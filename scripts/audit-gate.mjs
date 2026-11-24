// Vulnerability gate: reads `npm audit --json` on stdin and fails when any advisory
// is at or above the level given (default: high). The exit code of `npm audit`
// itself is not trusted: npm 8 on this machine exits 0 whatever it finds.
import { readFileSync } from "node:fs";

const levels = ["info", "low", "moderate", "high", "critical"];
const threshold = process.argv[2] ?? "high";
if (!levels.includes(threshold)) {
  console.error(`Unknown level "${threshold}". Use one of: ${levels.join(", ")}.`);
  process.exit(2);
}

const report = JSON.parse(readFileSync(0, "utf8"));
const found = report?.metadata?.vulnerabilities;
if (!found || report.error) {
  console.error("npm audit did not return a report, so nothing was checked.");
  process.exit(2);
}

const counts = new Map(Object.entries(found));
const summary = levels.map((level) => `${level} ${counts.get(level) ?? 0}`).join(", ");
const blocking = levels
  .slice(levels.indexOf(threshold))
  .reduce((sum, level) => sum + (counts.get(level) ?? 0), 0);

console.log(`Advisories: ${summary}.`);
if (blocking > 0) {
  console.error(`${blocking} at ${threshold} or above. Run \`npm audit\` for details.`);
  process.exit(1);
}
console.log(`None at ${threshold} or above.`);
