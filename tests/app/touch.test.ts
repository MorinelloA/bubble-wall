import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRng } from "../../src/core/rng";
import { defaultSettings, type Settings } from "../../src/core/settings";
import { createStore } from "../../src/core/store";
import type { TouchSound } from "../../src/core/touchForces";
import { createAudioEngine } from "../../src/app/audio/engine";
import { blockGestures } from "../../src/app/platform/device";
import { createWallPanel } from "../../src/app/ui/wallpanel";
import { watchPointers } from "../../src/app/wall/pointer";
import { FakeContext } from "./fakes/audio";
import { buttonNamed, isPressed, testPower } from "./fakes/page";

describe("watchPointers", () => {
  const setup = () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 100, top: 50, width: 800, height: 600 }) as DOMRect;
    const send = (type: string, pointerId: number, clientX: number, clientY: number): Event => {
      const event = new MouseEvent(type, { clientX, clientY, cancelable: true });
      Object.defineProperty(event, "pointerId", { value: pointerId });
      canvas.dispatchEvent(event);
      return event;
    };
    return { feed: watchPointers(canvas), send };
  };

  it("turns a touch into wall units, measured from the wall's own corner", () => {
    const { feed, send } = setup();
    send("pointerdown", 7, 400, 350);
    expect(feed.drain()).toEqual([{ type: "down", id: 7, x: 0.5, y: 0.5 }]);
  });

  it("hands over each touch once, in order", () => {
    const { feed, send } = setup();
    send("pointerdown", 1, 100, 50);
    send("pointermove", 1, 400, 50);
    send("pointerup", 1, 400, 50);
    expect(feed.drain().map((event) => event.type)).toEqual(["down", "move", "up"]);
    expect(feed.drain()).toEqual([]);
  });

  it("follows only fingers that went down on the wall", () => {
    const { feed, send } = setup();
    send("pointermove", 3, 200, 200);
    send("pointerup", 3, 200, 200);
    expect(feed.drain()).toEqual([]);
    send("pointerdown", 3, 200, 200);
    send("pointercancel", 3, 200, 200);
    send("pointermove", 3, 300, 300);
    expect(feed.drain().map((event) => event.type)).toEqual(["down", "cancel"]);
  });

  it("stops the browser's own handling of the touch", () => {
    const { send } = setup();
    expect(send("pointerdown", 1, 0, 0).defaultPrevented).toBe(true);
    expect(send("pointermove", 1, 5, 5).defaultPrevented).toBe(true);
  });

  it("keeps at most 256 touches waiting, dropping the oldest", () => {
    const { feed, send } = setup();
    send("pointerdown", 1, 100, 50);
    for (let n = 1; n <= 400; n += 1) send("pointermove", 1, 100 + n, 50);
    const waiting = feed.drain();
    expect(waiting).toHaveLength(256);
    expect(waiting.at(-1)?.x).toBeCloseTo(400 / 600);
    expect(waiting.at(0)?.type).toBe("move");
  });
});

describe("blockGestures", () => {
  it.each(["gesturestart", "gesturechange", "gestureend", "contextmenu"])(
    "cancels %s, so the page cannot be pinched or long-pressed",
    (type) => {
      blockGestures(document);
      const event = new Event(type, { cancelable: true, bubbles: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it("leaves ordinary taps alone", () => {
    blockGestures(document);
    const event = new Event("click", { cancelable: true, bubbles: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("touch sounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = async (over: Partial<Settings> = {}, start = true) => {
    const context = new FakeContext();
    const silentLayers = Object.fromEntries(
      Object.keys(defaultSettings().layers).map((id) => [id, { on: false, volume: 0.5 }]),
    ) as Settings["layers"];
    const { power } = testPower();
    const engine = createAudioEngine({
      createContext: () => context.asContext(),
      store: createStore({ ...defaultSettings(), layers: silentLayers, ...over }),
      power,
      rng: createRng(1),
      timers: window,
      onProblem: vi.fn(),
    });
    if (start) {
      engine.touch();
      await vi.advanceTimersByTimeAsync(0);
    }
    return { engine, context };
  };
  const sound = (kind: TouchSound["kind"], pitch = 0.5): TouchSound => ({ kind, pitch, pan: -0.4 });

  it("a plip is one quiet, low drop", async () => {
    const { engine, context } = await setup();
    engine.play(sound("plip"));
    expect(context.oneShots).toHaveLength(1);
    expect(context.ofKind("panner").at(-1)?.pan.value).toBeCloseTo(-0.4);
    expect(context.oneShots.at(0)?.outputs.at(0)).toMatchObject({ kind: "gain" });
  });

  it("a bloop is higher the higher up the wall the touch is", async () => {
    const low = await setup();
    low.engine.play(sound("bloop", 0));
    const high = await setup();
    high.engine.play(sound("bloop", 1));
    const length = (shot: (typeof low.context.oneShots)[number] | undefined): number =>
      shot?.buffer?.length ?? 0;
    expect(length(high.context.oneShots.at(0))).toBeLessThan(length(low.context.oneShots.at(0)));
  });

  it("a pop is a bloop and a snap together", async () => {
    const { engine, context } = await setup();
    engine.play(sound("pop"));
    expect(context.oneShots).toHaveLength(2);
  });

  it("makes no sound when touch sounds are switched off", async () => {
    const { engine, context } = await setup({ touchSounds: false });
    engine.play(sound("bloop"));
    expect(context.oneShots).toHaveLength(0);
  });

  it("makes no sound before sound has started", async () => {
    const { engine, context } = await setup({}, false);
    engine.play(sound("bloop"));
    expect(context.nodes).toHaveLength(0);
  });
});

describe("touch and floater controls in the Wall tab", () => {
  const setup = (over: Partial<Settings> = {}) => {
    const store = createStore({ ...defaultSettings(), ...over });
    return { store, panel: createWallPanel(document, store) };
  };

  it.each([
    ["Calm", { feel: "play" }, { feel: "calm" }],
    ["Play", { feel: "calm" }, { feel: "play" }],
    ["Touch sounds", { touchSounds: true }, { touchSounds: false }],
    ["Fish", { floaters: "none" }, { floaters: "fish" }],
    ["Balls", { floaters: "none" }, { floaters: "balls" }],
    ["Stars", { floaters: "none" }, { floaters: "stars" }],
    ["No floaters", { floaters: "fish" }, { floaters: "none" }],
  ] as const)("%s changes its setting", (label, before, after) => {
    const { store, panel } = setup(before);
    buttonNamed(panel, label).click();
    expect(store.get()).toMatchObject(after);
    expect(isPressed(buttonNamed(panel, label))).toBe(label !== "Touch sounds");
  });

  it("starts in Calm with no floaters", () => {
    const { panel } = setup();
    expect(isPressed(buttonNamed(panel, "Calm"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Play"))).toBe(false);
    expect(isPressed(buttonNamed(panel, "No floaters"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Touch sounds"))).toBe(true);
  });
});
