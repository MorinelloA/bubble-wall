/**
 * Power: off, on, the gentle fades between them, and the wind-down timer. The wall
 * never snaps on or off. The level (0 dark, 1 fully on) scales the lights, the
 * bubbles and the sound.
 */
import { clamp, smoothstep } from "./util";

export type PowerPhase = "off" | "on" | "fading" | "winding";

export interface PowerState {
  readonly phase: PowerPhase;
  /** The level when the current change began, and the level it is heading for. */
  readonly from: number;
  readonly to: number;
  /** When the current change began, in milliseconds. */
  readonly since: number;
  readonly duration: number;
  /** When the wind-down timer was set and when it ends, or null with no timer. */
  readonly timerStart: number | null;
  readonly timerEnd: number | null;
}

/** Waking up is quick; switching off is slower, so the ending is never abrupt. */
export const WAKE_MS = 900;
export const FADE_MS = 2000;
/** A timer's last minute is one long, slow fade. */
export const WIND_DOWN_MS = 60_000;
/** The pump keeps running through most of the wind-down, then the tubes empty. */
const PUMP_STOPS_BELOW = 0.3;

export const TIMER_CHOICES: readonly number[] = [5, 10, 15, 30, 60];

export function initialPower(): PowerState {
  return {
    phase: "off",
    from: 0,
    to: 0,
    since: 0,
    duration: 0,
    timerStart: null,
    timerEnd: null,
  };
}

/** How lit the wall is right now, from 0 to 1. */
export function powerLevel(state: PowerState, now: number): number {
  if (state.duration <= 0) return state.to;
  const progress = smoothstep(clamp((now - state.since) / state.duration, 0, 1));
  return state.from + (state.to - state.from) * progress;
}

/** On, or winding down towards off: the wall counts as switched on. */
export function isPowered(state: PowerState): boolean {
  return state.phase === "on" || state.phase === "winding";
}

/** Whether new bubbles should be let in. */
export function isPumping(state: PowerState, now: number): boolean {
  if (state.phase === "on") return true;
  return state.phase === "winding" && powerLevel(state, now) > PUMP_STOPS_BELOW;
}

/** The On button, or the start tap. Does nothing when already on (or winding down). */
export function turnOn(state: PowerState, now: number): PowerState {
  if (isPowered(state)) return state;
  return {
    ...initialPower(),
    phase: "on",
    from: powerLevel(state, now),
    to: 1,
    since: now,
    duration: WAKE_MS,
  };
}

/** The Off button. Does nothing when already off or on the way there. */
export function turnOff(state: PowerState, now: number): PowerState {
  if (!isPowered(state)) return state;
  return {
    ...initialPower(),
    phase: "fading",
    from: powerLevel(state, now),
    to: 0,
    since: now,
    duration: FADE_MS,
  };
}

/**
 * Sets the wind-down timer, or clears it with 0 minutes. Ignored while the wall is
 * off. Setting it during a wind-down brings the light back up and starts again.
 */
export function setTimer(state: PowerState, minutes: number, now: number): PowerState {
  if (!isPowered(state)) return state;
  const timed = minutes > 0;
  if (!timed && state.timerEnd === null) return state;
  return {
    phase: "on",
    from: powerLevel(state, now),
    to: 1,
    since: now,
    duration: WAKE_MS,
    timerStart: timed ? now : null,
    timerEnd: timed ? now + minutes * 60_000 : null,
  };
}

/** How many minutes the running timer was set for, or 0 with no timer. */
export function timerMinutes(state: PowerState): number {
  if (state.timerStart === null || state.timerEnd === null) return 0;
  return Math.round((state.timerEnd - state.timerStart) / 60_000);
}

/** The share of the timer still to run, from 1 down to 0, or null with no timer. */
export function timerRemaining(state: PowerState, now: number): number | null {
  if (state.timerStart === null || state.timerEnd === null) return null;
  const length = Math.max(1, state.timerEnd - state.timerStart);
  return clamp((state.timerEnd - now) / length, 0, 1);
}

/**
 * Moves time on. A fade that has finished becomes off; a timer in its last minute
 * becomes a wind-down; a timer that ran out while nobody was looking is simply off.
 */
export function tickPower(state: PowerState, now: number): PowerState {
  const fadeOver = now - state.since >= state.duration;
  if ((state.phase === "fading" || state.phase === "winding") && fadeOver) return initialPower();
  if (state.phase !== "on" || state.timerEnd === null) return state;
  if (now >= state.timerEnd) return initialPower();
  const windFrom = state.timerEnd - WIND_DOWN_MS;
  if (now < windFrom) return state;
  // Timed from when the last minute began, not from this tick, so a late tick
  // (the app was in the background) picks the fade up where it should be by now.
  return { ...state, phase: "winding", from: 1, to: 0, since: windFrom, duration: WIND_DOWN_MS };
}
