# Bubble Wall

A full-screen bubble wall for the iPad: rising bubbles lit by colour-changing lights, the remote that comes with the real wall, sounds you can mix, and a wall that reacts to touch. Built for a child with sensory needs.

It is a plain web app. Nothing is sent anywhere: no accounts, no analytics, no network calls. Settings stay on the iPad.

All commands below are for PowerShell, run from the repo folder.

## Put it on the iPad

1. On the iPad, open https://landonarcher.com/bubble-wall/ in Safari.
2. Tap Share, then **Add to Home Screen**. It appears as "Bubbles".
3. Open it from the Home Screen once while online. After that it works with no internet.

To keep the iPad on the app, use Guided Access: Settings > Accessibility > Guided Access, switch it on, then open the app and triple-click the top button.

### What is where

- **The pull tab** on the edge of the screen opens the drawer. It closes by itself after ten seconds.
- **Remote** is the real remote, key for key. **Sounds** mixes the eight sounds. **Wall** has Calm and Play, bubbles, light speed, extra light shows, the tube layout and floaters. **More** has favourites (hold a circle to save), scenes and the wind-down timer.
- **The faint lock** in the bottom corner opens the grown-up settings when held for three seconds: the loudest volume, whether Flash and Strobe are allowed, a lock for the remote, which side the drawer is on, a reset, and a log of any problems.
- **"Tap for sound"** shows in the top corner whenever sound is not playing. One tap brings it back.

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
- `build` holds the build steps that add the service worker and the Content-Security-Policy.

## Icons

The icons are drawn from `assets-src/icon.svg`. After changing it, run `npm run icons` and commit the PNGs.

## Where it is published

https://landonarcher.com/bubble-wall/ . See [docs/runbook.md](docs/runbook.md).
