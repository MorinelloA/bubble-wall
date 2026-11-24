import { afterEach, describe, expect, it, vi } from "vitest";
import { createField, stepField } from "../../src/core/bubbles";
import { arrangeFloaters, createFloaters } from "../../src/core/floaters";
import { tubesFor } from "../../src/core/layout";
import { createRng } from "../../src/core/rng";
import { defaultSettings, type Settings } from "../../src/core/settings";
import { createStore } from "../../src/core/store";
import type { TouchEvent } from "../../src/core/touchForces";
import { mountWall } from "../../src/app/wall/mount";
import { drawWall, type Frame } from "../../src/app/wall/renderer";
import { drawBubbleSprite, SPRITE_SIZE } from "../../src/app/wall/sprites";
import { createWall } from "../../src/app/wall/wall";
import { testPower } from "./fakes/page";
import { recordingPen } from "./fakes/pen";

const sizedCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: width });
  Object.defineProperty(canvas, "clientHeight", { value: height });
  return canvas;
};

const harness = (settings: Partial<Settings> = {}, pixelRatio = 1) => {
  const recording = recordingPen();
  const { power, wait } = testPower();
  power.on();
  wait(5000);
  const canvas = sizedCanvas(800, 600);
  const store = createStore({ ...defaultSettings(), ...settings });
  const pending = new Map<number, () => void>();
  const onProblem = vi.fn();
  const onTouchSound = vi.fn();
  /** Touches waiting for the next frame. */
  const touches: TouchEvent[] = [];
  let clock = 0;
  let nextHandle = 1;
  const wall = createWall({
    canvas,
    pen: recording.pen,
    sprite: canvas,
    store,
    power,
    rng: createRng(1),
    pointers: { drain: () => touches.splice(0) },
    onTouchSound,
    now: () => clock,
    requestFrame: (callback) => {
      nextHandle += 1;
      pending.set(nextHandle, callback);
      return nextHandle;
    },
    cancelFrame: (handle) => {
      pending.delete(handle);
    },
    pixelRatio: () => pixelRatio,
    onProblem,
  });
  /** Runs the waiting frame after `ms` milliseconds. */
  const advance = (ms = 1000 / 60, frames = 1): void => {
    for (let n = 0; n < frames; n += 1) {
      clock += ms;
      const [entry] = pending;
      if (!entry) return;
      pending.delete(entry[0]);
      entry[1]();
    }
  };
  /** The first colour stop of a frame: the base colour of the first tube. */
  const baseColor = (): unknown => {
    recording.calls.length = 0;
    advance();
    return recording.named("addColorStop").at(0)?.args.at(1);
  };
  return {
    ...recording,
    canvas,
    store,
    wall,
    pending,
    onProblem,
    advance,
    baseColor,
    power,
    wait,
    touches,
    onTouchSound,
  };
};

describe("drawBubbleSprite", () => {
  it("clears its square, then draws a round bubble with a highlight", () => {
    const { pen, calls, named } = recordingPen();
    drawBubbleSprite(pen);
    expect(calls.at(0)).toEqual({ name: "clearRect", args: [0, 0, SPRITE_SIZE, SPRITE_SIZE] });
    expect(named("arc")).toHaveLength(2);
    expect(named("ellipse")).toHaveLength(2);
    expect(named("fill").length).toBeGreaterThanOrEqual(3);
  });
});

