import { describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/core/settings";
import { createStore } from "../../src/core/store";

describe("createStore", () => {
  it("tells listeners the new and the previous settings", () => {
    const store = createStore(defaultSettings());
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.get();
    store.update((s) => ({ ...s, brightness: 2 }));
    expect(store.get().brightness).toBe(2);
    expect(listener).toHaveBeenCalledExactlyOnceWith(store.get(), before);
  });

  it("stays quiet when a change changes nothing", () => {
    const store = createStore(defaultSettings());
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((s) => s);
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops telling a listener that unsubscribed", () => {
    const store = createStore(defaultSettings());
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    stop();
    store.update((s) => ({ ...s, paused: true }));
    expect(listener).not.toHaveBeenCalled();
  });

  it("applies the cross-field rules to every change", () => {
    const store = createStore({ ...defaultSettings(), mode: "flash" });
    store.update((s) => ({ ...s, allowFlashStrobe: false }));
    expect(store.get().mode).toBe("smooth");
  });

  it("applies the cross-field rules to what it starts with", () => {
    const store = createStore({ ...defaultSettings(), mode: "strobe", allowFlashStrobe: false });
    expect(store.get().mode).toBe("smooth");
  });
});
