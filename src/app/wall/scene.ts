/**
 * What is in the wall: the bubbles, the floaters, the lights and the fingers
 * touching it. Each step moves all of it on and describes the frame to draw.
 */
import { createField, refitField, stepField } from "../../core/bubbles";
import { hexToRgb } from "../../core/color";
import { arrangeFloaters, createFloaters, stepFloaters } from "../../core/floaters";
import { tubesFor, type Tube } from "../../core/layout";
import { tubeLights } from "../../core/lights";
import { colorHex } from "../../core/palette";
import { MAX_BUBBLES } from "../../core/quality";
import type { Rng } from "../../core/rng";
import type { Store } from "../../core/store";
import {
  applyTouch,
  createTouch,
  stepTouch,
  touchForces,
  touchGlows,
  type TouchSound,
  type TouchWorld,
} from "../../core/touchForces";
import type { PowerControl } from "../power";
import type { PointerFeed } from "./pointer";
import type { Frame } from "./renderer";

export interface SceneDeps {
  readonly store: Store;
  readonly power: PowerControl;
  readonly rng: Rng;
  readonly pointers: PointerFeed;
  readonly onTouchSound: (sound: TouchSound) => void;
}

export interface Scene {
  /** Lays the tubes out for a wall this wide (in wall units; it is always 1 tall). */
  readonly layout: (wallWidth: number) => void;
  /**
   * Moves everything on by `seconds` and gives the frame to draw. `now` is in
   * milliseconds; `limit` is the most bubbles allowed at once.
   */
  readonly step: (seconds: number, now: number, limit: number) => Frame;
}

export function createScene(deps: SceneDeps): Scene {
  const { store, power, rng } = deps;
  const field = createField(MAX_BUBBLES);
  const floaters = createFloaters();
  const touch = createTouch();
  let tubes: Tube[] = [];
  let width = 1;
  let lightTime = 0;

  const layout = (wallWidth: number): void => {
    width = wallWidth;
    tubes = tubesFor(store.get().layout, width);
    refitField(field, tubes);
    arrangeFloaters(floaters, store.get().floaters, tubes, rng);
  };

  /** Takes the touches since the last frame and moves everything a touch moves. */
  const feel = (seconds: number, now: number): void => {
    const world: TouchWorld = { field, floaters, tubes, rng, feel: store.get().feel, width };
    for (const event of deps.pointers.drain()) {
      for (const sound of applyTouch(touch, event, world, now)) deps.onTouchSound(sound);
    }
    stepTouch(touch, seconds, now, world);
    stepFloaters(floaters, seconds, tubes);
  };

  store.subscribe((next, previous) => {
    if (next.layout !== previous.layout) layout(width);
    else if (next.floaters !== previous.floaters) {
      arrangeFloaters(floaters, next.floaters, tubes, rng);
    }
  });

  return {
    layout,
    step(seconds, now, limit) {
      const settings = store.get();
      power.tick();
      if (!settings.paused) lightTime += seconds;
      feel(seconds, now);
      stepField(field, {
        dt: seconds,
        tubes,
        // Switching off stops the pump at once, so the tubes empty as the light fades.
        pumpOn: settings.bubblesOn && power.isOn(),
        speed: settings.bubbleSpeed,
        limit,
        forces: touchForces(touch, settings.feel),
        rng,
      });
      const lights = tubeLights({
        mode: settings.mode,
        color: hexToRgb(colorHex(settings.colorId)),
        speed: settings.lightSpeed,
        brightness: settings.brightness,
        time: lightTime,
        tubes: tubes.length,
      });
      return {
        tubes,
        lights,
        field,
        floaters,
        floaterKind: settings.floaters,
        glows: touchGlows(touch),
        level: power.level(),
      };
    },
  };
}
