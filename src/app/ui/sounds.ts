/**
 * The Sounds tab: one volume, eight sounds to switch on and off in any mix, and a
 * slider for each sound that is on. Also the small "tap for sound" hint.
 */
import { setLayerVolume, setMasterVolume, setNoiseColor, toggleLayer } from "../../core/actions";
import { needsSoundHint } from "../../core/audioLifecycle";
import { NOISE_COLORS, type LayerId, type NoiseColor } from "../../core/settings";
import type { Store } from "../../core/store";
import type { AudioEngine } from "../audio/engine";
import { button, el, section, setPressed, slider } from "./dom";
import type { IconName } from "./icons";

const LAYERS: readonly (readonly [LayerId, string, IconName])[] = [
  ["bubbles", "Bubbles", "wall"],
  ["motor", "Motor", "motor"],
  ["stream", "Stream", "stream"],
  ["rain", "Rain", "rain"],
  ["ocean", "Ocean", "ocean"],
  ["deep", "Deep water", "deep"],
  ["noise", "Noise", "noise"],
  ["chimes", "Chimes", "chimes"],
];

const NOISE_NAMES: ReadonlyMap<NoiseColor, string> = new Map([
  ["white", "White"],
  ["pink", "Pink"],
  ["brown", "Brown"],
]);

/** The three kinds of noise, shown while the Noise sound is on. */
function noiseChoices(doc: Document, store: Store): HTMLElement {
  const element = el(doc, "div", "choices");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Kind of noise");
  const choices = NOISE_COLORS.map((color) => {
    const choice = button(doc, {
      label: `${NOISE_NAMES.get(color) ?? color} noise`,
      className: "chip",
      onPress: () => {
        store.update(setNoiseColor(color));
      },
    });
    choice.append(NOISE_NAMES.get(color) ?? color);
    element.append(choice);
    return { color, choice };
  });
  const refresh = (): void => {
    const settings = store.get();
    element.hidden = !settings.layers.noise.on;
    for (const { color, choice } of choices) setPressed(choice, settings.noiseColor === color);
  };
  store.subscribe(refresh);
  refresh();
  return element;
}

export function createSoundsPanel(doc: Document, store: Store): HTMLElement {
  const element = el(doc, "div", "sounds-panel");

  const volume = slider(doc, {
    label: "Volume",
    onInput: (value) => {
      store.update(setMasterVolume(value));
    },
  });
  const tiles = el(doc, "div", "tiles four");
  const mix = el(doc, "div", "mix");
  const layers = LAYERS.map(([id, label, iconName]) => {
    const tile = button(doc, {
      label,
      className: "tile",
      icon: iconName,
      caption: true,
      onPress: () => {
        store.update(toggleLayer(id));
      },
    });
    const level = slider(doc, {
      label,
      onInput: (value) => {
        store.update(setLayerVolume(id, value));
      },
    });
    tiles.append(tile);
    mix.append(level.element);
    return { id, tile, level };
  });
  mix.append(noiseChoices(doc, store));

  element.append(volume.element, section(doc, "Sounds", tiles), section(doc, "Mix", mix));

  const refresh = (): void => {
    const settings = store.get();
    const saved = new Map(Object.entries(settings.layers));
    volume.show(settings.masterVolume);
    for (const { id, tile, level } of layers) {
      const layer = saved.get(id);
      setPressed(tile, layer?.on === true);
      level.element.hidden = layer?.on !== true;
      level.show(layer?.volume ?? 0);
    }
  };
  store.subscribe(refresh);
  refresh();
  return element;
}

/** A small speaker in the corner that shows whenever sound is not actually playing. */
export function createSoundHint(doc: Document, audio: AudioEngine): HTMLElement {
  const hint = button(doc, {
    label: "Tap for sound",
    className: "sound-hint",
    icon: "mute",
    caption: true,
    onPress: () => {
      audio.touch();
    },
  });
  const refresh = (): void => {
    hint.hidden = !needsSoundHint(audio.phase());
  };
  audio.subscribe(refresh);
  refresh();
  return hint;
}
