/** Keeping the iPad from doing things to the page that a bubble wall should not do. */

/**
 * Stops pinch-zoom and the long-press menu. (Scrolling, double-tap zoom and text
 * selection are switched off in the stylesheet.) Safari sends its own gesture
 * events for a pinch; cancelling them is the only thing that stops the zoom.
 */
export function blockGestures(doc: Document): void {
  for (const type of ["gesturestart", "gesturechange", "gestureend", "contextmenu"]) {
    doc.addEventListener(
      type,
      (event) => {
        event.preventDefault();
      },
      { passive: false },
    );
  }
}

/**
 * Saves the app for offline use. Only over http or https: inside a native wrapper
 * the files are already on the device and there is no service worker to register.
 */
export function registerServiceWorker(win: Window, onProblem: (message: string) => void): void {
  const { protocol } = win.location;
  const container = (win.navigator as Partial<Navigator>).serviceWorker;
  if (!container || (protocol !== "https:" && protocol !== "http:")) return;
  container.register("./sw.js", { scope: "./" }).catch((error: unknown) => {
    onProblem(`Offline copy could not be saved: ${String(error)}`);
  });
}

interface WakeLockLike {
  request(type: "screen"): Promise<unknown>;
}

/**
 * Keeps the screen from dimming and sleeping while the wall is showing. The iPad
 * drops the lock whenever the app is hidden, so it is asked for again on return.
 * Where it is unavailable or refused, the app simply runs without it.
 * Returns a function that asks again; call it from a touch.
 */
export function keepAwake(win: Window): () => void {
  const doc = win.document;
  const wakeLock = (win.navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  const ask = (): void => {
    if (!wakeLock || doc.visibilityState !== "visible") return;
    wakeLock.request("screen").catch(() => undefined);
  };
  doc.addEventListener("visibilitychange", ask);
  ask();
  return ask;
}
