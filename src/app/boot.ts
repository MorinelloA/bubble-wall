import { createRng } from "../core/rng";
import { createStore, type Store } from "../core/store";
import { createAudioContext } from "./audio/context";
import { createAudioEngine, type AudioEngine } from "./audio/engine";
import { blockGestures } from "./platform/device";
import { createProblemLog, watchForProblems, type ProblemLog } from "./platform/errors";
import { createSafeStorage, loadSettings, persistSettings } from "./platform/storage";
import { createPowerControl, type PowerControl } from "./power";
import { createDrawer, type Drawer } from "./ui/drawer";
import { createRemote } from "./ui/remote";
import { createSoundHint, createSoundsPanel } from "./ui/sounds";
import { showStart } from "./ui/start";
import { createWallPanel } from "./ui/wallpanel";
import { mountWall } from "./wall/mount";

export interface App {
  readonly root: HTMLElement;
  readonly store: Store;
  readonly problems: ProblemLog;
  readonly power: PowerControl;
  readonly drawer: Drawer;
  readonly audio: AudioEngine;
}

interface AudioNeeds {
  readonly store: Store;
  readonly power: PowerControl;
  readonly seed: number;
  readonly onProblem: (message: string) => void;
}

/** Builds the sound engine and tells it about touches and about the app coming and going. */
function startAudio(win: Window, root: HTMLElement, needs: AudioNeeds): AudioEngine {
  const audio = createAudioEngine({
    createContext: () => createAudioContext(win),
    store: needs.store,
    power: needs.power,
    rng: createRng(needs.seed + 1),
    timers: win,
    onProblem: needs.onProblem,
  });
  // Safari only lets sound start from the end of a touch, a click or a key press.
  for (const type of ["pointerup", "click", "keydown"]) {
    root.addEventListener(type, audio.touch, { capture: true });
  }
  win.document.addEventListener("visibilitychange", () => {
    if (win.document.visibilityState === "hidden") audio.hidden();
    else audio.visible();
  });
  return audio;
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

  const onProblem = (message: string): void => {
    problems.record(message);
  };
  const power = createPowerControl(() => win.performance.now());
  const audio = startAudio(win, root, { store, power, seed, onProblem });
  blockGestures(doc);
  mountWall({
    win,
    root,
    store,
    power,
    rng: createRng(seed),
    onTouchSound: audio.play,
    onProblem,
  });
  const drawer = createDrawer({
    win,
    root,
    store,
    power,
    panels: [
      { id: "remote", label: "Remote", icon: "remote", content: createRemote(doc, store, power) },
      { id: "sounds", label: "Sounds", icon: "sound", content: createSoundsPanel(doc, store) },
      { id: "wall", label: "Wall", icon: "wall", content: createWallPanel(doc, store) },
    ],
  });
  root.append(createSoundHint(doc, audio));
  showStart(win, root, () => {
    power.on();
    audio.touch();
  });

  root.dataset.ready = "true";
  return { root, store, problems, power, drawer, audio };
}
