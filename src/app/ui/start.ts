/**
 * The first screen. Safari only lets sound begin from a touch, so the app opens on
 * one big, calm "tap to start" and everything begins from that tap.
 */
import { el } from "./dom";

const LEAVE_MS = 600;

export function showStart(win: Window, root: HTMLElement, onStart: () => void): void {
  const doc = win.document;
  const overlay = el(doc, "div", "start");
  const start = el(doc, "button", "start-button");
  start.type = "button";
  const bubble = el(doc, "span", "start-bubble");
  bubble.setAttribute("aria-hidden", "true");
  start.append(bubble, el(doc, "span", "start-words", "Tap to start"));
  overlay.append(start);

  start.addEventListener("click", () => {
    start.disabled = true;
    overlay.classList.add("is-leaving");
    root.classList.remove("not-started");
    onStart();
    win.setTimeout(() => {
      overlay.remove();
    }, LEAVE_MS);
  });
  // First in the page, so the keyboard reaches it first; nothing behind it can be
  // reached until the wall has started.
  root.classList.add("not-started");
  root.prepend(overlay);
}
