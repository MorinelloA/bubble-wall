# Bubble Wall

A full-screen bubble wall for the iPad: rising bubbles lit by colour-changing lights, the remote that comes with the real wall, sounds you can mix, and a wall that reacts to touch. Built for a child with sensory needs.

It is a plain web app. Nothing is sent anywhere: no accounts, no analytics, no network calls. Settings stay on the iPad.

All commands below are for PowerShell, run from the repo folder.

## Run it

Needs Node.js 26 or newer.

```powershell
npm ci
```

```powershell
npm run dev
```

Then open http://localhost:5173.

## Check it

After any change:

```powershell
npm run check
```

That runs the linter, the formatter check, the type check, the unit tests with coverage, the layering rule, the dead-code check and the duplication check.

Before publishing:

```powershell
npm run check:full
```

That adds the production build, the end-to-end and accessibility tests (Chromium and WebKit), the vulnerability audit and the licence inventory. The first time, install the two test browsers with `npx playwright install chromium webkit`.

## How the code is laid out

- `src/core` is pure TypeScript: the settings, the light shows, the bubble simulation, the timers and the state machines. It never touches the page, the clock, storage or random numbers directly; those are passed in. A lint rule and a dependency rule enforce this.
- `src/app` is everything that touches the browser: canvas, Web Audio, the drawer, storage.
- `tests` holds the unit tests, `e2e` the Playwright tests.

## Where it is published

https://landonarcher.com/bubble-wall/ . See [docs/runbook.md](docs/runbook.md).
