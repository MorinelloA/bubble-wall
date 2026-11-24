import { describe, expect, it } from "vitest";
import {
  activeCount,
  createField,
  refitField,
  riseSpeed,
  stepField,
  type BubbleField,
  type StepInput,
} from "../../src/core/bubbles";
import { tubesFor } from "../../src/core/layout";
import { createRng } from "../../src/core/rng";

const WALL_WIDTH = 4 / 3;
const FRAME = 1 / 60;

const input = (over: Partial<StepInput> = {}): StepInput => ({
  dt: FRAME,
  tubes: tubesFor("tubes6", WALL_WIDTH),
  pumpOn: true,
  speed: 3,
  limit: 320,
  forces: [],
  rng: createRng(11),
  ...over,
});

const run = (field: BubbleField, steps: number, stepInput: StepInput): void => {
  for (let n = 0; n < steps; n += 1) stepField(field, stepInput);
};

const active = (field: BubbleField) => field.pool.filter((bubble) => bubble.active);

describe("the pool", () => {
  it("is made once and never grows", () => {
    const field = createField(320);
    const pool = field.pool;
    run(field, 3000, input({ speed: 5 }));
    expect(field.pool).toBe(pool);
    expect(field.pool).toHaveLength(320);
  });

  it("stops spawning when every bubble is in use", () => {
    const field = createField(10);
    run(field, 600, input());
    expect(activeCount(field)).toBeLessThanOrEqual(10);
    expect(activeCount(field)).toBeGreaterThan(0);
  });

  it("never holds more bubbles than the limit", () => {
    const field = createField(320);
    const stepInput = input({ limit: 40, speed: 5 });
    let most = 0;
    for (let n = 0; n < 1500; n += 1) {
      stepField(field, stepInput);
      most = Math.max(most, activeCount(field));
    }
    expect(most).toBe(40);
  });
});

describe("sharing bubbles between tubes", () => {
  const perTube = (field: BubbleField, tubes: number): number[] =>
    Array.from(
      { length: tubes },
      (_, index) => active(field).filter((bubble) => bubble.tube === index).length,
    );

  it.each([60, 120, 320])(
    "gives every tube its share when only %s bubbles are allowed",
    (limit) => {
      const field = createField(320);
      run(field, 60 * 40, input({ limit }));
      const counts = perTube(field, 6);
      expect(Math.min(...counts)).toBeGreaterThan(0);
      expect(Math.max(...counts)).toBeLessThanOrEqual(Math.ceil(limit / 6));
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(limit / 6 / 2);
    },
  );

  it("still never goes over the limit when the shares round up", () => {
    const field = createField(320);
    const stepInput = input({ limit: 61, speed: 5 });
    let most = 0;
    for (let n = 0; n < 1500; n += 1) {
      stepField(field, stepInput);
      most = Math.max(most, activeCount(field));
    }
    expect(most).toBeLessThanOrEqual(61);
  });
});

