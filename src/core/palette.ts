/** The 16 colours of the real bubble-wall remote, in the order of its keys. */

const COLORS = [
  ["red", "Red", "#ff1f2d"],
  ["red-orange", "Red Orange", "#ff4b1f"],
  ["orange", "Orange", "#ff7a00"],
  ["amber", "Amber", "#ffab00"],
  ["yellow", "Yellow", "#ffe100"],
  ["lime", "Lime", "#8be234"],
  ["green", "Green", "#12c93a"],
  ["cyan", "Cyan", "#19e3d2"],
  ["teal", "Teal", "#14b8d4"],
  ["sky-blue", "Sky Blue", "#2f9bff"],
  ["blue", "Blue", "#1f47ff"],
  ["indigo", "Indigo", "#5b3bff"],
  ["purple", "Purple", "#9230f0"],
  ["magenta", "Magenta", "#d92bd3"],
  ["pink", "Pink", "#ff5cb4"],
  ["white", "White", "#ffffff"],
] as const;

export type ColorId = (typeof COLORS)[number][0];

export const COLOR_IDS: readonly ColorId[] = COLORS.map(([id]) => id);

const HEX_BY_ID: ReadonlyMap<string, string> = new Map(COLORS.map(([id, , hex]) => [id, hex]));

export function colorHex(id: ColorId): string {
  return HEX_BY_ID.get(id) ?? "#ffffff";
}

/** The colours Flash jumps through, in order. */
export const FLASH_SEQUENCE: readonly ColorId[] = [
  "red",
  "green",
  "blue",
  "yellow",
  "cyan",
  "purple",
  "white",
];

export type RemoteGroup = "power" | "brightness" | "colors" | "modes";

/** One key of the real remote. Names, colours and order match the remote app he already uses. */
export interface RemoteKey {
  readonly id: string;
  readonly label: string;
  /** The light colour for colour keys; the rim and icon colour for the rest. */
  readonly color: string;
  readonly group: RemoteGroup;
}

const key = (id: string, label: string, color: string, group: RemoteGroup): RemoteKey => ({
  id,
  label,
  color,
  group,
});

/** The 24 keys, in the order of the remote: 4 across, 6 down. */
export const REMOTE_KEYS: readonly RemoteKey[] = [
  key("on", "On", "#3ddc84", "power"),
  key("off", "Off", "#ff5a5f", "power"),
  key("dimmer", "Dimmer", "#8fa3c8", "brightness"),
  key("brighter", "Brighter", "#ffd95a", "brightness"),
  ...COLORS.map(([id, label, hex]) => key(id, label, hex, "colors")),
  key("flash", "Flash", "#ffd95a", "modes"),
  key("strobe", "Strobe", "#7fd4ff", "modes"),
  key("fade", "Fade", "#c79bff", "modes"),
  key("smooth", "Smooth", "#ff9ecb", "modes"),
];
