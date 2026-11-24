/**
 * Keeps the wall smooth on a slow device: when frames take too long, fewer bubbles
 * are allowed; when there is time to spare, they come back.
 */
import { clamp } from "./util";

export const MAX_BUBBLES = 320;
const MIN_BUBBLES = 60;
/** A frame at 60 a second takes 16.7 ms. Slower than this for a while means trouble. */
const SLOW_FRAME_MS = 21;
const EASY_FRAME_MS = 17.5;
const SMOOTHING = 0.05;

export interface Quality {
  /** The most bubbles allowed at once. */
  readonly limit: number;
  /** Running average of how long a frame takes, in milliseconds. */
  readonly averageMs: number;
  /** Frames since the limit last changed, so it is not changed again straight away. */
  readonly settled: number;
}

export function initialQuality(): Quality {
  return { limit: MAX_BUBBLES, averageMs: 16.7, settled: 0 };
}

const SETTLE_FRAMES = 90;

export function nextQuality(quality: Quality, frameMs: number): Quality {
  const averageMs = quality.averageMs + (frameMs - quality.averageMs) * SMOOTHING;
  const settled = quality.settled + 1;
  if (settled < SETTLE_FRAMES) return { ...quality, averageMs, settled };
  if (averageMs > SLOW_FRAME_MS && quality.limit > MIN_BUBBLES) {
    return {
      limit: clamp(Math.round(quality.limit * 0.8), MIN_BUBBLES, MAX_BUBBLES),
      averageMs,
      settled: 0,
    };
  }
  if (averageMs < EASY_FRAME_MS && quality.limit < MAX_BUBBLES) {
    return { limit: clamp(quality.limit + 20, MIN_BUBBLES, MAX_BUBBLES), averageMs, settled: 0 };
  }
  return { ...quality, averageMs, settled };
}
