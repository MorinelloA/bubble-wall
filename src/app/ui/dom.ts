/**
 * The one place controls are built. Every button gets a spoken label, a pressed
 * state and the same squish when touched, so no control can be made without them.
 */
import { icon, type IconName } from "./icons";

export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className = "",
  text = "",
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

export interface ButtonSpec {
  /** What a screen reader says. Also shown under the icon when `caption` is true. */
  readonly label: string;
  readonly className?: string;
  readonly icon?: IconName;
  /** Show the label as text on the button. */
  readonly caption?: boolean;
  readonly onPress: () => void;
}

export function button(doc: Document, spec: ButtonSpec): HTMLButtonElement {
  const element = el(doc, "button", spec.className);
  element.type = "button";
  element.setAttribute("aria-label", spec.label);
  if (spec.icon) element.append(icon(doc, spec.icon));
  if (spec.caption) element.append(el(doc, "span", "name", spec.label));

  const release = (): void => {
    element.classList.remove("is-pressed");
  };
  element.addEventListener("pointerdown", () => {
    element.classList.add("is-pressed");
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    element.addEventListener(type, release);
  }
  element.addEventListener("animationend", () => {
    element.classList.remove("is-done");
  });
  element.addEventListener("click", () => {
    element.classList.add("is-done");
    spec.onPress();
  });
  return element;
}

export interface HoldSpec {
  /** How long it must be held, in milliseconds. */
  readonly ms: number;
  readonly win: Pick<Window, "setTimeout" | "clearTimeout">;
  readonly onHeld: () => void;
}

/**
 * Calls `onHeld` once the element has been pressed and held, by finger or by key.
 * Letting go early cancels. The click that ends a completed hold is swallowed, so
 * holding never also counts as a tap.
 */
export function onHold(element: HTMLElement, spec: HoldSpec): void {
  let timer: number | undefined;
  let completed = false;
  const cancel = (): void => {
    spec.win.clearTimeout(timer);
    timer = undefined;
    element.classList.remove("is-holding");
  };
  const begin = (): void => {
    if (timer !== undefined) return;
    completed = false;
    element.style.setProperty("--hold", `${String(spec.ms)}ms`);
    element.classList.add("is-holding");
    timer = spec.win.setTimeout(() => {
      cancel();
      completed = true;
      spec.onHeld();
    }, spec.ms);
  };
  element.addEventListener("pointerdown", begin);
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") begin();
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel", "keyup", "blur"]) {
    element.addEventListener(type, cancel);
  }
  element.addEventListener(
    "click",
    (event) => {
      if (!completed) return;
      completed = false;
      event.stopImmediatePropagation();
      event.preventDefault();
    },
    { capture: true },
  );
}

/** Marks a button as the one in effect: a ring for the eye, a state for screen readers. */
export function setPressed(element: HTMLElement, pressed: boolean): void {
  element.setAttribute("aria-pressed", String(pressed));
}

export interface Stepper {
  readonly element: HTMLElement;
  /** Shows the current step, from 1 to `steps`. */
  readonly show: (value: number) => void;
}

export interface StepperSpec {
  /** What is being stepped, for example "Bubble speed". */
  readonly label: string;
  readonly steps: number;
  readonly onChange: (direction: -1 | 1) => void;
}

/** Less and more buttons around a row of dots that shows where you are. */
export function stepper(doc: Document, spec: StepperSpec): Stepper {
  const element = el(doc, "div", "stepper");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", spec.label);

  const less = button(doc, {
    label: `${spec.label}: less`,
    className: "round",
    icon: "minus",
    onPress: () => {
      spec.onChange(-1);
    },
  });
  const more = button(doc, {
    label: `${spec.label}: more`,
    className: "round",
    icon: "plus",
    onPress: () => {
      spec.onChange(1);
    },
  });
  const dots = el(doc, "div", "dots");
  dots.setAttribute("aria-hidden", "true");
  const marks = Array.from({ length: spec.steps }, () => el(doc, "span", "dot"));
  dots.append(...marks);
  const spoken = el(doc, "span", "visually-hidden");
  spoken.setAttribute("role", "status");

  element.append(less, dots, more, spoken);
  return {
    element,
    show(value) {
      for (const [index, mark] of marks.entries()) mark.classList.toggle("is-lit", index < value);
      spoken.textContent = `${spec.label} ${String(value)} of ${String(spec.steps)}`;
      less.disabled = value <= 1;
      more.disabled = value >= spec.steps;
    },
  };
}

export interface Slider {
  readonly element: HTMLElement;
  /** Shows a value from 0 to 1. */
  readonly show: (value: number) => void;
}

export interface SliderSpec {
  readonly label: string;
  /** Called with a value from 0 to 1 as the slider moves. */
  readonly onInput: (value: number) => void;
}

/** A labelled slider from 0 to 1. The label is the visible name and the spoken one. */
export function slider(doc: Document, spec: SliderSpec): Slider {
  const element = el(doc, "label", "slider");
  const input = el(doc, "input");
  input.type = "range";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  const fill = (): void => {
    input.style.setProperty("--fill", `${input.value}%`);
  };
  input.addEventListener("input", () => {
    fill();
    spec.onInput(Number(input.value) / 100);
  });
  element.append(el(doc, "span", "slider-name", spec.label), input);
  return {
    element,
    show(value) {
      input.value = String(Math.round(value * 100));
      fill();
    },
  };
}

/** A titled block inside a drawer panel. */
export function section(doc: Document, title: string, ...children: HTMLElement[]): HTMLElement {
  const element = el(doc, "section", "block");
  element.append(el(doc, "h2", "block-title", title), ...children);
  return element;
}
