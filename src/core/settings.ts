/**
 * Everything the app remembers, with its defaults and the rules for reading it back.
 * Saved data is never trusted: each field is checked on its own and falls back to
 * its own default, so one bad value cannot wipe the rest.
 */
import { COLOR_IDS, type ColorId } from "./palette";
import { clamp, fieldsOf, type Fields } from "./util";

export const SETTINGS_VERSION = 1;

export const LIGHT_MODES = [
  "static",
  "flash",
  "strobe",
  "fade",
  "smooth",
  "rainbow",
  "breathe",
] as const;
export type LightMode = (typeof LIGHT_MODES)[number];

export const LAYOUTS = ["tubes6", "tubes3", "open"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const FLOATER_KINDS = ["none", "fish", "balls", "stars"] as const;
export type FloaterKind = (typeof FLOATER_KINDS)[number];

export const FEELS = ["calm", "play"] as const;
export type Feel = (typeof FEELS)[number];

export const NOISE_COLORS = ["white", "pink", "brown"] as const;
export type NoiseColor = (typeof NOISE_COLORS)[number];

export const LAYER_IDS = [
  "bubbles",
  "motor",
  "stream",
  "rain",
  "ocean",
  "deep",
  "noise",
  "chimes",
] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export const DRAWER_SIDES = ["right", "left"] as const;
export type DrawerSide = (typeof DRAWER_SIDES)[number];

export const BRIGHTNESS_STEPS = 8;
export const LIGHT_SPEED_STEPS = 8;
export const BUBBLE_SPEED_STEPS = 5;
export const FAVOURITE_SLOTS = 4;

export interface LayerSetting {
  readonly on: boolean;
  /** 0 to 1. */
  readonly volume: number;
}

export type LayerMix = Readonly<Record<LayerId, LayerSetting>>;

/** The look and sound of the wall: what a favourite stores. */
export interface Look {
  readonly colorId: ColorId;
  readonly mode: LightMode;
  readonly brightness: number;
  readonly lightSpeed: number;
  readonly bubblesOn: boolean;
  readonly bubbleSpeed: number;
  readonly layout: Layout;
  readonly floaters: FloaterKind;
  readonly layers: LayerMix;
  readonly noiseColor: NoiseColor;
}

export interface Settings extends Look {
  readonly version: number;
  /** Lights frozen on the current colour. */
  readonly paused: boolean;
  readonly feel: Feel;
  /** 0 to 1. */
  readonly masterVolume: number;
  readonly touchSounds: boolean;
  readonly favourites: readonly (Look | null)[];
  /** Grown-up limit on volume, 0 to 1. */
  readonly volumeCap: number;
  readonly allowFlashStrobe: boolean;
  readonly remoteLocked: boolean;
  readonly drawerSide: DrawerSide;
}

const layer = (on: boolean, volume: number): LayerSetting => ({ on, volume });

export function defaultLook(): Look {
  return {
    colorId: "sky-blue",
    mode: "smooth",
    brightness: 6,
    lightSpeed: 3,
    bubblesOn: true,
    bubbleSpeed: 2,
    layout: "tubes6",
    floaters: "none",
    layers: {
      bubbles: layer(true, 0.8),
      motor: layer(true, 0.45),
      stream: layer(false, 0.6),
      rain: layer(false, 0.6),
      ocean: layer(false, 0.6),
      deep: layer(false, 0.6),
      noise: layer(false, 0.5),
      chimes: layer(false, 0.5),
    },
    noiseColor: "brown",
  };
}

export function defaultSettings(): Settings {
  return {
    ...defaultLook(),
    version: SETTINGS_VERSION,
    paused: false,
    feel: "calm",
    masterVolume: 0.6,
    touchSounds: true,
    favourites: Array.from({ length: FAVOURITE_SLOTS }, () => null),
    volumeCap: 0.8,
    allowFlashStrobe: true,
    remoteLocked: false,
    drawerSide: "right",
  };
}

function oneOf<T extends string>(raw: Fields, name: string, options: readonly T[], fallback: T): T {
  const value = raw.get(name);
  return options.find((option) => option === value) ?? fallback;
}

function wholeNumber(
  raw: Fields,
  name: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = raw.get(name);
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(Math.round(value), min, max)
    : fallback;
}

function fraction(raw: Fields, name: string, fallback: number): number {
  const value = raw.get(name);
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
}

function flag(raw: Fields, name: string, fallback: boolean): boolean {
  const value = raw.get(name);
  return typeof value === "boolean" ? value : fallback;
}

function readLayers(value: unknown, fallback: LayerMix): LayerMix {
  const raw = fieldsOf(value);
  const defaults = new Map(Object.entries(fallback));
  const entries = LAYER_IDS.map((id) => {
    const saved = fieldsOf(raw.get(id));
    const base = defaults.get(id) ?? layer(false, 0.5);
    return [id, layer(flag(saved, "on", base.on), fraction(saved, "volume", base.volume))];
  });
  return Object.fromEntries(entries) as LayerMix;
}

function readLook(raw: Fields, fallback: Look): Look {
  return {
    colorId: oneOf(raw, "colorId", COLOR_IDS, fallback.colorId),
    mode: oneOf(raw, "mode", LIGHT_MODES, fallback.mode),
    brightness: wholeNumber(raw, "brightness", 1, BRIGHTNESS_STEPS, fallback.brightness),
    lightSpeed: wholeNumber(raw, "lightSpeed", 1, LIGHT_SPEED_STEPS, fallback.lightSpeed),
    bubblesOn: flag(raw, "bubblesOn", fallback.bubblesOn),
    bubbleSpeed: wholeNumber(raw, "bubbleSpeed", 1, BUBBLE_SPEED_STEPS, fallback.bubbleSpeed),
    layout: oneOf(raw, "layout", LAYOUTS, fallback.layout),
    floaters: oneOf(raw, "floaters", FLOATER_KINDS, fallback.floaters),
    layers: readLayers(raw.get("layers"), fallback.layers),
    noiseColor: oneOf(raw, "noiseColor", NOISE_COLORS, fallback.noiseColor),
  };
}

function readFavourites(value: unknown): (Look | null)[] {
  const saved: unknown[] = Array.isArray(value) ? value : [];
  return Array.from({ length: FAVOURITE_SLOTS }, (_, slot) => {
    const raw = fieldsOf(saved.at(slot));
    return raw.size > 0 ? readLook(raw, defaultLook()) : null;
  });
}

/** Flash and Strobe only run while a grown-up allows them. */
export function isFlashing(mode: LightMode): boolean {
  return mode === "flash" || mode === "strobe";
}

/** Rules that span more than one field. Applied after every change and every load. */
export function normalizeSettings(settings: Settings): Settings {
  const blocked = !settings.allowFlashStrobe && isFlashing(settings.mode);
  return blocked ? { ...settings, mode: "smooth" } : settings;
}

/** Turns anything that was saved into valid settings. */
export function readSettings(value: unknown): Settings {
  const raw = fieldsOf(value);
  const defaults = defaultSettings();
  const version = raw.get("version");
  // Data from a newer app than this one cannot be understood safely: start fresh.
  if (typeof version === "number" && version > SETTINGS_VERSION) return defaults;
  return normalizeSettings({
    ...readLook(raw, defaults),
    version: SETTINGS_VERSION,
    paused: flag(raw, "paused", defaults.paused),
    feel: oneOf(raw, "feel", FEELS, defaults.feel),
    masterVolume: fraction(raw, "masterVolume", defaults.masterVolume),
    touchSounds: flag(raw, "touchSounds", defaults.touchSounds),
    favourites: readFavourites(raw.get("favourites")),
    volumeCap: fraction(raw, "volumeCap", defaults.volumeCap),
    allowFlashStrobe: flag(raw, "allowFlashStrobe", defaults.allowFlashStrobe),
    remoteLocked: flag(raw, "remoteLocked", defaults.remoteLocked),
    drawerSide: oneOf(raw, "drawerSide", DRAWER_SIDES, defaults.drawerSide),
  });
}

/** Reads saved JSON text. Missing or broken text gives the defaults. */
export function parseSettings(text: string | null): Settings {
  if (text === null) return defaultSettings();
  try {
    return readSettings(JSON.parse(text));
  } catch {
    return defaultSettings();
  }
}
