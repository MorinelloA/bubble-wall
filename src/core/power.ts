/**
 * Power: off, on, and the gentle fades between them. The wall never snaps on or
 * off. The level (0 dark, 1 fully on) scales the lights, the bubbles and the sound.
 */
import { clamp, smoothstep } from "./util";

export type PowerPhase = "off" | "on" | "fading";

export interface PowerState {
  readonly phase: PowerPhase;
  /** The level when the current change began, and the level it is heading for. */
  readonly from: number;
  readonly to: number;
  /** When the current change began, in milliseconds. */
  readonly since: number;
  readonly duration: number;
}

/** Waking up is quick; switching off is slower, so the ending is never abrupt. */
export const WAKE_MS = 900;
export const FADE_MS = 2000;

export function initialPower(): PowerState {
  return { phase: "off", from: 0, to: 0, since: 0, duration: 0 };
}

/** How lit the wall is right now, from 0 to 1. */
export function powerLevel(state: PowerState, now: number): number {
  if (state.duration <= 0) return state.to;
  const progress = smoothstep(clamp((now - state.since) / state.duration, 0, 1));
  return state.from + (state.to - state.from) * progress;
}

/** The On button, or the start tap. Does nothing when already on. */
export function turnOn(state: PowerState, now: number): PowerState {
  if (state.phase === "on") return state;
  return { phase: "on", from: powerLevel(state, now), to: 1, since: now, duration: WAKE_MS };
}

/** The Off button. Does nothing when already off or on the way there. */
export function turnOff(state: PowerState, now: number): PowerState {
  if (state.phase !== "on") return state;
  return { phase: "fading", from: powerLevel(state, now), to: 0, since: now, duration: FADE_MS };
}

/** Moves time on: a fade that has finished becomes off. */
export function tickPower(state: PowerState, now: number): PowerState {
  if (state.phase === "fading" && now - state.since >= state.duration) return initialPower();
  return state;
}
