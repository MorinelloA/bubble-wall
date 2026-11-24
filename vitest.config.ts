import { defineConfig } from "vitest/config";

// Coverage is enforced per layer, so well-tested browser code cannot hide untested rules.
export default defineConfig({
  test: {
    projects: [
      {
        test: { name: "core", include: ["tests/core/**/*.test.ts"], environment: "node" },
      },
      {
        test: { name: "app", include: ["tests/app/**/*.test.ts"], environment: "happy-dom" },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "lcov"],
      thresholds: {
        "src/core/**": { lines: 85, branches: 70 },
        "src/app/**": { lines: 75, branches: 68 },
      },
    },
  },
});
