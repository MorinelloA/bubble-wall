/**
 * Where the tubes are. The wall is measured in its own units: 1 unit tall, and as
 * wide as the screen is wide for its height (4:3 gives 1.33). x runs left to right,
 * y runs from 0 at the top to 1 at the bottom.
 */
import type { Layout } from "./settings";

export interface Tube {
  readonly x0: number;
  readonly x1: number;
}

/** Width of the frame between and around tubes, as a share of the wall's height. */
const DIVIDER = 0.018;

const TUBE_COUNTS: ReadonlyMap<Layout, number> = new Map([
  ["tubes6", 6],
  ["tubes3", 3],
  ["open", 1],
]);

/** The tubes for a layout on a wall of the given width, left to right. */
export function tubesFor(layout: Layout, wallWidth: number): Tube[] {
  const count = TUBE_COUNTS.get(layout) ?? 6;
  const tubeWidth = Math.max(0, (wallWidth - DIVIDER * (count + 1)) / count);
  return Array.from({ length: count }, (_, index) => {
    const x0 = DIVIDER + index * (tubeWidth + DIVIDER);
    return { x0, x1: x0 + tubeWidth };
  });
}

/** Which tube holds this x, or -1 when it is on the frame. */
export function tubeAt(tubes: readonly Tube[], x: number): number {
  return tubes.findIndex((tube) => x >= tube.x0 && x <= tube.x1);
}
