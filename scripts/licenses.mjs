// Licence inventory: reads `npm query "*"` on stdin (every installed package with
// its manifest), lists the licences and fails on any that is missing or not on the
// allow list. Run with `npm run licenses`.
import { readFileSync } from "node:fs";

const allowed = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "MPL-2.0",
  "Python-2.0",
  "Unlicense",
]);

// Tools that only run on the developer's machine and in CI, and are never part of
// what is published, may also carry these. The app itself ships no dependencies.
const allowedForTooling = new Set(["LGPL-3.0-only"]);

const packages = JSON.parse(readFileSync(0, "utf8"));
if (!Array.isArray(packages) || packages.length < 2) {
  console.error("No package list on stdin. Run this through `npm run licenses`.");
  process.exit(1);
}

const counts = new Map();
const problems = [];

for (const pkg of packages) {
  // The first entry is this project itself, which is private and unlicensed.
  if (pkg.location === "") continue;
  const licence = typeof pkg.license === "string" ? pkg.license : "";
  const label = licence || "(none)";
  counts.set(label, (counts.get(label) ?? 0) + 1);
  const parts = licence
    .replaceAll("(", "")
    .replaceAll(")", "")
    .split(" OR ")
    .flatMap((part) => part.split(" AND "));
  const ok = parts.some(
    (part) => allowed.has(part.trim()) || (pkg.dev === true && allowedForTooling.has(part.trim())),
  );
  if (!ok) {
    problems.push(`${pkg.name}@${pkg.version}: ${label}`);
  }
}

for (const [licence, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(4)}  ${licence}`);
}
if (problems.length > 0) {
  console.error(`\nLicences not on the allow list:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log(`\n${packages.length - 1} packages, all on the allow list.`);
