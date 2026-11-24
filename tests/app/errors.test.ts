import { describe, expect, it, vi } from "vitest";
import { createProblemLog, watchForProblems } from "../../src/app/platform/errors";
import { createSafeStorage } from "../../src/app/platform/storage";
import { memoryStorage } from "./fakes/storage";

const STORAGE_PREFIX = "bubble-wall:";

const storageWith = (raw: Storage) => createSafeStorage(() => raw, vi.fn());

describe("createProblemLog", () => {
  it("records a problem with the time it happened", () => {
    const log = createProblemLog(storageWith(memoryStorage()), () => 1234);
    log.record("the pump stopped");
    expect(log.list()).toEqual([{ at: 1234, message: "the pump stopped" }]);
  });

  it("keeps only the last 20", () => {
    const log = createProblemLog(storageWith(memoryStorage()), () => 0);
    for (let n = 1; n <= 25; n += 1) log.record(`problem ${String(n)}`);
    expect(log.list()).toHaveLength(20);
    expect(log.list().at(0)?.message).toBe("problem 6");
    expect(log.list().at(-1)?.message).toBe("problem 25");
  });

  it("shortens a very long message", () => {
    const log = createProblemLog(storageWith(memoryStorage()), () => 0);
    log.record("x".repeat(1000));
    expect(log.list().at(0)?.message).toHaveLength(300);
  });

  it("remembers problems between launches", () => {
    const raw = memoryStorage();
    createProblemLog(storageWith(raw), () => 5).record("first");
    expect(createProblemLog(storageWith(raw), () => 6).list()).toEqual([
      { at: 5, message: "first" },
    ]);
  });

  it("forgets everything when cleared", () => {
    const raw = memoryStorage();
    const log = createProblemLog(storageWith(raw), () => 5);
    log.record("first");
    log.clear();
    expect(log.list()).toEqual([]);
    expect(createProblemLog(storageWith(raw), () => 6).list()).toEqual([]);
  });

  it.each(["{oops", '"text"', '[{"at":"soon","message":1}, 7]'])(
    "starts empty when the saved log is %s",
    (saved) => {
      const raw = memoryStorage({ [`${STORAGE_PREFIX}problems`]: saved });
      expect(createProblemLog(storageWith(raw), () => 0).list()).toEqual([]);
    },
  );
});

describe("watchForProblems", () => {
  it("logs uncaught errors and unhandled rejections", () => {
    const log = createProblemLog(storageWith(memoryStorage()), () => 0);
    watchForProblems(window, log);
    window.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
    window.dispatchEvent(new ErrorEvent("error", {}));
    const rejection = new Event("unhandledrejection");
    Object.defineProperty(rejection, "reason", { value: "nope" });
    window.dispatchEvent(rejection);
    expect(log.list().map((problem) => problem.message)).toEqual([
      "boom",
      "Unknown error",
      "Unhandled: nope",
    ]);
  });
});
