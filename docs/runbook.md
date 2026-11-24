# Runbook

## Publish

The site is published from the LandonArcher repo, which copies this project's build into `/bubble-wall/`.

1. In this folder: `npm run check:full`.
2. In `C:\Repos\LandonArcher\cloudflare`: `npm run deploy`. It builds this project, copies `dist` and publishes all of landonarcher.com.
3. In the same folder: `.\check-site.ps1`. Zero failures means it is live.

A deploy also republishes the Game Room, Marble Run and Pictures from their folders as they stand. Check they have no half-finished changes first.

## Roll back

In `C:\Repos\LandonArcher\cloudflare`: `npx wrangler rollback`. That returns the whole site to the previous deploy.

## Updates on the iPad

A new version is fetched in the background and used the next time the app is opened. It never reloads in the middle of a session.

## Backups

There is nothing to back up. The app has no server and no database. Favourites and settings live only on the iPad and are lost if the Home Screen app is deleted.

## Problems log

Hold the lock icon for three seconds to open the grown-up area. It lists the last 20 errors the app caught. Nothing is sent anywhere.
