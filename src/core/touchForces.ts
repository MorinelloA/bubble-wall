/**
 * Touch. Fingers swirl the bubbles, light the water under them and leave a trail.
 * In Calm that is all: nothing sudden. In Play a tap also makes a burst and a bloop,
 * a held finger grows a big bubble, and a big bubble pops when tapped.
 */
import {
  BIG_RADIUS,
  bigBubbleAt,
  burst,
  holdBubble,
  type Bubble,
  type BubbleField,
  type Force,
} from "./bubbles";
import { floaterAt, nudgeFloater, type FloaterSet } from "./floaters";
import type { Tube } from "./layout";
import type { Rng } from "./rng";
import type { Feel } from "./settings";
import { clamp } from "./util";

export const MAX_FINGERS = 10;
const MAX_RIPPLES = 16;
const RIPPLE_SECONDS = 1.1;
/** A new ripple and a trail bubble for every this much of finger travel. */
const TRAIL_STEP = 0.035;
/** A finger held this still for this long starts growing a big bubble (Play only). */
const HOLD_MS = 350;
const HOLD_STILL = 0.03;
const GROW_PER_SECOND = 0.03;
const BIGGEST = 0.085;
const TAP_BURST = 8;
const POP_BURST = 10;

export type TouchEventType = "down" | "move" | "up" | "cancel";

export interface TouchEvent {
  readonly type: TouchEventType;
  readonly id: number;
  /** Where on the wall, in wall units. */
  readonly x: number;
  readonly y: number;
}

/** A sound a touch makes. `pitch` runs from 0 (low) to 1 (high), `pan` from -1 to 1. */
export interface TouchSound {
  readonly kind: "plip" | "bloop" | "pop";
  readonly pitch: number;
  readonly pan: number;
}

interface Finger {
  x: number;
  y: number;
  downAt: number;
  /** How far it has moved since it went down, and since its last trail bubble. */
  travelled: number;
  sinceTrail: number;
  growing: Bubble | null;
}

export interface Ripple {
  active: boolean;
  x: number;
  y: number;
  /** 0 when it starts, 1 when it has faded away. */
  age: number;
}

export interface TouchState {
  readonly fingers: Map<number, Finger>;
  readonly ripples: readonly Ripple[];
}

/** Everything a touch can change. */
export interface TouchWorld {
  readonly field: BubbleField;
  readonly floaters: FloaterSet;
  readonly tubes: readonly Tube[];
  readonly rng: Rng;
  readonly feel: Feel;
  /** The wall's width in wall units, for placing sounds left to right. */
  readonly width: number;
}

/** A patch of extra light on the wall. */
export interface Glow {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 0 to 1. */
  readonly strength: number;
}

export function createTouch(): TouchState {
  return {
    fingers: new Map(),
    ripples: Array.from({ length: MAX_RIPPLES }, () => ({ active: false, x: 0, y: 0, age: 0 })),
  };
}

function ripple(state: TouchState, x: number, y: number): void {
  const free = state.ripples.find((candidate) => !candidate.active);
  if (!free) return;
  free.active = true;
  free.x = x;
  free.y = y;
  free.age = 0;
}

const sound = (kind: TouchSound["kind"], event: TouchEvent, world: TouchWorld): TouchSound => ({
  kind,
  pitch: clamp(1 - event.y, 0, 1),
  pan: clamp((event.x / Math.max(world.width, 0.001)) * 2 - 1, -1, 1),
});

function down(state: TouchState, event: TouchEvent, world: TouchWorld, now: number): TouchSound[] {
  if (state.fingers.size >= MAX_FINGERS) return [];
  state.fingers.set(event.id, {
    x: event.x,
    y: event.y,
    downAt: now,
    travelled: 0,
    sinceTrail: 0,
    growing: null,
  });
  ripple(state, event.x, event.y);

  const floater = floaterAt(world.floaters, event.x, event.y);
  if (floater) nudgeFloater(floater);
  if (world.feel === "calm") return [sound("plip", event, world)];

  const big = bigBubbleAt(world.field, event.x, event.y);
  if (big) {
    big.active = false;
    burst(world.field, world.tubes, big, POP_BURST, world.rng);
    return [sound("pop", event, world)];
  }
  burst(world.field, world.tubes, event, TAP_BURST, world.rng);
  return [sound("bloop", event, world)];
}

