import { describe, expect, it } from "vitest";
import {
  setLayerVolume,
  setMasterVolume,
  setNoiseColor,
  toggleLayer,
} from "../../src/core/actions";
import {
  audioStep,
  needsSoundHint,
  type AudioEvent,
  type AudioPhase,
} from "../../src/core/audioLifecycle";
import { bloopRate, layerGains, masterGain, MAX_VOICES } from "../../src/core/mix";
import { createRng } from "../../src/core/rng";
import { defaultSettings, LAYER_IDS, type Settings } from "../../src/core/settings";
import { bloop, bloopShapes, CHIME_HZ, dropShape, noiseLoop } from "../../src/core/synth";

const base = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), ...over });

describe("the audio table", () => {
  // Every row of the table in the plan, then the rows that keep it from getting stuck.
  const rows: readonly (readonly [AudioPhase, AudioEvent, AudioPhase, string])[] = [
    ["none", "touch", "starting", "create"],
    ["starting", "running", "running", "none"],
    ["running", "interrupted", "suspended", "none"],
    ["running", "hidden", "suspended", "none"],
    ["suspended", "visible", "resuming", "resume"],
    ["suspended", "touch", "resuming", "resume"],
    ["resuming", "running", "running", "none"],
    ["resuming", "timeout", "rebuilding", "discard"],
    ["silent", "touch", "starting", "create"],
    ["rebuilding", "touch", "starting", "create"],

    ["starting", "touch", "starting", "resume"],
    ["starting", "timeout", "starting", "none"],
    ["starting", "hidden", "suspended", "none"],
    ["starting", "interrupted", "starting", "none"],
    ["resuming", "touch", "resuming", "resume"],
    ["resuming", "hidden", "suspended", "none"],
    ["suspended", "running", "running", "none"],
    ["suspended", "hidden", "suspended", "none"],
    ["running", "touch", "running", "none"],
    ["running", "visible", "running", "none"],
    ["running", "timeout", "running", "none"],
    ["none", "visible", "none", "none"],
    ["none", "hidden", "none", "none"],
    ["rebuilding", "visible", "rebuilding", "none"],
    ["silent", "running", "silent", "none"],
  ];

  it.each(rows)("%s + %s -> %s (%s)", (phase, event, next, command) => {
    expect(audioStep(phase, event)).toEqual({ phase: next, command });
  });

  const phases: readonly AudioPhase[] = [
    "none",
    "starting",
    "running",
    "suspended",
    "resuming",
    "rebuilding",
    "silent",
  ];

  it.each(phases)("%s + failed -> silent, and the context is thrown away", (phase) => {
    expect(audioStep(phase, "failed")).toEqual({ phase: "silent", command: "discard" });
  });

  it.each(phases)("the hint shows in %s unless sound is running", (phase) => {
    expect(needsSoundHint(phase)).toBe(phase !== "running");
  });
});

describe("mix", () => {
  it("squares the volume slider into gain", () => {
    expect(masterGain(base({ masterVolume: 0.5, volumeCap: 1 }), 1)).toBeCloseTo(0.25);
    expect(masterGain(base({ masterVolume: 1, volumeCap: 1 }), 1)).toBe(1);
    expect(masterGain(base({ masterVolume: 0, volumeCap: 1 }), 1)).toBe(0);
  });

  it("never goes above the grown-up cap", () => {
    expect(masterGain(base({ masterVolume: 1, volumeCap: 0.5 }), 1)).toBeCloseTo(0.25);
    expect(masterGain(base({ masterVolume: 0.3, volumeCap: 0.5 }), 1)).toBeCloseTo(0.09);
  });

  it("fades with the power level, which is kept between 0 and 1", () => {
    const settings = base({ masterVolume: 1, volumeCap: 1 });
    expect(masterGain(settings, 0.5)).toBeCloseTo(0.5);
    expect(masterGain(settings, 0)).toBe(0);
    expect(masterGain(settings, 7)).toBe(1);
    expect(masterGain(settings, -1)).toBe(0);
  });

  it("gives every layer a gain: silent when off, squared volume when on", () => {
    const gains = layerGains(base());
    expect([...gains.keys()]).toEqual([...LAYER_IDS]);
    expect(gains.get("bubbles")).toBeCloseTo(0.64);
    expect(gains.get("motor")).toBeCloseTo(0.2025);
    expect(gains.get("rain")).toBe(0);
  });

  it("makes more bubble sounds at faster bubble speeds, and none with the pump off", () => {
    const rates = [1, 2, 3, 4, 5].map((bubbleSpeed) => bloopRate(base({ bubbleSpeed })));
    expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    expect(rates.at(0)).toBeGreaterThan(5);
    expect(bloopRate(base({ bubblesOn: false }))).toBe(0);
  });

  it("allows twelve one-shot sounds at once", () => {
    expect(MAX_VOICES).toBe(12);
  });
});

