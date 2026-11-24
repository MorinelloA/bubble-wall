/**
 * The bubble simulation. Bubbles live in a pool of fixed size that is made once and
 * reused, so the wall never allocates while it runs and can never grow without limit.
 */
import { tubeAt, type Tube } from "./layout";
import type { Rng } from "./rng";
import { BUBBLE_SPEED_STEPS } from "./settings";
import { clamp } from "./util";

export interface Bubble {
  active: boolean;
  /** Index of the tube it is in. */
  tube: number;
  x: number;
  y: number;
  radius: number;
  /** How fast it rises compared with the others (bigger bubbles rise faster). */
  lift: number;
  /** Where it is in its side-to-side wobble, in radians. */
  phase: number;
  wobbleRate: number;
  /** Extra velocity from being pushed, which dies away. */
  vx: number;
  vy: number;
  /** Held under a finger and growing: it does not rise until it is let go. */
  held: boolean;
}

/** A finger in the water: bubbles within its reach are swirled round it and nudged away. */
export interface Force {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** Speed round the finger, in wall heights per second at its centre. */
  readonly swirl: number;
  /** Speed away from the finger. */
  readonly push: number;
}

export interface BubbleField {
  readonly pool: readonly Bubble[];
  /** Bubbles owed to each tube: spawning carries its remainder to the next step. */
  owed: number[];
}

export interface StepInput {
  /** Seconds since the last step. */
  readonly dt: number;
  readonly tubes: readonly Tube[];
  readonly pumpOn: boolean;
  /** 1 to 5. */
  readonly speed: number;
  /** The most bubbles allowed at once. Lowered when the device is struggling. */
  readonly limit: number;
  readonly forces: readonly Force[];
  readonly rng: Rng;
}

export const MIN_RADIUS = 0.006;
const MAX_RADIUS = 0.026;
/** Rise speed in wall heights per second, slowest and fastest. */
const SLOWEST_RISE = 0.09;
const FASTEST_RISE = 0.42;
/** Bubbles per unit of tube width, once the tube is full. */
const DENSITY = 150;
const WOBBLE_SPEED = 0.035;
/** Share of pushed velocity left after one second. */
const DRAG = 0.05;
const BOUNCE = 0.3;
/** Closer than this to a finger counts as this far, so the push never becomes huge. */
const CLOSEST = 0.01;
/** A bubble this big or bigger can be popped. */
export const BIG_RADIUS = 0.035;

function blankBubble(): Bubble {
  return {
    active: false,
    tube: 0,
    x: 0,
    y: 0,
    radius: MIN_RADIUS,
    lift: 1,
    phase: 0,
    wobbleRate: 1,
    vx: 0,
    vy: 0,
    held: false,
  };
}

export function createField(size: number): BubbleField {
  return { pool: Array.from({ length: size }, blankBubble), owed: [] };
}

export function activeCount(field: BubbleField): number {
  return field.pool.reduce((count, bubble) => count + (bubble.active ? 1 : 0), 0);
}

/** Rise speed for a bubble-speed step, in wall heights per second. */
export function riseSpeed(speed: number): number {
  const step = (clamp(speed, 1, BUBBLE_SPEED_STEPS) - 1) / (BUBBLE_SPEED_STEPS - 1);
  return SLOWEST_RISE + (FASTEST_RISE - SLOWEST_RISE) * step;
}

function launch(bubble: Bubble, tubeIndex: number, tube: Tube, rng: Rng): void {
  // Mostly small bubbles with the odd big one.
  const size = Math.pow(rng.next(), 2.2);
  const radius = Math.min(MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * size, (tube.x1 - tube.x0) / 2);
  bubble.active = true;
  bubble.tube = tubeIndex;
  bubble.radius = radius;
  bubble.x = rng.range(tube.x0 + radius, Math.max(tube.x0 + radius, tube.x1 - radius));
  bubble.y = 1 + radius;
  bubble.lift = 0.7 + 0.6 * size + rng.range(-0.08, 0.08);
  bubble.phase = rng.range(0, Math.PI * 2);
  bubble.wobbleRate = rng.range(1.5, 4);
  bubble.vx = 0;
  bubble.vy = 0;
  bubble.held = false;
}

/** Adds each finger's swirl and push to a bubble's velocity. */
function stir(bubble: Bubble, forces: readonly Force[], dt: number): void {
  for (const force of forces) {
    const dx = bubble.x - force.x;
    const dy = bubble.y - force.y;
    const distance = Math.hypot(dx, dy);
    if (distance >= force.radius) continue;
    const falloff = Math.pow(1 - distance / force.radius, 2);
    const unit = 1 / Math.max(distance, CLOSEST);
    bubble.vx += (-dy * force.swirl + dx * force.push) * unit * falloff * dt;
    bubble.vy += (dx * force.swirl + dy * force.push) * unit * falloff * dt;
  }
}

/** How many bubbles each tube holds now, by tube index. */
function countByTube(field: BubbleField): Map<number, number> {
  const counts = new Map<number, number>();
  for (const bubble of field.pool) {
    if (bubble.active) counts.set(bubble.tube, (counts.get(bubble.tube) ?? 0) + 1);
  }
  return counts;
}

