/**
 * Every change a control can make, as one named function each. The remote, the
 * drawer and the keyboard all go through these, so a button, a favourite and a
 * reload can never disagree about what a setting means.
 */
import { COLOR_IDS, type ColorId, type RemoteKey } from "./palette";
import { lookOf } from "./scenes";
import {
  BRIGHTNESS_STEPS,
  BUBBLE_SPEED_STEPS,
  defaultSettings,
  isFlashing,
  LIGHT_MODES,
  LIGHT_SPEED_STEPS,
  type Feel,
  type FloaterKind,
  type LayerId,
  type LayerMix,
  type LayerSetting,
  type Layout,
  type DrawerSide,
  type LightMode,
  type Look,
  type NoiseColor,
  type Settings,
} from "./settings";
import type { Change } from "./store";
import { clamp } from "./util";

/** Applies a patch, handing back the very same settings when nothing would change. */
function patch(settings: Settings, changes: Partial<Settings>): Settings {
  const current = new Map<string, unknown>(Object.entries(settings));
  const same = Object.entries(changes).every(([name, value]) => current.get(name) === value);
  return same ? settings : { ...settings, ...changes };
}

function changeLayer(
  settings: Settings,
  id: LayerId,
  change: (layer: LayerSetting) => LayerSetting,
): Settings {
  const entries = Object.entries(settings.layers).map(([name, layer]) =>
    name === id ? [name, change(layer)] : [name, layer],
  );
  const before = new Map(Object.entries(settings.layers)).get(id);
  const after = new Map(entries as [string, LayerSetting][]).get(id);
  const same = before?.on === after?.on && before?.volume === after?.volume;
  return same ? settings : { ...settings, layers: Object.fromEntries(entries) as LayerMix };
}

/** A colour key: that colour, held still. */
export const setColor =
  (colorId: ColorId): Change =>
  (s) =>
    patch(s, { colorId, mode: "static", paused: false });

/** A light show. Flash and Strobe are ignored while a grown-up has them switched off. */
export const setMode =
  (mode: LightMode): Change =>
  (s) =>
    !s.allowFlashStrobe && isFlashing(mode) ? s : patch(s, { mode, paused: false });

export const changeBrightness =
  (steps: number): Change =>
  (s) =>
    patch(s, { brightness: clamp(s.brightness + steps, 1, BRIGHTNESS_STEPS) });

export const changeLightSpeed =
  (steps: number): Change =>
  (s) =>
    patch(s, { lightSpeed: clamp(s.lightSpeed + steps, 1, LIGHT_SPEED_STEPS) });

export const changeBubbleSpeed =
  (steps: number): Change =>
  (s) =>
    patch(s, { bubbleSpeed: clamp(s.bubbleSpeed + steps, 1, BUBBLE_SPEED_STEPS) });

export const toggleBubbles: Change = (s) => patch(s, { bubblesOn: !s.bubblesOn });

/** Freezes the lights on the colour they are showing, or lets them move again. */
export const togglePause: Change = (s) => patch(s, { paused: !s.paused });

export const setLayout =
  (layout: Layout): Change =>
  (s) =>
    patch(s, { layout });

/** Calm: touch only swirls and glows. Play: touch also bursts, bloops and pops. */
export const setFeel =
  (feel: Feel): Change =>
  (s) =>
    patch(s, { feel });

export const setFloaters =
  (floaters: FloaterKind): Change =>
  (s) =>
    patch(s, { floaters });

export const toggleTouchSounds: Change = (s) => patch(s, { touchSounds: !s.touchSounds });

/** Switches one sound layer on or off. */
export const toggleLayer =
  (id: LayerId): Change =>
  (s) =>
    changeLayer(s, id, (layer) => ({ ...layer, on: !layer.on }));

/** Sets one sound layer's volume, from 0 to 1. */
export const setLayerVolume =
  (id: LayerId, volume: number): Change =>
  (s) =>
    changeLayer(s, id, (layer) => ({ ...layer, volume: clamp(volume, 0, 1) }));

export const setNoiseColor =
  (noiseColor: NoiseColor): Change =>
  (s) =>
    patch(s, { noiseColor });

export const setMasterVolume =
  (volume: number): Change =>
  (s) =>
    patch(s, { masterVolume: clamp(volume, 0, 1) });

/** Puts a whole look and sound on the wall: a favourite or a ready-made scene. */
export const applyLook =
  (look: Look): Change =>
  (s) => ({ ...s, ...look, paused: false });

/** Remembers the wall as it is now in a favourite slot. Not while the remote is locked. */
export const saveFavourite =
  (slot: number): Change =>
  (s) =>
    s.remoteLocked || slot < 0 || slot >= s.favourites.length
      ? s
      : {
          ...s,
          favourites: s.favourites.map((saved, index) => (index === slot ? lookOf(s) : saved)),
        };

/** Brings a favourite back. An empty slot changes nothing. */
export const applyFavourite =
  (slot: number): Change =>
  (s) => {
    const look = s.favourites.at(slot);
    return look ? applyLook(look)(s) : s;
  };

/** The grown-up limit on volume, from 0 to 1. */
export const setVolumeCap =
  (volumeCap: number): Change =>
  (s) =>
    patch(s, { volumeCap: clamp(volumeCap, 0, 1) });

export const toggleFlashStrobe: Change = (s) => patch(s, { allowFlashStrobe: !s.allowFlashStrobe });

export const toggleRemoteLock: Change = (s) => patch(s, { remoteLocked: !s.remoteLocked });

export const setDrawerSide =
  (drawerSide: DrawerSide): Change =>
  (s) =>
    patch(s, { drawerSide });

/** Back to how the app was when first opened. Favourites go too. */
export const resetEverything: Change = () => defaultSettings();

/** What pressing a key on the remote does: switch the power, or change a setting. */
export type RemoteEffect =
  | { readonly kind: "power"; readonly on: boolean }
  | { readonly kind: "change"; readonly change: Change };

const unchanged: Change = (s) => s;

export function remoteKeyEffect(key: RemoteKey): RemoteEffect {
  switch (key.group) {
    case "power":
      return { kind: "power", on: key.id === "on" };
    case "brightness":
      return { kind: "change", change: changeBrightness(key.id === "brighter" ? 1 : -1) };
    case "colors": {
      const colorId = COLOR_IDS.find((id) => id === key.id);
      return { kind: "change", change: colorId ? setColor(colorId) : unchanged };
    }
    case "modes": {
      const mode = LIGHT_MODES.find((id) => id === key.id);
      return { kind: "change", change: mode ? setMode(mode) : unchanged };
    }
  }
}

/** Whether a remote key should look pressed in: it shows what the wall is doing now. */
export function isRemoteKeyActive(key: RemoteKey, settings: Settings, powerOn: boolean): boolean {
  switch (key.group) {
    case "power":
      return (key.id === "on") === powerOn;
    case "brightness":
      return false;
    case "colors":
      return settings.mode === "static" && settings.colorId === key.id;
    case "modes":
      return settings.mode === key.id;
  }
}
