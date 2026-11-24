import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../src/core/rng";
import { defaultSettings, LAYER_IDS, type LayerId, type Settings } from "../../src/core/settings";
import { createStore } from "../../src/core/store";
import { createAudioContext } from "../../src/app/audio/context";
import { createAudioEngine } from "../../src/app/audio/engine";
import { createSoundKit } from "../../src/app/audio/kit";
import { LAYER_FACTORIES } from "../../src/app/audio/layers";
import { rampTo } from "../../src/app/audio/ramp";
import { FakeContext, FakeNode, FakeParam } from "./fakes/audio";
import { testPower } from "./fakes/page";

/** Lets promise callbacks run, then moves the clock on. */
const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

const withLayers = (on: readonly LayerId[], over: Partial<Settings> = {}): Settings => {
  const base = defaultSettings();
  const layers = Object.fromEntries(
    LAYER_IDS.map((id) => [id, { on: on.includes(id), volume: 0.5 }]),
  ) as Settings["layers"];
  return { ...base, ...over, layers };
};

const setup = (settings: Settings = defaultSettings()) => {
  const contexts: FakeContext[] = [];
  /** What the next context made will do when asked to resume. */
  const next = { behaviour: "works" as FakeContext["resumeBehaviour"], broken: false };
  const store = createStore(settings);
  const { power, wait } = testPower();
  power.on();
  wait(5000);
  const onProblem = vi.fn();
  const engine = createAudioEngine({
    createContext: () => {
      if (next.broken) throw new Error("no audio here");
      const context = new FakeContext();
      context.resumeBehaviour = next.behaviour;
      contexts.push(context);
      return context.asContext();
    },
    store,
    power,
    rng: createRng(5),
    timers: window,
    onProblem,
  });
  const phases: string[] = [];
  engine.subscribe((phase) => phases.push(phase));
  const latest = (): FakeContext => {
    const context = contexts.at(-1);
    if (!context) throw new Error("no context was made");
    return context;
  };
  return { engine, store, power, wait, onProblem, contexts, next, phases, latest };
};

/** Lets the sound play for a while: the audio clock and the timers move on together. */
const play = async (context: FakeContext, seconds: number): Promise<void> => {
  for (let tick = 0; tick < seconds * 10; tick += 1) {
    context.currentTime += 0.1;
    await settle(100);
    context.finishOneShots();
  }
};

