/**
 * The audio engine. It follows the table in core/audioLifecycle.ts: it creates the
 * audio context on a touch, tries to resume it when the iPad lets go of it, and
 * throws it away and starts again when a resume does not work. The wall never
 * waits on any of it.
 */
import {
  audioStep,
  RESUME_TIMEOUT_MS,
  type AudioCommand,
  type AudioEvent,
  type AudioPhase,
} from "../../core/audioLifecycle";
import { layerGains, masterGain } from "../../core/mix";
import type { Rng } from "../../core/rng";
import { LAYER_IDS, type LayerId, type Settings } from "../../core/settings";
import type { Store } from "../../core/store";
import { createEmitter } from "../../core/util";
import type { PowerControl } from "../power";
import { createSoundKit, type SoundKit, type Timers } from "./kit";
import { LAYER_FACTORIES, type Layer } from "./layers";
import { rampTo } from "./ramp";

/** How often the overall level follows the power fade and the volume. */
const LEVEL_MS = 100;
const LAYER_FADE_SECONDS = 0.9;
/** A layer that was switched off is stopped once its fade has finished. */
const LAYER_STOP_MS = 1500;

export interface AudioDeps {
  /** Makes a new audio context. Only ever called from inside a touch. */
  readonly createContext: () => AudioContext;
  readonly store: Store;
  readonly power: PowerControl;
  readonly rng: Rng;
  readonly timers: Timers;
  readonly onProblem: (message: string) => void;
}

export interface AudioEngine {
  /** Any touch on the screen. */
  readonly touch: () => void;
  readonly hidden: () => void;
  readonly visible: () => void;
  readonly phase: () => AudioPhase;
  /** Hears every change of phase. */
  readonly subscribe: (listener: (phase: AudioPhase) => void) => () => void;
}

interface Channel {
  readonly gain: GainNode;
  layer: Layer | null;
  stopTimer: number | undefined;
}

/** One audio context and everything hanging off it. */
interface Graph {
  readonly ctx: AudioContext;
  readonly kit: SoundKit;
  readonly master: GainNode;
  readonly channels: ReadonlyMap<LayerId, Channel>;
}

function buildGraph(ctx: AudioContext, rng: Rng, timers: Timers): Graph {
  // Everything passes through one level and then a limiter, so no mix of layers
  // can ever come out louder than the grown-up cap allows.
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  const channels = new Map<LayerId, Channel>();
  for (const id of LAYER_IDS) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    channels.set(id, { gain, layer: null, stopTimer: undefined });
  }
  return { ctx, kit: createSoundKit(ctx, rng, timers), master, channels };
}

/** Starts, fades and stops layers to match the settings. */
function syncLayers(graph: Graph, settings: Settings, timers: Timers): void {
  for (const [id, target] of layerGains(settings)) {
    const channel = graph.channels.get(id);
    if (!channel) continue;
    timers.clearTimeout(channel.stopTimer);
    if (target > 0) {
      channel.layer ??= LAYER_FACTORIES.get(id)?.(graph.kit, channel.gain, settings) ?? null;
    } else if (channel.layer) {
      channel.stopTimer = timers.setTimeout(() => {
        channel.layer?.stop();
        channel.layer = null;
      }, LAYER_STOP_MS);
    }
    channel.layer?.update(settings);
    rampTo(channel.gain.gain, target, graph.ctx.currentTime, LAYER_FADE_SECONDS);
  }
}

/** Builds a graph on a new context and reports every change of that context's state. */
function openGraph(deps: AudioDeps, onState: (graph: Graph, running: boolean) => void): Graph {
  const ctx = deps.createContext();
  const graph = buildGraph(ctx, deps.rng, deps.timers);
  ctx.addEventListener("statechange", () => {
    onState(graph, ctx.state === "running");
  });
  return graph;
}

function setMasterLevel(graph: Graph, level: number): void {
  rampTo(graph.master.gain, level, graph.ctx.currentTime, 0.2);
}

function closeGraph(graph: Graph, timers: Timers): void {
  for (const channel of graph.channels.values()) {
    timers.clearTimeout(channel.stopTimer);
    channel.layer?.stop();
  }
  graph.ctx.close().catch(() => undefined);
}

/** Asks a context to resume and reports back: with nothing when it did, with the error when not. */
function whenResumed(ctx: AudioContext, done: (error?: unknown) => void): void {
  ctx.resume().then(
    () => {
      done();
    },
    (error: unknown) => {
      done(error ?? new Error("resume was refused"));
    },
  );
}

export function createAudioEngine(deps: AudioDeps): AudioEngine {
  const { store, timers } = deps;
  const phases = createEmitter<AudioPhase>();
  let phase: AudioPhase = "none";
  let graph: Graph | null = null;
  let resumeTimer: number | undefined;

  /** The overall level follows the volume and the power fade. */
  const setLevel = (): void => {
    if (graph) setMasterLevel(graph, masterGain(store.get(), deps.power.level()));
  };
  const sync = (): void => {
    if (graph) syncLayers(graph, store.get(), timers);
    setLevel();
  };
  const discard = (): void => {
    timers.clearTimeout(resumeTimer);
    if (graph) closeGraph(graph, timers);
    graph = null;
  };
  const fail = (what: string, error: unknown): void => {
    deps.onProblem(`Sound: ${what}: ${String(error)}`);
    dispatch("failed");
  };
  const resume = (): void => {
    const current = graph;
    if (!current) return;
    timers.clearTimeout(resumeTimer);
    resumeTimer = timers.setTimeout(() => {
      dispatch("timeout");
    }, RESUME_TIMEOUT_MS);
    whenResumed(current.ctx, (error) => {
      if (graph !== current) return;
      if (error !== undefined) fail("could not resume", error);
      else if (current.ctx.state === "running") dispatch("running");
    });
  };
  const create = (): void => {
    try {
      graph = openGraph(deps, (from, running) => {
        if (graph === from) dispatch(running ? "running" : "interrupted");
      });
      resume();
    } catch (error) {
      fail("could not start", error);
    }
  };
  const commands: ReadonlyMap<AudioCommand, () => void> = new Map([
    ["create", create],
    ["resume", resume],
    ["discard", discard],
  ]);

  function dispatch(event: AudioEvent): void {
    const step = audioStep(phase, event);
    const changed = step.phase !== phase;
    phase = step.phase;
    if (changed) {
      if (phase === "running") {
        timers.clearTimeout(resumeTimer);
        sync();
      }
      phases.emit(phase);
    }
    // Announced first, then acted on: a context that answers at once must not make
    // listeners hear the next phase before this one.
    commands.get(step.command)?.();
  }

  store.subscribe(sync);
  // Sound and light go down together: the level is checked ten times a second.
  timers.setInterval(setLevel, LEVEL_MS);

  const on = (event: AudioEvent) => (): void => {
    dispatch(event);
  };
  return {
    touch: on("touch"),
    hidden: () => {
      dispatch("hidden");
      // Stop playing while the app is in the background.
      graph?.ctx.suspend().catch(() => undefined);
    },
    visible: on("visible"),
    phase: () => phase,
    subscribe: phases.subscribe,
  };
}
