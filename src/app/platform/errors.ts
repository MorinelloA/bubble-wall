/**
 * The problems log. Errors are never shown to the child and never sent anywhere:
 * the last few are kept on the iPad for the grown-up area.
 */
import { fieldsOf } from "../../core/util";
import type { SafeStorage } from "./storage";

const MAX_PROBLEMS = 20;
const MAX_MESSAGE_LENGTH = 300;

export interface Problem {
  readonly at: number;
  readonly message: string;
}

export interface ProblemLog {
  record(message: string): void;
  list(): readonly Problem[];
  clear(): void;
}

function readSaved(text: string | null): Problem[] {
  if (text === null) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item: unknown) => {
      const raw = fieldsOf(item);
      const at = raw.get("at");
      const message = raw.get("message");
      return typeof at === "number" && typeof message === "string" ? [{ at, message }] : [];
    });
  } catch {
    return [];
  }
}

export function createProblemLog(storage: SafeStorage, now: () => number): ProblemLog {
  let problems = readSaved(storage.read("problems")).slice(-MAX_PROBLEMS);
  const save = (): void => {
    storage.write("problems", JSON.stringify(problems));
  };
  return {
    record(message) {
      const entry = { at: now(), message: message.slice(0, MAX_MESSAGE_LENGTH) };
      problems = [...problems, entry].slice(-MAX_PROBLEMS);
      save();
    },
    list: () => problems,
    clear() {
      problems = [];
      save();
    },
  };
}

/** Sends every uncaught error and unhandled rejection to the log. */
export function watchForProblems(target: Window, log: ProblemLog): void {
  target.addEventListener("error", (event) => {
    log.record(event.message || "Unknown error");
  });
  target.addEventListener("unhandledrejection", (event) => {
    log.record(`Unhandled: ${String(event.reason)}`);
  });
}