describe("drawWall", () => {
  const size = { width: 800, height: 600 };
  const tubes = tubesFor("tubes6", 800 / 600);
  const red = { r: 1, g: 0, b: 0 };
  const frameOf = (over: Partial<Frame>): Frame => ({
    tubes,
    lights: tubes.map(() => red),
    field: createField(1),
    floaters: createFloaters(),
    floaterKind: "none",
    glows: [],
    level: 1,
    ...over,
  });
  const filledField = () => {
    const field = createField(40);
    stepField(field, {
      dt: 0.5,
      tubes,
      pumpOn: true,
      speed: 3,
      limit: 40,
      forces: [],
      rng: createRng(2),
    });
    return field;
  };

  it("draws every tube in its own light and one picture per bubble", () => {
    const { pen, named } = recordingPen();
    const field = filledField();
    drawWall(pen, size, frameOf({ field }), document.createElement("canvas"));
    const active = field.pool.filter((bubble) => bubble.active).length;
    expect(active).toBeGreaterThan(0);
    expect(named("drawImage")).toHaveLength(active);
    expect(named("createLinearGradient")).toHaveLength(18);
    expect(named("addColorStop").at(0)?.args).toEqual([0, "rgb(255 0 0 / 1)"]);
  });

  it("goes dark with no bubbles when the wall is off", () => {
    const { pen, named } = recordingPen();
    const frame = frameOf({ field: filledField(), level: 0 });
    drawWall(pen, size, frame, document.createElement("canvas"));
    expect(named("drawImage")).toHaveLength(0);
    expect(named("addColorStop").at(0)?.args).toEqual([0, "rgb(0 0 0 / 1)"]);
  });

  it("dims the light and the bubbles together while fading", () => {
    const { pen, named, sets } = recordingPen();
    const frame = frameOf({ field: filledField(), level: 0.5 });
    drawWall(pen, size, frame, document.createElement("canvas"));
    expect(named("addColorStop").at(0)?.args).toEqual([0, "rgb(128 0 0 / 1)"]);
    const alphas = sets.filter((set) => set.name === "globalAlpha").map((set) => set.args.at(0));
    expect(Math.max(...alphas.map(Number).slice(1, -1))).toBeLessThanOrEqual(0.5);
  });

  it("leaves a tube dark when it has no light", () => {
    const { pen, named } = recordingPen();
    drawWall(pen, size, frameOf({ lights: [] }), document.createElement("canvas"));
    expect(named("addColorStop").at(0)?.args).toEqual([0, "rgb(0 0 0 / 1)"]);
  });

  it("adds light where the wall is touched, dimmed with the wall", () => {
    const { pen, named } = recordingPen();
    const glows = [{ x: 0.5, y: 0.5, radius: 0.1, strength: 0.4 }];
    drawWall(pen, size, frameOf({ glows, level: 0.5 }), document.createElement("canvas"));
    expect(named("createRadialGradient")).toHaveLength(1);
    expect(named("createRadialGradient").at(0)?.args).toEqual([300, 300, 0, 300, 300, 60]);
    expect(named("addColorStop").some((call) => call.args.at(1) === "rgb(255 255 255 / 0.2)")).toBe(
      true,
    );
  });

  it.each([
    ["fish", "ellipse", 12],
    ["balls", "arc", 12],
    ["stars", "closePath", 12],
  ] as const)("draws %s when they are chosen", (floaterKind, shape, count) => {
    const { pen, named } = recordingPen();
    const floaters = createFloaters();
    arrangeFloaters(floaters, floaterKind, tubes, createRng(1));
    drawWall(pen, size, frameOf({ floaters, floaterKind }), document.createElement("canvas"));
    expect(named(shape)).toHaveLength(count);
    expect(named("save")).toHaveLength(12);
    expect(named("restore")).toHaveLength(12);
  });

  it("draws no floaters when none are chosen or the wall is off", () => {
    const floaters = createFloaters();
    arrangeFloaters(floaters, "fish", tubes, createRng(1));
    for (const over of [
      { floaterKind: "none" as const },
      { floaterKind: "fish" as const, level: 0 },
    ]) {
      const { pen, named } = recordingPen();
      drawWall(pen, size, frameOf({ floaters, ...over }), document.createElement("canvas"));
      expect(named("save")).toHaveLength(0);
    }
  });
});

