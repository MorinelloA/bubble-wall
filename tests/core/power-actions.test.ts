import { describe, expect, it } from "vitest";
import {
  changeBrightness,
  changeBubbleSpeed,
  changeLightSpeed,
  isRemoteKeyActive,
  remoteKeyEffect,
  setColor,
  setLayout,
  setMode,
  toggleBubbles,
  togglePause,
} from "../../src/core/actions";
import { COLOR_IDS, REMOTE_KEYS, type RemoteKey } from "../../src/core/palette";
import {
  FADE_MS,
  initialPower,
  powerLevel,
  tickPower,
  turnOff,
  turnOn,
  WAKE_MS,
} from "../../src/core/power";
import { defaultSettings, type Settings } from "../../src/core/settings";
import type { Change } from "../../src/core/store";

const base = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), ...over });

const keyNamed = (id: string): RemoteKey => {
  const found = REMOTE_KEYS.find((key) => key.id === id);
  if (!found) throw new Error(`no key ${id}`);
  return found;
};

/** Presses a remote key and gives the settings afterwards (power keys change nothing here). */
const press = (id: string, settings: Settings): Settings => {
  const effect = remoteKeyEffect(keyNamed(id));
  return effect.kind === "change" ? effect.change(settings) : settings;
};

describe("power", () => {
  it("starts off and dark", () => {
    const power = initialPower();
    expect(power.phase).toBe("off");
    expect(powerLevel(power, 0)).toBe(0);
    expect(powerLevel(power, 99_999)).toBe(0);
  });

  it("Off, then On or the start tap: wakes gently to full", () => {
    const power = turnOn(initialPower(), 1000);
    expect(power.phase).toBe("on");
    expect(powerLevel(power, 1000)).toBe(0);
    expect(powerLevel(power, 1000 + WAKE_MS / 2)).toBeCloseTo(0.5);
    expect(powerLevel(power, 1000 + WAKE_MS)).toBe(1);
    expect(powerLevel(power, 1000 + WAKE_MS * 50)).toBe(1);
  });

  it("On, then Off: fades over two seconds, then is off", () => {
    const on = turnOn(initialPower(), 0);
    const fading = turnOff(on, 10_000);
    expect(fading.phase).toBe("fading");
    expect(powerLevel(fading, 10_000)).toBe(1);
    expect(powerLevel(fading, 10_000 + FADE_MS / 2)).toBeCloseTo(0.5);
    expect(tickPower(fading, 10_000 + FADE_MS - 1).phase).toBe("fading");
    const off = tickPower(fading, 10_000 + FADE_MS);
    expect(off.phase).toBe("off");
    expect(powerLevel(off, 10_000 + FADE_MS)).toBe(0);
  });

  it("the level only ever falls during a fade", () => {
    const fading = turnOff(turnOn(initialPower(), 0), 5000);
    const levels = Array.from({ length: 21 }, (_, n) => powerLevel(fading, 5000 + n * 100));
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
  });

  it("the button for the state it is already in does nothing", () => {
    const off = initialPower();
    expect(turnOff(off, 5)).toBe(off);
    const on = turnOn(off, 0);
    expect(turnOn(on, 500)).toBe(on);
    const fading = turnOff(on, 5000);
    expect(turnOff(fading, 5500)).toBe(fading);
  });

  it("On during a fade picks up from where the light had got to, with no jump", () => {
    const fading = turnOff(turnOn(initialPower(), 0), 5000);
    const halfway = powerLevel(fading, 6000);
    const back = turnOn(fading, 6000);
    expect(back.phase).toBe("on");
    expect(powerLevel(back, 6000)).toBeCloseTo(halfway);
    expect(powerLevel(back, 6000 + WAKE_MS)).toBe(1);
  });

  it("Off while still waking fades from where it had got to", () => {
    const waking = turnOn(initialPower(), 0);
    const fading = turnOff(waking, WAKE_MS / 2);
    expect(powerLevel(fading, WAKE_MS / 2)).toBeCloseTo(0.5);
  });

  it("ticking leaves on and off alone", () => {
    const off = initialPower();
    expect(tickPower(off, 1e9)).toBe(off);
    const on = turnOn(off, 0);
    expect(tickPower(on, 1e9)).toBe(on);
  });
});

