/**
 * Fingers on the wall. Each touch is turned into wall units and queued; the wall
 * takes the queue once a frame, so everything that changes the wall happens in step.
 */
import type { TouchEvent, TouchEventType } from "../../core/touchForces";

/** More than this waiting means the wall has stalled: the oldest are dropped. */
const MAX_QUEUED = 256;

export interface PointerFeed {
  /** Hands over every touch since the last call, oldest first. */
  readonly drain: () => TouchEvent[];
}

const TYPES: ReadonlyMap<string, TouchEventType> = new Map([
  ["pointerdown", "down"],
  ["pointermove", "move"],
  ["pointerup", "up"],
  // The iPad sends this when a system gesture takes over a touch.
  ["pointercancel", "cancel"],
]);

export function watchPointers(canvas: HTMLCanvasElement): PointerFeed {
  let queue: TouchEvent[] = [];
  /** Only fingers that went down on the wall are followed. */
  const down = new Set<number>();

  const handle = (type: TouchEventType, event: PointerEvent): void => {
    if (type === "down") down.add(event.pointerId);
    else if (!down.has(event.pointerId)) return;
    if (type === "up" || type === "cancel") down.delete(event.pointerId);

    const box = canvas.getBoundingClientRect();
    const height = Math.max(1, box.height);
    if (queue.length >= MAX_QUEUED) queue.shift();
    queue.push({
      type,
      id: event.pointerId,
      x: (event.clientX - box.left) / height,
      y: (event.clientY - box.top) / height,
    });
  };

  for (const [name, type] of TYPES) {
    canvas.addEventListener(name, (event) => {
      event.preventDefault();
      handle(type, event as PointerEvent);
    });
  }
  return {
    drain: () => {
      const taken = queue;
      queue = [];
      return taken;
    },
  };
}
