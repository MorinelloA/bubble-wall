import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings, type Settings } from "../../../src/core/settings";
import { createStore } from "../../../src/core/store";
import { createDrawer } from "../../../src/app/ui/drawer";
import { buttonNamed, freshRoot, key, pointer, testPower } from "../fakes/page";

const setup = (over: Partial<Settings> = {}) => {
  const root = freshRoot();
  const store = createStore({ ...defaultSettings(), ...over });
  const { power } = testPower();
  const first = document.createElement("div");
  const inside = document.createElement("button");
  const slider = document.createElement("input");
  first.append(inside, slider);
  const drawer = createDrawer({
    win: window,
    root,
    store,
    power,
    panels: [
      { id: "remote", label: "Remote", icon: "remote", content: first },
      { id: "wall", label: "Wall", icon: "wall", content: document.createElement("div") },
    ],
  });
  const panel = root.querySelector<HTMLElement>("aside.drawer");
  const pull = root.querySelector<HTMLButtonElement>("button.drawer-tab");
  if (!panel || !pull) throw new Error("drawer not built");
  const outside = document.createElement("canvas");
  root.append(outside);
  return { root, store, power, drawer, panel, pull, inside, slider, outside, first };
};

describe("the drawer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts closed, as a labelled side panel with a pull tab", () => {
    const { drawer, panel, pull } = setup();
    expect(drawer.isOpen()).toBe(false);
    expect(panel.classList.contains("is-open")).toBe(false);
    expect(panel.getAttribute("aria-label")).toBe("Remote and settings");
    expect(pull.getAttribute("aria-expanded")).toBe("false");
    expect(pull.getAttribute("aria-controls")).toBe(panel.id);
  });

  it("opens and closes from the pull tab", () => {
    const { drawer, panel, pull, root } = setup();
    pull.click();
    expect(drawer.isOpen()).toBe(true);
    expect(panel.classList.contains("is-open")).toBe(true);
    expect(root.classList.contains("drawer-open")).toBe(true);
    expect(pull.getAttribute("aria-expanded")).toBe("true");
    pull.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("closes by itself after 10 seconds untouched", () => {
    const { drawer } = setup();
    drawer.open();
    vi.advanceTimersByTime(9_999);
    expect(drawer.isOpen()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(drawer.isOpen()).toBe(false);
  });

  it.each(["pointerdown", "keydown", "input"])("stays open while it is being used (%s)", (type) => {
    const { drawer, inside } = setup();
    drawer.open();
    vi.advanceTimersByTime(8_000);
    inside.dispatchEvent(new Event(type, { bubbles: true }));
    vi.advanceTimersByTime(8_000);
    expect(drawer.isOpen()).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(drawer.isOpen()).toBe(false);
  });

  it("closes on a tap outside, but not on a tap inside or on the tab", () => {
    const { drawer, inside, pull, outside } = setup();
    drawer.open();
    pointer(inside, "pointerdown");
    pointer(pull, "pointerdown");
    expect(drawer.isOpen()).toBe(true);
    pointer(outside, "pointerdown");
    expect(drawer.isOpen()).toBe(false);
  });

  it("closes on Escape, and ignores other keys", () => {
    const { drawer } = setup();
    drawer.open();
    key(document, "a");
    expect(drawer.isOpen()).toBe(true);
    key(document, "Escape");
    expect(drawer.isOpen()).toBe(false);
    key(document, "Escape");
    expect(drawer.isOpen()).toBe(false);
  });

  it("closes when swiped back towards its edge", () => {
    const { drawer, first } = setup();
    drawer.open();
    pointer(first, "pointerdown", 700);
    pointer(first, "pointermove", 730);
    expect(drawer.isOpen()).toBe(true);
    pointer(first, "pointermove", 761);
    expect(drawer.isOpen()).toBe(false);
  });

  it("ignores a swipe the other way, a swipe that was let go, and one on a control", () => {
    const { drawer, first, inside, slider } = setup();
    drawer.open();
    pointer(first, "pointerdown", 700);
    pointer(first, "pointermove", 600);
    expect(drawer.isOpen()).toBe(true);

    pointer(first, "pointerdown", 700);
    pointer(first, "pointerup", 700);
    pointer(first, "pointermove", 800);
    expect(drawer.isOpen()).toBe(true);

    for (const control of [inside, slider]) {
      pointer(control, "pointerdown", 700);
      pointer(control, "pointermove", 800);
      expect(drawer.isOpen()).toBe(true);
    }
  });

  it("opens when the tab is pulled into the screen, and the click that follows keeps it open", () => {
    const { drawer, pull } = setup();
    pointer(pull, "pointerdown", 1000);
    pointer(pull, "pointermove", 1010);
    expect(drawer.isOpen()).toBe(false);
    pointer(pull, "pointermove", 980);
    expect(drawer.isOpen()).toBe(true);
    pull.click();
    expect(drawer.isOpen()).toBe(true);
    pull.click();
    expect(drawer.isOpen()).toBe(false);
  });

  it("does not open when the tab is pushed towards the edge", () => {
    const { drawer, pull } = setup();
    pointer(pull, "pointerdown", 1000);
    pointer(pull, "pointermove", 1030);
    expect(drawer.isOpen()).toBe(false);
  });

  it("sits on the left when asked, and swipes the other way", () => {
    const { drawer, root, store, first, pull } = setup({ drawerSide: "left" });
    expect(root.dataset.side).toBe("left");
    pointer(pull, "pointerdown", 10);
    pointer(pull, "pointermove", 40);
    expect(drawer.isOpen()).toBe(true);
    pointer(first, "pointerdown", 300);
    pointer(first, "pointermove", 200);
    expect(drawer.isOpen()).toBe(false);
    store.update((s) => ({ ...s, drawerSide: "right" }));
    expect(root.dataset.side).toBe("right");
  });

  it("hides the tab and closes when a grown-up locks the remote", () => {
    const { drawer, store, pull } = setup();
    drawer.open();
    store.update((s) => ({ ...s, remoteLocked: true }));
    expect(drawer.isOpen()).toBe(false);
    expect(pull.hidden).toBe(true);
    drawer.open();
    expect(drawer.isOpen()).toBe(false);
    store.update((s) => ({ ...s, remoteLocked: false }));
    expect(pull.hidden).toBe(false);
  });

  it("fades the tab when left alone and brings it back on any touch", () => {
    const { pull, outside } = setup();
    expect(pull.classList.contains("is-idle")).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(pull.classList.contains("is-idle")).toBe(true);
    pointer(outside, "pointerdown");
    expect(pull.classList.contains("is-idle")).toBe(false);
  });

  it("keeps the tab easy to find while the wall is off", () => {
    const { pull, power } = setup();
    power.on();
    expect(pull.classList.contains("is-needed")).toBe(false);
    power.off();
    expect(pull.classList.contains("is-needed")).toBe(true);
  });

  it("moves focus into the drawer on open and back to the tab on close", () => {
    const { drawer, pull, root } = setup();
    drawer.open();
    expect(document.activeElement).toBe(buttonNamed(root, "Remote"));
    expect(document.activeElement?.getAttribute("role")).toBe("tab");
    drawer.close();
    expect(document.activeElement).toBe(pull);
  });

  it("leaves focus alone on close when it was not in the drawer", () => {
    const { drawer, outside } = setup();
    drawer.open();
    outside.tabIndex = 0;
    outside.focus();
    drawer.close();
    expect(document.activeElement).toBe(outside);
  });
});

describe("the drawer tabs", () => {
  const tabs = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="tab"]')];
  const panels = (root: HTMLElement) => [
    ...root.querySelectorAll<HTMLElement>('[role="tabpanel"]'),
  ];

  it("shows the first panel and ties each tab to its panel", () => {
    const { root } = setup();
    const [remote, wall] = tabs(root);
    const [remotePanel, wallPanel] = panels(root);
    expect(remote?.getAttribute("aria-selected")).toBe("true");
    expect(wall?.getAttribute("aria-selected")).toBe("false");
    expect(remotePanel?.hidden).toBe(false);
    expect(wallPanel?.hidden).toBe(true);
    expect(remote?.getAttribute("aria-controls")).toBe(remotePanel?.id);
    expect(wallPanel?.getAttribute("aria-labelledby")).toBe(wall?.id);
    expect(wall?.tabIndex).toBe(-1);
  });

  it("switches panel on a press", () => {
    const { root } = setup();
    const [, wall] = tabs(root);
    wall?.click();
    expect(wall?.getAttribute("aria-selected")).toBe("true");
    expect(panels(root).map((panel) => panel.hidden)).toEqual([true, false]);
  });

  it("moves between tabs with the arrow keys, wrapping at the ends", () => {
    const { root } = setup();
    const [remote, wall] = tabs(root);
    const list = root.querySelector('[role="tablist"]');
    if (!list) throw new Error("no tablist");
    key(list, "ArrowRight");
    expect(document.activeElement).toBe(wall);
    key(list, "ArrowRight");
    expect(document.activeElement).toBe(remote);
    key(list, "ArrowLeft");
    expect(document.activeElement).toBe(wall);
    key(list, "Enter");
    expect(wall?.getAttribute("aria-selected")).toBe("true");
  });
});
