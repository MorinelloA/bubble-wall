/** Seeded random numbers, so every simulation and every test is repeatable. */
export interface Rng {
  /** A number from 0 (inclusive) to 1 (exclusive). */
  next(): number;
  /** A number from min (inclusive) to max (exclusive). */
  range(min: number, max: number): number;
}

/** mulberry32: small, fast and good enough for bubbles. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, range: (min, max) => min + (max - min) * next() };
}
