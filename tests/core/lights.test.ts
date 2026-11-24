import { describe, expect, it } from "vitest";
import { hexToRgb, type Rgb } from "../../src/core/color";
import {
  brightnessLevel,
  lightSpeedFactor,
  tubeLights,
  type LightInput,
} from "../../src/core/lights";
import { colorHex, FLASH_SEQUENCE } from "../../src/core/palette";
import { LIGHT_MODES } from "../../src/core/settings";

const RED: Rgb = { r: 1, g: 0, b: 0 };
const SPEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const input = (over: Partial<LightInput>): LightInput => ({
  mode: "static",
  color: RED,
  speed: 4,
  brightness: 8,
  time: 0,
  tubes: 6,
  ...over,
});

const first = (over: Partial<LightInput>): Rgb => {
  const light = tubeLights(input(over)).at(0);
  if (!light) throw new Error("no tubes");
  return light;
};

const near = (a: Rgb, b: Rgb): boolean =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-6;

describe("every show, at every speed", () => {
  const cases = LIGHT_MODES.flatMap((mode) => SPEEDS.map((speed) => [mode, speed] as const));

  it.each(cases)("%s at speed %s gives one sane colour per tube", (mode, speed) => {
    for (let time = 0; time < 90; time += 0.37) {
      const lights = tubeLights(input({ mode, speed, time }));
      expect(lights).toHaveLength(6);
      for (const light of lights) {
        for (const value of [light.r, light.g, light.b]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("static", () => {
  it("holds the chosen colour on every tube, whatever the time", () => {
    for (const time of [0, 1.3, 500]) {
      expect(tubeLights(input({ time })).every((light) => near(light, RED))).toBe(true);
    }
  });
});

describe("flash", () => {
  it.each(SPEEDS)("jumps through its seven colours in order at speed %s", (speed) => {
    const hold = 0.9 / lightSpeedFactor(speed);
    const seen = FLASH_SEQUENCE.map((_, index) =>
      first({ mode: "flash", speed, time: (index + 0.5) * hold }),
    );
    expect(seen).toEqual(FLASH_SEQUENCE.map((id) => hexToRgb(colorHex(id))));
  });

  it("holds each colour, then jumps with nothing in between", () => {
    const hold = 0.9 / lightSpeedFactor(4);
    expect(first({ mode: "flash", time: hold * 0.01 })).toEqual(hexToRgb(colorHex("red")));
    expect(first({ mode: "flash", time: hold * 0.99 })).toEqual(hexToRgb(colorHex("red")));
    expect(first({ mode: "flash", time: hold * 1.01 })).toEqual(hexToRgb(colorHex("green")));
  });

  it("starts again after the seventh colour", () => {
    const hold = 0.9 / lightSpeedFactor(4);
    expect(first({ mode: "flash", time: hold * 7.5 })).toEqual(hexToRgb(colorHex("red")));
  });
});

describe("strobe", () => {
  it.each(SPEEDS)("is on for half of each blink and off for half at speed %s", (speed) => {
    const period = 0.5 / lightSpeedFactor(speed);
    expect(near(first({ mode: "strobe", speed, time: period * 0.25 }), RED)).toBe(true);
    expect(first({ mode: "strobe", speed, time: period * 0.75 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(near(first({ mode: "strobe", speed, time: period * 1.25 }), RED)).toBe(true);
  });
});

describe("fade", () => {
  it.each(SPEEDS)("breathes the chosen colour between dim and full at speed %s", (speed) => {
    const period = 5 / lightSpeedFactor(speed);
    expect(first({ mode: "fade", speed, time: 0 }).r).toBeCloseTo(0.12);
    expect(first({ mode: "fade", speed, time: period / 2 }).r).toBeCloseTo(1);
    expect(first({ mode: "fade", speed, time: period }).r).toBeCloseTo(0.12);
    expect(first({ mode: "fade", speed, time: period / 4 }).g).toBe(0);
  });
});

describe("smooth", () => {
  it("shows the same colour on every tube", () => {
    const lights = tubeLights(input({ mode: "smooth", time: 3.3 }));
    expect(lights.every((light) => near(light, lights.at(0) ?? RED))).toBe(true);
  });

  it.each(SPEEDS)("travels the whole rainbow and returns at speed %s", (speed) => {
    const period = 24 / lightSpeedFactor(speed);
    expect(near(first({ mode: "smooth", speed, time: 0 }), RED)).toBe(true);
    expect(first({ mode: "smooth", speed, time: period / 3 }).g).toBeCloseTo(1);
    expect(first({ mode: "smooth", speed, time: (period * 2) / 3 }).b).toBeCloseTo(1);
    expect(first({ mode: "smooth", speed, time: period }).r).toBeCloseTo(1);
  });

  it("changes a little at a time", () => {
    const a = first({ mode: "smooth", time: 5 });
    const b = first({ mode: "smooth", time: 5.016 });
    expect(Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)).toBeLessThan(0.02);
  });
});

describe("rainbow", () => {
  it("gives each tube its own colour", () => {
    const lights = tubeLights(input({ mode: "rainbow", time: 1 }));
    const distinct = new Set(lights.map((light) => JSON.stringify(light)));
    expect(distinct.size).toBe(6);
  });

  it("drifts over time", () => {
    expect(near(first({ mode: "rainbow", time: 0 }), first({ mode: "rainbow", time: 9 }))).toBe(
      false,
    );
  });

  it("copes with a wall that has no tubes", () => {
    expect(tubeLights(input({ mode: "rainbow", tubes: 0 }))).toEqual([]);
  });
});

describe("breathe", () => {
  it.each(SPEEDS)("swells for 4 seconds and eases for 6, whatever speed %s is set", (speed) => {
    expect(first({ mode: "breathe", speed, time: 0 }).r).toBeCloseTo(0.25);
    expect(first({ mode: "breathe", speed, time: 4 }).r).toBeCloseTo(1);
    expect(first({ mode: "breathe", speed, time: 7 }).r).toBeCloseTo(0.625);
    expect(first({ mode: "breathe", speed, time: 10 }).r).toBeCloseTo(0.25);
    expect(first({ mode: "breathe", speed, time: 14 }).r).toBeCloseTo(1);
  });
});

describe("brightness", () => {
  it("gets brighter with every step and is never dark", () => {
    const levels = [1, 2, 3, 4, 5, 6, 7, 8].map(brightnessLevel);
    expect(levels.at(0)).toBeCloseTo(0.2);
    expect(levels.at(-1)).toBe(1);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(new Set(levels).size).toBe(8);
  });

  it("scales the light", () => {
    expect(first({ brightness: 1 }).r).toBeCloseTo(0.2);
  });

  it("treats a step outside the range as the nearest end", () => {
    expect(brightnessLevel(0)).toBe(brightnessLevel(1));
    expect(brightnessLevel(99)).toBe(1);
  });
});

describe("speed", () => {
  it("gets faster with every step, by the same ratio each time", () => {
    const factors = SPEEDS.map(lightSpeedFactor);
    expect(factors.at(0)).toBeCloseTo(0.35);
    expect(factors.at(-1)).toBeCloseTo(3);
    const ratios = factors.slice(1).map((factor, index) => factor / (factors.at(index) ?? 1));
    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios.at(0) ?? 0);
  });
});
