/**
 * Fish, balls or stars that drift gently in the tubes, like the ones in a real
 * bubble tube. Touch one and it bobs and spins.
 */
import type { Tube } from "./layout";
import type { Rng } from "./rng";
import type { FloaterKind } from "./settings";
import { clamp } from "./util";

export interface Floater {
  active: boolean;
  tube: number;
  x: number;
  y: number;
  /** The height it drifts around. */
  homeY: number;
  /** Half its width, in wall heights. */
  size: number;
  /** Where it is in its slow up-and-down drift, in radians. */
  phase: number;
  driftRate: number;
  /** Extra upward speed from being touched, which dies away. */
  bob: number;
  angle: number;
  spin: number;
  /** Which colour it is: an index the renderer looks up. */
  tint: number;
  /** 1 facing right, -1 facing left. */
  facing: number;
}

export interface FloaterSet {
  readonly pool: readonly Floater[];
}

const POOL_SIZE = 12;
const SIZE = 0.035;
const DRIFT_HEIGHT = 0.07;
const DRIFT_SIDEWAYS = 0.012;
/** How hard a touch sends one up, and round. */
const BOB_SPEED = 0.35;
const SPIN_SPEED = 7;
/** Share of bob and spin left after one second. */
const SETTLE = 0.12;

function blank(): Floater {
  return {
    active: false,
    tube: 0,
    x: 0,
    y: 0,
    homeY: 0.5,
    size: SIZE,
    phase: 0,
    driftRate: 0.5,
    bob: 0,
    angle: 0,
    spin: 0,
    tint: 0,
    facing: 1,
  };
}

export function createFloaters(): FloaterSet {
  return { pool: Array.from({ length: POOL_SIZE }, blank) };
}

/** Puts floaters of a kind into the tubes: shared out evenly, none for "none". */
export function arrangeFloaters(
  set: FloaterSet,
  kind: FloaterKind,
  tubes: readonly Tube[],
  rng: Rng,
): void {
  const wanted = kind === "none" || tubes.length === 0 ? 0 : POOL_SIZE;
  for (const [index, floater] of set.pool.entries()) {
    const tubeIndex = index % Math.max(1, tubes.length);
    const tube = tubes.at(tubeIndex);
    const size = Math.min(SIZE, ((tube?.x1 ?? 0) - (tube?.x0 ?? 0)) / 2.4);
    floater.active = index < wanted && tube !== undefined && size > 0;
    if (!floater.active || !tube) continue;
    floater.tube = tubeIndex;
    floater.size = size;
    floater.x = rng.range(tube.x0 + size, Math.max(tube.x0 + size, tube.x1 - size));
    floater.homeY = rng.range(0.18, 0.82);
    floater.y = floater.homeY;
    floater.phase = rng.range(0, Math.PI * 2);
    floater.driftRate = rng.range(0.25, 0.6);
    floater.bob = 0;
    floater.angle = 0;
    floater.spin = 0;
    floater.tint = index;
    floater.facing = rng.next() < 0.5 ? -1 : 1;
  }
}

export function stepFloaters(set: FloaterSet, dt: number, tubes: readonly Tube[]): void {
  const settle = Math.pow(SETTLE, dt);
  for (const floater of set.pool) {
    const tube = tubes.at(floater.tube);
    if (!floater.active || !tube) continue;
    floater.phase += floater.driftRate * dt;
    // A touch lifts it; afterwards it sinks back to the height it drifts around.
    floater.homeY = clamp(floater.homeY - floater.bob * dt, 0.12, 0.88);
    floater.y = floater.homeY + Math.sin(floater.phase) * DRIFT_HEIGHT;
    floater.x += Math.cos(floater.phase * 0.7) * DRIFT_SIDEWAYS * dt * floater.facing;
    floater.x = clamp(
      floater.x,
      tube.x0 + floater.size,
      Math.max(tube.x0 + floater.size, tube.x1 - floater.size),
    );
    floater.angle += floater.spin * dt;
    floater.bob *= settle;
    floater.spin *= settle;
    // Once it has all but stopped turning, it eases back upright.
    if (Math.abs(floater.spin) < 0.3) floater.angle *= Math.pow(0.05, dt);
  }
}

/** The floater under a point, if there is one. */
export function floaterAt(set: FloaterSet, x: number, y: number): Floater | undefined {
  return set.pool.find(
    (floater) => floater.active && Math.hypot(floater.x - x, floater.y - y) <= floater.size * 1.3,
  );
}

/** A touch: it bobs up and spins. */
export function nudgeFloater(floater: Floater): void {
  floater.bob = BOB_SPEED;
  floater.spin = SPIN_SPEED * floater.facing;
}