function spawn(field: BubbleField, input: StepInput): void {
  const rise = riseSpeed(input.speed);
  const counts = countByTube(field);
  let room = input.limit - activeCount(field);
  // Each tube may hold only its share of the limit. Without this, when the limit is
  // low the tubes on the left would take every bubble and the rest would run dry.
  const share = Math.ceil(input.limit / Math.max(1, input.tubes.length));
  field.owed = input.tubes.map((tube, index) => {
    const owed = (field.owed.at(index) ?? 0) + DENSITY * (tube.x1 - tube.x0) * rise * input.dt;
    const whole = Math.floor(owed);
    let here = counts.get(index) ?? 0;
    for (let n = 0; n < whole && room > 0 && here < share; n += 1) {
      const free = field.pool.find((bubble) => !bubble.active);
      if (!free) break;
      launch(free, index, tube, input.rng);
      room -= 1;
      here += 1;
    }
    return owed - whole;
  });
}

function move(bubble: Bubble, tube: Tube, input: StepInput): void {
  const { dt } = input;
  if (bubble.held) return;
  stir(bubble, input.forces, dt);
  bubble.phase += bubble.wobbleRate * dt;
  bubble.x += (Math.sin(bubble.phase) * WOBBLE_SPEED + bubble.vx) * dt;
  bubble.y += (bubble.vy - riseSpeed(input.speed) * bubble.lift) * dt;
  const drag = Math.pow(DRAG, dt);
  bubble.vx *= drag;
  bubble.vy *= drag;

  const left = tube.x0 + bubble.radius;
  const right = Math.max(left, tube.x1 - bubble.radius);
  if (bubble.x < left || bubble.x > right) {
    bubble.x = clamp(bubble.x, left, right);
    bubble.vx = -bubble.vx * BOUNCE;
  }
  if (bubble.y < -bubble.radius) bubble.active = false;
}

/** Moves every bubble on by dt and, while the pump is on, lets new ones in at the bottom. */
export function stepField(field: BubbleField, input: StepInput): void {
  if (input.pumpOn) spawn(field, input);
  for (const bubble of field.pool) {
    if (!bubble.active) continue;
    const tube = input.tubes.at(bubble.tube);
    if (tube) move(bubble, tube, input);
    else bubble.active = false;
  }
}

/** After the layout changes: each bubble joins the tube it now sits in, or leaves. */
export function refitField(field: BubbleField, tubes: readonly Tube[]): void {
  field.owed = [];
  for (const bubble of field.pool) {
    if (!bubble.active) continue;
    const index = tubeAt(tubes, bubble.x);
    const tube = tubes.at(index);
    if (index < 0 || !tube) {
      bubble.active = false;
    } else {
      bubble.tube = index;
      bubble.radius = Math.min(bubble.radius, (tube.x1 - tube.x0) / 2);
    }
  }
}

/** The free bubble to use next, or nothing when the pool is all in use. */
function claim(field: BubbleField): Bubble | undefined {
  return field.pool.find((bubble) => !bubble.active);
}

/**
 * A puff of small bubbles at a point, flying apart. They come from the same pool as
 * every other bubble, so bursts can never pile up. Returns how many were made.
 */
export function burst(
  field: BubbleField,
  tubes: readonly Tube[],
  at: { readonly x: number; readonly y: number },
  count: number,
  rng: Rng,
): number {
  const index = tubeAt(tubes, at.x);
  const tube = tubes.at(index);
  if (index < 0 || !tube) return 0;
  let made = 0;
  for (; made < count; made += 1) {
    const bubble = claim(field);
    if (!bubble) break;
    launch(bubble, index, tube, rng);
    bubble.radius = Math.min(bubble.radius, MIN_RADIUS * 2.2);
    const angle = rng.range(0, Math.PI * 2);
    const speed = rng.range(0.05, 0.3);
    bubble.x = clamp(
      at.x,
      tube.x0 + bubble.radius,
      Math.max(tube.x0 + bubble.radius, tube.x1 - bubble.radius),
    );
    bubble.y = at.y;
    bubble.vx = Math.cos(angle) * speed;
    bubble.vy = Math.sin(angle) * speed;
  }
  return made;
}

/** Starts a bubble under a finger, to be grown. Nothing when the finger is on the frame. */
export function holdBubble(
  field: BubbleField,
  tubes: readonly Tube[],
  at: { readonly x: number; readonly y: number },
  rng: Rng,
): Bubble | null {
  const index = tubeAt(tubes, at.x);
  const tube = tubes.at(index);
  const bubble = claim(field);
  if (index < 0 || !tube || !bubble) return null;
  launch(bubble, index, tube, rng);
  bubble.held = true;
  bubble.radius = MAX_RADIUS;
  bubble.lift = 1.1;
  bubble.x = at.x;
  bubble.y = at.y;
  return bubble;
}

/** The big, free bubble under a point, if there is one. */
export function bigBubbleAt(field: BubbleField, x: number, y: number): Bubble | undefined {
  return field.pool.find(
    (bubble) =>
      bubble.active &&
      !bubble.held &&
      bubble.radius >= BIG_RADIUS &&
      Math.hypot(bubble.x - x, bubble.y - y) <= bubble.radius,
  );
}
