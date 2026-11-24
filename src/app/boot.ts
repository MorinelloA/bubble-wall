import { createRng } from "../core/rng";

/** Finds the app's root element and starts everything inside it. */
export function boot(doc: Document, seed: number): HTMLElement {
  const root = doc.getElementById("app");
  if (!root) throw new Error("Bubble Wall needs an element with id 'app'.");
  root.dataset.ready = String(createRng(seed).next() < 1);
  return root;
}
