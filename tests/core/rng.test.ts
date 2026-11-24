import { describe, expect, it } from "vitest";
import { createRng } from "../../src/core/rng";

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(first);
  });

  it("gives a different sequence for a different seed", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("stays inside 0 to 1", () => {
    const rng = createRng(7);
    const values = Array.from({ length: 500 }, () => rng.next());
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("stays inside the asked range", () => {
    const rng = createRng(9);
    const values = Array.from({ length: 500 }, () => rng.range(-2, 3));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-2);
    expect(Math.max(...values)).toBeLessThan(3);
  });
});
