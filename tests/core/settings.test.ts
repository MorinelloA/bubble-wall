import { describe, expect, it } from "vitest";
import {
  defaultSettings,
  normalizeSettings,
  parseSettings,
  readSettings,
  SETTINGS_VERSION,
} from "../../src/core/settings";

describe("defaultSettings", () => {
  it("starts calm, with bubbles and motor hum like the real wall", () => {
    const settings = defaultSettings();
    expect(settings.feel).toBe("calm");
    expect(settings.layers.bubbles.on).toBe(true);
    expect(settings.layers.motor.on).toBe(true);
    expect(settings.layers.rain.on).toBe(false);
    expect(settings.favourites).toEqual([null, null, null, null]);
  });

  it("survives a round trip through JSON unchanged", () => {
    const settings = defaultSettings();
    expect(parseSettings(JSON.stringify(settings))).toEqual(settings);
  });
});

describe("readSettings", () => {
  const defaults = defaultSettings();

  it.each([
    ["brightness", 99, 8],
    ["brightness", -4, 1],
    ["lightSpeed", 100, 8],
    ["lightSpeed", 0, 1],
    ["bubbleSpeed", 9, 5],
    ["bubbleSpeed", 0, 1],
    ["masterVolume", 7, 1],
    ["masterVolume", -1, 0],
    ["volumeCap", 2, 1],
    ["volumeCap", -0.5, 0],
  ])("clamps %s of %s to %s", (field, saved, expected) => {
    expect(readSettings({ [field]: saved })).toMatchObject({ [field]: expected });
  });

  it("rounds a fractional step to a whole one", () => {
    expect(readSettings({ brightness: 3.6 }).brightness).toBe(4);
  });

  it.each([
    ["brightness", "bright"],
    ["brightness", Number.NaN],
    ["lightSpeed", null],
    ["bubbleSpeed", {}],
    ["masterVolume", "loud"],
    ["volumeCap", Number.POSITIVE_INFINITY],
    ["colorId", "burgundy"],
    ["mode", "disco"],
    ["layout", 3],
    ["floaters", "sharks"],
    ["feel", "wild"],
    ["noiseColor", "green"],
    ["drawerSide", "top"],
    ["bubblesOn", "yes"],
    ["paused", 1],
    ["touchSounds", null],
    ["allowFlashStrobe", "no"],
    ["remoteLocked", 0],
  ])("replaces a bad %s (%s) with its own default and keeps the rest", (field, saved) => {
    const result = readSettings({ masterVolume: 0.25, [field]: saved });
    const kept = field === "masterVolume" ? defaults.masterVolume : 0.25;
    expect(result).toEqual({ ...defaults, masterVolume: kept });
  });

  it("keeps valid values", () => {
    const result = readSettings({ colorId: "pink", mode: "fade", layout: "open", feel: "play" });
    expect(result).toMatchObject({ colorId: "pink", mode: "fade", layout: "open", feel: "play" });
  });

  it("fills in a layer that is missing or broken", () => {
    const result = readSettings({ layers: { rain: { on: true, volume: 5 }, motor: "loud" } });
    expect(result.layers.rain).toEqual({ on: true, volume: 1 });
    expect(result.layers.motor).toEqual(defaults.layers.motor);
    expect(result.layers.chimes).toEqual(defaults.layers.chimes);
  });

  it("reads favourites slot by slot, dropping what is not a look", () => {
    const result = readSettings({ favourites: [{ colorId: "green" }, "nope", null] });
    expect(result.favourites).toHaveLength(4);
    expect(result.favourites.at(0)?.colorId).toBe("green");
    expect(result.favourites.slice(1)).toEqual([null, null, null]);
  });

  it("ignores extra favourites beyond the four slots", () => {
    const six = Array.from({ length: 6 }, () => ({ colorId: "red" }));
    expect(readSettings({ favourites: six }).favourites).toHaveLength(4);
  });

  it("starts fresh when the data is from a newer version", () => {
    expect(readSettings({ version: SETTINGS_VERSION + 1, colorId: "pink" })).toEqual(defaults);
  });

  it("reads data from an older version field by field", () => {
    expect(readSettings({ version: 0, colorId: "pink" }).colorId).toBe("pink");
  });

  it.each([null, undefined, 42, "text", [1, 2]])("gives defaults for %s", (value) => {
    expect(readSettings(value)).toEqual(defaults);
  });
});

describe("parseSettings", () => {
  it("gives defaults when nothing was saved", () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
  });

  it("gives defaults when the saved text is not JSON", () => {
    expect(parseSettings("{oops")).toEqual(defaultSettings());
  });
});

describe("normalizeSettings", () => {
  it.each(["flash", "strobe"] as const)("turns %s into smooth when not allowed", (mode) => {
    const settings = { ...defaultSettings(), mode, allowFlashStrobe: false };
    expect(normalizeSettings(settings).mode).toBe("smooth");
  });

  it("leaves flash alone when allowed", () => {
    const settings = { ...defaultSettings(), mode: "flash" as const };
    expect(normalizeSettings(settings)).toBe(settings);
  });

  it("applies when loading saved data", () => {
    expect(readSettings({ mode: "strobe", allowFlashStrobe: false }).mode).toBe("smooth");
  });
});
