/** The wall's power, as something the page can press and watch. */
import { initialPower, powerLevel, tickPower, turnOff, turnOn } from "../core/power";

export interface PowerControl {
  /** 0 dark to 1 fully on, right now. */
  readonly level: () => number;
  /** True from the moment On is pressed until the moment Off is pressed. */
  readonly isOn: () => boolean;
  readonly on: () => void;
  readonly off: () => void;
  /** Call every frame, so a finished fade becomes off. */
  readonly tick: () => void;
  /** Hears whenever the wall is switched on or off, or finishes fading out. */
  readonly subscribe: (listener: () => void) => () => void;
}

export function createPowerControl(now: () => number): PowerControl {
  let state = initialPower();
  const listeners = new Set<() => void>();
  const move = (next: typeof state): void => {
    if (next === state) return;
    const changed = next.phase !== state.phase;
    state = next;
    if (changed) for (const listener of listeners) listener();
  };
  return {
    level: () => powerLevel(state, now()),
    isOn: () => state.phase === "on",
    on: () => {
      move(turnOn(state, now()));
    },
    off: () => {
      move(turnOff(state, now()));
    },
    tick: () => {
      move(tickPower(state, now()));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
