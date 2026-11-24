import { describe, expect, it } from "vitest";
import { setFeel, setFloaters, toggleTouchSounds } from "../../src/core/actions";
import {
  activeCount,
  BIG_RADIUS,
  bigBubbleAt,
  burst,
  createField,
  holdBubble,
  stepField,
  type BubbleField,
  type Force,
} from "../../src/core/bubbles";
import {
  arrangeFloaters,
  createFloaters,
  floaterAt,
  nudgeFloater,
  stepFloaters,
} from "../../src/core/floaters";
import { tubesFor } from "../../src/core/layout";
import { createRng } from "../../src/core/rng";
import { defaultSettings, type Feel } from "../../src/core/settings";
import {
  applyTouch,
  createTouch,
  MAX_FINGERS,
  stepTouch,
  touchForces,
  touchGlows,
  type TouchEvent,
  type TouchWorld,
} from "../../src/core/touchForces";

const WIDTH = 4 / 3;
const TUBES = tubesFor("tubes6", WIDTH);
const FRAME = 1 / 60;
/** The middle of the first tube. */
const IN_TUBE = { x: ((TUBES.at(0)?.x0 ?? 0) + (TUBES.at(0)?.x1 ?? 0)) / 2, y: 0.5 };
/** On the frame between the first two tubes. */
const ON_FRAME = { x: ((TUBES.at(0)?.x1 ?? 0) + (TUBES.at(1)?.x0 ?? 0)) / 2, y: 0.5 };

const world = (feel: Feel, field: BubbleField = createField(200)): TouchWorld => ({
  field,
  floaters: createFloaters(),
  tubes: TUBES,
  rng: createRng(3),
  feel,
  width: WIDTH,
});

const event = (type: TouchEvent["type"], id = 1, at = IN_TUBE): TouchEvent => ({
  type,
  id,
  x: at.x,
  y: at.y,
});

const still = (field: BubbleField, forces: readonly Force[], steps = 1): void => {
  for (let n = 0; n < steps; n += 1) {
    stepField(field, {
      dt: FRAME,
      tubes: TUBES,
      pumpOn: false,
      speed: 3,
      limit: 200,
      forces,
      rng: createRng(1),
    });
  }
};

