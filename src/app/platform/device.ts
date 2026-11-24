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
