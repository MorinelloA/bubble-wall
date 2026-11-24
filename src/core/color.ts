/** Colour maths. Channels run from 0 to 1 until the moment they are drawn. */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Reads "#rrggbb". Anything else gives white, so a bad value is still a light. */
export function hexToRgb(hex: string): Rgb {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return { r: 1, g: 1, b: 1 };
  const [, r = "ff", g = "ff", b = "ff"] = match;
  return { r: parseInt(r, 16) / 255, g: parseInt(g, 16) / 255, b: parseInt(b, 16) / 255 };
}

/** A fully saturated colour for a hue from 0 to 1 (red, through the rainbow, back to red). */
export function hueToRgb(hue: number): Rgb {
  const h = (((hue % 1) + 1) % 1) * 6;
  const rising = h % 1;
  const falling = 1 - rising;
  const sextants: readonly Rgb[] = [
    { r: 1, g: rising, b: 0 },
    { r: falling, g: 1, b: 0 },
    { r: 0, g: 1, b: rising },
    { r: 0, g: falling, b: 1 },
    { r: rising, g: 0, b: 1 },
    { r: 1, g: 0, b: falling },
  ];
  return sextants.at(Math.floor(h)) ?? { r: 1, g: 0, b: 0 };
}

export function scaleRgb(color: Rgb, factor: number): Rgb {
  return { r: color.r * factor, g: color.g * factor, b: color.b * factor };
}

const channel = (value: number): string =>
  String(Math.round(Math.min(1, Math.max(0, value)) * 255));

/** CSS text for a colour, for canvas fills. */
export function toCss(color: Rgb, alpha = 1): string {
  return `rgb(${channel(color.r)} ${channel(color.g)} ${channel(color.b)} / ${String(alpha)})`;
}
