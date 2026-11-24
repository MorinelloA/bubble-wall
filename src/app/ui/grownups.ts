/**
 * The grown-up area: limits and housekeeping, kept out of casual reach behind a
 * three-second hold on a faint lock. It is not a real lock; Guided Access is.
 */
import {
  setDrawerSide,
  setVolumeCap,
  toggleFlashStrobe,
  toggleRemoteLock,
} from "../../core/actions";
import { DRAWER_SIDES, type DrawerSide, type Settings } from "../../core/settings";
import type { Change, Store } from "../../core/store";
import type { ProblemLog } from "../platform/errors";
import { button, el, onHold, section, setPressed, slider } from "./dom";

const HOLD_TO_OPEN_MS = 3000;

export interface GrownupDeps {
  readonly win: Window;
  readonly root: HTMLElement;
  readonly store: Store;
  readonly problems: ProblemLog;
  /** Puts every setting back and forgets everything this app has saved. */
  readonly onReset: () => void;
}

const SIDE_NAMES: ReadonlyMap<DrawerSide, string> = new Map([
  ["right", "Right"],
  ["left", "Left"],
]);

/** A switch that applies one change and shows whether it is on. */
function toggle(
  doc: Document,
  store: Store,
  label: string,
  change: Change,
  isOn: (settings: Settings) => boolean,
): HTMLElement {
  const element = button(doc, {
    label,
    className: "switch",
    onPress: () => {
      store.update(change);
    },
  });
  element.append(el(doc, "span", "switch-name", label), el(doc, "span", "switch-knob"));
  const refresh = (): void => {
    setPressed(element, isOn(store.get()));
  };
  store.subscribe(refresh);
  refresh();
  return element;
}

function limits(doc: Document, store: Store): HTMLElement {
  const cap = slider(doc, {
    label: "Loudest volume",
    onInput: (value) => {
      store.update(setVolumeCap(value));
    },
  });
  const sides = el(doc, "div", "choices");
  sides.setAttribute("role", "group");
  sides.setAttribute("aria-label", "Side of the screen the drawer is on");
  const sideButtons = DRAWER_SIDES.map((side) => {
    const name = SIDE_NAMES.get(side) ?? side;
    const choice = button(doc, {
      label: `Drawer on the ${name.toLowerCase()}`,
      className: "chip",
      onPress: () => {
        store.update(setDrawerSide(side));
      },
    });
    choice.append(name);
    sides.append(choice);
    return { side, choice };
  });
  const refresh = (): void => {
    const settings = store.get();
    cap.show(settings.volumeCap);
    for (const { side, choice } of sideButtons) setPressed(choice, settings.drawerSide === side);
  };
  store.subscribe(refresh);
  refresh();

  const element = el(doc, "div");
  element.append(
    cap.element,
    toggle(doc, store, "Allow Flash and Strobe", toggleFlashStrobe, (s) => s.allowFlashStrobe),
    toggle(doc, store, "Lock the remote", toggleRemoteLock, (s) => s.remoteLocked),
    section(doc, "Drawer side", sides),
  );
  return element;
}

/** The problems log, and a button to clear it. `refresh` re-reads the log. */
function problemList(
  doc: Document,
  problems: ProblemLog,
): { element: HTMLElement; refresh: () => void } {
  const list = el(doc, "ul", "problems");
  // It scrolls when the log is long, so the keyboard must be able to reach it.
  list.tabIndex = 0;
  list.setAttribute("aria-label", "Problems");
  const refresh = (): void => {
    const entries = problems.list();
    list.replaceChildren(
      ...(entries.length === 0
        ? [el(doc, "li", "", "None so far.")]
        : entries.map((problem) =>
            el(doc, "li", "", `${new Date(problem.at).toLocaleString()}: ${problem.message}`),
          )),
    );
  };
  const clear = button(doc, {
    label: "Clear the problems log",
    className: "chip",
    onPress: () => {
      problems.clear();
      refresh();
    },
  });
  clear.append("Clear");
  const element = section(doc, "Problems log", list, clear);
  return { element, refresh };
}

/** Asks twice: the first press arms it, the second resets. */
function resetButton(
  doc: Document,
  onReset: () => void,
): { element: HTMLElement; disarm: () => void } {
  let armed = false;
  const show = (): void => {
    element.textContent = armed ? "Tap again to reset everything" : "Reset everything";
    element.classList.toggle("is-armed", armed);
  };
  const element = button(doc, {
    label: "Reset everything",
    className: "chip danger",
    onPress: () => {
      if (armed) onReset();
      armed = !armed;
      show();
    },
  });
  show();
  return {
    element,
    disarm: () => {
      armed = false;
      show();
    },
  };
}

/** Adds the lock and its dialog to the page. */
export function createGrownups(deps: GrownupDeps): void {
  const { win, root, store } = deps;
  const doc = win.document;

  const dialog = el(doc, "dialog", "grownups");
  dialog.setAttribute("aria-labelledby", "grownups-title");
  const title = el(doc, "h2", "grownups-title", "Grown-up settings");
  title.id = "grownups-title";
  const log = problemList(doc, deps.problems);
  const reset = resetButton(doc, deps.onReset);
  const done = button(doc, {
    label: "Done",
    className: "chip primary",
    onPress: () => {
      dialog.close();
    },
  });
  done.append("Done");
  const note = el(
    doc,
    "p",
    "hint",
    "To keep the iPad on this app, switch on Guided Access in Settings, under Accessibility. Then, with the app open, triple-click the top button.",
  );
  dialog.append(
    title,
    limits(doc, store),
    section(doc, "Start again", reset.element),
    log.element,
    section(doc, "Keeping him in the app", note),
    done,
  );

  const lock = button(doc, {
    label: "Grown-ups: hold for three seconds",
    className: "grownup-lock",
    icon: "lock",
    onPress: () => undefined,
  });
  onHold(lock, {
    ms: HOLD_TO_OPEN_MS,
    win,
    onHeld: () => {
      reset.disarm();
      log.refresh();
      dialog.showModal();
    },
  });
  root.append(lock, dialog);
}
