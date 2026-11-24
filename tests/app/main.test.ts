import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { boot } from "../../src/app/boot";

const STORAGE_PREFIX = "bubble-wall:";

const addRoot = (): HTMLElement => {
  const root = document.createElement("main");
  root.id = "app";
  document.body.append(root);
  return root;
};

describe("boot", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("marks the root as ready and loads saved settings", () => {
    localStorage.setItem(`${STORAGE_PREFIX}settings`, JSON.stringify({ colorId: "pink" }));
    const root = addRoot();
    const app = boot(window, 3);
    expect(root.dataset.ready).toBe("true");
    expect(app.store.get().colorId).toBe("pink");
  });

  it("says what is missing when there is no root", () => {
    expect(() => boot(window, 3)).toThrow(/id 'app'/);
  });

  it("saves a pending change when the page is hidden", () => {
    addRoot();
    const app = boot(window, 3);
    app.store.update((s) => ({ ...s, brightness: 1 }));
    window.dispatchEvent(new Event("pagehide"));
    expect(localStorage.getItem(`${STORAGE_PREFIX}settings`)).toContain('"brightness":1');
  });

  it("saves a pending change when the app goes to the background", () => {
    addRoot();
    const app = boot(window, 3);
    app.store.update((s) => ({ ...s, brightness: 2 }));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(localStorage.getItem(`${STORAGE_PREFIX}settings`)).toContain('"brightness":2');
  });

  it("logs uncaught errors without showing anything", () => {
    addRoot();
    const app = boot(window, 3);
    window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
    expect(app.problems.list().at(-1)?.message).toBe("boom");
  });

  it("starts from main.ts", async () => {
    const root = addRoot();
    await import("../../src/app/main");
    expect(root.dataset.ready).toBe("true");
  });
});
