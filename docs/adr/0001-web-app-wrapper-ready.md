# 1. A web app, ready for a native wrapper

Date: 2026-11-24

## Decision

Bubble Wall is a web app added to the iPad Home Screen from landonarcher.com/bubble-wall/. It uses Vite and TypeScript with no UI framework and no runtime dependencies. The wall is drawn on a 2D canvas. Every sound is synthesised with Web Audio; there are no audio files.

Every path in the build is relative (`base: "./"`), and nothing depends on the service worker being present, so the same build can be dropped into a Capacitor wrapper unchanged.

## Why

- It can be built, tested and published from Windows. A native iPad app needs a Mac and an Apple Developer account.
- Synthesised sound loops forever without a seam, needs no licences, and can follow the wall (more bubbles, more bubble sound).
- No network calls means nothing to secure, nothing to break offline and nothing leaving the iPad.

## What it costs

- iPadOS 26 has an open WebKit bug (291892): a Home Screen web app can lose Web Audio after it is reopened. The audio engine rebuilds its audio context when a resume does not take within a second. If that is not enough on the real iPad, the fallback is the wrapper.
- iPads have no haptic motor, so touch feedback is sight and sound only.
- Settings live in the browser's storage on the iPad. Deleting the Home Screen app deletes them.

## Shared origin

landonarcher.com also serves the Game Room, Marble Run and Pictures. They share one storage area and one cache list, so every key and cache this app owns starts with `bubble-wall`, and it never clears anything it did not create.
