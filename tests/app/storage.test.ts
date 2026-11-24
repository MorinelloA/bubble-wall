import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/core/settings";
import { createStore } from "../../src/core/store";
import { createSafeStorage, loadSettings, persistSettings } from "../../src/app/platform/storage";
import { brokenStorage, memoryStorage } from "./fakes/storage";

const STORAGE_PREFIX = "bubble-wall:";

describe("createSafeStorage", () => {
  it("keeps every key under the prefix this app owns", () => {
    const raw = memoryStorage();
    const storage = createSafeStorage(() => raw, vi.fn());
    storage.write("settings", "x");
    expect(raw.getItem(`${STORAGE_PREFIX}settings`)).toBe("x");
    expect(storage.read("settings")).toBe("x");
  });

  it("carries on and reports once when storage is blocked", () => {
    const onProblem = vi.fn();
    const storage = createSafeStorage(brokenStorage, onProblem);
    expect(storage.read("settings")).toBeNull();
    storage.write("settings", "x");
    storage.clearOwn();
    expect(onProblem).toHaveBeenCalledTimes(1);
    expect(onProblem.mock.calls.at(0)?.at(0)).toMatch(/not available/);
  });

  it("carries on when a write fails because storage is full", () => {
    const raw = memoryStorage();
    raw.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    const onProblem = vi.fn();
    createSafeStorage(() => raw, onProblem).write("settings", "x");
    expect(onProblem).toHaveBeenCalledTimes(1);
  });

  it("clears its own keys and leaves the keys of the other apps alone", () => {
    const raw = memoryStorage({
      "marblerun:save": "keep",
      [`${STORAGE_PREFIX}settings`]: "go",
      "games-progress": "keep",
      [`${STORAGE_PREFIX}problems`]: "go",
    });
    createSafeStorage(() => raw, vi.fn()).clearOwn();
    expect(raw).toHaveLength(2);
    expect(raw.getItem("marblerun:save")).toBe("keep");
    expect(raw.getItem("games-progress")).toBe("keep");
  });
});

describe("loadSettings", () => {
  it("reads what was saved", () => {
    const saved = JSON.stringify({ ...defaultSettings(), colorId: "pink" });
    const raw = memoryStorage({ [`${STORAGE_PREFIX}settings`]: saved });
    expect(loadSettings(createSafeStorage(() => raw, vi.fn())).colorId).toBe("pink");
  });

  it("gives defaults when storage is blocked", () => {
    expect(loadSettings(createSafeStorage(brokenStorage, vi.fn()))).toEqual(defaultSettings());
  });
});

describe("persistSettings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const raw = memoryStorage();
    const write = vi.spyOn(raw, "setItem");
    const store = createStore(defaultSettings());
    const persistence = persistSettings(
      store,
      createSafeStorage(() => raw, vi.fn()),
    );
    return { raw, write, store, persistence };
  };

  it("saves once, a moment after the changes stop", () => {
    const { raw, write, store } = setup();
    store.update((s) => ({ ...s, brightness: 2 }));
    vi.advanceTimersByTime(200);
    store.update((s) => ({ ...s, brightness: 3 }));
    vi.advanceTimersByTime(299);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(loadSettings(createSafeStorage(() => raw, vi.fn())).brightness).toBe(3);
  });

  it("saves straight away when flushed, and not again afterwards", () => {
    const { write, store, persistence } = setup();
    store.update((s) => ({ ...s, paused: true }));
    persistence.flush();
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("writes nothing when flushed with nothing changed", () => {
    const { write, persistence } = setup();
    persistence.flush();
    expect(write).not.toHaveBeenCalled();
  });
});
