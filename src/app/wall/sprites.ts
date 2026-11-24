/**
 * The bubble picture, drawn once and stamped for every bubble. It is clear glass
 * with a bright rim and a highlight, so it takes on the colour of the light behind it.
 */

/** The part of the 2D canvas API this app draws with. Tests pass a recording stand-in. */
export type Pen = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "globalAlpha"
  | "globalCompositeOperation"
  | "fillRect"
  | "clearRect"
  | "beginPath"
  | "arc"
  | "ellipse"
  | "fill"
  | "stroke"
  | "drawImage"
  | "createLinearGradient"
  | "createRadialGradient"
  | "save"
  | "restore"
  | "translate"
  | "rotate"
  | "scale"
  | "moveTo"
  | "lineTo"
  | "closePath"
>;

export const SPRITE_SIZE = 128;

/** Draws one bubble filling a square of SPRITE_SIZE pixels. */
export function drawBubbleSprite(pen: Pen): void {
  const half = SPRITE_SIZE / 2;
  const radius = half - 3;
  pen.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Glass body: almost clear in the middle, brighter towards the rim.
  const body = pen.createRadialGradient(half, half, radius * 0.35, half, half, radius);
  body.addColorStop(0, "rgb(255 255 255 / 0.03)");
  body.addColorStop(0.75, "rgb(255 255 255 / 0.12)");
  body.addColorStop(1, "rgb(255 255 255 / 0.5)");
  pen.fillStyle = body;
  pen.beginPath();
  pen.arc(half, half, radius, 0, Math.PI * 2);
  pen.fill();

  pen.strokeStyle = "rgb(255 255 255 / 0.55)";
  pen.lineWidth = 2.5;
  pen.beginPath();
  pen.arc(half, half, radius, 0, Math.PI * 2);
  pen.stroke();

  // Highlight, top left.
  const glint = pen.createRadialGradient(
    half * 0.68,
    half * 0.6,
    0,
    half * 0.68,
    half * 0.6,
    radius * 0.42,
  );
  glint.addColorStop(0, "rgb(255 255 255 / 0.95)");
  glint.addColorStop(0.5, "rgb(255 255 255 / 0.3)");
  glint.addColorStop(1, "rgb(255 255 255 / 0)");
  pen.fillStyle = glint;
  pen.beginPath();
  pen.ellipse(half * 0.68, half * 0.6, radius * 0.36, radius * 0.26, -0.6, 0, Math.PI * 2);
  pen.fill();

  // A small glow low on the far side, as light passes through.
  pen.fillStyle = "rgb(255 255 255 / 0.22)";
  pen.beginPath();
  pen.ellipse(half * 1.3, half * 1.42, radius * 0.16, radius * 0.09, -0.7, 0, Math.PI * 2);
  pen.fill();
}
