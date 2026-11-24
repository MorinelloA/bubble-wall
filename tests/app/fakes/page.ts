/** Helpers for tests that press, drag and look things up on the page. */
import { createPowerControl, type PowerControl } from "../../../src/app/power";

export interface TestPower {
  readonly power: PowerControl;
  /** Moves the power clock on by this many milliseconds. */
  readonly wait: (ms: number) => void;
}

export function testPower(): TestPower {
  let clock = 0;
  return {
    power: createPowerControl(() => clock),
    wait: (ms) => {
      clock += ms;
    },
  };
}

/** A fresh root element on an otherwise empty page. */
export function freshRoot(): HTMLElement {
  document.body.replaceChildren();
  const root = document.createElement("main");
  root.id = "app";
  document.body.append(root);
  return root;
}

/** Sends a pointer event (finger down, move or up) to an element at a horizontal position. */
export function pointer(target: Element, type: string, clientX = 0): void {
  target.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

export function key(target: EventTarget, name: string): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
}

/** The button with this spoken label inside `within`. Fails the test when there is none. */
export function buttonNamed(within: ParentNode, label: string): HTMLButtonElement {
  const found = [...within.querySelectorAll("button")].find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!found) throw new Error(`No button labelled "${label}"`);
  return found;
}

export function isPressed(element: Element): boolean {
  return element.getAttribute("aria-pressed") === "true";
}