describe("createWall", () => {
  it("sizes the canvas to the screen, with at most 2 pixels per point", () => {
    const { wall, canvas } = harness({}, 3);
    wall.resize();
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
  });

  it("never sizes the canvas below one pixel per point", () => {
    const { wall, canvas } = harness({}, 0.5);
    wall.resize();
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
  });

  it("asks for one frame at a time, however often it is started", () => {
    const { wall, pending, advance } = harness();
    wall.resize();
    wall.start();
    wall.start();
    expect(pending.size).toBe(1);
    advance();
    expect(pending.size).toBe(1);
  });

  it("fills with bubbles as it runs", () => {
    const { wall, named, advance } = harness();
    wall.resize();
    wall.start();
    advance(1000 / 60, 300);
    expect(named("drawImage").length).toBeGreaterThan(300);
  });

  it("draws no bubbles when the pump is off", () => {
    const { wall, named, advance } = harness({ bubblesOn: false });
    wall.resize();
    wall.start();
    advance(1000 / 60, 120);
    expect(named("drawImage")).toHaveLength(0);
  });

  it("stops when told to, and can start again", () => {
    const { wall, pending, advance, named } = harness();
    wall.resize();
    wall.start();
    wall.stop();
    wall.stop();
    expect(pending.size).toBe(0);
    wall.start();
    advance();
    expect(named("fillRect").length).toBeGreaterThan(0);
  });

  it("moves the lights on while running and holds them while paused", () => {
    const { wall, store, baseColor, advance } = harness({ mode: "smooth", lightSpeed: 8 });
    wall.resize();
    wall.start();
    const first = baseColor();
    advance(1000 / 60, 60);
    expect(baseColor()).not.toBe(first);

    store.update((s) => ({ ...s, paused: true }));
    const held = baseColor();
    advance(1000 / 60, 60);
    expect(baseColor()).toBe(held);
  });

  it("follows the remote: a new colour shows on the next frame", () => {
    const { wall, store, baseColor } = harness({ mode: "static", colorId: "red", brightness: 8 });
    wall.resize();
    wall.start();
    expect(baseColor()).toBe("rgb(255 31 45 / 1)");
    store.update((s) => ({ ...s, colorId: "white" }));
    expect(baseColor()).toBe("rgb(255 255 255 / 1)");
  });

  it("fades to dark and lets the bubbles float out when switched off", () => {
    const { wall, power, wait, advance, baseColor, calls, named } = harness({
      mode: "static",
      colorId: "white",
      brightness: 8,
    });
    wall.resize();
    wall.start();
    advance(1000 / 60, 600);
    power.off();
    wait(1000);
    expect(baseColor()).toBe("rgb(128 128 128 / 1)");
    wait(1000);
    advance(1000 / 60, 60 * 20);
    expect(power.level()).toBe(0);
    expect(baseColor()).toBe("rgb(0 0 0 / 1)");
    calls.length = 0;
    advance();
    expect(named("drawImage")).toHaveLength(0);
  });

  it("a touch lights the wall under the finger and, in Play, bursts and bloops", () => {
    const { wall, touches, onTouchSound, advance, calls, named } = harness({ feel: "play" });
    wall.resize();
    wall.start();
    advance();
    calls.length = 0;
    advance();
    expect(named("createRadialGradient")).toHaveLength(0);

    touches.push({ type: "down", id: 1, x: 0.1, y: 0.5 });
    calls.length = 0;
    advance();
    expect(onTouchSound).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ kind: "bloop", pitch: 0.5 }),
    );
    expect(named("createRadialGradient").length).toBeGreaterThanOrEqual(2);
    expect(named("drawImage").length).toBeGreaterThanOrEqual(8);

    touches.push({ type: "up", id: 1, x: 0.1, y: 0.5 });
    advance(1000 / 60, 120);
    calls.length = 0;
    advance();
    expect(named("createRadialGradient")).toHaveLength(0);
  });

  it("shows floaters when they are switched on, without a resize", () => {
    const { wall, store, advance, calls, named } = harness();
    wall.resize();
    wall.start();
    advance();
    expect(named("save")).toHaveLength(0);
    store.update((s) => ({ ...s, floaters: "stars" }));
    calls.length = 0;
    advance();
    expect(named("save")).toHaveLength(12);
  });

  it("redraws with the new tubes when the layout changes", () => {
    const { wall, store, advance, calls, named } = harness();
    wall.resize();
    wall.start();
    advance();
    expect(named("createLinearGradient")).toHaveLength(18);
    store.update((s) => ({ ...s, layout: "tubes3" }));
    calls.length = 0;
    advance();
    expect(named("createLinearGradient")).toHaveLength(9);
  });

  it("takes a long stall in one small step, so bubbles are not flung", () => {
    const { wall, advance, named } = harness();
    wall.resize();
    wall.start();
    advance(60_000);
    expect(named("drawImage").length).toBeLessThan(20);
  });

  it("logs a drawing failure once, keeps going, and draws again when it can", () => {
    const { wall, advance, onProblem, breakOn, pending, calls, named } = harness();
    wall.resize();
    wall.start();
    breakOn("fillRect");
    advance(1000 / 60, 100);
    expect(onProblem).toHaveBeenCalledTimes(1);
    expect(onProblem.mock.calls.at(0)?.at(0)).toMatch(/Drawing failed.*fillRect/);
    expect(pending.size).toBe(1);

    advance(5000);
    expect(onProblem).toHaveBeenCalledTimes(2);

    breakOn(null);
    calls.length = 0;
    advance();
    expect(named("fillRect").length).toBeGreaterThan(0);
  });
});

describe("mountWall", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const host = () => ({
    win: window,
    root: document.body,
    store: createStore(defaultSettings()),
    power: testPower().power,
    rng: createRng(1),
    onTouchSound: vi.fn(),
    onProblem: vi.fn(),
  });

  it("adds a labelled canvas and reports when the device cannot draw", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const wallHost = host();
    expect(mountWall(wallHost)).toBeNull();
    const canvas = document.querySelector("canvas.wall");
    expect(canvas?.getAttribute("role")).toBe("img");
    expect(canvas?.getAttribute("aria-label")).toBe("Bubble wall");
    expect(wallHost.onProblem).toHaveBeenCalledWith(expect.stringMatching(/cannot draw/));
  });

  it("starts the wall, pauses it in the background and follows the screen size", () => {
    const { pen } = recordingPen();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(pen as never);
    const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockReturnValue();
    const visibility = vi.spyOn(document, "visibilityState", "get");

    expect(mountWall(host())).not.toBeNull();
    expect(request).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancel).toHaveBeenCalledWith(7);

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(request).toHaveBeenCalledTimes(2);

    const canvas = document.querySelector("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 500 });
    Object.defineProperty(canvas, "clientHeight", { value: 400 });
    window.dispatchEvent(new Event("resize"));
    expect(canvas?.width).toBe(500);
  });
});