function move(state: TouchState, event: TouchEvent, world: TouchWorld): void {
  const finger = state.fingers.get(event.id);
  if (!finger) return;
  const distance = Math.hypot(event.x - finger.x, event.y - finger.y);
  finger.x = event.x;
  finger.y = event.y;
  finger.travelled += distance;
  finger.sinceTrail += distance;
  if (finger.sinceTrail < TRAIL_STEP) return;
  finger.sinceTrail = 0;
  ripple(state, event.x, event.y);
  burst(world.field, world.tubes, event, 1, world.rng);
}

/** Lets a finger go. A bubble it was growing floats off; nothing pops. */
function release(state: TouchState, id: number): void {
  const finger = state.fingers.get(id);
  if (finger?.growing) finger.growing.held = false;
  state.fingers.delete(id);
}

/** Takes one touch event. Returns the sounds it makes. */
export function applyTouch(
  state: TouchState,
  event: TouchEvent,
  world: TouchWorld,
  now: number,
): TouchSound[] {
  switch (event.type) {
    case "down":
      return down(state, event, world, now);
    case "move":
      move(state, event, world);
      return [];
    case "up":
    case "cancel":
      release(state, event.id);
      return [];
  }
}

/** Keeps a growing bubble under its finger and a little bigger, inside its tube. */
function grow(bubble: Bubble, finger: Finger, tubes: readonly Tube[], dt: number): void {
  const tube = tubes.at(bubble.tube);
  const room = tube ? (tube.x1 - tube.x0) / 2 : BIG_RADIUS;
  bubble.radius = Math.min(bubble.radius + GROW_PER_SECOND * dt, BIGGEST, room);
  const left = (tube?.x0 ?? finger.x) + bubble.radius;
  const right = Math.max(left, (tube?.x1 ?? finger.x) - bubble.radius);
  bubble.x = clamp(finger.x, left, right);
  bubble.y = finger.y;
}

/** Moves touch on by dt: ripples fade, and held fingers grow their bubbles (Play only). */
export function stepTouch(state: TouchState, dt: number, now: number, world: TouchWorld): void {
  for (const ring of state.ripples) {
    if (!ring.active) continue;
    ring.age += dt / RIPPLE_SECONDS;
    if (ring.age >= 1) ring.active = false;
  }
  for (const finger of state.fingers.values()) {
    if (finger.growing) {
      grow(finger.growing, finger, world.tubes, dt);
      continue;
    }
    const held = now - finger.downAt >= HOLD_MS && finger.travelled < HOLD_STILL;
    if (world.feel === "play" && held) {
      finger.growing = holdBubble(world.field, world.tubes, finger, world.rng);
    }
  }
}

/** The swirl each finger puts into the water: gentle in Calm, stronger in Play. */
export function touchForces(state: TouchState, feel: Feel): Force[] {
  const strong = feel === "play";
  return [...state.fingers.values()].map((finger) => ({
    x: finger.x,
    y: finger.y,
    radius: strong ? 0.22 : 0.16,
    swirl: strong ? 1.8 : 0.8,
    push: strong ? 0.5 : 0.12,
  }));
}

/** The extra light on the wall: a steady glow under each finger, and the fading ripples. */
export function touchGlows(state: TouchState): Glow[] {
  const under = [...state.fingers.values()].map((finger) => ({
    x: finger.x,
    y: finger.y,
    radius: 0.13,
    strength: 0.45,
  }));
  const rings = state.ripples
    .filter((ring) => ring.active)
    .map((ring) => ({
      x: ring.x,
      y: ring.y,
      radius: 0.05 + ring.age * 0.22,
      strength: 0.4 * (1 - ring.age),
    }));
  return [...under, ...rings];
}
