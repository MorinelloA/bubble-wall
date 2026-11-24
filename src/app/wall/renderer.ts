/**
 * Draws one frame of the wall: lit tubes, bubbles, and the frame around them.
 * Everything arrives in wall units (1 unit tall) and is scaled to pixels here.
 */
import type { BubbleField } from "../../core/bubbles";
import { scaleRgb, toCss, type Rgb } from "../../core/color";
import type { Tube } from "../../core/layout";
import type { Pen } from "./sprites";

export interface Frame {
  readonly tubes: readonly Tube[];
  /** One colour per tube, brightness already applied. */
  readonly lights: readonly Rgb[];
  readonly field: BubbleField;
  /** 0 when the wall is off, 1 when fully on. */
  readonly level: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

const FRAME_COLOR = "#03070d";
const DARK: Rgb = { r: 0, g: 0, b: 0 };

function drawTube(pen: Pen, tube: Tube, light: Rgb, size: Size): void {
  const x = tube.x0 * size.height;
  const width = (tube.x1 - tube.x0) * size.height;

  // Lit from the bottom: brightest at the base, fading up the tube.
  const glow = pen.createLinearGradient(0, size.height, 0, 0);
  glow.addColorStop(0, toCss(light));
  glow.addColorStop(0.45, toCss(scaleRgb(light, 0.62)));
  glow.addColorStop(1, toCss(scaleRgb(light, 0.3)));
  pen.fillStyle = glow;
  pen.fillRect(x, 0, width, size.height);

  // Round glass: darker towards each edge, with a soft strip of shine.
  const glass = pen.createLinearGradient(x, 0, x + width, 0);
  glass.addColorStop(0, "rgb(0 0 0 / 0.5)");
  glass.addColorStop(0.18, "rgb(0 0 0 / 0.08)");
  glass.addColorStop(0.3, "rgb(255 255 255 / 0.07)");
  glass.addColorStop(0.42, "rgb(0 0 0 / 0)");
  glass.addColorStop(0.85, "rgb(0 0 0 / 0.1)");
  glass.addColorStop(1, "rgb(0 0 0 / 0.55)");
  pen.fillStyle = glass;
  pen.fillRect(x, 0, width, size.height);

  // The light bar at the base.
  const base = pen.createLinearGradient(0, size.height, 0, size.height * 0.9);
  base.addColorStop(0, toCss(scaleRgb(light, 1.4), 0.75));
  base.addColorStop(1, toCss(light, 0));
  pen.fillStyle = base;
  pen.fillRect(x, size.height * 0.9, width, size.height * 0.1);
}

function drawBubbles(pen: Pen, frame: Frame, size: Size, sprite: CanvasImageSource): void {
  pen.globalCompositeOperation = "lighter";
  for (const bubble of frame.field.pool) {
    if (!bubble.active) continue;
    const radius = bubble.radius * size.height;
    pen.globalAlpha = frame.level * Math.min(1, 0.55 + bubble.radius * 14);
    pen.drawImage(
      sprite,
      bubble.x * size.height - radius,
      bubble.y * size.height - radius,
      radius * 2,
      radius * 2,
    );
  }
  pen.globalAlpha = 1;
  pen.globalCompositeOperation = "source-over";
}

/** Draws the whole wall. `sprite` is the bubble picture from sprites.ts. */
export function drawWall(pen: Pen, size: Size, frame: Frame, sprite: CanvasImageSource): void {
  pen.globalAlpha = 1;
  pen.globalCompositeOperation = "source-over";
  pen.fillStyle = FRAME_COLOR;
  pen.fillRect(0, 0, size.width, size.height);

  for (const [index, tube] of frame.tubes.entries()) {
    const light = scaleRgb(frame.lights.at(index) ?? DARK, frame.level);
    drawTube(pen, tube, light, size);
  }
  if (frame.level > 0) drawBubbles(pen, frame, size, sprite);
}
