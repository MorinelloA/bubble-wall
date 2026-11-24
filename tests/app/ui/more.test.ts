import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, type Settings } from "../../../src/core/settings";
import { createStore } from "../../../src/core/store";
import { createProblemLog } from "../../../src/app/platform/errors";
import { createSafeStorage } from "../../../src/app/platform/storage";
import { onHold } from "../../../src/app/ui/dom";
import { createGrownups } from "../../../src/app/ui/grownups";
import { createMorePanel, createTimerLine } from "../../../src/app/ui/more";
import { buttonNamed, freshRoot, isPressed, key, pointer, testPower } from "../fakes/page";
import { memoryStorage } from "../fakes/storage";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Presses and holds an element for a while, then lets go and delivers the click that follows. */
const hold = (element: HTMLElement, ms: number): void => {
  pointer(element, "pointerdown");
  vi.advanceTimersByTime(ms);
  pointer(element, "pointerup");
  element.click();
};

const slotNumbered = (panel: HTMLElement, number: number): HTMLButtonElement => {
  const found = panel.querySelectorAll<HTMLButtonElement>("button.slot").item(number - 1);
  return found;
};

describe("onHold", () => {
  const setup = () => {
    const element = document.createElement("button");
    const onHeld = vi.fn();
    const onClick = vi.fn();
    element.addEventListener("click", onClick);
    onHold(element, { ms: 1000, win: window, onHeld });
    return { element, onHeld, onClick };
  };

  it("fires once the element has been held for the whole time", () => {
    const { element, onHeld } = setup();
    pointer(element, "pointerdown");
    expect(element.classList.contains("is-holding")).toBe(true);
    expect(element.style.getPropertyValue("--hold")).toBe("1000ms");
    vi.advanceTimersByTime(999);
    expect(onHeld).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onHeld).toHaveBeenCalledTimes(1);
    expect(element.classList.contains("is-holding")).toBe(false);
  });

  it.each(["pointerup", "pointerleave", "pointercancel", "blur"])(
    "is cancelled by %s before the time is up",
    (type) => {
      const { element, onHeld } = setup();
      pointer(element, "pointerdown");
      vi.advanceTimersByTime(900);
      element.dispatchEvent(new Event(type));
      vi.advanceTimersByTime(5000);
      expect(onHeld).not.toHaveBeenCalled();
      expect(element.classList.contains("is-holding")).toBe(false);
    },
  );

  it("swallows the click that ends a hold, but not an ordinary tap", () => {
    const { element, onClick } = setup();
    hold(element, 1000);
    expect(onClick).not.toHaveBeenCalled();
    element.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    hold(element, 200);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it.each(["Enter", " "])("works with the %s key held down, however often it repeats", (name) => {
    const { element, onHeld } = setup();
    key(element, name);
    vi.advanceTimersByTime(500);
    key(element, name);
    vi.advanceTimersByTime(500);
    expect(onHeld).toHaveBeenCalledTimes(1);
  });

  it("is cancelled when the key is let go early, and ignores other keys", () => {
    const { element, onHeld } = setup();
    key(element, "Enter");
    vi.advanceTimersByTime(500);
    element.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    key(element, "a");
    vi.advanceTimersByTime(5000);
    expect(onHeld).not.toHaveBeenCalled();
  });
});

describe("the More tab", () => {
  const setup = (over: Partial<Settings> = {}) => {
    const store = createStore({ ...defaultSettings(), ...over });
    const { power, wait } = testPower();
    const panel = createMorePanel(window, store, power);
    return { store, power, wait, panel };
  };

  it("starts with four empty favourites that say how to save", () => {
    const { panel } = setup();
    const slots = [...panel.querySelectorAll("button.slot")];
    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(slot.classList.contains("is-empty")).toBe(true);
      expect(slot.getAttribute("aria-label")).toMatch(/Empty\. Hold to save/);
    }
  });

  it("saves the wall into a favourite when held for a second, without also applying it", () => {
    const { store, panel } = setup({ colorId: "pink", mode: "static" });
    const first = slotNumbered(panel, 1);
    hold(first, 999);
    expect(store.get().favourites.at(0)).toBeNull();
    hold(first, 1000);
    expect(store.get().favourites.at(0)?.colorId).toBe("pink");
    expect(first.classList.contains("is-empty")).toBe(false);
    expect(first.getAttribute("aria-label")).toBe("Favourite 1. Tap to use, hold to save again");
    expect(first.style.getPropertyValue("--swatch")).toBe("#ff5cb4");
  });

  it("brings a favourite back on a tap", () => {
    const { store, panel } = setup({ colorId: "pink", mode: "static" });
    hold(slotNumbered(panel, 2), 1000);
    store.update((s) => ({ ...s, colorId: "green" }));
    slotNumbered(panel, 2).click();
    expect(store.get().colorId).toBe("pink");
  });

  it("shows a moving show as a rainbow swatch", () => {
    const { panel } = setup({ mode: "rainbow" });
    hold(slotNumbered(panel, 1), 1000);
    expect(slotNumbered(panel, 1).style.getPropertyValue("--swatch")).toMatch(/conic-gradient/);
  });

  it("a tap on an empty favourite changes nothing", () => {
    const { store, panel } = setup();
    const before = store.get();
    slotNumbered(panel, 3).click();
    expect(store.get()).toBe(before);
  });

  it("cannot save while the remote is locked", () => {
    const { store, panel } = setup({ remoteLocked: true });
    hold(slotNumbered(panel, 1), 1000);
    expect(store.get().favourites.at(0)).toBeNull();
  });

  it.each([
    ["Ocean Calm", { colorId: "teal", mode: "fade" }],
    ["Rainbow", { mode: "rainbow" }],
    ["Night Light", { colorId: "indigo", brightness: 2 }],
    ["Lava", { colorId: "red-orange", layout: "tubes3" }],
  ] as const)("the %s scene puts that look on the wall", (name, expected) => {
    const { store, panel } = setup({ paused: true });
    buttonNamed(panel, name).click();
    expect(store.get()).toMatchObject({ ...expected, paused: false });
  });

  it("offers the timer only while the wall is on", () => {
    const { power, panel } = setup();
    expect(buttonNamed(panel, "5 minutes").disabled).toBe(true);
    power.on();
    expect(buttonNamed(panel, "5 minutes").disabled).toBe(false);
    expect(isPressed(buttonNamed(panel, "Timer off"))).toBe(true);
  });

  it.each([5, 10, 15, 30, 60])("sets a %s minute timer and shows it as chosen", (minutes) => {
    const { power, panel } = setup();
    power.on();
    buttonNamed(panel, `${String(minutes)} minutes`).click();
    expect(power.timerMinutes()).toBe(minutes);
    expect(isPressed(buttonNamed(panel, `${String(minutes)} minutes`))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Timer off"))).toBe(false);
    buttonNamed(panel, "Timer off").click();
    expect(power.timerMinutes()).toBe(0);
  });

  it("goes back to Off by itself once the timer has switched the wall off", () => {
    const { power, wait, panel } = setup();
    power.on();
    buttonNamed(panel, "5 minutes").click();
    wait(6 * 60_000);
    power.tick();
    expect(power.isOn()).toBe(false);
    expect(isPressed(buttonNamed(panel, "Timer off"))).toBe(true);
    expect(buttonNamed(panel, "5 minutes").disabled).toBe(true);
  });
});

describe("the timer line", () => {
  it("is hidden with no timer, and shrinks as the time runs down", () => {
    const { power, wait } = testPower();
    const line = createTimerLine(window, power);
    expect(line.hidden).toBe(true);
    expect(line.getAttribute("role")).toBe("progressbar");
    expect(line.getAttribute("aria-label")).toBe("Time left on the timer");

    power.on();
    power.setTimer(10);
    expect(line.hidden).toBe(false);
    expect(line.getAttribute("aria-valuenow")).toBe("100");

    wait(5 * 60_000);
    vi.advanceTimersByTime(1000);
    expect(line.getAttribute("aria-valuenow")).toBe("50");
    expect(line.style.getPropertyValue("--left")).toBe("50%");

    power.setTimer(0);
    expect(line.hidden).toBe(true);
  });
});

describe("the grown-up area", () => {
  const setup = (over: Partial<Settings> = {}) => {
    const root = freshRoot();
    const store = createStore({ ...defaultSettings(), ...over });
    const problems = createProblemLog(
      createSafeStorage(() => memoryStorage(), vi.fn()),
      () => Date.UTC(2026, 10, 24, 12),
    );
    const onReset = vi.fn();
    createGrownups({ win: window, root, store, problems, onReset });
    const dialog = root.querySelector("dialog");
    const lock = root.querySelector<HTMLButtonElement>("button.grownup-lock");
    if (!dialog || !lock) throw new Error("grown-up area not built");
    const open = (): void => {
      hold(lock, 3000);
    };
    return { root, store, problems, onReset, dialog, lock, open };
  };

  it("opens only after the lock has been held for three seconds", () => {
    const { dialog, lock } = setup();
    lock.click();
    expect(dialog.open).toBe(false);
    hold(lock, 2999);
    expect(dialog.open).toBe(false);
    hold(lock, 3000);
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBe("grownups-title");
    expect(lock.getAttribute("aria-label")).toBe("Grown-ups: hold for three seconds");
  });

  it("opens from the keyboard too", () => {
    const { dialog, lock } = setup();
    key(lock, "Enter");
    vi.advanceTimersByTime(3000);
    expect(dialog.open).toBe(true);
  });

  it("closes on Done", () => {
    const { dialog, open } = setup();
    open();
    buttonNamed(dialog, "Done").click();
    expect(dialog.open).toBe(false);
  });

  it("sets the loudest volume", () => {
    const { store, dialog } = setup({ volumeCap: 0.8 });
    const input = dialog.querySelector<HTMLInputElement>('input[type="range"]');
    expect(input?.value).toBe("80");
    if (input) input.value = "40";
    input?.dispatchEvent(new Event("input", { bubbles: true }));
    expect(store.get().volumeCap).toBeCloseTo(0.4);
  });

  it("switches Flash and Strobe off and on", () => {
    const { store, dialog } = setup({ mode: "flash" });
    const allow = buttonNamed(dialog, "Allow Flash and Strobe");
    expect(isPressed(allow)).toBe(true);
    allow.click();
    expect(store.get()).toMatchObject({ allowFlashStrobe: false, mode: "smooth" });
    expect(isPressed(allow)).toBe(false);
    allow.click();
    expect(store.get().allowFlashStrobe).toBe(true);
  });

  it("locks and unlocks the remote", () => {
    const { store, dialog } = setup();
    buttonNamed(dialog, "Lock the remote").click();
    expect(store.get().remoteLocked).toBe(true);
    expect(isPressed(buttonNamed(dialog, "Lock the remote"))).toBe(true);
    buttonNamed(dialog, "Lock the remote").click();
    expect(store.get().remoteLocked).toBe(false);
  });

  it("moves the drawer to the other side", () => {
    const { store, dialog } = setup();
    expect(isPressed(buttonNamed(dialog, "Drawer on the right"))).toBe(true);
    buttonNamed(dialog, "Drawer on the left").click();
    expect(store.get().drawerSide).toBe("left");
    expect(isPressed(buttonNamed(dialog, "Drawer on the left"))).toBe(true);
    expect(isPressed(buttonNamed(dialog, "Drawer on the right"))).toBe(false);
  });

  it("resets only on a second press", () => {
    const { dialog, onReset, open } = setup();
    open();
    const reset = buttonNamed(dialog, "Reset everything");
    reset.click();
    expect(onReset).not.toHaveBeenCalled();
    expect(reset.textContent).toBe("Tap again to reset everything");
    reset.click();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(reset.textContent).toBe("Reset everything");
  });

  it("forgets a half-made reset when the area is opened again", () => {
    const { dialog, onReset, open } = setup();
    open();
    buttonNamed(dialog, "Reset everything").click();
    buttonNamed(dialog, "Done").click();
    open();
    buttonNamed(dialog, "Reset everything").click();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("lists the problems caught so far, as plain text, and can clear them", () => {
    const { dialog, problems, open } = setup();
    open();
    expect(dialog.querySelector(".problems")?.textContent).toBe("None so far.");
    buttonNamed(dialog, "Done").click();

    problems.record("<b>the pump stopped</b>");
    open();
    const items = [...dialog.querySelectorAll(".problems li")];
    expect(items).toHaveLength(1);
    expect(items.at(0)?.textContent).toContain("<b>the pump stopped</b>");
    expect(items.at(0)?.querySelector("b")).toBeNull();

    buttonNamed(dialog, "Clear the problems log").click();
    expect(problems.list()).toEqual([]);
    expect(dialog.querySelector(".problems")?.textContent).toBe("None so far.");
  });

  it("explains Guided Access", () => {
    const { dialog } = setup();
    expect(dialog.textContent).toContain("Guided Access");
  });
});
