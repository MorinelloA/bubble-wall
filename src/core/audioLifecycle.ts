/**
 * The life of the audio context, as a table. iPads suspend and interrupt web audio
 * freely, and a Home Screen web app can come back with a context that will not
 * resume (WebKit bug 291892). So a resume that has not worked within a second is
 * abandoned: the context is thrown away and a new one is built on the next touch.
 * The wall never waits for any of this; it simply runs silently meanwhile.
 */

export type AudioPhase =
  "none" | "starting" | "running" | "suspended" | "resuming" | "rebuilding" | "silent";

export type AudioEvent =
  /** Any touch on the screen. */
  | "touch"
  /** The context reports that it is running. */
  | "running"
  /** The context reports that it was suspended or interrupted. */
  | "interrupted"
  | "hidden"
  | "visible"
  /** A second has passed since a resume was asked for. */
  | "timeout"
  /** The context could not be created, or threw. */
  | "failed";

/** What the engine must do as it enters the new phase. */
export type AudioCommand = "none" | "create" | "resume" | "discard";

export interface AudioStep {
  readonly phase: AudioPhase;
  readonly command: AudioCommand;
}

/** How long a resume is given before the context is abandoned, in milliseconds. */
export const RESUME_TIMEOUT_MS = 1000;

const stay = (phase: AudioPhase): AudioStep => ({ phase, command: "none" });

function whileWaitingToRun(phase: "starting" | "resuming", event: AudioEvent): AudioStep {
  switch (event) {
    case "running":
      return stay("running");
    case "hidden":
      return stay("suspended");
    case "timeout":
      // A first start that is slow is left alone; a resume that is slow is abandoned.
      return phase === "resuming" ? { phase: "rebuilding", command: "discard" } : stay(phase);
    case "touch":
      return { phase, command: "resume" };
    default:
      return stay(phase);
  }
}

export function audioStep(phase: AudioPhase, event: AudioEvent): AudioStep {
  if (event === "failed") return { phase: "silent", command: "discard" };
  switch (phase) {
    case "none":
    case "rebuilding":
    case "silent":
      return event === "touch" ? { phase: "starting", command: "create" } : stay(phase);
    case "starting":
    case "resuming":
      return whileWaitingToRun(phase, event);
    case "running":
      return event === "interrupted" || event === "hidden" ? stay("suspended") : stay(phase);
    case "suspended":
      if (event === "running") return stay("running");
      return event === "touch" || event === "visible"
        ? { phase: "resuming", command: "resume" }
        : stay(phase);
  }
}

/** The "tap for sound" hint shows whenever sound is not actually playing. */
export function needsSoundHint(phase: AudioPhase): boolean {
  return phase !== "running";
}
