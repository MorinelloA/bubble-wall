# Runbook

## Publish

The site is published from the LandonArcher repo, which copies this project's build into `/bubble-wall/`.

1. In this folder: `npm run check:full`.
2. In `C:\Repos\LandonArcher\cloudflare`: `npm run deploy`. It builds this project, copies `dist` and publishes all of landonarcher.com.
3. In the same folder: `.\check-site.ps1`. Zero failures means it is live.

A deploy also republishes the Game Room, Marble Run and Pictures from their folders as they stand. Check they have no half-finished changes first.

## Nothing is added to the page

Cloudflare Web Analytics is switched on for landonarcher.com, and Cloudflare adds its beacon script to every page it serves. This app promises to send nothing anywhere, so the site sends `Cache-Control: no-transform` for `/bubble-wall/*`, which tells Cloudflare to leave the page alone. `check-site.ps1` checks the header is there. If it ever goes missing, the app's Content-Security-Policy still blocks the script, and the end-to-end test "talks to no other site" fails against the live address.

## Roll back

In `C:\Repos\LandonArcher\cloudflare`: `npx wrangler rollback`. That returns the whole site to the previous deploy.

## Updates on the iPad

A new version is fetched in the background and used the next time the app is opened. It never reloads in the middle of a session. If the iPad keeps showing the old version, close the app fully (swipe it away in the app switcher) and open it again.

## First install

On the iPad, open https://landonarcher.com/bubble-wall/ in Safari, tap Share, then Add to Home Screen. Open it once while online so it can save itself for offline use.

## Sound stops after reopening

iPadOS has a bug where a Home Screen web app can lose sound after it is reopened. The app notices within a second and shows "Tap for sound"; one tap rebuilds the audio. If that tap does not bring sound back, close the app fully and open it again. If it keeps happening, the fix is to wrap the app natively (see docs/adr/0001).

## Backups

There is nothing to back up. The app has no server and no database. Favourites and settings live only on the iPad and are lost if the Home Screen app is deleted.

## Problems log

Hold the lock icon for three seconds to open the grown-up area. It lists the last 20 errors the app caught. Nothing is sent anywhere.
