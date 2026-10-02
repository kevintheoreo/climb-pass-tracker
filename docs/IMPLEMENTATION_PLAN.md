# Climb Pass Tracker — Implementation Plan

Based on [PRD v2.1](./PRD.md) (the single-screen redesign). Requirement IDs (FR-x) and decision IDs (Dx) refer to the PRD, whose numbers are stable across versions.

The work follows the PRD's three milestones. Each milestone is split into steps that are small enough to be one pull request each, so every step can be reviewed and previewed on Netlify before merging.

---

## 0. What the redesign changed in the existing code (done in step 1.5)

Steps 1.1 to 1.4 were built for the earlier, multi-screen design. The first version of step 1.5 (Gyms screens, PR #4) was built but never merged and PR #4 was closed; the redesign replaced it. Its branch `step-1-5-gyms` stays, because some files were taken from it.

| Existing code | What happens to it |
|---|---|
| `src/domain/dates.ts`, `reminders.ts`, `settings.ts`, `passStatus.ts` (entries left, freezes, days left, status) | **Keep.** `passStatus` changes slightly: a membership uses `purchaseDate` / `expiryDate` instead of `startDate` / `endDate`, a single entry is a counted pass with 1 entry (no separate "visit" state), and the expiry of a single entry may be empty. |
| `src/domain/schemas.ts`, `types.ts` | **Rework.** One pass shape for all types (see PRD §7): no `name`, no billing period, no `visitDate`; membership and single entry share `purchaseDate` / `expiryDate`; add `comments`. Remove the user-template schema. A use loses its `note`. |
| `src/domain/rules.ts` (`canLogUse`) and `selection.ts` (pass pre-selection, D6) | **Replace.** `rules.ts` becomes a small counter rule (D25, FR-9, FR-11, FR-52). `selection.ts` is deleted; `rows.ts` takes over ordering and the Finished split. |
| `src/db/db.ts`, `repo.ts` | **Rework.** Dexie version 2 drops `userTemplates` and `hiddenGyms` and clears the old pass rows, which only ever existed on development previews. Repo loses templates, hidden gyms and gym deletion, and gains `findOrCreateGym` and counter adjustment. |
| `src/app/` (router, `TabBar`, `Layout`), `features/gyms`, `features/history` | **Rework / delete.** No bottom tab bar. A header with a gear icon and two routes, `/` and `/settings`. |
| `src/components/Page.tsx`, `persist.ts`, PWA setup, CI, Netlify config | **Keep.** |
| From branch `step-1-5-gyms`: `money.ts` (`parseSgd`, `formatSgd`, `centsToInput`), the gym search from `domain/gyms.ts` (`searchGyms` and its punctuation-insensitive matching), `components/forms.tsx`, `formUtils.ts`, `ConfirmDelete.tsx`, `labels.ts` | **Take over** (copy the files and their tests onto the new branch). Everything else on that branch is dropped. |

---

## 1. Technical foundations

### 1.1 Libraries

| Purpose | Choice | Notes |
|---|---|---|
| Build / UI | Vite, React 19, TypeScript (strict) | |
| Routing | React Router | Two routes: the main screen and Settings. |
| Styling | Tailwind CSS | Light and dark mode from the system setting. |
| Local database | Dexie + `dexie-react-hooks` | `useLiveQuery` re-renders screens when data changes, so no separate state library is needed. |
| Dates | `date-fns` | Pure helpers, easy to test. |
| Validation | `zod` | Pass schema shared by the row editor, CSV export and (later) sync. |
| PWA | `vite-plugin-pwa` | Precaches the app shell; manifest and icons. |
| Backend (M2) | `@supabase/supabase-js` | Auth, Postgres, row-level security, one Edge Function. |
| Tests | Vitest + Testing Library; Playwright | Playwright uses the pre-installed Chromium. |
| Lint / format | ESLint + Prettier | |

### 1.2 Folder structure

```
src/
  domain/        Pure business logic, no React or database code (fully unit-tested)
    types.ts       Pass, Use, Freeze, Gym, Settings
    passStatus.ts  entriesLeft, effectiveEndDate, status, daysLeft
    cycle.ts       monthly membership periods: current period, next reset, entries left this month (D32, D33)
    rows.ts        view-model for the main screen: sorted active rows, Finished split, highlights
    counter.ts     what − and + do and when they are allowed (D25, FR-9, FR-11, FR-52)
    gyms.ts        gym name matching, search and "find or create" decisions (FR-53)
    money.ts       parse / format SGD
    reminders.ts   which banners to show (FR-31 to FR-34)
    csv.ts         CSV export (FR-45)
  db/            Dexie schema, migrations, and the repository
  data/          Bundled built-in gym names (M1; becomes the offline fallback in M2)
  features/
    passes/      the main screen: rows, add row, details, Finished, banners
    settings/
  components/    Shared UI: Page, form fields, ConfirmDelete, ...
  sync/          (M2) Supabase client, auth, sync engine
  app/           Router, header, providers
supabase/        (M2) SQL migrations, RLS policies, Edge Functions
e2e/             Playwright tests
```

Keeping all rules in `src/domain/` means the tricky logic (counts, expiry, status, reminders, gym matching) is tested once and used everywhere.

### 1.3 Data conventions

- **IDs:** UUIDs made with `crypto.randomUUID()` on the device.
- **Every user record has** `createdAt`, `updatedAt`, `deletedAt` (null unless deleted). Deleting sets `deletedAt` and leaves the row in place. All queries filter out deleted rows. This makes M2 sync straightforward.
- **Dates without a time** (purchase, expiry, freeze start and end) are stored as `YYYY-MM-DD` strings in the device's local time zone. **`usedAt`** is a full ISO timestamp.
- **A pass is valid through the whole of its expiry date** (it expires at the end of that day).
- **Money** is stored as a number of cents (integer) in SGD, to avoid rounding errors, and shown as `S$12.50`.
- **Built-in gym IDs are fixed UUIDs** written in the seed file. M2 loads the same IDs into Supabase, so passes created in M1 still point to the right gym after sync.
- A pass's `gymRef` is `{ kind: 'builtin' | 'user', id }`.

### 1.4 Status logic (single source of truth)

`getPassStatus(pass, uses, freezes, today, settings)` returns one main status plus extra flags:

| Pass type | Status order (first match wins) |
|---|---|
| Multipass / class pack / single entry | Used up (0 left) → Expired – X unused (today > expiry, if there is one) → Active, with *Expiring soon* and *Low* flags |
| Membership | Expired (today > effective end) → Frozen (today inside a freeze) → Active, with an *Expiring soon* flag. A membership with a monthly allowance is never *Used up* or *Low*: at 0 this month it stays Active until the next reset |

**Active** rows (including frozen memberships) are listed in the main list, sorted by soonest expiry. **Used up** and **Expired** rows are listed in the collapsed Finished section.

### 1.5 The counter

- `−` records a use (timestamp only) when entries are left and the pass is active.
- `+` removes the most recent recorded use; with none recorded it lowers `initialUsed`; it does nothing at the full total.
- Both change the stored data in one database transaction, so a double tap never counts twice.
- A monthly membership counts only the uses inside the **current period** (`cycle.ts`): from the latest reset date on or before today (or the purchase date, if none yet) up to the next reset date. `+` removes the latest use in that period and does nothing when there is none. Because the count is derived from timestamped uses, changing the reset day or the allowance recalculates it immediately, and nothing needs resetting by a timer.
- "Already used this month" entered when adding a monthly membership is saved as that many uses stamped at the start of the current period.

---

## 2. Milestone 1 — Core app, on-device only

Goal: a complete, installable, offline app with no account and no backend.

| Step | Work | PRD |
|---|---|---|
| **1.1 Project setup** ✅ | Vite + React + TS strict, Tailwind, ESLint/Prettier, Vitest, Playwright, `vite-plugin-pwa` with placeholder icons, `netlify.toml`, GitHub Actions CI. | §10, D21 |
| **1.2 Domain logic + tests** ✅ | Pass status, entries left, freezes, reminders, dates, validation. *Parts are reworked in 1.5.* | FR-6, 22, 31–34 |
| **1.3 Local database** ✅ | Dexie schema and repository with timestamps and soft deletes. *Reworked in 1.5.* | §7, FR-19, 36 |
| **1.4 App shell + PWA** ✅ | Router, theme, offline precaching, manifest, iOS meta tags, persistent-storage request. *The tab bar is replaced in 1.5.* | §9 |
| **1.5 Rework for the single-screen model** ✅ | Everything in section 0 marked Keep / Rework / Replace: unified pass schema (memberships gain `monthlyEntries` and `resetDay`), Dexie version 2, new repo functions (`findOrCreateGym`, counter adjustment), `counter.ts`, `cycle.ts` (monthly periods and reset dates, including short months), `rows.ts`, `gyms.ts` (matching), a third reminder kind (monthly reset) in `reminders.ts`, take over the files listed from `step-1-5-gyms`, built-in gym seed reduced to names, header with gear icon and two routes (no tab bar), delete the Gyms and History pages. Unit tests for all of it; the app still shows a placeholder main screen. | D23–D31, FR-51 |
| **1.6 Main screen: the list** ✅ | Rows (`Gym | Type | Expiry | Left`) from the database, sorted by soonest expiry; status badges and "days left"; the collapsed Finished section with "Used up" / "Expired – X unused"; empty state. The Left column shows `5 / 8` and "resets 15 Nov" for monthly memberships and "Unlimited" for the others. Read-only. Phone layout confirmed from a screenshot (PRD §15). | FR-1–3, 6, 8, 30, 50, D31 |
| **1.7 The counter** ✅ | `−` and `+` on counted rows, wired to the transaction in 1.5; disabled at the limits; rows move to Finished at 0 (a monthly membership stays in the list and shows its reset date). | FR-4, 9, 11, 12, 14, 52, D25 |
| **1.8 Add a row** ✅ | The blank row at the bottom: gym autocomplete with "Add “text” as a new gym", type, entries (for a membership, the optional entries per month), expiry with +6 / +12 month buttons; saves itself when complete and the user leaves the row or presses Enter; missing or invalid cells say so. | FR-15, 22, 25, 53, 54, D24, D29 |
| **1.9 Edit a row and its details** ✅ | Edit cells in place; tap a row to open details (purchase date, price, already used, comments, and for monthly memberships the reset day); delete with confirmation; editing the expiry of a Finished row brings it back. When `−` uses the last entry and the row moves to Finished, a short notice at the bottom says "Moved to Finished · Undo" for a few seconds; Undo gives the entry back (same as `+`). | FR-17–19, 22, 56, D30 |
| **1.10 Reminders + Settings** ✅ | Reminder banners with dismiss and row highlights, including the monthly reset banner 3 days before a reset. Settings (gear icon): reminder thresholds and on/off (expiring soon, low entries, monthly reset), CSV export (passes + recorded uses), delete all local data, app version, "data only on this device" notice, install instructions for iOS and Android. | FR-7, 31–34, 42–45, 47, 49, 55 |
| **1.11 End-to-end tests** | Playwright on a phone-sized viewport: first launch → add a row by typing a new gym → tap `−` three times and `+` once → a monthly membership counts down, stops at 0 and shows its reset date → two rows at one gym stay separate → row moves to Finished → reminder banner → CSV download → everything still works offline. | §13 |

**M1 done when:** everything above works offline in Chrome (Android) and Safari (iOS) when installed, unit and end-to-end tests pass, and it is deployed on a Netlify preview URL for you to try.

---

## 3. Milestone 2 — Accounts and sync

**What you need to set up first** (I'll give step-by-step instructions): a free Supabase project, a Google Cloud OAuth client, and the Supabase URL and anon key added to Netlify's environment variables.

| Step | Work | PRD |
|---|---|---|
| **2.1 Database schema** | SQL migrations in `supabase/` for the tables in PRD §7 (gyms, user gyms, passes, freezes, uses, settings), each user table with `user_id`. Row-level security: users can only read and write their own rows; built-in gyms are read-only for everyone. A trigger sets a `server_updated_at` column on every write. Seed built-in gyms with the same fixed IDs as the bundled file. | §7, §9 Security, D11 |
| **2.2 Google sign-in** | Sign in / out in Settings, session handling, redirect URLs for local, preview and production addresses. | FR-37 |
| **2.3 Built-in gyms from the database** | Fetch built-in gym names when online, save them on the device, fall back to the bundled file on a first offline launch. | FR-23 |
| **2.4 Sync engine** | Runs on sign-in, app start, when the device comes back online, and a short time after each local change. **Push:** send local rows changed since the last push. **Pull:** fetch server rows with `server_updated_at` after the last pull. **Conflicts:** keep the row with the later `updatedAt` (last write wins). Deletions travel as rows with `deletedAt` set. Sync status shown in Settings ("Synced just now" / "Offline — will sync later"). | FR-38–40 |
| **2.5 First sign-in merge** | Attach `user_id` to every local row and push it. UUIDs never clash, so merging is just uploading. Settings: if the account already has settings, keep those. | FR-38, D13 |
| **2.6 Sign-out** | Warn, then sync any pending changes, then clear the local database. If there are unsynced changes and the device is offline, warn that they will be lost. | FR-41, D14 |
| **2.7 Delete account** | A Supabase Edge Function (it needs admin rights that the app itself must not have) deletes the user's rows and their login, then the app clears local data. | FR-46, D15 |
| **2.8 Tests** | Unit tests for merge and conflict rules; an integration test against a local Supabase instance (Supabase CLI) covering two devices editing the same pass, and checking RLS blocks access to another user's data. | §13 |

Because `−` and `+` change recorded uses, two devices counting at the same time are merged by the same last-write-wins rule on each row; a double count is possible in that rare case and is accepted for v1.

**M2 done when:** you can use the app signed out, sign in, see the same data on a second device, edit on both while offline, and end up with the same data on both after reconnecting.

---

## 4. Milestone 3 — Launch polish

| Step | Work | PRD |
|---|---|---|
| **3.1 Verified gym names** | Load your checked gym name list into Supabase and the bundled file (see 4.1). | §11, D22 |
| **3.2 Membership freezes** | Add / edit / remove freezes in a membership's details; end date and status update. | FR-20 |
| **3.3 Buy again** | A button in a row's details that creates a new row with the same gym, type, entries and price. | FR-21 |
| **3.4** | *Removed.* Hiding gyms is no longer needed (autocomplete replaces the gym list). | FR-26 removed |
| **3.5 Privacy policy and terms** | Static pages linked from Settings. You'll need to review or supply the wording. | FR-48, §9 PDPA |
| **3.6 Accessibility and quality** | Automated accessibility checks (axe) in Playwright, large-text and screen-reader check of the row controls and the autocomplete, real icons and splash screens, Lighthouse PWA and performance check against the 2 s / 1 s targets. | §9 |
| **3.6a Row motion** (FR-61) | When a row moves to or from Finished, it slides out to the side while the rows below move up (and the reverse when it comes back). Needs the row to stay on screen briefly after the data changes; skipped when the phone's reduced-motion setting is on; must not break the double-tap guard or the tests (turn motion off in tests). | polish |
| **3.7 Nice-to-have** | App icon badge with reminder count, where supported. | FR-35 |
| **3.8 Production deploy** | Production Netlify site on the free `.netlify.app` address, Google sign-in redirects updated, final run of the full test suite. | D21 |

### 4.1 Gym seed data format

You'll fill in and maintain one file (`src/data/gyms.ts`, later mirrored to Supabase). Names only:

```ts
{ id: '…fixed uuid…', name: 'Example Gym' }
```

During M1 I'll put in a few placeholder gyms so the app can be tested; you replace them with the checked list before launch.

---

## 5. Testing strategy

- **Unit tests (Vitest):** all of `src/domain/` — this is where most bugs would hurt (wrong counts, wrong expiry, wrong gym matching). Dates are passed in as arguments rather than read from the clock, so tests can fix "today".
- **Component tests:** the add row (autocomplete, new gym, saving itself), the counter buttons, the details section.
- **End-to-end (Playwright):** the core flows from PRD §8, on a phone-sized screen, including offline mode.
- **CI:** GitHub Actions runs lint, typecheck and unit tests on every PR; Netlify builds a preview for every PR.

---

## 6. Decisions made before starting

| # | Question | Decision |
|---|---|---|
| Q1 | Last valid day | A pass is usable **on** its expiry date and expires at the end of that day. |
| Q2 | Membership edge cases | *Superseded.* A membership has no counter and no visit log (D28), so there is nothing to block. A membership is Finished the day after its (freeze-extended) end date. |
| Q3 | User-added templates | *Superseded.* There are no templates (D11, D30). |
| Q4 | Icon | A simple generated placeholder icon until there is a logo. |
| Q5 | CI | A GitHub Actions workflow runs lint, typecheck and tests on every PR. |
| Q6 | Redesign | One screen of rows (D23–D34, including monthly-allowance memberships), as set out in PRD v2.1. |
