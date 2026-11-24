import { createRng, type Rng } from "../core/rng";
import { createStore, type Store } from "../core/store";
import { createProblemLog, watchForProblems, type ProblemLog } from "./platform/errors";
import { createSafeStorage, loadSettings, persistSettings } from "./platform/storage";

export interface App {
  readonly root: HTMLElement;
  readonly store: Store;
  readonly problems: ProblemLog;
  readonly rng: Rng;
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

  root.dataset.ready = "true";
  return { root, store, problems, rng: createRng(seed) };
}
