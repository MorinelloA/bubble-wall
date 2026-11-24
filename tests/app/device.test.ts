import { afterEach, describe, expect, it, vi } from "vitest";
import { boot } from "../../src/app/boot";
import { keepAwake, registerServiceWorker } from "../../src/app/platform/device";

/** A window-shaped object with just what these functions look at. */
const fakeWindow = (parts: { protocol?: string; serviceWorker?: unknown; wakeLock?: unknown }) => {
  const doc = document.implementation.createHTMLDocument("test");
  const visibility = vi.spyOn(doc, "visibilityState", "get").mockReturnValue("visible");
  const win = {
    document: doc,
    location: { protocol: parts.protocol ?? "https:" },
    navigator: { serviceWorker: parts.serviceWorker, wakeLock: parts.wakeLock },
  } as unknown as Window;
  return { win, doc, visibility };
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("registerServiceWorker", () => {
  it.each(["https:", "http:"])("saves the app for offline use over %s", (protocol) => {
    const register = vi.fn().mockResolvedValue(undefined);
    const { win } = fakeWindow({ protocol, serviceWorker: { register } });
    registerServiceWorker(win, vi.fn());
    expect(register).toHaveBeenCalledExactlyOnceWith("./sw.js", { scope: "./" });
  });

  it.each(["capacitor:", "file:"])("does nothing inside a wrapper (%s)", (protocol) => {
    const register = vi.fn();
    const { win } = fakeWindow({ protocol, serviceWorker: { register } });
    registerServiceWorker(win, vi.fn());
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing in a browser with no service workers", () => {
    const { win } = fakeWindow({});
    expect(() => {
      registerServiceWorker(win, vi.fn());
    }).not.toThrow();
  });

  it("logs it and carries on when the offline copy cannot be saved", async () => {
    const register = vi.fn().mockRejectedValue(new Error("no space"));
    const onProblem = vi.fn();
    const { win } = fakeWindow({ serviceWorker: { register } });
    registerServiceWorker(win, onProblem);
    await settle();
    expect(onProblem).toHaveBeenCalledWith(expect.stringMatching(/Offline copy.*no space/));
  });
});

describe("keepAwake", () => {
  it("asks for the screen to stay on straight away", () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const { win } = fakeWindow({ wakeLock: { request } });
    keepAwake(win);
    expect(request).toHaveBeenCalledExactlyOnceWith("screen");
  });

  it("asks again each time the app comes back, and not while it is hidden", () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const { win, doc, visibility } = fakeWindow({ wakeLock: { request } });
    keepAwake(win);
    visibility.mockReturnValue("hidden");
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("can be asked again from a touch", () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const { win } = fakeWindow({ wakeLock: { request } });
    const ask = keepAwake(win);
    ask();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("runs without it when the iPad refuses", async () => {
    const request = vi.fn().mockRejectedValue(new Error("low battery"));
    const { win } = fakeWindow({ wakeLock: { request } });
    keepAwake(win)();
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("runs without it where there is no wake lock at all", () => {
    const { win } = fakeWindow({});
    expect(() => {
      keepAwake(win)();
    }).not.toThrow();
  });
});

describe("boot and offline use", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const withRegister = () => {
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    });
    const root = document.createElement("main");
    root.id = "app";
    document.body.append(root);
    return register;
  };

  it("saves the app for offline use in the published build", () => {
    const register = withRegister();
    boot(window, { seed: 1, offline: true });
    expect(register).toHaveBeenCalledTimes(1);
  });

  it("does not while developing", () => {
    const register = withRegister();
    boot(window, { seed: 1, offline: false });
    expect(register).not.toHaveBeenCalled();
  });
});
