/**
 * The running wall: owns the canvas, keeps time, steps the simulation and draws.
 * The browser pieces it needs (frames, the clock, the screen) are handed in.
 */
import { createField, refitField, stepField } from "../../core/bubbles";
import { hexToRgb } from "../../core/color";
import { tubesFor, type Tube } from "../../core/layout";
import { tubeLights } from "../../core/lights";
import { colorHex } from "../../core/palette";
import { initialQuality, MAX_BUBBLES, nextQuality } from "../../core/quality";
import type { Rng } from "../../core/rng";
import type { Store } from "../../core/store";
import { drawWall, type Size } from "./renderer";
import type { Pen } from "./sprites";

/** The longest step the simulation will take, so a stall does not fling bubbles. */
const MAX_STEP_SECONDS = 0.05;
const MAX_PIXEL_RATIO = 2;
/** A broken frame is logged, but not sixty times a second. */
const PROBLEM_GAP_MS = 5000;

export interface WallDeps {
  readonly canvas: HTMLCanvasElement;
  readonly pen: Pen;
  readonly sprite: CanvasImageSource;
  readonly store: Store;
  readonly rng: Rng;
  /** Milliseconds, from a clock that only goes forward. */
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(handle: number): void;
  pixelRatio(): number;
  readonly onProblem: (message: string) => void;
}

export interface Wall {
  start(): void;
  stop(): void;
  /** Call when the screen changes size or turns. */
  resize(): void;
}

export function createWall(deps: WallDeps): Wall {
  const { canvas, pen, store } = deps;
  const field = createField(MAX_BUBBLES);
  let size: Size = { width: 1, height: 1 };
  let tubes: Tube[] = [];
  let quality = initialQuality();
  let lightTime = 0;
  let last = 0;
  let handle: number | undefined;
  let lastProblemAt = Number.NEGATIVE_INFINITY;

  const fit = (): void => {
    const ratio = Math.min(MAX_PIXEL_RATIO, Math.max(1, deps.pixelRatio()));
    size = {
      width: Math.max(1, Math.round(canvas.clientWidth * ratio)),
      height: Math.max(1, Math.round(canvas.clientHeight * ratio)),
    };
    canvas.width = size.width;
    canvas.height = size.height;
    tubes = tubesFor(store.get().layout, size.width / size.height);
    refitField(field, tubes);
  };

  const frame = (seconds: number): void => {
    const settings = store.get();
    if (!settings.paused) lightTime += seconds;
    stepField(field, {
      dt: seconds,
      tubes,
      pumpOn: settings.bubblesOn,
      speed: settings.bubbleSpeed,
      limit: quality.limit,
      rng: deps.rng,
    });
    const lights = tubeLights({
      mode: settings.mode,
      color: hexToRgb(colorHex(settings.colorId)),
      speed: settings.lightSpeed,
      brightness: settings.brightness,
      time: lightTime,
      tubes: tubes.length,
    });
    drawWall(pen, size, { tubes, lights, field, level: 1 }, deps.sprite);
  };

  const tick = (): void => {
    handle = deps.requestFrame(tick);
    const now = deps.now();
    const elapsedMs = now - last;
    last = now;
    quality = nextQuality(quality, elapsedMs);
    try {
      frame(Math.min(MAX_STEP_SECONDS, Math.max(0, elapsedMs / 1000)));
    } catch (error) {
      if (now - lastProblemAt >= PROBLEM_GAP_MS) {
        lastProblemAt = now;
        deps.onProblem(`Drawing failed: ${String(error)}`);
      }
    }
  };

  store.subscribe((next, previous) => {
    if (next.layout !== previous.layout) fit();
  });

  return {
    start() {
      if (handle !== undefined) return;
      last = deps.now();
      handle = deps.requestFrame(tick);
    },
    stop() {
      if (handle === undefined) return;
      deps.cancelFrame(handle);
      handle = undefined;
    },
    resize: fit,
  };
}
