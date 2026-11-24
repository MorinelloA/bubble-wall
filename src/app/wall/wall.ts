/**
 * The running wall: owns the canvas, keeps time, and draws the scene each frame.
 * The browser pieces it needs (frames, the clock, the screen) are handed in.
 */
import { initialQuality, nextQuality } from "../../core/quality";
import { drawWall, type Size } from "./renderer";
import { createScene, type SceneDeps } from "./scene";
import type { Pen } from "./sprites";

/** The longest step the simulation will take, so a stall does not fling bubbles. */
const MAX_STEP_SECONDS = 0.05;
const MAX_PIXEL_RATIO = 2;
/** A broken frame is logged, but not sixty times a second. */
const PROBLEM_GAP_MS = 5000;

export interface WallDeps extends SceneDeps {
  readonly canvas: HTMLCanvasElement;
  readonly pen: Pen;
  readonly sprite: CanvasImageSource;
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
  const { canvas, pen } = deps;
  const scene = createScene(deps);
  let size: Size = { width: 1, height: 1 };
  let quality = initialQuality();
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
    scene.layout(size.width / size.height);
  };

  const tick = (): void => {
    handle = deps.requestFrame(tick);
    const now = deps.now();
    const elapsedMs = now - last;
    last = now;
    quality = nextQuality(quality, elapsedMs);
    try {
      const seconds = Math.min(MAX_STEP_SECONDS, Math.max(0, elapsedMs / 1000));
      drawWall(pen, size, scene.step(seconds, now, quality.limit), deps.sprite);
    } catch (error) {
      if (now - lastProblemAt >= PROBLEM_GAP_MS) {
        lastProblemAt = now;
        deps.onProblem(`Drawing failed: ${String(error)}`);
      }
    }
  };

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
