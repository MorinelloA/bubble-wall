/** Making an audio context the way an iPad needs it made. */

interface AudioSessionLike {
  type: string;
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

/**
 * A new audio context. On Safari this also marks the page's audio as "playback",
 * which keeps the iPad's mute setting from silencing the wall. Throws when the
 * browser has no Web Audio.
 */
export function createAudioContext(win: Window): AudioContext {
  const audioWindow = win as AudioWindow;
  const session = (win.navigator as Navigator & { audioSession?: AudioSessionLike }).audioSession;
  if (session) session.type = "playback";
  const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
  if (!Context) throw new Error("This browser has no Web Audio.");
  return new Context({ latencyHint: "interactive" });
}
