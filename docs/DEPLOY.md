# Deploying

The app is a static website (no server, no database): `npm run build` makes the `dist` folder, and Netlify serves it.

- **Live site:** https://climbpasstracker.netlify.app (the free `.netlify.app` address, D21).
- **How a release happens:** merging a pull request into `main` is the release. Netlify builds `main` with `npm run build` and publishes it by itself (settings are in `netlify.toml`). Every pull request also gets its own preview address, `https://deploy-preview-<number>--climbpasstracker.netlify.app`, which is built from the branch and is not the live site.
- **What must pass first:** CI runs lint, format, types, the unit tests, the build and the browser tests on every pull request. Do not merge a red one.

## Releasing

1. Merge the pull request (CI green, preview looked at on a phone).
2. Wait for the Netlify deploy to finish (the Deploys page of the site, a minute or two).
3. Check the live site matches what was merged:
   ```
   npm run build                      # on the merged commit
   node scripts/check-production.mjs  # defaults to the live site; give another address as an argument
   ```
   It confirms the live site serves this build's files, every address answers, the files have the right type and caching, and the security headers are there. It exits with 1 if anything is wrong. (It needs Node 22 or newer.)
4. Open the live site on a phone, add a pass, and reload with the network off.
5. Bump `version` in `package.json` for a release people should be able to tell apart: Settings shows it ("version 1.0.0"), which helps when someone reports a problem.

## Rolling back

Netlify keeps every deploy. In the site's **Deploys** page, open the last good deploy and choose **Publish deploy**; the live site goes back at once. Then fix forward with a new pull request. A rollback does not touch anyone's passes: they are on their own phones.

## What an update does to people

- **Their passes stay.** They are in the phone's own storage and a new version never clears them. A change to how records are stored needs a Dexie version step with an upgrade (see `src/db/db.ts`); the gym ids in `src/data/gyms.ts` must never change.
- **The app updates itself.** When the app is opened the browser checks `sw.js`; a new one installs and takes over at once (`registerType: 'autoUpdate'`, skip waiting), and the new files are used from the next time the app is opened. A tab that was already open keeps running the old code, which keeps working. If that tab then opens Settings, the privacy policy or the terms, the old file it asks for is gone: `src/app/lazyRoute.ts` reloads the page once to pick up the new version.
- **The backup file** carries a format version (`src/domain/backup.ts`); an older app refuses a file from a newer format (and says to update), and a newer app must keep reading older ones.

## Security headers

`netlify.toml` sets a strict Content-Security-Policy (only the app's own files, no outside connections), no framing, no referrer, and a few more. They back up the privacy policy: nothing can leave the phone. `e2e/csp.spec.ts` runs the app under that exact policy. If a change needs more (an inline style, a font file, a web address), that test fails first; widen the policy deliberately, never to make a test pass.

## Where things can go wrong

| Sign | Likely cause |
| --- | --- |
| Live site shows an old version for a while | Normal: the app updates the next time it is opened. Check `/sw.js` has `Cache-Control: no-cache`. |
| `/robots.txt` or an icon returns the app's page | The file is missing from `public/` (the single-page fallback answers for anything it cannot find). |
| The manifest is not found or has the wrong type | `netlify.toml` header for `/manifest.webmanifest`. |
| A feature fails only on the live site | A header blocks it: check the browser console for "Content Security Policy". |
| iPhone shows a white screen when opened from the home screen | The launch screens are only read when the app is added to the home screen: remove it and add it again. |