describe("a finger in the water", () => {
  const force: Force = { ...IN_TUBE, radius: 0.16, swirl: 1, push: 0.3 };

  it("swirls a bubble near it and leaves a far one alone", () => {
    const field = createField(10);
    burst(field, TUBES, { x: IN_TUBE.x + 0.03, y: IN_TUBE.y }, 1, createRng(1));
    burst(field, TUBES, { x: IN_TUBE.x, y: 0.95 }, 1, createRng(2));
    const [near, far] = field.pool;
    if (!near || !far) throw new Error("no bubbles");
    near.vx = 0;
    near.vy = 0;
    far.vx = 0;
    far.vy = 0;
    still(field, [force]);
    expect(Math.hypot(near.vx, near.vy)).toBeGreaterThan(0);
    expect(Math.hypot(far.vx, far.vy)).toBe(0);
  });

  it("stays finite when a bubble is exactly under the finger", () => {
    const field = createField(10);
    burst(field, TUBES, IN_TUBE, 1, createRng(1));
    const [bubble] = field.pool;
    if (!bubble) throw new Error("no bubble");
    bubble.x = IN_TUBE.x;
    bubble.y = IN_TUBE.y;
    bubble.vx = 0;
    bubble.vy = 0;
    still(field, [{ ...force, swirl: 50, push: 50 }], 30);
    for (const value of [bubble.x, bubble.y, bubble.vx, bubble.vy]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("never throws a bubble out of its tube, however hard it pushes", () => {
    const field = createField(120);
    burst(field, TUBES, IN_TUBE, 100, createRng(1));
    still(field, [{ ...force, swirl: 30, push: 30 }], 240);
    const tube = TUBES.at(0);
    for (const bubble of field.pool.filter((candidate) => candidate.active)) {
      expect(bubble.x).toBeGreaterThanOrEqual((tube?.x0 ?? 0) + bubble.radius - 1e-9);
      expect(bubble.x).toBeLessThanOrEqual((tube?.x1 ?? 0) - bubble.radius + 1e-9);
    }
  });
});

describe("bursts", () => {
  it("puts small bubbles where the finger is, inside the tube", () => {
    const field = createField(50);
    expect(burst(field, TUBES, IN_TUBE, 8, createRng(1))).toBe(8);
    expect(activeCount(field)).toBe(8);
    for (const bubble of field.pool.filter((candidate) => candidate.active)) {
      expect(bubble.y).toBe(IN_TUBE.y);
      expect(bubble.tube).toBe(0);
      expect(bubble.radius).toBeLessThan(BIG_RADIUS);
    }
  });

  it("makes nothing on the frame between tubes", () => {
    const field = createField(50);
    expect(burst(field, TUBES, ON_FRAME, 8, createRng(1))).toBe(0);
    expect(activeCount(field)).toBe(0);
  });

  it("cannot pile up: it stops when the pool is full", () => {
    const field = createField(20);
    const made = Array.from({ length: 10 }, () => burst(field, TUBES, IN_TUBE, 8, createRng(1)));
    expect(made.reduce((sum, count) => sum + count, 0)).toBe(20);
    expect(field.pool).toHaveLength(20);
  });
});

describe("floaters", () => {
  const arranged = (kind: "none" | "fish" | "balls" | "stars", tubes = TUBES) => {
    const set = createFloaters();
    arrangeFloaters(set, kind, tubes, createRng(4));
    return set;
  };
  const active = (set: ReturnType<typeof createFloaters>) =>
    set.pool.filter((floater) => floater.active);

  it("has none when none are chosen", () => {
    expect(active(arranged("none"))).toHaveLength(0);
  });

  it.each(["fish", "balls", "stars"] as const)("shares %s out evenly across the tubes", (kind) => {
    const set = arranged(kind);
    expect(active(set)).toHaveLength(12);
    for (const [index, tube] of TUBES.entries()) {
      const here = active(set).filter((floater) => floater.tube === index);
      expect(here).toHaveLength(2);
      for (const floater of here) {
        expect(floater.x).toBeGreaterThanOrEqual(tube.x0 + floater.size);
        expect(floater.x).toBeLessThanOrEqual(tube.x1 - floater.size);
      }
    }
  });

  it("drifts gently and stays inside its tube and the wall", () => {
    const set = arranged("fish");
    const start = active(set).map((floater) => floater.y);
    for (let n = 0; n < 60 * 120; n += 1) stepFloaters(set, FRAME, TUBES);
    for (const floater of active(set)) {
      const tube = TUBES.at(floater.tube);
      expect(floater.x).toBeGreaterThanOrEqual((tube?.x0 ?? 0) + floater.size - 1e-9);
      expect(floater.x).toBeLessThanOrEqual((tube?.x1 ?? 0) - floater.size + 1e-9);
      expect(floater.y).toBeGreaterThan(0);
      expect(floater.y).toBeLessThan(1);
    }
    expect(active(set).map((floater) => floater.y)).not.toEqual(start);
  });

  it("bobs up and spins when touched, then settles upright", () => {
    const set = arranged("balls");
    const [floater] = active(set);
    if (!floater) throw new Error("no floater");
    const home = floater.homeY;
    expect(floaterAt(set, floater.x, floater.y)).toBe(floater);
    nudgeFloater(floater);
    for (let n = 0; n < 30; n += 1) stepFloaters(set, FRAME, TUBES);
    expect(floater.homeY).toBeLessThan(home);
    expect(Math.abs(floater.angle)).toBeGreaterThan(0.5);
    for (let n = 0; n < 60 * 20; n += 1) stepFloaters(set, FRAME, TUBES);
    expect(Math.abs(floater.spin)).toBeLessThan(0.01);
    expect(Math.abs(floater.angle)).toBeLessThan(0.01);
    expect(floater.homeY).toBeGreaterThanOrEqual(0.12);
  });

  it("finds nothing where there is no floater", () => {
    expect(floaterAt(arranged("fish"), -5, -5)).toBeUndefined();
    expect(floaterAt(arranged("none"), IN_TUBE.x, IN_TUBE.y)).toBeUndefined();
  });

  it("copes with no tubes and with tubes too narrow to hold one", () => {
    expect(active(arranged("fish", []))).toHaveLength(0);
    expect(active(arranged("fish", [{ x0: 0.5, x1: 0.5 }]))).toHaveLength(0);
    const set = arranged("fish");
    stepFloaters(set, FRAME, []);
    expect(active(set)).toHaveLength(12);
  });
});

describe("touch in Calm", () => {
  it("makes a soft plip and a glow, and no burst", () => {
    const state = createTouch();
    const calm = world("calm");
    const sounds = applyTouch(state, event("down"), calm, 0);
    expect(sounds).toEqual([{ kind: "plip", pitch: 0.5, pan: expect.any(Number) as number }]);
    expect(activeCount(calm.field)).toBe(0);
    expect(touchGlows(state).length).toBeGreaterThanOrEqual(2);
  });

  it("never bursts, pops or grows a bubble", () => {
    const state = createTouch();
    const calm = world("calm");
    const big = holdBubble(calm.field, TUBES, IN_TUBE, createRng(1));
    if (!big) throw new Error("no bubble");
    big.held = false;
    big.radius = 0.06;

    const sounds = applyTouch(state, event("down"), calm, 0);
    for (let n = 0; n < 120; n += 1) stepTouch(state, FRAME, n * 16.7, calm);
    expect(sounds.map((sound) => sound.kind)).toEqual(["plip"]);
    expect(big.active).toBe(true);
    expect(activeCount(calm.field)).toBe(1);
  });

  it("leaves a short trail of tiny bubbles when dragged", () => {
    const state = createTouch();
    const calm = world("calm");
    applyTouch(state, event("down"), calm, 0);
    applyTouch(state, event("move", 1, { x: IN_TUBE.x, y: 0.49 }), calm, 10);
    expect(activeCount(calm.field)).toBe(0);
    applyTouch(state, event("move", 1, { x: IN_TUBE.x, y: 0.4 }), calm, 20);
    expect(activeCount(calm.field)).toBe(1);
    applyTouch(state, event("move", 1, { x: IN_TUBE.x, y: 0.3 }), calm, 30);
    expect(activeCount(calm.field)).toBe(2);
  });

  it("swirls more gently than Play", () => {
    const state = createTouch();
    applyTouch(state, event("down"), world("calm"), 0);
    const [calm] = touchForces(state, "calm");
    const [play] = touchForces(state, "play");
    expect(calm?.swirl).toBeLessThan(play?.swirl ?? 0);
    expect(calm?.push).toBeLessThan(play?.push ?? 0);
    expect(calm?.radius).toBeLessThan(play?.radius ?? 0);
  });
});

describe("touch in Play", () => {
  it("a tap makes a burst and a bloop pitched by height and placed by side", () => {
    const state = createTouch();
    const play = world("play");
    const high = applyTouch(state, event("down", 1, { x: 0.1, y: 0.1 }), play, 0);
    expect(activeCount(play.field)).toBe(8);
    expect(high.at(0)?.kind).toBe("bloop");
    expect(high.at(0)?.pitch).toBeCloseTo(0.9);
    expect(high.at(0)?.pan).toBeLessThan(0);
    const low = applyTouch(state, event("down", 2, { x: WIDTH - 0.1, y: 0.9 }), play, 0);
    expect(low.at(0)?.pitch).toBeCloseTo(0.1);
    expect(low.at(0)?.pan).toBeGreaterThan(0);
  });

  it("a held finger grows one big bubble that follows it and floats off when let go", () => {
    const state = createTouch();
    const play = world("play");
    applyTouch(state, event("down"), play, 0);
    stepTouch(state, FRAME, 340, play);
    const before = activeCount(play.field);
    stepTouch(state, FRAME, 350, play);
    expect(activeCount(play.field)).toBe(before + 1);
    const growing = play.field.pool.find((bubble) => bubble.held);
    if (!growing) throw new Error("nothing growing");

    const first = growing.radius;
    for (let n = 0; n < 60; n += 1) stepTouch(state, FRAME, 400 + n * 16.7, play);
    expect(growing.radius).toBeGreaterThan(first);
    expect(growing.y).toBe(IN_TUBE.y);

    for (let n = 0; n < 60 * 10; n += 1) stepTouch(state, FRAME, 2000 + n * 16.7, play);
    const tube = TUBES.at(0);
    expect(growing.radius).toBeLessThanOrEqual(((tube?.x1 ?? 0) - (tube?.x0 ?? 0)) / 2 + 1e-9);
    expect(growing.x).toBeGreaterThanOrEqual((tube?.x0 ?? 0) + growing.radius - 1e-9);

    const y = growing.y;
    still(play.field, [], 10);
    expect(growing.y).toBe(y);
    expect(applyTouch(state, event("up"), play, 9000)).toEqual([]);
    expect(growing.held).toBe(false);
    still(play.field, [], 10);
    expect(growing.y).toBeLessThan(y);
  });

  it("does not grow a bubble under a finger that is moving", () => {
    const state = createTouch();
    const play = world("play");
    applyTouch(state, event("down"), play, 0);
    applyTouch(state, event("move", 1, { x: IN_TUBE.x, y: 0.4 }), play, 100);
    for (let n = 0; n < 60; n += 1) stepTouch(state, FRAME, 400 + n * 16.7, play);
    expect(play.field.pool.some((bubble) => bubble.held)).toBe(false);
  });

  it("cancel mid-hold lets the growing bubble go without a pop", () => {
    const state = createTouch();
    const play = world("play");
    applyTouch(state, event("down"), play, 0);
    stepTouch(state, FRAME, 400, play);
    const growing = play.field.pool.find((bubble) => bubble.held);
    expect(growing).toBeDefined();
    const count = activeCount(play.field);
    expect(applyTouch(state, event("cancel"), play, 500)).toEqual([]);
    expect(growing?.held).toBe(false);
    expect(growing?.active).toBe(true);
    expect(activeCount(play.field)).toBe(count);
    expect(touchForces(state, "play")).toEqual([]);
  });

  it("tapping a big bubble pops it into a puff of small ones", () => {
    const state = createTouch();
    const play = world("play");
    const big = holdBubble(play.field, TUBES, IN_TUBE, createRng(1));
    if (!big) throw new Error("no bubble");
    big.held = false;
    big.radius = 0.06;
    expect(bigBubbleAt(play.field, IN_TUBE.x, IN_TUBE.y)).toBe(big);

    const sounds = applyTouch(state, event("down"), play, 0);
    expect(sounds.map((sound) => sound.kind)).toEqual(["pop"]);
    expect(bigBubbleAt(play.field, IN_TUBE.x, IN_TUBE.y)).toBeUndefined();
    expect(activeCount(play.field)).toBe(10);
  });

  it("a bubble still being grown cannot be popped", () => {
    const play = world("play");
    holdBubble(play.field, TUBES, IN_TUBE, createRng(1));
    expect(bigBubbleAt(play.field, IN_TUBE.x, IN_TUBE.y)).toBeUndefined();
  });

  it("a tap on the frame still bloops but makes no bubbles", () => {
    const state = createTouch();
    const play = world("play");
    expect(applyTouch(state, event("down", 1, ON_FRAME), play, 0)).toHaveLength(1);
    expect(activeCount(play.field)).toBe(0);
    stepTouch(state, FRAME, 1000, play);
    expect(play.field.pool.some((bubble) => bubble.held)).toBe(false);
  });
});

describe("fingers", () => {
  it("follows one finger and forgets it when it lifts", () => {
    const state = createTouch();
    const calm = world("calm");
    applyTouch(state, event("down"), calm, 0);
    expect(touchForces(state, "calm")).toHaveLength(1);
    applyTouch(state, event("up"), calm, 100);
    expect(touchForces(state, "calm")).toEqual([]);
  });

  it("follows ten fingers at once and ignores an eleventh", () => {
    const state = createTouch();
    const play = world("play");
    for (let id = 1; id <= MAX_FINGERS; id += 1) applyTouch(state, event("down", id), play, 0);
    expect(touchForces(state, "play")).toHaveLength(10);
    const before = activeCount(play.field);
    expect(applyTouch(state, event("down", 11), play, 0)).toEqual([]);
    expect(touchForces(state, "play")).toHaveLength(10);
    expect(activeCount(play.field)).toBe(before);
    applyTouch(state, event("move", 11, { x: 0.3, y: 0.1 }), play, 10);
    applyTouch(state, event("up", 11), play, 20);
    expect(touchForces(state, "play")).toHaveLength(10);
  });

  it("moves the force with the finger", () => {
    const state = createTouch();
    const calm = world("calm");
    applyTouch(state, event("down"), calm, 0);
    applyTouch(state, event("move", 1, { x: 0.7, y: 0.2 }), calm, 10);
    expect(touchForces(state, "calm").at(0)).toMatchObject({ x: 0.7, y: 0.2 });
  });

  it("ripples spread and fade away, and there are never more than sixteen", () => {
    const state = createTouch();
    const calm = world("calm");
    for (let id = 1; id <= 10; id += 1) {
      applyTouch(state, event("down", id), calm, 0);
      applyTouch(state, event("move", id, { x: IN_TUBE.x, y: 0.2 }), calm, 0);
      applyTouch(state, event("move", id, { x: IN_TUBE.x, y: 0.8 }), calm, 0);
      applyTouch(state, event("up", id), calm, 0);
    }
    const glows = touchGlows(state);
    expect(glows).toHaveLength(16);
    stepTouch(state, 0.5, 500, calm);
    const later = touchGlows(state);
    expect(later.at(0)?.radius).toBeGreaterThan(glows.at(0)?.radius ?? 0);
    expect(later.at(0)?.strength).toBeLessThan(glows.at(0)?.strength ?? 0);
    stepTouch(state, 1, 1500, calm);
    expect(touchGlows(state)).toEqual([]);
  });

  it("touching a floater makes it bob", () => {
    const state = createTouch();
    const calm = world("calm");
    arrangeFloaters(calm.floaters, "fish", TUBES, createRng(4));
    const [fish] = calm.floaters.pool;
    if (!fish) throw new Error("no fish");
    applyTouch(state, event("down", 1, { x: fish.x, y: fish.y }), calm, 0);
    expect(fish.bob).toBeGreaterThan(0);
    expect(fish.spin).not.toBe(0);
  });
});

describe("touch settings", () => {
  it("switches between Calm and Play, the floaters, and touch sounds", () => {
    const start = defaultSettings();
    expect(setFeel("play")(start).feel).toBe("play");
    expect(setFeel("calm")(start)).toBe(start);
    expect(setFloaters("fish")(start).floaters).toBe("fish");
    expect(toggleTouchSounds(start).touchSounds).toBe(false);
    expect(toggleTouchSounds(toggleTouchSounds(start)).touchSounds).toBe(true);
  });
});
