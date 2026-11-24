/** From settings to loudness: what each sound layer and the whole mix should play at. */
import { riseSpeed } from "./bubbles";
import type { LayerId, Settings } from "./settings";
import { clamp } from "./util";

/** Ears hear loudness roughly as the square of a slider, so sliders are squared into gain. */
const toGain = (slider: number): number => {
  const value = clamp(slider, 0, 1);
  return value * value;
};

/**
 * The gain of the whole mix. The grown-up cap always wins over the volume slider,
 * and the power level fades the sound with the lights.
 */
export function masterGain(settings: Settings, powerLevel: number): number {
  const volume = Math.min(settings.masterVolume, settings.volumeCap);
  return toGain(volume) * clamp(powerLevel, 0, 1);
}

/** The gain of every layer: silent when the layer is off. */
export function layerGains(settings: Settings): Map<LayerId, number> {
  const gains = new Map<LayerId, number>();
  for (const [id, layer] of Object.entries(settings.layers)) {
    gains.set(id as LayerId, layer.on ? toGain(layer.volume) : 0);
  }
  return gains;
}

/** Bubble sounds per second: more when the bubbles are faster, none while the pump is off. */
export function bloopRate(settings: Settings): number {
  return settings.bubblesOn ? 5 + riseSpeed(settings.bubbleSpeed) * 60 : 0;
}

/** At most this many one-shot sounds (bloops, drops, chimes) play at once. Extras are dropped. */
export const MAX_VOICES = 12;
