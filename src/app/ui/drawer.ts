/**
 * The drawer: a faint pull tab on the side of the screen that slides the remote
 * in over the wall. The wall keeps running behind it. It closes by itself when
 * left alone, so the wall is never covered for long.
 */
import type { Store } from "../../core/store";
import type { PowerControl } from "../power";
import { button, el } from "./dom";
import type { IconName } from "./icons";

const AUTO_CLOSE_MS = 10_000;
const IDLE_MS = 5_000;
/** How far a finger must travel to count as a swipe, in CSS pixels. */
const SWIPE_PX = 60;
const PULL_PX = 16;
const ARROW_STEPS: ReadonlyMap<string, number> = new Map([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
]);

export interface DrawerPanel {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly content: HTMLElement;
}

export interface DrawerDeps {
  readonly win: Window;
  readonly root: HTMLElement;
  readonly store: Store;
  readonly power: PowerControl;
  readonly panels: readonly DrawerPanel[];
}

export interface Drawer {
  readonly open: () => void;
  readonly close: () => void;
  readonly isOpen: () => boolean;
}

interface Tabs {
  readonly list: HTMLElement;
  readonly bodies: readonly HTMLElement[];
  readonly focusSelected: () => void;
}

/** The row of tabs and the panel under each, with the usual arrow-key behaviour. */
function buildTabs(doc: Document, panels: readonly DrawerPanel[]): Tabs {
  const list = el(doc, "div", "drawer-tabs");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Remote sections");

  const entries = panels.map((panel) => {
    const body = el(doc, "div", "drawer-panel");
    body.id = `panel-${panel.id}`;
    body.setAttribute("role", "tabpanel");
    body.setAttribute("aria-labelledby", `tab-${panel.id}`);
    body.append(panel.content);
    const tab = button(doc, {
      label: panel.label,
      className: "drawer-tab-button",
      icon: panel.icon,
      caption: true,
      onPress: () => {
        select(panel.id);
      },
    });
    tab.id = `tab-${panel.id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", body.id);
    list.append(tab);
    return { id: panel.id, tab, body };
  });

  const select = (id: string): void => {
    for (const entry of entries) {
      const selected = entry.id === id;
      entry.tab.setAttribute("aria-selected", String(selected));
      entry.tab.tabIndex = selected ? 0 : -1;
      entry.body.hidden = !selected;
    }
  };
  const selectedIndex = (): number =>
    entries.findIndex((entry) => entry.tab.getAttribute("aria-selected") === "true");

  list.addEventListener("keydown", (event) => {
    const step = ARROW_STEPS.get(event.key);
    if (step === undefined) return;
    const next = entries.at((selectedIndex() + step + entries.length) % entries.length);
    if (!next) return;
    select(next.id);
    next.tab.focus({ preventScroll: true });
  });

  const [first] = entries;
  if (first) select(first.id);
  return {
    list,
    bodies: entries.map((entry) => entry.body),
    // preventScroll: the drawer is still sliding in, and the page must not scroll to meet it.
    focusSelected: () => entries.at(selectedIndex())?.tab.focus({ preventScroll: true }),
  };
}

/** Calls `onSwipe` when a finger that went down on `target` has moved far enough sideways. */
function watchSwipe(
  target: HTMLElement,
  distance: number,
  accepts: (start: EventTarget | null) => boolean,
  onSwipe: (dx: number) => void,
): void {
  let startX: number | null = null;
  target.addEventListener("pointerdown", (event) => {
    startX = accepts(event.target) ? event.clientX : null;
  });
  target.addEventListener("pointermove", (event) => {
    if (startX === null || Math.abs(event.clientX - startX) < distance) return;
    const dx = event.clientX - startX;
    startX = null;
    onSwipe(dx);
  });
  for (const type of ["pointerup", "pointercancel"]) {
    target.addEventListener(type, () => {
      startX = null;
    });
  }
}

interface Gestures {
  readonly root: HTMLElement;
  readonly panel: HTMLElement;
  readonly pull: HTMLElement;
  /** Which way is "into the screen" for the side the drawer is on: -1 left, 1 right. */
  readonly inward: () => number;
  readonly isOpen: () => boolean;
  readonly setOpen: (open: boolean) => void;
  readonly wake: () => void;
  readonly onPulledOpen: () => void;
}

/** Taps outside, Escape and swipes: every way to open or close without the tab. */
function watchGestures(g: Gestures): void {
  g.root.addEventListener("pointerdown", (event) => {
    g.wake();
    const target = event.target instanceof Node ? event.target : null;
    if (g.isOpen() && !g.panel.contains(target) && !g.pull.contains(target)) g.setOpen(false);
  });
  g.root.ownerDocument.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && g.isOpen()) g.setOpen(false);
  });
  // Swipe the drawer back towards its edge to close it. A swipe that starts on a
  // control is that control's business (a slider is dragged sideways too).
  watchSwipe(
    g.panel,
    SWIPE_PX,
    (start) => !(start instanceof Element && start.closest("button, input")),
    (dx) => {
      if (Math.sign(dx) === -g.inward()) g.setOpen(false);
    },
  );
  // Pull the tab into the screen to open it.
  watchSwipe(
    g.pull,
    PULL_PX,
    () => !g.isOpen(),
    (dx) => {
      if (Math.sign(dx) !== g.inward()) return;
      g.onPulledOpen();
      g.setOpen(true);
    },
  );
}

export function createDrawer(deps: DrawerDeps): Drawer {
  const { win, root, store } = deps;
  const doc = win.document;
  const tabs = buildTabs(doc, deps.panels);
  let open = false;
  let closeTimer: number | undefined;
  let idleTimer: number | undefined;
  /** A pull that opened the drawer is followed by a click, which must not close it again. */
  let pulledOpen = false;

  const panel = el(doc, "aside", "drawer");
  panel.id = "drawer";
  panel.setAttribute("aria-label", "Remote and settings");
  panel.append(tabs.list, ...tabs.bodies);

  const pull = button(doc, {
    label: "Remote drawer",
    className: "drawer-tab",
    icon: "grip",
    onPress: () => {
      if (pulledOpen) pulledOpen = false;
      else setOpen(!open);
    },
  });
  pull.setAttribute("aria-controls", panel.id);
  const inward = (): number => (store.get().drawerSide === "right" ? -1 : 1);

  const restartAutoClose = (): void => {
    win.clearTimeout(closeTimer);
    if (open) closeTimer = win.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
  };
  const setOpen = (next: boolean): void => {
    const wasInside = panel.contains(doc.activeElement);
    open = next && !store.get().remoteLocked;
    panel.classList.toggle("is-open", open);
    root.classList.toggle("drawer-open", open);
    pull.setAttribute("aria-expanded", String(open));
    restartAutoClose();
    if (open) tabs.focusSelected();
    else if (wasInside) pull.focus({ preventScroll: true });
  };
  const wake = (): void => {
    pull.classList.remove("is-idle");
    win.clearTimeout(idleTimer);
    idleTimer = win.setTimeout(() => pull.classList.add("is-idle"), IDLE_MS);
  };
  const applySettings = (): void => {
    const settings = store.get();
    root.dataset.side = settings.drawerSide;
    pull.hidden = settings.remoteLocked;
    if (settings.remoteLocked) setOpen(false);
  };

  for (const type of ["pointerdown", "keydown", "input"]) {
    panel.addEventListener(type, restartAutoClose);
  }
  watchGestures({
    root,
    panel,
    pull,
    inward,
    isOpen: () => open,
    setOpen,
    wake,
    onPulledOpen: () => {
      pulledOpen = true;
    },
  });

  store.subscribe(applySettings);
  deps.power.subscribe(() => {
    // While the wall is off the tab stays easy to find: it is the way back on.
    pull.classList.toggle("is-needed", !deps.power.isOn());
  });
  root.append(pull, panel);
  applySettings();
  setOpen(false);
  wake();
  return { open: () => setOpen(true), close: () => setOpen(false), isOpen: () => open };
}
