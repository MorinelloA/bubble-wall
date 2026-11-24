// Renders assets-src/icon.svg into every PNG size the app needs, under public/icons.
// Run from the repo root with `npm run icons`. The PNGs are committed, so this only
// needs running again when the SVG changes.
//
// It also writes public/icons/version.txt: a fingerprint of the icons. The service
// worker's cache name is built from it, so new icons reach the iPad.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const sizes = [
  ["apple-touch-icon-180.png", 180], // iPhone, and the default apple-touch-icon
  ["apple-touch-icon-167.png", 167], // iPad Pro
  ["apple-touch-icon-152.png", 152], // iPad
  ["icon-192.png", 192], // web app manifest
  ["icon-512.png", 512], // web app manifest
  ["icon-maskable-512.png", 512], // manifest, purpose "maskable"
  ["favicon-32.png", 32],
];

await mkdir("public/icons", { recursive: true });
const svg = await readFile("assets-src/icon.svg");
const fingerprint = createHash("sha256").update(svg);

for (const [name, size] of sizes) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size)
    .flatten({ background: "#0b2f57" }) // no transparency: iOS would paint it black
    .png({ compressionLevel: 9 })
    .toBuffer();
  fingerprint.update(png);
  await sharp(png).toFile(`public/icons/${name}`);
  console.log(`wrote public/icons/${name} (${String(size)}x${String(size)})`);
}

await copyFile("assets-src/icon.svg", "public/icons/favicon.svg");
await writeFile("public/icons/version.txt", `${fingerprint.digest("hex").slice(0, 16)}\n`);
console.log("wrote public/icons/favicon.svg and public/icons/version.txt");
