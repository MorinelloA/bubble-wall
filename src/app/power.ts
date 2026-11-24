/** The wall's power, as something the page can press and watch. */
import {
  initialPower,
  isPowered,
  isPumping,
  powerLevel,
  setTimer,
  tickPower,
  timerMinutes,
  timerRemaining,
  turnOff,
  turnOn,
} from "../core/power";
import { createEmitter } from "../core/util";

export interface PowerControl {
  /** 0 dark to 1 fully on, right now. */
  readonly level: () => number;
  /** True from the moment On is pressed until the wall is switched off or winds down. */
  readonly isOn: () => boolean;
  /** Whether new bubbles should be let in. */
  readonly isPumping: () => boolean;
  readonly on: () => void;
  readonly off: () => void;
  /** Starts the wind-down timer, or clears it with 0. */
  readonly setTimer: (minutes: number) => void;
  /** The minutes the running timer was set for, or 0. */
  readonly timerMinutes: () => number;
  /** The share of the timer still to run, 1 down to 0, or null with no timer. */
  readonly timerRemaining: () => number | null;
  /** Call every frame, so fades and the timer move on. */
  readonly tick: () => void;
  /** Hears whenever the wall is switched, starts winding down, or its timer changes. */
  readonly subscribe: (listener: () => void) => () => void;
}

export function createPowerControl(now: () => number): PowerControl {
  let state = initialPower();
  const changes = createEmitter<undefined>();
  const move = (next: typeof state): void => {
    if (next === state) return;
    const changed = next.phase !== state.phase || next.timerEnd !== state.timerEnd;
    state = next;
    if (changed) changes.emit(undefined);
  };
  return {
    level: () => powerLevel(state, now()),
    isOn: () => isPowered(state),
    isPumping: () => isPumping(state, now()),
    on: () => {
      move(turnOn(state, now()));
    },
    off: () => {
      move(turnOff(state, now()));
    },
    setTimer: (minutes) => {
      move(setTimer(state, minutes, now()));
    },
    timerMinutes: () => timerMinutes(state),
    timerRemaining: () => timerRemaining(state, now()),
    tick: () => {
      move(tickPower(state, now()));
    },
    subscribe: changes.subscribe,
  };
}
