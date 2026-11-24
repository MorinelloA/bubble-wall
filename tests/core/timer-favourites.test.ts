import { describe, expect, it } from "vitest";
import {
  applyFavourite,
  applyLook,
  resetEverything,
  saveFavourite,
  setColor,
  setDrawerSide,
  setVolumeCap,
  toggleFlashStrobe,
  toggleRemoteLock,
} from "../../src/core/actions";
import {
  FADE_MS,
  initialPower,
  isPowered,
  isPumping,
  powerLevel,
  setTimer,
  tickPower,
  TIMER_CHOICES,
  timerMinutes,
  timerRemaining,
  turnOff,
  turnOn,
  WIND_DOWN_MS,
  type PowerState,
} from "../../src/core/power";
import { lookOf, SCENES } from "../../src/core/scenes";
import {
  defaultSettings,
  LAYER_IDS,
  normalizeSettings,
  readSettings,
  type Settings,
} from "../../src/core/settings";

const MINUTE = 60_000;
const base = (over: Partial<Settings> = {}): Settings => ({ ...defaultSettings(), ...over });

/** A wall that has been on since time 0, with a timer set at `setAt`. */
const timed = (minutes: number, setAt = 10_000): PowerState =>
  setTimer(turnOn(initialPower(), 0), minutes, setAt);

