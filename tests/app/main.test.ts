import { beforeEach, describe, expect, it } from "vitest";
import { boot } from "../../src/app/boot";

describe("boot", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("marks the root as ready", () => {
    const root = document.createElement("main");
    root.id = "app";
    document.body.append(root);
    expect(boot(document, 3).dataset.ready).toBe("true");
  });

  it("says what is missing when there is no root", () => {
    expect(() => boot(document, 3)).toThrow(/id 'app'/);
  });

  it("starts from main.ts", async () => {
    const root = document.createElement("main");
    root.id = "app";
    document.body.append(root);
    await import("../../src/app/main");
    expect(root.dataset.ready).toBe("true");
  });
});
