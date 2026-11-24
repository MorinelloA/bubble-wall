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