describe("the wind-down timer", () => {
  it("offers 5, 10, 15, 30 and 60 minutes", () => {
    expect(TIMER_CHOICES).toEqual([5, 10, 15, 30, 60]);
  });

  it("is ignored while the wall is off or fading out", () => {
    const off = initialPower();
    expect(setTimer(off, 5, 0)).toBe(off);
    const fading = turnOff(turnOn(off, 0), 5000);
    expect(setTimer(fading, 5, 5500)).toBe(fading);
  });

  it("leaves the wall fully on until its last minute", () => {
    const power = timed(5);
    const justBefore = 10_000 + 4 * MINUTE - 1;
    expect(tickPower(power, justBefore)).toBe(power);
    expect(powerLevel(power, justBefore)).toBe(1);
    expect(timerMinutes(power)).toBe(5);
  });

  it("On, then the timer reaches its last 60 seconds: winds down slowly, then is off", () => {
    const power = timed(5);
    const lastMinute = 10_000 + 4 * MINUTE;
    const winding = tickPower(power, lastMinute);
    expect(winding.phase).toBe("winding");
    expect(powerLevel(winding, lastMinute)).toBe(1);
    expect(powerLevel(winding, lastMinute + WIND_DOWN_MS / 2)).toBeCloseTo(0.5);
    expect(tickPower(winding, lastMinute + WIND_DOWN_MS - 1).phase).toBe("winding");

    const off = tickPower(winding, lastMinute + WIND_DOWN_MS);
    expect(off.phase).toBe("off");
    expect(powerLevel(off, lastMinute + WIND_DOWN_MS)).toBe(0);
    expect(timerRemaining(off, lastMinute + WIND_DOWN_MS)).toBeNull();
    expect(timerMinutes(off)).toBe(0);
  });

  it("the light only ever falls during the wind-down", () => {
    const winding = tickPower(timed(5), 10_000 + 4 * MINUTE);
    const levels = Array.from({ length: 61 }, (_, second) =>
      powerLevel(winding, 10_000 + 4 * MINUTE + second * 1000),
    );
    expect([...levels].sort((a, b) => b - a)).toEqual(levels);
  });

  it("Winding down, then Off: fades from where it had got to, then is off", () => {
    const winding = tickPower(timed(5), 10_000 + 4 * MINUTE);
    const halfway = 10_000 + 4 * MINUTE + WIND_DOWN_MS / 2;
    const fading = turnOff(winding, halfway);
    expect(fading.phase).toBe("fading");
    expect(powerLevel(fading, halfway)).toBeCloseTo(0.5);
    expect(tickPower(fading, halfway + FADE_MS).phase).toBe("off");
    expect(timerRemaining(fading, halfway)).toBeNull();
  });

  it("Winding down, then On: nothing changes and the ending is not extended", () => {
    const winding = tickPower(timed(5), 10_000 + 4 * MINUTE);
    expect(isPowered(winding)).toBe(true);
    expect(turnOn(winding, 10_000 + 4 * MINUTE + 5000)).toBe(winding);
  });

  it("picks the wind-down up where it should be when a tick comes late", () => {
    const late = 10_000 + 4 * MINUTE + 45_000;
    const winding = tickPower(timed(5), late);
    expect(winding.phase).toBe("winding");
    expect(powerLevel(winding, late)).toBeLessThan(0.3);
    expect(tickPower(winding, 10_000 + 5 * MINUTE).phase).toBe("off");
  });

  it("a timer that ran out while the app was away leaves the wall off on return", () => {
    const back = tickPower(timed(5), 10_000 + 3 * 60 * MINUTE);
    expect(back.phase).toBe("off");
    expect(powerLevel(back, 10_000 + 3 * 60 * MINUTE)).toBe(0);
  });

  it("switching off clears the timer, so it cannot switch a later session off", () => {
    const fading = turnOff(timed(5), 20_000);
    const again = turnOn(tickPower(fading, 30_000), 40_000);
    expect(timerMinutes(again)).toBe(0);
    expect(tickPower(again, 40_000 + 6 * MINUTE)).toBe(again);
  });

  it("says how much of the timer is left, for the shrinking line", () => {
    const power = timed(10);
    expect(timerRemaining(power, 10_000)).toBe(1);
    expect(timerRemaining(power, 10_000 + 5 * MINUTE)).toBeCloseTo(0.5);
    expect(timerRemaining(power, 10_000 + 10 * MINUTE)).toBe(0);
    expect(timerRemaining(power, 10_000 + 99 * MINUTE)).toBe(0);
    expect(timerRemaining(turnOn(initialPower(), 0), 5000)).toBeNull();
  });

  it("0 minutes clears the timer, and does nothing when there is none", () => {
    const cleared = setTimer(timed(5), 0, 20_000);
    expect(timerMinutes(cleared)).toBe(0);
    expect(tickPower(cleared, 20_000 + 10 * MINUTE)).toBe(cleared);
    const plain = turnOn(initialPower(), 0);
    expect(setTimer(plain, 0, 5000)).toBe(plain);
  });

  it("a new timer during the wind-down brings the light back up and starts again", () => {
    const halfway = 10_000 + 4 * MINUTE + WIND_DOWN_MS / 2;
    const winding = tickPower(timed(5), 10_000 + 4 * MINUTE);
    const again = setTimer(winding, 10, halfway);
    expect(again.phase).toBe("on");
    expect(powerLevel(again, halfway)).toBeCloseTo(0.5);
    expect(powerLevel(again, halfway + 2000)).toBe(1);
    expect(timerRemaining(again, halfway)).toBe(1);
  });

  it("keeps the pump running through most of the wind-down, then lets the tubes empty", () => {
    const start = 10_000 + 4 * MINUTE;
    const winding = tickPower(timed(5), start);
    expect(isPumping(turnOn(initialPower(), 0), 100)).toBe(true);
    expect(isPumping(winding, start + 10_000)).toBe(true);
    expect(isPumping(winding, start + 55_000)).toBe(false);
    expect(isPumping(initialPower(), 0)).toBe(false);
    expect(isPumping(turnOff(turnOn(initialPower(), 0), 5000), 5001)).toBe(false);
  });
});

