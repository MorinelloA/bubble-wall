/**
 * The light shows. Given the mode, the chosen colour, the speed and the time, this
 * says what colour each tube is right now. Nothing here keeps state, so a show can
 * be stepped through time in a test.
 */
import { BLACK, hexToRgb, hueToRgb, scaleRgb, type Rgb } from "./color";
import { colorHex, FLASH_SEQUENCE } from "./palette";
import { BRIGHTNESS_STEPS, LIGHT_SPEED_STEPS, type LightMode } from "./settings";
import { clamp, smoothstep } from "./util";

export interface LightInput {
  readonly mode: LightMode;
  /** The colour picked on the remote. */
  readonly color: Rgb;
  /** 1 to 8. */
  readonly speed: number;
  /** 1 to 8. */
  readonly brightness: number;
  /** Seconds the lights have been running (it stops while paused). */
  readonly time: number;
  readonly tubes: number;
}

const FLASH_COLORS: readonly Rgb[] = FLASH_SEQUENCE.map((id) => hexToRgb(colorHex(id)));

const SLOWEST = 0.35;
const FASTEST = 3;
/** Seconds each Flash colour is held at speed factor 1. */
const FLASH_HOLD = 0.9;
/** Seconds for one Strobe blink (on and off) at speed factor 1. */
const STROBE_PERIOD = 0.5;
const FADE_PERIOD = 5;
const SMOOTH_PERIOD = 24;
const RAINBOW_PERIOD = 40;
/** Breathe never changes speed: in for 4 seconds, out for 6. */
const BREATHE_IN = 4;
const BREATHE_OUT = 6;
const BREATHE_LOW = 0.25;
const FADE_LOW = 0.12;
const DIMMEST = 0.2;

/** How much faster or slower than normal each speed step runs. Each step is the same ratio. */
export function lightSpeedFactor(speed: number): number {
  const step = (clamp(speed, 1, LIGHT_SPEED_STEPS) - 1) / (LIGHT_SPEED_STEPS - 1);
  return SLOWEST * Math.pow(FASTEST / SLOWEST, step);
}

/** Light output for a brightness step. The lowest step is dim, never dark. */
export function brightnessLevel(brightness: number): number {
  const step = (clamp(brightness, 1, BRIGHTNESS_STEPS) - 1) / (BRIGHTNESS_STEPS - 1);
  return DIMMEST + (1 - DIMMEST) * step;
}

function breatheLevel(time: number): number {
  const phase = time % (BREATHE_IN + BREATHE_OUT);
  const rise =
    phase < BREATHE_IN
      ? smoothstep(phase / BREATHE_IN)
      : 1 - smoothstep((phase - BREATHE_IN) / BREATHE_OUT);
  return BREATHE_LOW + (1 - BREATHE_LOW) * rise;
}

/** One tube's colour before brightness. `position` is the tube's place across the wall, 0 to 1. */
function showColor(input: LightInput, position: number): Rgb {
  const factor = lightSpeedFactor(input.speed);
  const t = input.time * factor;
  switch (input.mode) {
    case "static":
      return input.color;
    case "flash":
      return FLASH_COLORS.at(Math.floor(t / FLASH_HOLD) % FLASH_COLORS.length) ?? input.color;
    case "strobe":
      return t % STROBE_PERIOD < STROBE_PERIOD / 2 ? input.color : BLACK;
    case "fade": {
      const wave = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / FADE_PERIOD);
      return scaleRgb(input.color, FADE_LOW + (1 - FADE_LOW) * wave);
    }
    case "smooth":
      return hueToRgb(t / SMOOTH_PERIOD);
    case "rainbow":
      return hueToRgb(position + t / RAINBOW_PERIOD);
    case "breathe":
      return scaleRgb(input.color, breatheLevel(input.time));
  }
}

/** The colour of every tube, left to right, with brightness applied. */
export function tubeLights(input: LightInput): Rgb[] {
  const level = brightnessLevel(input.brightness);
  return Array.from({ length: input.tubes }, (_, index) =>
    scaleRgb(showColor(input, index / Math.max(1, input.tubes)), level),
  );
}
