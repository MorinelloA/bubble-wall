/** Drawing the floaters: fish, balls and stars, each in a soft colour of its own. */
import type { Floater, FloaterSet } from "../../core/floaters";
import type { FloaterKind } from "../../core/settings";
import type { Pen } from "./sprites";

const TINTS: readonly string[] = ["#ff9f43", "#ffd95a", "#ff7eb6", "#7fe3c4", "#ffffff", "#b79bff"];

type Shape = (pen: Pen, size: number, tint: string) => void;

const ball: Shape = (pen, size, tint) => {
  const shade = pen.createRadialGradient(-size * 0.3, -size * 0.35, size * 0.1, 0, 0, size);
  shade.addColorStop(0, "#ffffff");
  shade.addColorStop(0.25, tint);
  shade.addColorStop(1, "rgb(0 0 0 / 0.55)");
  pen.fillStyle = shade;
  pen.beginPath();
  pen.arc(0, 0, size, 0, Math.PI * 2);
  pen.fill();
};

const fish: Shape = (pen, size, tint) => {
  pen.fillStyle = tint;
  pen.beginPath();
  pen.ellipse(size * 0.15, 0, size * 0.8, size * 0.5, 0, 0, Math.PI * 2);
  pen.fill();
  // Tail.
  pen.beginPath();
  pen.moveTo(-size * 0.5, 0);
  pen.lineTo(-size * 1.1, -size * 0.5);
  pen.lineTo(-size * 1.1, size * 0.5);
  pen.closePath();
  pen.fill();
  // Eye.
  pen.fillStyle = "#06223a";
  pen.beginPath();
  pen.arc(size * 0.55, -size * 0.12, size * 0.1, 0, Math.PI * 2);
  pen.fill();
};

const star: Shape = (pen, size, tint) => {
  pen.fillStyle = tint;
  pen.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const reach = point % 2 === 0 ? size : size * 0.45;
    const angle = (point * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * reach;
    const y = Math.sin(angle) * reach;
    if (point === 0) pen.moveTo(x, y);
    else pen.lineTo(x, y);
  }
  pen.closePath();
  pen.fill();
};

const SHAPES: ReadonlyMap<FloaterKind, Shape> = new Map([
  ["balls", ball],
  ["fish", fish],
  ["stars", star],
]);

function drawOne(pen: Pen, floater: Floater, shape: Shape, height: number): void {
  pen.save();
  pen.translate(floater.x * height, floater.y * height);
  pen.rotate(floater.angle);
  pen.scale(floater.facing, 1);
  shape(pen, floater.size * height, TINTS.at(floater.tint % TINTS.length) ?? "#ffffff");
  pen.restore();
}

/** Draws every floater of the chosen kind. `level` fades them with the wall's power. */
export function drawFloaters(
  pen: Pen,
  set: FloaterSet,
  kind: FloaterKind,
  height: number,
  level: number,
): void {
  const shape = SHAPES.get(kind);
  if (!shape || level <= 0) return;
  pen.globalAlpha = 0.9 * level;
  for (const floater of set.pool) {
    if (floater.active) drawOne(pen, floater, shape, height);
  }
  pen.globalAlpha = 1;
}