describe("sound actions", () => {
  it("switches one layer and leaves the others alone", () => {
    const start = base();
    const after = toggleLayer("rain")(start);
    expect(after.layers.rain).toEqual({ on: true, volume: start.layers.rain.volume });
    expect(after.layers.bubbles).toBe(start.layers.bubbles);
    expect(toggleLayer("rain")(after).layers.rain.on).toBe(false);
  });

  it("sets one layer's volume, kept between 0 and 1", () => {
    expect(setLayerVolume("motor", 0.2)(base()).layers.motor).toEqual({ on: true, volume: 0.2 });
    expect(setLayerVolume("motor", 9)(base()).layers.motor.volume).toBe(1);
    expect(setLayerVolume("motor", -9)(base()).layers.motor.volume).toBe(0);
  });

  it("hands back the same settings when a volume does not change", () => {
    const start = base();
    expect(setLayerVolume("motor", start.layers.motor.volume)(start)).toBe(start);
    expect(setMasterVolume(start.masterVolume)(start)).toBe(start);
    expect(setNoiseColor(start.noiseColor)(start)).toBe(start);
  });

  it("sets the volume and the kind of noise", () => {
    expect(setMasterVolume(0.9)(base()).masterVolume).toBeCloseTo(0.9);
    expect(setMasterVolume(4)(base()).masterVolume).toBe(1);
    expect(setNoiseColor("pink")(base()).noiseColor).toBe("pink");
  });
});

describe("synth", () => {
  const peak = (samples: Float32Array): number =>
    samples.reduce((most, value) => Math.max(most, Math.abs(value)), 0);

  it.each(["white", "pink", "brown"] as const)(
    "%s noise is audible and stays in range",
    (color) => {
      const samples = noiseLoop(color, 8000, 500, createRng(1));
      expect(samples).toHaveLength(8000);
      expect(peak(samples)).toBeGreaterThan(0.2);
      // The blended start of the loop can briefly reach 1.41; the limiter deals with it.
      expect(peak(samples)).toBeLessThanOrEqual(1.42);
      expect(samples.every((value) => Number.isFinite(value))).toBe(true);
    },
  );

  it("is repeatable for the same seed", () => {
    expect(noiseLoop("pink", 500, 50, createRng(4))).toEqual(
      noiseLoop("pink", 500, 50, createRng(4)),
    );
  });

  it("loops without a jump: the last sample runs on into the first", () => {
    // Brown noise moves slowly, so a seam would show as a step far bigger than its neighbours.
    const samples = noiseLoop("brown", 8000, 1000, createRng(2));
    const steps = Array.from({ length: 7999 }, (_, index) =>
      Math.abs((samples.at(index + 1) ?? 0) - (samples.at(index) ?? 0)),
    );
    const largestInside = Math.max(...steps);
    const seam = Math.abs((samples.at(0) ?? 0) - (samples.at(-1) ?? 0));
    expect(seam).toBeLessThanOrEqual(largestInside * 1.5);
  });

  it("copes with a blend longer than the loop", () => {
    expect(noiseLoop("white", 10, 500, createRng(1))).toHaveLength(10);
  });

  it("a bloop starts and ends in silence and rises in pitch", () => {
    const samples = bloop({ sampleRate: 8000, fromHz: 400, toHz: 800, seconds: 0.1 });
    expect(samples).toHaveLength(800);
    expect(Math.abs(samples.at(0) ?? 1)).toBeLessThan(0.01);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
    expect(peak(samples)).toBeGreaterThan(0.5);
    const crossings = (from: number, to: number): number =>
      samples
        .slice(from, to)
        .reduce(
          (count, value, index, part) =>
            count + (index > 0 && value >= 0 !== (part.at(index - 1) ?? 0) >= 0 ? 1 : 0),
          0,
        );
    expect(crossings(400, 800)).toBeGreaterThan(crossings(0, 400));
  });

  it("is never empty, however short", () => {
    expect(bloop({ sampleRate: 8000, fromHz: 400, toHz: 800, seconds: 0 })).toHaveLength(1);
  });

  it("has a set of bubble sounds from low to high, each a rising chirp", () => {
    const shapes = bloopShapes(44100);
    expect(shapes.length).toBeGreaterThanOrEqual(6);
    for (const shape of shapes) {
      expect(shape.toHz).toBeGreaterThan(shape.fromHz);
      expect(shape.seconds).toBeLessThan(0.15);
    }
    const starts = shapes.map((shape) => shape.fromHz);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it("has a short raindrop and chime notes", () => {
    expect(dropShape(44100).seconds).toBeLessThan(0.03);
    expect(CHIME_HZ.length).toBeGreaterThan(4);
  });
});
