/**
 * Build steps that make the app installable and keep it to itself:
 * a service worker that saves every built file for offline use, and a
 * Content-Security-Policy that stops the page talking to anything but its own files.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";

/**
 * The page may load its own scripts, styles, images and manifest, and nothing else.
 * No inline script, no other origin, no plugins, no forms, no <base> tricks.
 */
const POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export function contentSecurityPolicy(): Plugin {
  return {
    name: "bubble-wall:csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: POLICY },
        injectTo: "head-prepend",
      },
    ],
  };
}

/** Every file in public/, as a path relative to the app (icons/icon-192.png, ...). */
function publicFiles(): string[] {
  return readdirSync("public", { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll("\\", "/"))
    .map((path) => path.replace(/^public\//, ""))
    .filter((path) => path !== "icons/version.txt");
}

export function serviceWorker(): Plugin {
  return {
    name: "bubble-wall:service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      // The cache name changes whenever any file does: built files carry their own
      // fingerprints, and the icons and manifest are fingerprinted here.
      const version = createHash("sha256");
      const built: string[] = [];
      for (const [name, file] of Object.entries(bundle)) {
        version.update(name).update(file.type === "chunk" ? file.code : file.source);
        if (name !== "index.html") built.push(name);
      }
      version
        .update(readFileSync("public/icons/version.txt"))
        .update(readFileSync("public/manifest.webmanifest"));

      // "./" is the page itself. index.html is left out: a host that redirects it
      // to "./" would hand the worker a redirected response it cannot serve.
      const inOrder = (names: readonly string[]): string[] =>
        names.toSorted((a, b) => a.localeCompare(b));
      const files = ["./", ...inOrder(built), ...inOrder(publicFiles())];
      const source = readFileSync("build/sw.template.js", "utf8")
        .replace("__VERSION__", version.digest("hex").slice(0, 16))
        .replace("__FILES__", JSON.stringify(files, null, 2));
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