/** An engine whose sound is already playing. */
const running = async (settings?: Settings) => {
  const harness = setup(settings);
  harness.engine.touch();
  await settle();
  expect(harness.engine.phase()).toBe("running");
  return harness;
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("rampTo", () => {
  it("glides from where the level is now, never jumping", () => {
    const param = new FakeParam(0.3);
    rampTo(param as unknown as AudioParam, 0.8, 2);
    expect(param.log).toEqual(["cancel", "set", "target"]);
    expect(param.target).toBeCloseTo(0.8);
  });
});

describe("createAudioContext", () => {
  class Context {
    constructor(readonly options: AudioContextOptions) {}
  }

  it("marks the page's audio as playback, so the mute setting does not silence the wall", () => {
    const audioSession = { type: "auto" };
    const win = { navigator: { audioSession }, AudioContext: Context } as unknown as Window;
    expect(createAudioContext(win)).toBeInstanceOf(Context);
    expect(audioSession.type).toBe("playback");
  });

  it("uses the older prefixed context where that is all there is", () => {
    const win = { navigator: {}, webkitAudioContext: Context } as unknown as Window;
    expect(createAudioContext(win)).toBeInstanceOf(Context);
  });

  it("says so when the browser has no Web Audio", () => {
    expect(() => createAudioContext({ navigator: {} } as unknown as Window)).toThrow(/Web Audio/);
  });
});

describe("the audio engine follows the table", () => {
  it("None + first tap: starts, and runs once the context reports running", async () => {
    const { engine, contexts, phases } = setup();
    expect(engine.phase()).toBe("none");
    engine.touch();
    expect(contexts).toHaveLength(1);
    await settle();
    expect(phases).toEqual(["starting", "running"]);
  });

  it("makes no context until there is a touch", async () => {
    const { engine, contexts } = setup();
    engine.visible();
    engine.hidden();
    await settle(5000);
    expect(contexts).toHaveLength(0);
    expect(engine.phase()).toBe("none");
  });

  it("Starting: a slow first start is left alone and asked again on the next touch", async () => {
    const harness = setup();
    harness.next.behaviour = "hangs";
    harness.engine.touch();
    await settle(3000);
    expect(harness.engine.phase()).toBe("starting");
    expect(harness.contexts).toHaveLength(1);
    harness.latest().resumeBehaviour = "works";
    harness.engine.touch();
    await settle();
    expect(harness.engine.phase()).toBe("running");
    expect(harness.latest().resumeCalls).toBe(2);
  });

  it.each(["interrupted", "suspended"] as const)(
    "Running + the context is %s: suspended",
    async (state) => {
      const { engine, latest } = await running();
      latest().setState(state);
      expect(engine.phase()).toBe("suspended");
    },
  );

  it("Running + app hidden: suspended, and the context is told to stop playing", async () => {
    const { engine, latest } = await running();
    engine.hidden();
    expect(engine.phase()).toBe("suspended");
    expect(latest().suspendCalls).toBe(1);
  });

  it.each(["visible", "touch"] as const)(
    "Suspended + %s: resumes, and runs when the context does within a second",
    async (event) => {
      const { engine, latest, phases } = await running();
      latest().setState("interrupted");
      phases.length = 0;
      if (event === "visible") engine.visible();
      else engine.touch();
      await settle();
      expect(phases).toEqual(["resuming", "running"]);
      expect(latest().resumeCalls).toBe(2);
    },
  );

  it("Resuming + not running after a second: throws the context away, rebuilds on a touch", async () => {
    const { engine, contexts, latest, next } = await running();
    const first = latest();
    first.setState("interrupted");
    first.resumeBehaviour = "hangs";
    engine.visible();
    await settle(999);
    expect(engine.phase()).toBe("resuming");
    await settle(1);
    expect(engine.phase()).toBe("rebuilding");
    expect(first.state).toBe("closed");
    expect(first.playingLoops).toHaveLength(0);

    engine.visible();
    await settle(2000);
    expect(contexts).toHaveLength(1);

    next.behaviour = "works";
    engine.touch();
    await settle();
    expect(contexts).toHaveLength(2);
    expect(engine.phase()).toBe("running");
    expect(latest().playingLoops.length).toBeGreaterThan(0);
  });

  it("ignores anything a thrown-away context says later", async () => {
    const { engine, latest } = await running();
    const first = latest();
    first.setState("interrupted");
    first.resumeBehaviour = "hangs";
    engine.visible();
    await settle(1000);
    first.setState("running");
    expect(engine.phase()).toBe("rebuilding");
  });

  it("a context that cannot be made: silent, logged, and tried again on a touch", async () => {
    const harness = setup();
    harness.next.broken = true;
    harness.engine.touch();
    expect(harness.engine.phase()).toBe("silent");
    expect(harness.onProblem).toHaveBeenCalledWith(
      expect.stringMatching(/could not start.*no audio/),
    );
    harness.next.broken = false;
    harness.engine.touch();
    await settle();
    expect(harness.engine.phase()).toBe("running");
  });

  it("a resume that is refused: silent, logged, and the context is thrown away", async () => {
    const harness = setup();
    harness.next.behaviour = "refuses";
    harness.engine.touch();
    await settle();
    expect(harness.engine.phase()).toBe("silent");
    expect(harness.latest().state).toBe("closed");
    expect(harness.onProblem).toHaveBeenCalledWith(expect.stringMatching(/could not resume/));
  });

  it("stops telling a listener that unsubscribed", async () => {
    const { engine } = setup();
    const listener = vi.fn();
    engine.subscribe(listener)();
    engine.touch();
    await settle();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("the mix", () => {
  const channel = (context: FakeContext, id: LayerId): FakeNode => {
    const found = context.channels.at(LAYER_IDS.indexOf(id));
    if (!found) throw new Error(`no channel for ${id}`);
    return found;
  };

  it("plays bubbles and motor hum by default, through one level and a limiter", async () => {
    const { latest } = await running();
    const context = latest();
    expect(context.channels).toHaveLength(8);
    expect(context.ofKind("limiter").at(0)?.outputs).toContain(context.destination);
    expect(channel(context, "bubbles").gain.target).toBeCloseTo(0.64);
    expect(channel(context, "motor").gain.target).toBeCloseTo(0.2025);
    expect(channel(context, "rain").gain.target).toBe(0);
    expect(context.playingLoops.length).toBeGreaterThan(5);
  });

  it("is silent before it runs and reaches the volume once running", async () => {
    const { latest } = await running(withLayers([], { masterVolume: 0.5, volumeCap: 1 }));
    expect(latest().master.gain.target).toBeCloseTo(0.25);
  });

  it("never plays louder than the grown-up cap", async () => {
    const { latest, store } = await running(withLayers([], { masterVolume: 1, volumeCap: 0.5 }));
    expect(latest().master.gain.target).toBeCloseTo(0.25);
    store.update((s) => ({ ...s, volumeCap: 0.2 }));
    expect(latest().master.gain.target).toBeCloseTo(0.04);
  });

  it("fades out with the lights when the wall is switched off", async () => {
    const { latest, power, wait } = await running(
      withLayers([], { masterVolume: 1, volumeCap: 1 }),
    );
    power.off();
    wait(1000);
    await settle(100);
    expect(latest().master.gain.target).toBeCloseTo(0.5);
    wait(1000);
    await settle(100);
    expect(latest().master.gain.target).toBe(0);
  });

  it("starts a layer when it is switched on, with a glide rather than a jump", async () => {
    const { latest, store } = await running(withLayers([]));
    const context = latest();
    expect(context.playingLoops).toHaveLength(0);
    store.update((s) => ({ ...s, layers: { ...s.layers, ocean: { on: true, volume: 1 } } }));
    expect(context.playingLoops.length).toBeGreaterThan(0);
    expect(channel(context, "ocean").gain.log.slice(-3)).toEqual(["cancel", "set", "target"]);
    expect(channel(context, "ocean").gain.target).toBe(1);
  });

  it("fades a layer out, then stops it once the fade is over", async () => {
    const { latest, store } = await running(withLayers(["motor"]));
    const context = latest();
    const before = context.playingLoops.length;
    expect(before).toBeGreaterThan(0);
    store.update((s) => ({ ...s, layers: { ...s.layers, motor: { on: false, volume: 0.5 } } }));
    expect(channel(context, "motor").gain.target).toBe(0);
    expect(context.playingLoops).toHaveLength(before);
    await settle(1500);
    expect(context.playingLoops).toHaveLength(0);
  });

  it("keeps a layer playing when it is switched back on before its fade ends", async () => {
    const { latest, store } = await running(withLayers(["motor"]));
    const context = latest();
    const before = context.playingLoops.length;
    const set = (on: boolean): void => {
      store.update((s) => ({ ...s, layers: { ...s.layers, motor: { on, volume: 0.5 } } }));
    };
    set(false);
    await settle(1000);
    set(true);
    await settle(5000);
    expect(context.playingLoops).toHaveLength(before);
  });

  it("does not restart layers that are already playing when something else changes", async () => {
    const { latest, store } = await running(withLayers(["motor", "deep"]));
    const made = latest().nodes.length;
    store.update((s) => ({ ...s, brightness: 2 }));
    store.update((s) => ({ ...s, masterVolume: 0.2 }));
    expect(latest().nodes).toHaveLength(made);
  });

  it.each(LAYER_IDS)("the %s layer builds, plays and stops cleanly", async (id) => {
    const { latest, store } = await running(withLayers([id]));
    const context = latest();
    await play(context, 20);
    const sounding = context.playingLoops.length + context.oneShots.length;
    expect(sounding).toBeGreaterThan(0);
    store.update((s) => ({ ...s, layers: { ...s.layers, [id]: { on: false, volume: 0.5 } } }));
    await settle(1500);
    expect(context.playingLoops).toHaveLength(0);
  });

  it("has a factory for every layer", () => {
    expect([...LAYER_FACTORIES.keys()]).toEqual([...LAYER_IDS]);
  });
});

describe("the layers that follow settings", () => {
  const scheduled = async (settings: Settings): Promise<FakeContext> => {
    const { latest } = await running(settings);
    await play(latest(), 3);
    return latest();
  };

  it("bubble sounds come faster at a faster bubble speed", async () => {
    const slow = await scheduled(withLayers(["bubbles"], { bubbleSpeed: 1 }));
    const fast = await scheduled(withLayers(["bubbles"], { bubbleSpeed: 5 }));
    expect(slow.oneShots.length).toBeGreaterThan(5);
    expect(fast.oneShots.length).toBeGreaterThan(slow.oneShots.length);
  });

  it("bubble sounds stop when the pump is off, and start again with it", async () => {
    const { latest, store } = await running(withLayers(["bubbles"], { bubblesOn: false }));
    const context = latest();
    await play(context, 1);
    expect(context.oneShots).toHaveLength(0);
    store.update((s) => ({ ...s, bubblesOn: true }));
    await play(context, 1);
    expect(context.oneShots.length).toBeGreaterThan(0);
  });

  it("every one-shot is placed ahead of the clock, never in the past", async () => {
    const context = await scheduled(withLayers(["bubbles", "rain", "chimes"]));
    expect(context.oneShots.length).toBeGreaterThan(10);
    for (const shot of context.oneShots) expect(shot.startedAt).toBeGreaterThanOrEqual(0);
  });

  it("changing the kind of noise swaps the loop for the new one", async () => {
    const { latest, store } = await running(withLayers(["noise"], { noiseColor: "brown" }));
    const context = latest();
    const [first] = context.playingLoops;
    expect(context.playingLoops).toHaveLength(1);
    store.update((s) => ({ ...s, noiseColor: "white" }));
    expect(first?.playing).toBe(false);
    expect(context.playingLoops).toHaveLength(1);
    expect(context.playingLoops.at(0)?.buffer).not.toBe(first?.buffer);
    store.update((s) => ({ ...s, brightness: 1 }));
    expect(context.playingLoops).toHaveLength(1);
  });
});

describe("the sound kit", () => {
  const kitOn = (context: FakeContext) => createSoundKit(context.asContext(), createRng(1), window);

  it("makes each colour of noise once and reuses it", () => {
    const kit = kitOn(new FakeContext());
    expect(kit.noise("pink")).toBe(kit.noise("pink"));
    expect(kit.noise("pink")).not.toBe(kit.noise("brown"));
    expect(kit.noise("white")).toHaveLength(8000);
  });

  it("plays at most twelve one-shots at once and drops the rest", () => {
    const context = new FakeContext();
    const kit = kitOn(context);
    const shot = { buffer: kit.drop, at: 0, rate: 1, gain: 0.1, pan: 0, to: context.destination };
    for (let n = 0; n < 20; n += 1) kit.playOnce(shot as never);
    expect(context.oneShots).toHaveLength(12);

    context.oneShots.at(0)?.finish();
    kit.playOnce(shot as never);
    kit.playOnce(shot as never);
    expect(context.oneShots).toHaveLength(13);
  });

  it("counts chime tones against the same limit", () => {
    const context = new FakeContext();
    const kit = kitOn(context);
    const tone = { hz: 440, at: 1, seconds: 2, gain: 0.2, pan: 0, to: context.destination };
    for (let n = 0; n < 20; n += 1) kit.playTone(tone as never);
    const tones = context.ofKind("oscillator").filter((node) => node.startedAt !== null);
    expect(tones).toHaveLength(12);
    expect(tones.at(0)?.stoppedAt).toBe(3);
  });

  it("sets a one-shot's pitch, level and position", () => {
    const context = new FakeContext();
    const kit = kitOn(context);
    kit.playOnce({
      buffer: kit.drop,
      at: 4,
      rate: 1.5,
      gain: 0.2,
      pan: -0.5,
      to: context.destination as never,
    });
    const [source] = context.ofKind("source");
    expect(source?.startedAt).toBe(4);
    expect(source?.playbackRate.value).toBe(1.5);
    expect(context.ofKind("panner").at(0)?.pan.value).toBe(-0.5);
    expect(context.ofKind("gain").at(0)?.gain.value).toBeCloseTo(0.2);
  });
});
