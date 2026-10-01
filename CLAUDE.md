# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Climb Pass Tracker is a phone-first PWA for climbers to track gym passes (shareable multipasses, memberships, single entries, class packs), starting with Singapore gyms. `docs/PRD.md` is the source of truth for scope and behaviour; `docs/IMPLEMENTATION_PLAN.md` is the step-by-step build plan (milestones M1–M3). Read both before implementing anything, and cite decision IDs (D1–D22) and requirement IDs (FR-1…FR-49) when relevant.

Progress: steps 1.1 (setup), 1.2 (domain logic) and 1.3 (local database) are done; the app is still a placeholder screen. Next is step 1.4 (app shell + PWA). Work happens on a feature branch per step, merged into `main` through a PR (CI runs on PRs only).

Domain logic lives in `src/domain/` and has no React or database imports. Pass dates are `YYYY-MM-DD` strings and "today" is always passed in, never read from the clock. Use `getPassStatus` for pass state, `canLogUse` before recording a use, `orderUsablePasses` to pre-select a pass, and `getReminders` for banners. `src/domain/schemas.ts` (zod) is the source for the record types. CSV export (`csv.ts` in the plan) is deferred to step 1.10.

Storage lives in `src/db/`: `db.ts` is the Dexie schema, `repo.ts` is the only code that reads or writes it (`import { repo } from './db'`). The repo validates input, sets timestamps, and soft-deletes (sets `deletedAt`; reads return live rows only). It is storage only: call `canLogUse` before `repo.addUse`. Reads are plain async functions so they work inside `useLiveQuery`. Tests build a throwaway database with `makeTestRepo()` (fake-indexeddb is loaded in `src/test-setup.ts`). Never name a custom error `NotFoundError`: Dexie rewrites errors with that name.

## Commands

```
npm run dev            # Vite dev server
npm run build          # typecheck + production build (also generates the service worker)
npm run lint           # ESLint
npm run format         # Prettier write (docs/ and CLAUDE.md are excluded)
npm run typecheck      # tsc -b
npm test               # Vitest, run once
npx vitest run src/path/file.test.ts      # a single test file
npx vitest run -t "test name"             # tests matching a name
npm run e2e            # Playwright; builds and serves the app on :4173 first
node scripts/generate-icons.mjs           # regenerate placeholder PWA icons from public/*.svg
```

In the cloud environment, run Playwright with `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` (the browser is pre-installed; do not run `playwright install`). CI (`.github/workflows/ci.yml`) runs lint, format check, typecheck, tests and build on every PR.

## Planned stack (PRD §10)

- React + TypeScript + Vite, Tailwind CSS, `vite-plugin-pwa` (Workbox)
- IndexedDB via Dexie for on-device storage
- Supabase (Postgres, Google OAuth, row-level security) for sync and the built-in gym catalog — added in milestone M2, not M1
- Vitest for unit tests, Playwright for end-to-end tests
- Hosted on Netlify free plan (`netlify.toml`: SPA redirect to `index.html` with status 200, `Cache-Control: no-cache` on `sw.js`). Not Vercel — its free plan forbids commercial use.

Build in milestone order (PRD §12): M1 on-device only (built-in gym list bundled with the app), M2 accounts and sync, M3 launch polish.

## Architecture rules that span the codebase

- **Local-first.** Every write goes to IndexedDB first; sync to Supabase happens in the background. All core flows must work offline. The app must be fully usable without signing in.
- **Sync records:** client-generated UUIDs plus `created_at`, `updated_at`, `deleted_at`. Deletes are soft (flagged) so they sync. Conflicts resolve last-write-wins by `updated_at`. First sign-in merges local data into the account; sign-out clears local data.
- **Derived, never stored:** `entries_left = total_entries − initial_used − count(non-deleted uses)`, membership `effective_end_date = end_date + sum(freeze lengths)`, and pass status (Active / Expiring soon / Low / Used up / Expired – X unused / Frozen).
- **One tap = one use.** A `Use` record has a date/time and an optional note — never a person's name (D3, D4).

## Domain rules that are easy to get wrong

- Pass types: multipass and class pack have counters and behave identically; membership is unlimited (visits logged for history, supports freezes); single entry is a dated visit with a price and no balance.
- Block logging a use when 0 entries remain, or for today on an expired pass (offer to edit expiry instead). Backdated uses on or before expiry are allowed.
- With several active counted passes at one gym, pre-select the soonest-expiring one; the user can switch (D6).
- Built-in gyms are tracked **per brand** and carry only name, optional website, and pass templates (type, name, entries). **Never ship suggested prices or validity periods** (D11). Templates fill in name and entry count only; users enter price and expiry (with generic +6 / +12 month quick buttons).
- User-added gyms and templates are private to that user.
- **SGD only** — no currency setting or conversion in v1 (D18).
- Reminders are in-app banners only in v1 (defaults: 14 and 3 days before expiry, ≤ 2 entries left; user-configurable). No push notifications.
- No analytics or crash-reporting services (D19). English only.