describe("rising", () => {
  it.each([1, 2, 3, 4, 5])("keeps every bubble inside its tube at speed %s", (speed) => {
    const field = createField(320);
    const stepInput = input({ speed });
    let worstOvershoot = 0;
    let strays = 0;
    for (let n = 0; n < 2000; n += 1) {
      stepField(field, stepInput);
      for (const bubble of active(field)) {
        const tube = stepInput.tubes.at(bubble.tube);
        if (!tube) strays += 1;
        const left = (tube?.x0 ?? 0) + bubble.radius - bubble.x;
        const right = bubble.x - ((tube?.x1 ?? 0) - bubble.radius);
        worstOvershoot = Math.max(worstOvershoot, left, right);
      }
    }
    expect(strays).toBe(0);
    expect(worstOvershoot).toBeLessThanOrEqual(1e-9);
    expect(activeCount(field)).toBeGreaterThan(20);
  });

  it("starts bubbles below the wall and moves them up", () => {
    const field = createField(50);
    stepField(field, input({ dt: 0.2 }));
    const bubble = active(field).at(0);
    expect(bubble).toBeDefined();
    const startY = bubble?.y ?? 0;
    expect(startY).toBeGreaterThan(0.9);
    run(field, 30, input());
    expect(bubble?.y).toBeLessThan(startY);
  });

  it("lets a bubble go once it is past the top", () => {
    const field = createField(50);
    stepField(field, input({ dt: 0.2 }));
    const born = activeCount(field);
    expect(born).toBeGreaterThan(0);
    run(field, 60 * 30, input({ pumpOn: false }));
    expect(activeCount(field)).toBe(0);
  });

  it("rises faster at each bubble-speed step", () => {
    const speeds = [1, 2, 3, 4, 5].map(riseSpeed);
    expect([...speeds].sort((a, b) => a - b)).toEqual(speeds);
    expect(new Set(speeds).size).toBe(5);
    expect(riseSpeed(0)).toBe(riseSpeed(1));
    expect(riseSpeed(9)).toBe(riseSpeed(5));
  });

  it("fills a tube to about the same number of bubbles at any speed", () => {
    const counts = [1, 5].map((speed) => {
      const field = createField(320);
      run(field, 60 * 40, input({ speed, rng: createRng(5) }));
      return activeCount(field);
    });
    const [slow = 0, fast = 0] = counts;
    expect(Math.abs(slow - fast)).toBeLessThan(slow * 0.5);
  });

  it("is repeatable for the same seed", () => {
    const a = createField(100);
    const b = createField(100);
    run(a, 500, input({ rng: createRng(3) }));
    run(b, 500, input({ rng: createRng(3) }));
    expect(a.pool).toEqual(b.pool);
  });
});

describe("the pump", () => {
  it("lets no new bubbles in while it is off", () => {
    const field = createField(100);
    run(field, 600, input({ pumpOn: false }));
    expect(activeCount(field)).toBe(0);
  });

  it("lets the bubbles already in the tubes float out", () => {
    const field = createField(320);
    run(field, 600, input());
    const before = activeCount(field);
    run(field, 120, input({ pumpOn: false }));
    const during = activeCount(field);
    expect(during).toBeLessThan(before);
    expect(during).toBeGreaterThan(0);
  });
});

describe("changing the layout", () => {
  it("moves each bubble to the tube it now sits in and drops those on the frame", () => {
    const field = createField(320);
    run(field, 900, input());
    const wide = tubesFor("tubes3", WALL_WIDTH);
    refitField(field, wide);
    for (const bubble of active(field)) {
      const tube = wide.at(bubble.tube);
      expect(tube).toBeDefined();
      expect(bubble.x).toBeGreaterThanOrEqual(tube?.x0 ?? 0);
      expect(bubble.x).toBeLessThanOrEqual(tube?.x1 ?? 0);
    }
    run(field, 300, input({ tubes: wide }));
    expect(activeCount(field)).toBeGreaterThan(0);
  });

  it("shrinks bubbles that are too big for a narrower tube", () => {
    const field = createField(320);
    run(field, 900, input({ tubes: tubesFor("open", WALL_WIDTH) }));
    const narrow = tubesFor("tubes6", 0.3);
    refitField(field, narrow);
    for (const bubble of active(field)) {
      const tube = narrow.at(bubble.tube);
      expect(bubble.radius).toBeLessThanOrEqual(((tube?.x1 ?? 0) - (tube?.x0 ?? 0)) / 2 + 1e-9);
    }
  });

  it("drops a bubble whose tube no longer exists", () => {
    const field = createField(320);
    run(field, 900, input());
    stepField(field, input({ tubes: tubesFor("open", WALL_WIDTH), pumpOn: false }));
    expect(active(field).every((bubble) => bubble.tube === 0)).toBe(true);
  });

  it("copes with a tube too narrow for any bubble", () => {
    const field = createField(50);
    run(field, 300, input({ tubes: [{ x0: 0.5, x1: 0.5 }] }));
    for (const bubble of active(field)) {
      expect(bubble.x).toBe(0.5);
      expect(Number.isFinite(bubble.y)).toBe(true);
    }
  });
});
