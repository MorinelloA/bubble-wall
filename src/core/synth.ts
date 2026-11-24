/**
 * Sound, as numbers. Every sound in the app is made here from maths: there are no
 * audio files. These functions fill sample arrays; src/app plays them.
 */
import type { Rng } from "./rng";
import type { NoiseColor } from "./settings";
import { smoothstep } from "./util";

type Sampler = () => number;

function whiteSampler(rng: Rng): Sampler {
  return () => rng.next() * 2 - 1;
}

/** Pink noise (equal energy per octave), by Paul Kellet's filter. */
function pinkSampler(rng: Rng): Sampler {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  return () => {
    const white = rng.next() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    return (b0 + b1 + b2 + white * 0.1848) * 0.2;
  };
}

/** Brown noise (deep, like a waterfall far away): white noise that wanders. */
function brownSampler(rng: Rng): Sampler {
  let last = 0;
  return () => {
    last = (last + 0.02 * (rng.next() * 2 - 1)) / 1.02;
    return last * 3.5;
  };
}

function samplerFor(color: NoiseColor, rng: Rng): Sampler {
  if (color === "white") return whiteSampler(rng);
  return color === "pink" ? pinkSampler(rng) : brownSampler(rng);
}

/**
 * Noise that can loop for ever with no click: the end is blended into the start
 * over `blend` samples.
 */
export function noiseLoop(
  color: NoiseColor,
  length: number,
  blend: number,
  rng: Rng,
): Float32Array {
  const sample = samplerFor(color, rng);
  const overlap = Math.min(blend, length);
  const raw = Float32Array.from({ length: length + overlap }, sample);
  return Float32Array.from({ length }, (_, index) => {
    const own = raw.at(index) ?? 0;
    if (index >= overlap) return own;
    // Equal-power crossfade from the tail (which followed the end) into the head.
    const mix = index / overlap;
    const tail = raw.at(length + index) ?? 0;
    return own * Math.sqrt(mix) + tail * Math.sqrt(1 - mix);
  });
}

export interface BloopShape {
  readonly sampleRate: number;
  /** The pitch it starts at and the pitch it rises to, in hertz. */
  readonly fromHz: number;
  readonly toHz: number;
  readonly seconds: number;
}

/** One bubble: a short sine that rises in pitch and dies away, like air leaving water. */
export function bloop(shape: BloopShape): Float32Array {
  const length = Math.max(1, Math.round(shape.sampleRate * shape.seconds));
  const attack = Math.max(1, Math.round(shape.sampleRate * 0.004));
  let phase = 0;
  return Float32Array.from({ length }, (_, index) => {
    const progress = index / length;
    const hz = shape.fromHz * Math.pow(shape.toHz / shape.fromHz, progress);
    phase += (2 * Math.PI * hz) / shape.sampleRate;
    const fadeIn = smoothstep(index / attack);
    const fadeOut = Math.pow(1 - progress, 2.2);
    return Math.sin(phase) * fadeIn * fadeOut;
  });
}

/** The set of bubble sounds: small high ones to big low ones. */
export function bloopShapes(sampleRate: number): BloopShape[] {
  const pitches = [320, 420, 540, 680, 860, 1080, 1340, 1680];
  return pitches.map((fromHz) => ({
    sampleRate,
    fromHz,
    toHz: fromHz * 1.9,
    seconds: 0.03 + 22 / fromHz,
  }));
}

/** A raindrop: a very short, high tick. */
export function dropShape(sampleRate: number): BloopShape {
  return { sampleRate, fromHz: 2600, toHz: 1900, seconds: 0.018 };
}

/** Notes for the chimes: a pentatonic scale, so any two sound good together. */
export const CHIME_HZ: readonly number[] = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
