/**
 * Every change a control can make, as one named function each. The remote, the
 * drawer and the keyboard all go through these, so a button, a favourite and a
 * reload can never disagree about what a setting means.
 */
import { COLOR_IDS, type ColorId, type RemoteKey } from "./palette";
import {
  BRIGHTNESS_STEPS,
  BUBBLE_SPEED_STEPS,
  isFlashing,
  LIGHT_MODES,
  LIGHT_SPEED_STEPS,
  type Layout,
  type LightMode,
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
