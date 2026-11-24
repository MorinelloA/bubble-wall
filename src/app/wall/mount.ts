/** Puts the wall on the page and keeps it running while the app is visible. */
import type { Rng } from "../../core/rng";
import type { Store } from "../../core/store";
import type { PowerControl } from "../power";
import { drawBubbleSprite, SPRITE_SIZE } from "./sprites";
import { createWall, type Wall } from "./wall";

export interface WallHost {
  readonly win: Window;
  readonly root: HTMLElement;
  readonly store: Store;
  readonly power: PowerControl;
  readonly rng: Rng;
  readonly onProblem: (message: string) => void;
}

/** Returns the running wall, or null when this device cannot draw one. */
export function mountWall(host: WallHost): Wall | null {
  const { win, root } = host;
  const doc = win.document;

  const canvas = doc.createElement("canvas");
  canvas.className = "wall";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Bubble wall");
  root.append(canvas);

  const spriteCanvas = doc.createElement("canvas");
  spriteCanvas.width = SPRITE_SIZE;
  spriteCanvas.height = SPRITE_SIZE;

  const pen = canvas.getContext("2d", { alpha: false });
  const spritePen = spriteCanvas.getContext("2d");
  if (!pen || !spritePen) {
    host.onProblem("This device cannot draw the wall (no 2D canvas).");
    return null;
  }
  drawBubbleSprite(spritePen);

  const wall = createWall({
    canvas,
    pen,
    sprite: spriteCanvas,
    store: host.store,
    power: host.power,
    rng: host.rng,
    now: () => win.performance.now(),
    requestFrame: (callback) => win.requestAnimationFrame(callback),
    cancelFrame: (handle) => {
      win.cancelAnimationFrame(handle);
    },
    pixelRatio: () => win.devicePixelRatio,
    onProblem: host.onProblem,
  });

  win.addEventListener("resize", () => {
    wall.resize();
  });
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") wall.stop();
    else wall.start();
  });

  wall.resize();
  wall.start();
  return wall;
}