describe("scenes", () => {
  it("has Ocean Calm, Rainbow, Night Light and Lava", () => {
    expect(SCENES.map((scene) => scene.name)).toEqual([
      "Ocean Calm",
      "Rainbow",
      "Night Light",
      "Lava",
    ]);
  });

  it.each(SCENES)("$name is a complete, valid look with some sound", (scene) => {
    const applied = applyLook(scene.look)(base());
    expect(readSettings(applied)).toEqual(applied);
    expect(Object.keys(scene.look.layers)).toEqual([...LAYER_IDS]);
    expect(Object.values(scene.look.layers).some((layer) => layer.on)).toBe(true);
    expect(["flash", "strobe"]).not.toContain(scene.look.mode);
  });

  it("takes the look and sound out of the settings, and nothing else", () => {
    const look = lookOf(base({ colorId: "pink", remoteLocked: true, masterVolume: 0.1 }));
    expect(look.colorId).toBe("pink");
    expect(new Set(Object.keys(look))).toEqual(
      new Set([
        "bubbleSpeed",
        "bubblesOn",
        "brightness",
        "colorId",
        "floaters",
        "layers",
        "layout",
        "lightSpeed",
        "mode",
        "noiseColor",
      ]),
    );
  });
});

describe("favourites", () => {
  it("saves the wall as it is into a slot and brings it back later", () => {
    const pink = base({ colorId: "pink", mode: "fade", layout: "open", bubbleSpeed: 5 });
    const saved = saveFavourite(2)(pink);
    expect(saved.favourites.map((slot) => slot !== null)).toEqual([false, false, true, false]);

    const changed = setColor("green")({ ...saved, layout: "tubes3", bubbleSpeed: 1, paused: true });
    const back = applyFavourite(2)(changed);
    expect(back).toMatchObject({
      colorId: "pink",
      mode: "fade",
      layout: "open",
      bubbleSpeed: 5,
      paused: false,
    });
    expect(back.favourites).toEqual(saved.favourites);
  });

  it("does not change volume limits, the feel or the lock when brought back", () => {
    const saved = saveFavourite(0)(base({ feel: "calm", masterVolume: 0.2, volumeCap: 0.3 }));
    const back = applyFavourite(0)({ ...saved, feel: "play", masterVolume: 0.9, volumeCap: 0.5 });
    expect(back).toMatchObject({ feel: "play", masterVolume: 0.9, volumeCap: 0.5 });
  });

  it("saving over a slot replaces it", () => {
    const first = saveFavourite(0)(base({ colorId: "red" }));
    const second = saveFavourite(0)({ ...first, colorId: "blue" });
    expect(second.favourites.at(0)?.colorId).toBe("blue");
  });

  it("an empty slot, or a slot that does not exist, changes nothing", () => {
    const start = base();
    expect(applyFavourite(1)(start)).toBe(start);
    expect(applyFavourite(9)(start)).toBe(start);
    expect(saveFavourite(9)(start)).toBe(start);
    expect(saveFavourite(-1)(start)).toBe(start);
  });

  it("cannot be saved while the remote is locked", () => {
    const locked = base({ remoteLocked: true });
    expect(saveFavourite(0)(locked)).toBe(locked);
  });

  it("a favourite with Flash becomes Smooth when Flash is no longer allowed", () => {
    const saved = saveFavourite(0)(base({ mode: "flash" }));
    const back = normalizeSettings(applyFavourite(0)({ ...saved, allowFlashStrobe: false }));
    expect(back.mode).toBe("smooth");
  });
});

describe("grown-up settings", () => {
  it("sets the loudest volume, kept between 0 and 1", () => {
    expect(setVolumeCap(0.4)(base()).volumeCap).toBeCloseTo(0.4);
    expect(setVolumeCap(3)(base()).volumeCap).toBe(1);
    expect(setVolumeCap(-3)(base()).volumeCap).toBe(0);
  });

  it("switches Flash and Strobe, the lock, and the drawer side", () => {
    expect(toggleFlashStrobe(base()).allowFlashStrobe).toBe(false);
    expect(toggleRemoteLock(base()).remoteLocked).toBe(true);
    expect(toggleRemoteLock(toggleRemoteLock(base())).remoteLocked).toBe(false);
    expect(setDrawerSide("left")(base()).drawerSide).toBe("left");
    const start = base();
    expect(setDrawerSide("right")(start)).toBe(start);
  });

  it("reset puts everything back, favourites included", () => {
    const used = saveFavourite(0)(base({ colorId: "pink", volumeCap: 0.1, remoteLocked: false }));
    expect(resetEverything(used)).toEqual(defaultSettings());
  });
});
