import { createRng } from "../core/rng";
import { createStore, type Store } from "../core/store";
import { createProblemLog, watchForProblems, type ProblemLog } from "./platform/errors";
import { createSafeStorage, loadSettings, persistSettings } from "./platform/storage";
import { createPowerControl, type PowerControl } from "./power";
import { createDrawer, type Drawer } from "./ui/drawer";
import { createRemote } from "./ui/remote";
import { showStart } from "./ui/start";
import { createWallPanel } from "./ui/wallpanel";
import { mountWall } from "./wall/mount";

export interface App {
  readonly root: HTMLElement;
  readonly store: Store;
  readonly problems: ProblemLog;
  readonly power: PowerControl;
  readonly drawer: Drawer;
}

/** Finds the app's root element and starts everything inside it. */
export function boot(win: Window, seed: number): App {
  const doc = win.document;
  const root = doc.getElementById("app");
  if (!root) throw new Error("Bubble Wall needs an element with id 'app'.");

  // The storage and the log need each other: a storage failure is logged, and the
  // log is kept in storage. The log is created second and reached through this box.
  const late: { log?: ProblemLog } = {};
  const storage = createSafeStorage(
    () => win.localStorage,
    (message) => late.log?.record(message),
  );
  const problems = createProblemLog(storage, () => Date.now());
  late.log = problems;
  watchForProblems(win, problems);

  const store = createStore(loadSettings(storage));
  const persistence = persistSettings(store, storage);
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") persistence.flush();
  });
  win.addEventListener("pagehide", () => {
    persistence.flush();
  });

  const power = createPowerControl(() => win.performance.now());
  mountWall({
    win,
    root,
    store,
    power,
    rng: createRng(seed),
    onProblem: (message) => {
      problems.record(message);
    },
  });
  const drawer = createDrawer({
    win,
    root,
    store,
    power,
    panels: [
      { id: "remote", label: "Remote", icon: "remote", content: createRemote(doc, store, power) },
      { id: "wall", label: "Wall", icon: "wall", content: createWallPanel(doc, store) },
    ],
  });
  showStart(win, root, () => {
    power.on();
  });

  root.dataset.ready = "true";
  return { root, store, problems, power, drawer };
}
