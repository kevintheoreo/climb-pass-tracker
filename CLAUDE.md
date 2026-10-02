# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Climb Pass Tracker is a phone-first PWA for climbers to track gym passes, starting with Singapore gyms. **The whole app is one main screen: a list of rows, one per pass**, with the columns `Gym | Type | Expiry | Left`. The Left column has `−` / `+` buttons. The same gym can appear in many rows (two multipasses at one gym are two rows). There is no Gyms screen, no History screen and no bottom tab bar; Settings is reached from a gear icon. The first column is a text box with gym autocomplete, and a typed name that matches no gym is saved as a new gym.

`docs/PRD.md` (v2.1, the single-screen redesign) is the source of truth for scope and behaviour; `docs/IMPLEMENTATION_PLAN.md` is the step-by-step build plan (milestones M1–M3). Read both before implementing anything, and cite decision IDs (D1–D34) and requirement IDs (FR-1…FR-59) when relevant. IDs are stable across versions; superseded ones are marked in the PRD, so do not follow a D/FR that the PRD marks Superseded or Removed.

Progress: steps 1.1 to 1.7 are merged: setup, domain logic, local database, app shell, the rework for the single-screen model, the list of rows, and the `−` / `+` counter (`Counter.tsx`, rules in `counterView` in `src/domain/counter.ts`). You cannot add or edit passes by hand yet, and Settings is empty. **Next is step 1.8, adding a row.** Work happens on a feature branch per step, merged into `main` through a PR (CI runs on PRs only). The old Gyms-screens branch `step-1-5-gyms` (PR #4, closed unmerged) is only a source of ideas now; do not merge it.

Where things live:

- `src/domain/` is pure logic with no React or database imports; pass dates are `YYYY-MM-DD` strings and "today" is always passed in, never read from the clock. `schemas.ts` (zod) is the source for the record types (`Pass` is one of: multipass / class pack, single entry, membership). Key modules: `passStatus.ts` (`getPassStatus`, entries left, freezes), `cycle.ts` (monthly membership periods and reset dates), `counter.ts` (`canUseEntry`, `planGiveBack`: what `−` and `+` may do), `rows.ts` (`buildRows`: the sorted active list and the Finished split), `gyms.ts` (gym list, `searchGyms`, `resolveGymInput`), `reminders.ts` (`getReminders`: expiring, low, monthly reset), `money.ts` (`parseSgd`, `formatSgd`). CSV export (`csv.ts` in the plan) comes in step 1.10.
- `src/db/` holds the Dexie schema (`db.ts`, version 2) and `repo.ts`, the only code that reads or writes it (`import { repo } from './db'`). It validates input, sets timestamps and soft-deletes (sets `deletedAt`; reads return live rows only). `repo.useEntry` (`−`) and `repo.giveBackEntry` (`+`) check the counter rules and write inside one transaction, so a double tap never counts twice; `repo.findOrCreateGym(typed)` turns the gym cell's text into a gym, creating a private one when nothing matches. Reads are plain async functions so they work inside `useLiveQuery`. Tests build a throwaway database with `makeTestRepo()` (fake-indexeddb is loaded in `src/test-setup.ts`).
- `src/data/gyms.ts` is the built-in gym list: **names only**, fixed ids that must never change. **It currently holds two placeholder gyms and must be replaced with the owner's checked Singapore list before launch** (plan step 3.1).
- `src/features/passes/` is the main screen: `usePassRows` (live rows, via `useToday`, which rolls over at midnight), `PassRow` / `RowList` (a phone shows each row on two lines; from 640px wide it is a table with column headings), and the collapsed Finished section. Display wording (dates, `7 / 10`, "resets 15 Nov", badges) lives in `src/domain/format.ts`. **`sampleData.ts` and the `SampleTools` box (shown only with `?sample` in the address) are preview-only scaffolding: delete them in step 1.8**, when rows can be added by hand.
- `src/app/` is the router and `Layout` (a header with the app name and a gear link to Settings; no tab bar). Each screen is a page under `src/features/<name>/` wrapped in `components/Page`, which sets the heading, `document.title` and an optional back link. Shared form pieces are in `src/components/` (`forms.tsx`, `formUtils.ts`, `ConfirmDelete.tsx`); forms must report all problems at once.
- Light/dark follows the system setting through Tailwind's `dark:` classes (no manual toggle). `main.tsx` asks the browser for persistent storage via `src/db/persist.ts`. The Playwright suite includes an offline test (the service worker serves the app and deep links with the network off); if it fails, check `navigateFallback` in `vite.config.ts`.

Never name a custom error `NotFoundError`: Dexie rewrites errors with that name.

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
- **Derived, never stored:** `entries_left = total_entries − initial_used − count(non-deleted uses)` (never below 0; for a monthly membership `monthly_entries − count(uses in the current period)`), a membership's `effective_end_date = expiry_date + sum(freeze lengths)`, and pass status (Active / Expiring soon / Low / Used up / Expired – X unused / Frozen). "Finished" is derived from status, not stored.
- **`−` = one use.** It records a `Use` (a timestamp only, never a person's name or a note; D3, D4, D26). `+` removes the latest recorded use, or lowers `initial_used` when none is recorded. Both run in one transaction. Uses are never shown in v1.

## Domain rules that are easy to get wrong

- Pass types: multipass and class pack have counters and behave identically; a single entry is a counted pass with exactly 1 entry whose expiry is optional; a membership's Expiry is its end date and freezes push that date back (P1). A membership is either unlimited (the Left column says "Unlimited", no counter) or has an optional **entries per month** allowance: then it has a counter for the current month, shows "resets 15 Nov", stays in the main list at 0 and returns to the full allowance at each reset (unused entries are lost). The reset day defaults to the purchase date's day, is editable (1–31, clamped to the month's last day), and a freeze does not move it (D32, D33, FR-57, FR-58). A pass is usable **through** its expiry date.
- The counter stays between 0 and the total entered when the row was created (D25); for a monthly membership, between 0 and the monthly allowance, counting only uses in the current period. `−` is disabled at 0; used-up and expired rows move to the collapsed **Finished** section, where they can be deleted. Editing an expiry to a later date moves a row back up.
- Rows are not grouped by gym and are sorted by soonest expiry, rows with no expiry last (D31). Never pre-select or merge passes by gym.
- The gym text box matches existing gyms ignoring case and punctuation ("boulder+" matches "Boulder+"); an exact match reuses that gym so no duplicate is created; otherwise a new private user gym is saved (D24, FR-53).
- Built-in gyms are tracked **per brand** and carry a **name only**: no pass options, prices or validity periods (D11). Users enter their own price and expiry (with generic +6 / +12 month quick buttons that count from the purchase date).
- A new row saves itself only when every required cell is valid and focus leaves the row or Enter is pressed (D29, FR-54). Validation reports every problem at once.
- User-added gyms are private to that user.
- **SGD only**, stored as cents; no currency setting or conversion in v1 (D18).
- Reminders are in-app banners only in v1 (defaults: 14 and 3 days before expiry, ≤ 2 entries left, plus 3 days before a monthly reset when entries are left; each user-configurable and switchable off), and the row a banner is about is highlighted. Monthly memberships never get the "low entries" banner or badge (D34). No push notifications.
- No analytics or crash-reporting services (D19). English only.
