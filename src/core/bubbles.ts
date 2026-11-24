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
  readonly rng: Rng;
}

const MIN_RADIUS = 0.006;
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
}

function spawn(field: BubbleField, input: StepInput): void {
  const rise = riseSpeed(input.speed);
  let room = input.limit - activeCount(field);
  field.owed = input.tubes.map((tube, index) => {
    const owed = (field.owed.at(index) ?? 0) + DENSITY * (tube.x1 - tube.x0) * rise * input.dt;
    const whole = Math.floor(owed);
    for (let n = 0; n < whole && room > 0; n += 1) {
      const free = field.pool.find((bubble) => !bubble.active);
      if (!free) break;
      launch(free, index, tube, input.rng);
      room -= 1;
    }
    return owed - whole;
  });
}

function move(bubble: Bubble, tube: Tube, input: StepInput): void {
  const { dt } = input;
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
