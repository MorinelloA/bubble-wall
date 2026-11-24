/** Ready-made looks to start from, and how a look is taken from the current settings. */
import { defaultLook, type LayerId, type Look, type Settings } from "./settings";

export interface Scene {
  readonly id: string;
  readonly name: string;
  readonly look: Look;
}

/** The layers that are on, each with its volume. Every other layer is off. */
function soundOf(on: Readonly<Partial<Record<LayerId, number>>>): Look["layers"] {
  const chosen = new Map(Object.entries(on));
  const entries = Object.entries(defaultLook().layers).map(([id, layer]) => {
    const volume = chosen.get(id);
    return [id, { on: volume !== undefined, volume: volume ?? layer.volume }];
  });
  return Object.fromEntries(entries) as Look["layers"];
}

const scene = (id: string, name: string, look: Partial<Look>): Scene => ({
  id,
  name,
  look: { ...defaultLook(), ...look },
});

export const SCENES: readonly Scene[] = [
  scene("ocean-calm", "Ocean Calm", {
    colorId: "teal",
    mode: "fade",
    brightness: 5,
    lightSpeed: 1,
    bubbleSpeed: 1,
    layout: "tubes6",
    layers: soundOf({ ocean: 0.7, bubbles: 0.4 }),
  }),
  scene("rainbow", "Rainbow", {
    mode: "rainbow",
    brightness: 7,
    lightSpeed: 4,
    bubbleSpeed: 3,
    layout: "tubes6",
    layers: soundOf({ bubbles: 0.8, motor: 0.4 }),
  }),
  scene("night-light", "Night Light", {
    colorId: "indigo",
    mode: "static",
    brightness: 2,
    bubbleSpeed: 1,
    layout: "tubes6",
    layers: soundOf({ deep: 0.5 }),
  }),
  scene("lava", "Lava", {
    colorId: "red-orange",
    mode: "breathe",
    brightness: 6,
    bubbleSpeed: 1,
    layout: "tubes3",
    layers: soundOf({ motor: 0.5, deep: 0.5 }),
  }),
];

/** The look and sound part of the settings: what a favourite remembers. */
export function lookOf(settings: Settings): Look {
  return {
    colorId: settings.colorId,
    mode: settings.mode,
    brightness: settings.brightness,
    lightSpeed: settings.lightSpeed,
    bubblesOn: settings.bubblesOn,
    bubbleSpeed: settings.bubbleSpeed,
    layout: settings.layout,
    floaters: settings.floaters,
    layers: settings.layers,
    noiseColor: settings.noiseColor,
  };
}