describe("every action changes the setting it names", () => {
  const table: readonly (readonly [string, Change, Partial<Settings>, Partial<Settings>])[] = [
    [
      "setColor",
      setColor("pink"),
      { mode: "fade", paused: true },
      { colorId: "pink", mode: "static", paused: false },
    ],
    ["setMode", setMode("fade"), { mode: "static", paused: true }, { mode: "fade", paused: false }],
    ["setMode rainbow", setMode("rainbow"), {}, { mode: "rainbow" }],
    ["setMode breathe", setMode("breathe"), {}, { mode: "breathe" }],
    ["changeBrightness up", changeBrightness(1), { brightness: 3 }, { brightness: 4 }],
    ["changeBrightness down", changeBrightness(-1), { brightness: 3 }, { brightness: 2 }],
    ["changeLightSpeed up", changeLightSpeed(1), { lightSpeed: 3 }, { lightSpeed: 4 }],
    ["changeLightSpeed down", changeLightSpeed(-1), { lightSpeed: 3 }, { lightSpeed: 2 }],
    ["changeBubbleSpeed up", changeBubbleSpeed(1), { bubbleSpeed: 3 }, { bubbleSpeed: 4 }],
    ["changeBubbleSpeed down", changeBubbleSpeed(-1), { bubbleSpeed: 3 }, { bubbleSpeed: 2 }],
    ["toggleBubbles off", toggleBubbles, { bubblesOn: true }, { bubblesOn: false }],
    ["toggleBubbles on", toggleBubbles, { bubblesOn: false }, { bubblesOn: true }],
    ["togglePause on", togglePause, { paused: false }, { paused: true }],
    ["togglePause off", togglePause, { paused: true }, { paused: false }],
    ["setLayout", setLayout("open"), { layout: "tubes6" }, { layout: "open" }],
  ];

  it.each(table)("%s", (_name, change, before, after) => {
    const start = base(before);
    expect(change(start)).toEqual({ ...start, ...after });
  });

  it.each([
    ["brightness at the top", changeBrightness(1), { brightness: 8 }],
    ["brightness at the bottom", changeBrightness(-1), { brightness: 1 }],
    ["light speed at the top", changeLightSpeed(1), { lightSpeed: 8 }],
    ["light speed at the bottom", changeLightSpeed(-1), { lightSpeed: 1 }],
    ["bubble speed at the top", changeBubbleSpeed(1), { bubbleSpeed: 5 }],
    ["bubble speed at the bottom", changeBubbleSpeed(-1), { bubbleSpeed: 1 }],
    ["the layout already chosen", setLayout("tubes6"), { layout: "tubes6" }],
    ["the colour already showing", setColor("red"), { colorId: "red", mode: "static" }],
  ] as const)("%s hands back the same settings untouched", (_name, change, before) => {
    const start = base(before);
    expect(change(start)).toBe(start);
  });

  it.each(["flash", "strobe"] as const)("%s is ignored while not allowed", (mode) => {
    const start = base({ allowFlashStrobe: false, mode: "fade" });
    expect(setMode(mode)(start)).toBe(start);
  });
});

describe("the remote", () => {
  it("has the 24 keys of the real one, in its order", () => {
    expect(REMOTE_KEYS.map((key) => key.label)).toEqual([
      "On",
      "Off",
      "Dimmer",
      "Brighter",
      "Red",
      "Red Orange",
      "Orange",
      "Amber",
      "Yellow",
      "Lime",
      "Green",
      "Cyan",
      "Teal",
      "Sky Blue",
      "Blue",
      "Indigo",
      "Purple",
      "Magenta",
      "Pink",
      "White",
      "Flash",
      "Strobe",
      "Fade",
      "Smooth",
    ]);
  });

  it("On and Off switch the power", () => {
    expect(remoteKeyEffect(keyNamed("on"))).toEqual({ kind: "power", on: true });
    expect(remoteKeyEffect(keyNamed("off"))).toEqual({ kind: "power", on: false });
  });

  it("Dimmer and Brighter move the brightness one step", () => {
    expect(press("dimmer", base({ brightness: 5 })).brightness).toBe(4);
    expect(press("brighter", base({ brightness: 5 })).brightness).toBe(6);
  });

  it.each(COLOR_IDS)("the %s key shows that colour, held still", (id) => {
    const after = press(id, base({ mode: "flash", colorId: id === "red" ? "blue" : "red" }));
    expect(after).toMatchObject({ colorId: id, mode: "static" });
  });

  it.each(["flash", "strobe", "fade", "smooth"] as const)("the %s key starts that show", (id) => {
    expect(press(id, base({ mode: "static" })).mode).toBe(id);
  });

  it("a key that is not on the remote changes nothing", () => {
    const start = base();
    for (const group of ["colors", "modes"] as const) {
      const effect = remoteKeyEffect({ id: "plaid", label: "Plaid", color: "#000000", group });
      expect(effect.kind === "change" && effect.change(start)).toBe(start);
    }
  });

  it("shows which keys are in effect", () => {
    const active = (settings: Settings, powerOn: boolean): string[] =>
      REMOTE_KEYS.filter((key) => isRemoteKeyActive(key, settings, powerOn)).map((key) => key.id);
    expect(active(base({ mode: "static", colorId: "green" }), true)).toEqual(["on", "green"]);
    expect(active(base({ mode: "fade", colorId: "green" }), true)).toEqual(["on", "fade"]);
    expect(active(base({ mode: "rainbow" }), false)).toEqual(["off"]);
  });
});
