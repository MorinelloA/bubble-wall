// Bubble Wall's service worker: keeps a copy of the app so it opens with no network.
// Built by build/pwa.ts, which fills in the cache name and the list of files.
//
// landonarcher.com serves other apps from the same origin, and they all share one
// list of caches. This worker only ever opens and deletes caches whose names start
// with "bubble-wall-". It never touches anyone else's.
//
// A new version installs in the background and takes over the next time the app is
// opened. It never claims or reloads a page that is in use.

const PREFIX = "bubble-wall-";
const CACHE = PREFIX + "__VERSION__";
const FILES = __FILES__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(PREFIX) && name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(event.request, { ignoreSearch: true, ignoreVary: true }))
      .then((saved) => saved ?? fetch(event.request)),
  );
});
