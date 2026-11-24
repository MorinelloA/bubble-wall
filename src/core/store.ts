/** The one place settings live. Everything else reads from here and subscribes. */
import { normalizeSettings, type Settings } from "./settings";

export type Change = (settings: Settings) => Settings;
export type Listener = (next: Settings, previous: Settings) => void;

export interface Store {
  get(): Settings;
  /** Applies a change. Listeners hear about it only if something actually changed. */
  update(change: Change): void;
  /** Returns a function that stops listening. */
  subscribe(listener: Listener): () => void;
}

export function createStore(initial: Settings): Store {
  let current = normalizeSettings(initial);
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    update(change) {
      const previous = current;
      const next = normalizeSettings(change(previous));
      if (next === previous) return;
      current = next;
      for (const listener of listeners) listener(next, previous);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
