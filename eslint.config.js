import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

// What src/core may not reach for: it is pure, so time, randomness, storage and
// the page are handed to it. Tests then control all four.
const impureGlobals = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "sessionStorage",
  "performance",
  "requestAnimationFrame",
  "setTimeout",
  "setInterval",
  "AudioContext",
].map((name) => ({ name, message: "src/core is pure: pass this in from src/app." }));

const noRawHtml = [
  {
    selector: "AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]",
    message: "Build elements with src/app/ui/dom.ts; never assign HTML strings.",
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "Build elements with src/app/ui/dom.ts; never insert HTML strings.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "reports",
      "node_modules",
      "playwright-report",
      "test-results",
      ".stryker-tmp",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  sonarjs.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Size budgets.
      "sonarjs/cognitive-complexity": ["error", 15],
      complexity: ["error", 15],
      "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "no-restricted-syntax": ["error", ...noRawHtml],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // The security plugin ships its rules as warnings; make each one fail the run.
      ...Object.fromEntries(
        Object.keys(security.configs.recommended.rules ?? {}).map((rule) => [rule, "error"]),
      ),
    },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...impureGlobals],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "src/core is pure: take the time as input." },
        { object: "Math", property: "random", message: "src/core is pure: use the injected Rng." },
      ],
    },
  },
  {
    files: ["tests/**/*.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/expect-expect": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/no-focused-tests": "error",
      // A describe block is a container of tests, not a method, so the method-length
      // budget does not apply to it. Each test inside is still short.
      "max-lines-per-function": "off",
    },
  },
  {
    // Config and scripts run in Node and are not part of the TypeScript project.
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", module: "writable", URL: "readonly" },
    },
  },
  {
    // The service worker template: it runs in a worker, and its two placeholders
    // are filled in by build/pwa.ts.
    files: ["build/sw.template.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        fetch: "readonly",
        __FILES__: "readonly",
      },
    },
  },
);
