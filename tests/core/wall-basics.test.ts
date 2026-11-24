import { describe, expect, it } from "vitest";
import { hexToRgb, hueToRgb, scaleRgb, toCss } from "../../src/core/color";
import { tubeAt, tubesFor } from "../../src/core/layout";
import { COLOR_IDS, colorHex } from "../../src/core/palette";
import { initialQuality, MAX_BUBBLES, nextQuality, type Quality } from "../../src/core/quality";
import { smoothstep } from "../../src/core/util";

describe("colour", () => {
  it("reads a hex colour", () => {
    expect(hexToRgb("#ff0080")).toEqual({ r: 1, g: 0, b: 128 / 255 });
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it.each(["", "red", "#fff", "#gggggg", "ff0000"])("treats %s as white", (text) => {
    expect(hexToRgb(text)).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("goes round the rainbow", () => {
    expect(hueToRgb(0)).toEqual({ r: 1, g: 0, b: 0 });
    expect(hueToRgb(1 / 3).g).toBeCloseTo(1);
    expect(hueToRgb(2 / 3).b).toBeCloseTo(1);
    expect(hueToRgb(1)).toEqual(hueToRgb(0));
    expect(hueToRgb(-0.25)).toEqual(hueToRgb(0.75));
    expect(hueToRgb(5.5)).toEqual(hueToRgb(0.5));
  });

  it("scales every channel", () => {
    expect(scaleRgb({ r: 1, g: 0.5, b: 0 }, 0.5)).toEqual({ r: 0.5, g: 0.25, b: 0 });
  });

  it("writes CSS, keeping channels in range", () => {
    expect(toCss({ r: 1, g: 0.5, b: 0 })).toBe("rgb(255 128 0 / 1)");
    expect(toCss({ r: 2, g: -1, b: 0 }, 0.5)).toBe("rgb(255 0 0 / 0.5)");
  });
});

describe("palette", () => {
  it("has the 16 colours of the remote, each with a hex value", () => {
    expect(COLOR_IDS).toHaveLength(16);
    for (const id of COLOR_IDS) expect(colorHex(id)).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorHex("red")).toBe("#ff1f2d");
    expect(colorHex("white")).toBe("#ffffff");
  });
});

describe("smoothstep", () => {
  it("eases from 0 to 1 and stays there outside the range", () => {
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(4)).toBe(1);
    expect(smoothstep(0.25)).toBeLessThan(0.25);
  });
});

describe("layout", () => {
  it.each([
    ["tubes6", 6],
    ["tubes3", 3],
    ["open", 1],
  ] as const)("%s has %s tubes that fit inside the wall without overlapping", (layout, count) => {
    const tubes = tubesFor(layout, 4 / 3);
    expect(tubes).toHaveLength(count);
    expect(tubes.at(0)?.x0).toBeGreaterThan(0);
    expect(tubes.at(-1)?.x1).toBeLessThan(4 / 3);
    const edges = tubes.flatMap((tube) => [tube.x0, tube.x1]);
    expect(new Set(edges).size).toBe(count * 2);
    expect([...edges].sort((a, b) => a - b)).toEqual(edges);
  });

  it("gives every tube the same width", () => {
    const widths = tubesFor("tubes6", 4 / 3).map((tube) => tube.x1 - tube.x0);
    for (const width of widths) expect(width).toBeCloseTo(widths.at(0) ?? 0);
  });

  it("never gives a tube a negative width on a very narrow wall", () => {
    for (const tube of tubesFor("tubes6", 0.05)) expect(tube.x1 - tube.x0).toBe(0);
  });

  it("finds the tube under a point, or none on the frame", () => {
    const tubes = tubesFor("tubes3", 4 / 3);
    const [, middle] = tubes;
    expect(tubeAt(tubes, ((middle?.x0 ?? 0) + (middle?.x1 ?? 0)) / 2)).toBe(1);
    expect(tubeAt(tubes, 0.001)).toBe(-1);
    expect(tubeAt(tubes, 99)).toBe(-1);
  });
});

describe("quality", () => {
  const settle = (quality: Quality, frameMs: number, frames: number): Quality => {
    let current = quality;
    for (let n = 0; n < frames; n += 1) current = nextQuality(current, frameMs);
    return current;
  };

  it("starts with every bubble allowed", () => {
    expect(initialQuality().limit).toBe(MAX_BUBBLES);
  });

  it("keeps the limit while frames are on time", () => {
    expect(settle(initialQuality(), 16.7, 2000).limit).toBe(MAX_BUBBLES);
  });

  it("allows fewer bubbles when frames run slow, but never too few", () => {
    const slow = settle(initialQuality(), 33, 400);
    expect(slow.limit).toBeLessThan(MAX_BUBBLES);
    expect(settle(slow, 50, 20000).limit).toBe(60);
  });

  it("waits before changing the limit again", () => {
    const slow = settle(initialQuality(), 40, 200);
    const once = slow.limit;
    expect(nextQuality(slow, 40).limit).toBe(once);
  });

  it("brings the bubbles back when there is time to spare", () => {
    const slow = settle(initialQuality(), 40, 2000);
    expect(settle(slow, 10, 20000).limit).toBe(MAX_BUBBLES);
  });
});
