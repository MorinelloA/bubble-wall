import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REMOTE_KEYS } from "../../../src/core/palette";
import { defaultSettings, type Settings } from "../../../src/core/settings";
import { createStore } from "../../../src/core/store";
import { button, setPressed, stepper } from "../../../src/app/ui/dom";
import { icon } from "../../../src/app/ui/icons";
import { createRemote } from "../../../src/app/ui/remote";
import { showStart } from "../../../src/app/ui/start";
import { createWallPanel } from "../../../src/app/ui/wallpanel";
import { buttonNamed, freshRoot, isPressed, pointer, testPower } from "../fakes/page";

const storeWith = (over: Partial<Settings> = {}) => createStore({ ...defaultSettings(), ...over });

describe("button", () => {
  it("is a real button with a spoken label, an icon and optional words", () => {
    const plain = button(document, { label: "Rain", icon: "wall", onPress: vi.fn() });
    expect(plain.type).toBe("button");
    expect(plain.getAttribute("aria-label")).toBe("Rain");
    expect(plain.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(plain.textContent).toBe("");
    const captioned = button(document, { label: "Rain", caption: true, onPress: vi.fn() });
    expect(captioned.textContent).toBe("Rain");
  });

  it("squishes while a finger is on it and lets go on up, leave or cancel", () => {
    const element = button(document, { label: "x", onPress: vi.fn() });
    for (const end of ["pointerup", "pointerleave", "pointercancel"]) {
      pointer(element, "pointerdown");
      expect(element.classList.contains("is-pressed")).toBe(true);
      pointer(element, end);
      expect(element.classList.contains("is-pressed")).toBe(false);
    }
  });

  it("calls its action on a press and pops until the animation ends", () => {
    const onPress = vi.fn();
    const element = button(document, { label: "x", onPress });
    element.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(element.classList.contains("is-done")).toBe(true);
    element.dispatchEvent(new Event("animationend"));
    expect(element.classList.contains("is-done")).toBe(false);
  });

  it("can be marked as the one in effect", () => {
    const element = button(document, { label: "x", onPress: vi.fn() });
    setPressed(element, true);
    expect(isPressed(element)).toBe(true);
    setPressed(element, false);
    expect(isPressed(element)).toBe(false);
  });
});

describe("icon", () => {
  it("builds shapes, not HTML text", () => {
    const svg = icon(document, "brighter");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect([...svg.children].map((child) => child.tagName)).toEqual(["circle", "path"]);
  });
});

describe("stepper", () => {
  it("steps down and up, lights its dots and says where it is", () => {
    const onChange = vi.fn();
    const control = stepper(document, { label: "Bubble speed", steps: 5, onChange });
    control.show(2);
    expect(control.element.getAttribute("role")).toBe("group");
    expect(control.element.querySelectorAll(".dot.is-lit")).toHaveLength(2);
    expect(control.element.querySelector('[role="status"]')?.textContent).toBe(
      "Bubble speed 2 of 5",
    );
    buttonNamed(control.element, "Bubble speed: less").click();
    buttonNamed(control.element, "Bubble speed: more").click();
    expect(onChange.mock.calls).toEqual([[-1], [1]]);
  });

  it("switches off the button that has nowhere left to go", () => {
    const control = stepper(document, { label: "Speed", steps: 3, onChange: vi.fn() });
    control.show(1);
    expect(buttonNamed(control.element, "Speed: less").disabled).toBe(true);
    expect(buttonNamed(control.element, "Speed: more").disabled).toBe(false);
    control.show(3);
    expect(buttonNamed(control.element, "Speed: less").disabled).toBe(false);
    expect(buttonNamed(control.element, "Speed: more").disabled).toBe(true);
  });
});

describe("the remote", () => {
  const setup = (over: Partial<Settings> = {}) => {
    const store = storeWith(over);
    const { power, wait } = testPower();
    const remote = createRemote(document, store, power);
    return { store, power, wait, remote };
  };

  it("has the 24 keys in the order of the real remote, each labelled", () => {
    const { remote } = setup();
    const labels = [...remote.querySelectorAll("button")].map((key) =>
      key.getAttribute("aria-label"),
    );
    expect(labels).toEqual(REMOTE_KEYS.map((key) => key.label));
    expect(remote.getAttribute("aria-label")).toBe("Bubble wall remote");
  });

  it("shows words on the control keys and colour alone on the colour keys", () => {
    const { remote } = setup();
    expect(buttonNamed(remote, "Flash").textContent).toBe("Flash");
    expect(buttonNamed(remote, "Flash").classList.contains("glass")).toBe(true);
    expect(buttonNamed(remote, "Red").textContent).toBe("");
    expect(buttonNamed(remote, "Red").style.getPropertyValue("--c")).toBe("#ff1f2d");
  });

  it.each(REMOTE_KEYS.filter((key) => key.group === "colors"))(
    "the $label key sets that colour",
    (key) => {
      const { store, remote } = setup({ mode: "fade", colorId: key.id === "red" ? "blue" : "red" });
      buttonNamed(remote, key.label).click();
      expect(store.get()).toMatchObject({ colorId: key.id, mode: "static" });
      expect(isPressed(buttonNamed(remote, key.label))).toBe(true);
    },
  );

  it.each(["Flash", "Strobe", "Fade", "Smooth"])("the %s key starts that show", (label) => {
    const { store, remote } = setup({ mode: "static" });
    buttonNamed(remote, label).click();
    expect(store.get().mode).toBe(label.toLowerCase());
    expect(isPressed(buttonNamed(remote, label))).toBe(true);
    expect(isPressed(buttonNamed(remote, "Sky Blue"))).toBe(false);
  });

  it("Dimmer and Brighter step the brightness and never look pressed", () => {
    const { store, remote } = setup({ brightness: 4 });
    buttonNamed(remote, "Brighter").click();
    buttonNamed(remote, "Brighter").click();
    buttonNamed(remote, "Dimmer").click();
    expect(store.get().brightness).toBe(5);
    expect(isPressed(buttonNamed(remote, "Brighter"))).toBe(false);
  });

  it("On and Off switch the wall and show which one is in effect", () => {
    const { power, wait, remote } = setup();
    expect(isPressed(buttonNamed(remote, "Off"))).toBe(true);
    buttonNamed(remote, "On").click();
    expect(power.isOn()).toBe(true);
    expect(isPressed(buttonNamed(remote, "On"))).toBe(true);
    expect(isPressed(buttonNamed(remote, "Off"))).toBe(false);
    buttonNamed(remote, "Off").click();
    expect(power.isOn()).toBe(false);
    expect(isPressed(buttonNamed(remote, "Off"))).toBe(true);
    wait(5000);
    power.tick();
    expect(power.level()).toBe(0);
  });

  it("hides Flash and Strobe while a grown-up has them switched off", () => {
    const { store, remote } = setup({ allowFlashStrobe: false });
    expect(buttonNamed(remote, "Flash").hidden).toBe(true);
    expect(buttonNamed(remote, "Strobe").hidden).toBe(true);
    expect(buttonNamed(remote, "Fade").hidden).toBe(false);
    store.update((s) => ({ ...s, allowFlashStrobe: true }));
    expect(buttonNamed(remote, "Flash").hidden).toBe(false);
  });
});

describe("the Wall tab", () => {
  const setup = (over: Partial<Settings> = {}) => {
    const store = storeWith(over);
    return { store, panel: createWallPanel(document, store) };
  };

  it.each([
    ["Bubbles", { bubblesOn: true }, { bubblesOn: false }],
    ["Bubble speed: more", { bubbleSpeed: 2 }, { bubbleSpeed: 3 }],
    ["Bubble speed: less", { bubbleSpeed: 2 }, { bubbleSpeed: 1 }],
    ["Light speed: more", { lightSpeed: 3 }, { lightSpeed: 4 }],
    ["Light speed: less", { lightSpeed: 3 }, { lightSpeed: 2 }],
    ["Rainbow", { mode: "static" }, { mode: "rainbow" }],
    ["Breathe", { mode: "static" }, { mode: "breathe" }],
    ["Hold this colour", { paused: false }, { paused: true }],
    ["Six tubes", { layout: "open" }, { layout: "tubes6" }],
    ["Three tubes", { layout: "tubes6" }, { layout: "tubes3" }],
    ["One big tank", { layout: "tubes6" }, { layout: "open" }],
  ] as const)("%s changes its setting", (label, before, after) => {
    const { store, panel } = setup(before);
    buttonNamed(panel, label).click();
    expect(store.get()).toMatchObject(after);
  });

  it("shows what is in effect and follows changes made elsewhere", () => {
    const { store, panel } = setup({ mode: "rainbow", layout: "tubes3", bubblesOn: true });
    expect(isPressed(buttonNamed(panel, "Rainbow"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Breathe"))).toBe(false);
    expect(isPressed(buttonNamed(panel, "Three tubes"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Bubbles"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Hold this colour"))).toBe(false);

    store.update((s) => ({ ...s, mode: "breathe", bubbleSpeed: 5, paused: true }));
    expect(isPressed(buttonNamed(panel, "Breathe"))).toBe(true);
    expect(isPressed(buttonNamed(panel, "Hold this colour"))).toBe(true);
    expect(buttonNamed(panel, "Bubble speed: more").disabled).toBe(true);
    expect(panel.textContent).toContain("Bubble speed 5 of 5");
  });
});

describe("the start screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts everything from one tap, once, then gets out of the way", () => {
    const root = freshRoot();
    const onStart = vi.fn();
    showStart(window, root, onStart);
    const start = root.querySelector<HTMLButtonElement>(".start-button");
    expect(start?.textContent).toBe("Tap to start");
    expect(root.firstElementChild?.classList.contains("start")).toBe(true);
    expect(root.classList.contains("not-started")).toBe(true);

    start?.click();
    start?.click();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(root.classList.contains("not-started")).toBe(false);
    expect(root.querySelector(".start")?.classList.contains("is-leaving")).toBe(true);
    vi.advanceTimersByTime(600);
    expect(root.querySelector(".start")).toBeNull();
  });
});
