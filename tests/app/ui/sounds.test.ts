import { describe, expect, it, vi } from "vitest";
import type { AudioPhase } from "../../../src/core/audioLifecycle";
import { defaultSettings, type Settings } from "../../../src/core/settings";
import { createStore } from "../../../src/core/store";
import type { AudioEngine } from "../../../src/app/audio/engine";
import { slider } from "../../../src/app/ui/dom";
import { createSoundHint, createSoundsPanel } from "../../../src/app/ui/sounds";
import { buttonNamed, isPressed } from "../fakes/page";

const setup = (over: Partial<Settings> = {}) => {
  const store = createStore({ ...defaultSettings(), ...over });
  const panel = createSoundsPanel(document, store);
  const sliderNamed = (name: string): HTMLInputElement => {
    const label = [...panel.querySelectorAll("label")].find(
      (candidate) => candidate.querySelector(".slider-name")?.textContent === name,
    );
    const input = label?.querySelector("input");
    if (!input) throw new Error(`No slider named "${name}"`);
    return input;
  };
  const move = (name: string, value: number): void => {
    const input = sliderNamed(name);
    input.value = String(value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return { store, panel, sliderNamed, move };
};

describe("slider", () => {
  it("is a labelled range from 0 to 1 that reports as it moves", () => {
    const onInput = vi.fn();
    const control = slider(document, { label: "Volume", onInput });
    const input = control.element.querySelector("input");
    expect(control.element.tagName).toBe("LABEL");
    expect(control.element.textContent).toBe("Volume");
    expect(input?.type).toBe("range");
    control.show(0.25);
    expect(input?.value).toBe("25");
    expect(input?.style.getPropertyValue("--fill")).toBe("25%");
    if (input) input.value = "80";
    input?.dispatchEvent(new Event("input"));
    expect(onInput).toHaveBeenCalledWith(0.8);
    expect(input?.style.getPropertyValue("--fill")).toBe("80%");
  });
});

describe("the Sounds tab", () => {
  const names = [
    "Bubbles",
    "Motor",
    "Stream",
    "Rain",
    "Ocean",
    "Deep water",
    "Noise",
    "Chimes",
  ] as const;

  it("has a tile for each of the eight sounds, lit for the ones that are on", () => {
    const { panel } = setup();
    for (const name of names) expect(buttonNamed(panel, name)).toBeDefined();
    expect(isPressed(buttonNamed(panel, "Bubbles"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Motor"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Rain"))).toBe(false);
  });

  it.each([
    ["Bubbles", "bubbles"],
    ["Motor", "motor"],
    ["Stream", "stream"],
    ["Rain", "rain"],
    ["Ocean", "ocean"],
    ["Deep water", "deep"],
    ["Noise", "noise"],
    ["Chimes", "chimes"],
  ] as const)("the %s tile switches that sound on and off", (name, id) => {
    const { store, panel } = setup();
    const before = new Map(Object.entries(store.get().layers)).get(id)?.on;
    buttonNamed(panel, name).click();
    const after = new Map(Object.entries(store.get().layers)).get(id)?.on;
    expect(after).toBe(!before);
    expect(isPressed(buttonNamed(panel, name))).toBe(!before);
  });

  it("lets any mix of sounds be on together", () => {
    const { store, panel } = setup();
    buttonNamed(panel, "Rain").click();
    buttonNamed(panel, "Chimes").click();
    const on = Object.entries(store.get().layers)
      .filter(([, layer]) => layer.on)
      .map(([id]) => id);
    expect(on).toEqual(["bubbles", "motor", "rain", "chimes"]);
  });

  it("sets the overall volume", () => {
    const { store, sliderNamed, move } = setup({ masterVolume: 0.6 });
    expect(sliderNamed("Volume").value).toBe("60");
    move("Volume", 35);
    expect(store.get().masterVolume).toBeCloseTo(0.35);
  });

  it("shows a mix slider for each sound that is on, and only those", () => {
    const { panel, sliderNamed, store } = setup();
    const row = (name: string) => sliderNamed(name).closest("label");
    expect(row("Bubbles")?.hidden).toBe(false);
    expect(row("Rain")?.hidden).toBe(true);
    buttonNamed(panel, "Rain").click();
    expect(row("Rain")?.hidden).toBe(false);
    expect(sliderNamed("Rain").value).toBe(String(store.get().layers.rain.volume * 100));
  });

  it("sets one sound's level from its mix slider", () => {
    const { store, move } = setup();
    move("Motor", 90);
    expect(store.get().layers.motor).toEqual({ on: true, volume: 0.9 });
    expect(store.get().layers.bubbles.volume).toBeCloseTo(0.8);
  });

  it("offers the kinds of noise only while Noise is on", () => {
    const { store, panel } = setup();
    const choices = panel.querySelector<HTMLElement>(".choices");
    expect(choices?.hidden).toBe(true);
    buttonNamed(panel, "Noise").click();
    expect(choices?.hidden).toBe(false);
    expect(isPressed(buttonNamed(panel, "Brown noise"))).toBe(true);
    buttonNamed(panel, "Pink noise").click();
    expect(store.get().noiseColor).toBe("pink");
    expect(isPressed(buttonNamed(panel, "Pink noise"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Brown noise"))).toBe(false);
    buttonNamed(panel, "White noise").click();
    expect(store.get().noiseColor).toBe("white");
  });
});

describe("the sound hint", () => {
  const fakeEngine = (start: AudioPhase) => {
    let phase = start;
    const listeners: ((phase: AudioPhase) => void)[] = [];
    const engine: AudioEngine = {
      touch: vi.fn(),
      hidden: vi.fn(),
      visible: vi.fn(),
      play: vi.fn(),
      phase: () => phase,
      subscribe: (listener) => {
        listeners.push(listener);
        return vi.fn();
      },
    };
    const become = (next: AudioPhase): void => {
      phase = next;
      for (const listener of listeners) listener(next);
    };
    return { engine, become };
  };

  it("shows whenever sound is not playing, and hides when it is", () => {
    const { engine, become } = fakeEngine("none");
    const hint = createSoundHint(document, engine);
    expect(hint.getAttribute("aria-label")).toBe("Tap for sound");
    expect(hint.hidden).toBe(false);
    become("running");
    expect(hint.hidden).toBe(true);
    for (const phase of ["suspended", "resuming", "rebuilding", "silent", "starting"] as const) {
      become(phase);
      expect(hint.hidden).toBe(false);
    }
  });

  it("counts as a touch when pressed", () => {
    const { engine } = fakeEngine("silent");
    createSoundHint(document, engine).click();
    expect(engine.touch).toHaveBeenCalledTimes(1);
  });
});
