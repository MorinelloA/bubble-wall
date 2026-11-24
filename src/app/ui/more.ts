/**
 * The More tab: his own favourites to save and bring back, ready-made scenes, and
 * the wind-down timer. Also the thin line that shows how much of the timer is left.
 */
import { applyFavourite, applyLook, saveFavourite } from "../../core/actions";
import { colorHex } from "../../core/palette";
import { TIMER_CHOICES } from "../../core/power";
import { SCENES } from "../../core/scenes";
import type { Look } from "../../core/settings";
import type { Store } from "../../core/store";
import type { PowerControl } from "../power";
import { button, el, onHold, section, setPressed } from "./dom";
import type { IconName } from "./icons";

const HOLD_TO_SAVE_MS = 1000;
const TIMER_LINE_MS = 1000;

const SCENE_ICONS: ReadonlyMap<string, IconName> = new Map([
  ["ocean-calm", "ocean"],
  ["rainbow", "rainbow"],
  ["night-light", "moon"],
  ["lava", "flame"],
]);

/** The colour a saved look is shown in: its own colour, or a rainbow for moving shows. */
function swatch(look: Look): string {
  const moving = look.mode === "smooth" || look.mode === "rainbow" || look.mode === "flash";
  return moving
    ? "conic-gradient(#ff1f2d, #ffe100, #12c93a, #19e3d2, #1f47ff, #d92bd3, #ff1f2d)"
    : colorHex(look.colorId);
}

function favourites(win: Window, store: Store): HTMLElement {
  const doc = win.document;
  const row = el(doc, "div", "slots");
  const slots = store.get().favourites.map((_, slot) => {
    const number = String(slot + 1);
    const slotButton = button(doc, {
      label: `Favourite ${number}`,
      className: "slot",
      onPress: () => {
        store.update(applyFavourite(slot));
      },
    });
    slotButton.append(el(doc, "span", "slot-number", number));
    onHold(slotButton, {
      ms: HOLD_TO_SAVE_MS,
      win,
      onHeld: () => {
        store.update(saveFavourite(slot));
      },
    });
    row.append(slotButton);
    return { slot, number, slotButton };
  });
  const refresh = (): void => {
    const settings = store.get();
    for (const { slot, number, slotButton } of slots) {
      const look = settings.favourites.at(slot);
      const state = look ? "Tap to use, hold to save again" : "Empty. Hold to save";
      slotButton.setAttribute("aria-label", `Favourite ${number}. ${state}`);
      slotButton.classList.toggle("is-empty", !look);
      slotButton.style.setProperty("--swatch", look ? swatch(look) : "transparent");
    }
  };
  store.subscribe(refresh);
  refresh();
  const block = section(doc, "My favourites", row);
  block.append(el(doc, "p", "hint", "Hold a circle to save the wall as it is now."));
  return block;
}

function scenes(doc: Document, store: Store): HTMLElement {
  const row = el(doc, "div", "tiles four");
  for (const scene of SCENES) {
    row.append(
      button(doc, {
        label: scene.name,
        className: "tile",
        icon: SCENE_ICONS.get(scene.id) ?? "more",
        caption: true,
        onPress: () => {
          store.update(applyLook(scene.look));
        },
      }),
    );
  }
  return section(doc, "Scenes", row);
}

function timer(doc: Document, power: PowerControl): HTMLElement {
  const row = el(doc, "div", "choices");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Wind-down timer, in minutes");
  const chips = [0, ...TIMER_CHOICES].map((minutes) => {
    const chip = button(doc, {
      label: minutes === 0 ? "Timer off" : `${String(minutes)} minutes`,
      className: "chip",
      onPress: () => {
        power.setTimer(minutes);
      },
    });
    chip.append(minutes === 0 ? "Off" : String(minutes));
    row.append(chip);
    return { minutes, chip };
  });
  const refresh = (): void => {
    for (const { minutes, chip } of chips) {
      setPressed(chip, power.timerMinutes() === minutes);
      // A timer only means something while the wall is on.
      chip.disabled = !power.isOn();
    }
  };
  power.subscribe(refresh);
  refresh();
  const block = section(doc, "Wind-down timer", row);
  block.append(el(doc, "p", "hint", "Minutes until the wall slowly dims and switches off."));
  return block;
}

export function createMorePanel(win: Window, store: Store, power: PowerControl): HTMLElement {
  const doc = win.document;
  const element = el(doc, "div", "more-panel");
  element.append(favourites(win, store), scenes(doc, store), timer(doc, power));
  return element;
}

/** A thin line along the top that slowly shrinks, so the ending is never a surprise. */
export function createTimerLine(win: Window, power: PowerControl): HTMLElement {
  const line = el(win.document, "div", "timer-line");
  line.setAttribute("role", "progressbar");
  line.setAttribute("aria-label", "Time left on the timer");
  line.setAttribute("aria-valuemin", "0");
  line.setAttribute("aria-valuemax", "100");
  const refresh = (): void => {
    const remaining = power.timerRemaining();
    line.hidden = remaining === null;
    const percent = Math.round((remaining ?? 0) * 100);
    line.setAttribute("aria-valuenow", String(percent));
    line.style.setProperty("--left", `${String((remaining ?? 0) * 100)}%`);
  };
  power.subscribe(refresh);
  win.setInterval(refresh, TIMER_LINE_MS);
  refresh();
  return line;
}
