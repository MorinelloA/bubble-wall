/**
 * Saving and loading. landonarcher.com also serves the Game Room, Marble Run and
 * Pictures, and they all share one storage area, so every key here starts with
 * "bubble-wall:" and nothing outside that prefix is ever touched.
 */
import { parseSettings, type Settings } from "../../core/settings";
import type { Store } from "../../core/store";

const STORAGE_PREFIX = "bubble-wall:";
const SAVE_DELAY_MS = 300;

/** Storage that never throws: a blocked or full store just stops remembering. */
export interface SafeStorage {
  read(name: string): string | null;
  write(name: string, value: string): void;
  /** Removes every key this app owns, and only those. */
  clearOwn(): void;
}

export function createSafeStorage(
  open: () => Storage,
  onProblem: (message: string) => void,
): SafeStorage {
  let reported = false;
  const attempt = <T>(action: (storage: Storage) => T, fallback: T): T => {
    try {
      return action(open());
    } catch (error) {
      if (!reported) {
        reported = true;
        onProblem(`Storage is not available: ${String(error)}`);
      }
      return fallback;
    }
  };
  return {
    read: (name) => attempt((storage) => storage.getItem(STORAGE_PREFIX + name), null),
    write(name, value) {
      attempt((storage) => {
        storage.setItem(STORAGE_PREFIX + name, value);
      }, undefined);
    },
    clearOwn() {
      attempt((storage) => {
        const names = Array.from({ length: storage.length }, (_, index) => storage.key(index));
        for (const name of names) {
          if (name?.startsWith(STORAGE_PREFIX)) storage.removeItem(name);
        }
      }, undefined);
    },
  };
}

export function loadSettings(storage: SafeStorage): Settings {
  return parseSettings(storage.read("settings"));
}

export interface Persistence {
  /** Writes any pending change now. Called when the app is hidden. */
  flush(): void;
}

/** Saves settings a moment after they stop changing, as one write. */
export function persistSettings(store: Store, storage: SafeStorage): Persistence {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  const flush = (): void => {
    clearTimeout(timer);
    if (!pending) return;
    pending = false;
    storage.write("settings", JSON.stringify(store.get()));
  };
  store.subscribe(() => {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MS);
  });
  return { flush };
}
