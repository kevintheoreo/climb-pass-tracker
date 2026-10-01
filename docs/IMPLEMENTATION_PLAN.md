# Climb Pass Tracker — Implementation Plan

Based on [PRD v1.2](./PRD.md). Requirement IDs (FR-x) and decision IDs (Dx) refer to the PRD.

The work follows the PRD's three milestones. Each milestone is split into steps that are small enough to be one pull request each, so every step can be reviewed and previewed on Netlify before merging.

---

## 1. Technical foundations

### 1.1 Libraries

| Purpose | Choice | Notes |
|---|---|---|
| Build / UI | Vite, React 19, TypeScript (strict) | |
| Routing | React Router | Bottom tab bar + stacked detail pages. |
| Styling | Tailwind CSS | Light and dark mode from the system setting. |
| Local database | Dexie + `dexie-react-hooks` | `useLiveQuery` re-renders screens when data changes, so no separate state library is needed. |
| Dates | `date-fns` | Pure helpers, easy to test. |
| Validation | `zod` | One schema per pass type, shared by forms, CSV export and (later) sync. |
| PWA | `vite-plugin-pwa` | Precaches the app shell; manifest and icons. |
| Backend (M2) | `@supabase/supabase-js` | Auth, Postgres, row-level security, one Edge Function. |
| Tests | Vitest + Testing Library; Playwright | Playwright uses the pre-installed Chromium. |
| Lint / format | ESLint + Prettier | |

### 1.2 Folder structure

```
src/
  domain/        Pure business logic, no React or database code (fully unit-tested)
    types.ts       Pass, Use, Freeze, Gym, Template, Settings
    passStatus.ts  entriesLeft, effectiveEndDate, status, daysLeft
    selection.ts   which pass to pre-select at a gym (D6)
    rules.ts       canLogUse (FR-11, FR-12), form validation (FR-22)
    reminders.ts   which banners to show (FR-31 to FR-34)
    csv.ts         CSV export (FR-45)
  db/            Dexie schema, migrations, and repository functions
  data/          Bundled built-in gym seed (M1; becomes the offline fallback in M2)
  features/      One folder per screen area
    dashboard/  passes/  gyms/  history/  settings/  onboarding/
  components/    Shared UI: Button, Card, Badge, Toast, Sheet, DateField, ...
  sync/          (M2) Supabase client, auth, sync engine
  app/           Router, layout, providers
supabase/        (M2) SQL migrations, RLS policies, Edge Functions
e2e/             Playwright tests
```

Keeping all rules in `src/domain/` means the tricky logic (counts, expiry, status, reminders) is tested once and used everywhere.

### 1.3 Data conventions

- **IDs:** UUIDs made with `crypto.randomUUID()` on the device.
- **Every user record has** `createdAt`, `updatedAt`, `deletedAt` (null unless deleted). Deleting sets `deletedAt` and leaves the row in place. All queries filter out deleted rows. This costs nothing in M1 and makes M2 sync straightforward.
- **Dates without a time** (purchase, expiry, start, end, visit) are stored as `YYYY-MM-DD` strings in the device's local time zone. **`usedAt`** is a full ISO timestamp.
- **A pass is valid through the whole of its expiry date** (it expires at the end of that day). *To confirm — see section 6.*
- **Money** is stored as a number of cents (integer) in SGD, to avoid rounding errors, and shown as `S$12.50`.
- **Built-in gym and template IDs are fixed UUIDs** written in the seed file. M2 loads the same IDs into Supabase, so passes created in M1 still point to the right gym after sync.
- A pass's `gymRef` is `{ kind: 'builtin' | 'user', id }`.

### 1.4 Status logic (single source of truth)

`getPassStatus(pass, uses, freezes, today, settings)` returns one main status plus extra flags:

| Pass type | Status order (first match wins) |
|---|---|
| Multipass / class pack | Used up (0 left) → Expired – X unused (today > expiry) → Active, with *Expiring soon* and *Low* flags |
| Membership | Expired (today > effective end) → Frozen (today inside a freeze) → Active, with an *Expiring soon* flag |
| Single entry | Always history |

"Active" passes appear on the dashboard. Everything else appears in History.

---

## 2. Milestone 1 — Core app, on-device only

Goal: a complete, installable, offline app with no account and no backend.

| Step | Work | PRD |
|---|---|---|
| **1.1 Project setup** | Vite + React + TS strict, Tailwind, ESLint/Prettier, Vitest, Playwright, `vite-plugin-pwa` with placeholder icons, `netlify.toml` (SPA redirect, `no-cache` on `sw.js`), GitHub Actions running lint + typecheck + unit tests on each PR. Update `CLAUDE.md` with the real commands. | §10, D21 |
| **1.2 Domain logic + tests** | `src/domain/*` as listed above, with unit tests for edge cases: expiry day itself, backdated uses, `initialUsed`, 0 entries left, freezes that overlap or extend past the end date, reminder windows (14 / 3 days), dismissed banners coming back at the next window. | FR-6, 10–12, 22, 31–34 |
| **1.3 Local database** | Dexie schema (tables: `passes`, `uses`, `freezes`, `userGyms`, `userTemplates`, `hiddenGyms`, `settings`, `meta`) with indexes on `passId`, `gymRef`, `updatedAt`. Repository functions that always set timestamps and soft-delete. Deleting a pass also soft-deletes its uses (FR-19). | §7, FR-19, 36 |
| **1.4 App shell + PWA** | Layout with bottom tabs (Passes, History, Gyms, Settings), routes, light/dark theme, offline precaching, web manifest, iOS meta tags. | §9 |
| **1.5 Gyms** | Bundled seed file (names and pass options only — owner fills in verified data; see 4.1). Gym list with active pass counts. Add your own gym and pass templates. Gym search used by the add-pass flow. | FR-23 (bundled for now), 24, 25, 27 |
| **1.6 Add / edit / delete pass** | Three-step add flow: gym → template or pass type → details form. A different form per pass type, +6 / +12 month buttons on expiry, "entries already used" field, zod validation. Edit and delete (with confirmation). Single entry saves straight into History. | FR-15–19, 22, D7 |
| **1.7 Dashboard + logging use** | Pass cards grouped by gym and sorted by soonest expiry, status badges, **Use 1** / **Log visit** buttons, toast with Undo (≥ 5 s), blocking messages for 0 left / expired (with "Edit expiry?" link), pass pre-selection and one-tap switch when a gym has several counted passes, empty state. | FR-1–12, D6 |
| **1.8 Pass detail + use history** | Pass header, uses grouped by month (newest first), add past use, change a use's date and time, delete a use, edit note. | FR-13, 14, 28 |
| **1.9 History** | Used-up, expired and single-entry passes, gym filter, "X unused" shown on expired passes. | FR-29, 30 |
| **1.10 Reminders + settings** | Reminder banners on the dashboard with dismiss. Settings: reminder windows and low-entry threshold, on/off switches, CSV export (passes + uses), delete all local data, app version, "data only on this device" notice, install instructions for iOS and Android. | FR-7, 31–34, 42–45, 47, 49 |
| **1.11 End-to-end tests** | Playwright on a phone-sized viewport: first launch → add pass → use 3 times → undo; backdate a use; expired-pass block; reminder banner; CSV download; app still works after going offline. | §13 |

**M1 done when:** everything above works offline in Chrome (Android) and Safari (iOS) when installed, unit and end-to-end tests pass, and it is deployed on a Netlify preview URL for you to try.

---

## 3. Milestone 2 — Accounts and sync

**What you need to set up first** (I'll give step-by-step instructions): a free Supabase project, a Google Cloud OAuth client, and the Supabase URL and anon key added to Netlify's environment variables.

| Step | Work | PRD |
|---|---|---|
| **2.1 Database schema** | SQL migrations in `supabase/` for all tables in PRD §7, each user table with `user_id`. Row-level security: users can only read and write their own rows; built-in gyms and templates are read-only for everyone. A trigger sets a `server_updated_at` column on every write. Seed built-in gyms with the same fixed IDs as the bundled file. | §7, §9 Security, D11 |
| **2.2 Google sign-in** | Sign in / out in Settings, session handling, redirect URLs for local, preview and production addresses. | FR-37 |
| **2.3 Built-in gyms from the database** | Fetch built-in gyms and templates when online, save them on the device, fall back to the bundled file on a first offline launch. | FR-23 |
| **2.4 Sync engine** | Runs on sign-in, app start, when the device comes back online, and a short time after each local change. **Push:** send local rows changed since the last push. **Pull:** fetch server rows with `server_updated_at` after the last pull. **Conflicts:** keep the row with the later `updatedAt` (last write wins). Deletions travel as rows with `deletedAt` set. Sync status shown in Settings ("Synced just now" / "Offline — will sync later"). | FR-38–40 |
| **2.5 First sign-in merge** | Attach `user_id` to every local row and push it. UUIDs never clash, so merging is just uploading. Settings: if the account already has settings, keep those. | FR-38, D13 |
| **2.6 Sign-out** | Warn, then sync any pending changes, then clear the local database. If there are unsynced changes and the device is offline, warn that they will be lost. | FR-41, D14 |
| **2.7 Delete account** | A Supabase Edge Function (it needs admin rights that the app itself must not have) deletes the user's rows and their login, then the app clears local data. | FR-46, D15 |
| **2.8 Tests** | Unit tests for merge and conflict rules; an integration test against a local Supabase instance (Supabase CLI) covering two devices editing the same pass, and checking RLS blocks access to another user's data. | §13 |

**M2 done when:** you can use the app signed out, sign in, see the same data on a second device, edit on both while offline, and end up with the same data on both after reconnecting.

---

## 4. Milestone 3 — Launch polish

| Step | Work | PRD |
|---|---|---|
| **3.1 Verified gym data** | Load your checked gym list into Supabase and the bundled file (see 4.1). | §11, D22 |
| **3.2 Membership freezes** | Add / edit / remove freezes; end date and status update. | FR-20 |
| **3.3 Renew / buy again** | Copy a pass's details into a new pass form. | FR-21 |
| **3.4 Hide gyms** | Hide built-in gyms from the picker; manage them in Settings. | FR-26 |
| **3.5 Privacy policy and terms** | Static pages linked from Settings. You'll need to review or supply the wording. | FR-48, §9 PDPA |
| **3.6 Accessibility and quality** | Automated accessibility checks (axe) in Playwright, large-text and screen-reader check, real icons and splash screens, Lighthouse PWA and performance check against the 2 s / 1 s targets. | §9 |
| **3.7 Nice-to-have** | App icon badge with reminder count, where supported. | FR-35 |
| **3.8 Production deploy** | Production Netlify site on the free `.netlify.app` address, Google sign-in redirects updated, final run of the full test suite. | D21 |

### 4.1 Gym seed data format

You'll fill in and maintain one file (`src/data/gyms.ts`, later mirrored to Supabase):

```ts
{ id: '…fixed uuid…', name: 'Example Gym', website: 'https://…',
  templates: [
    { id: '…', type: 'multipass', name: '10-Pass', entries: 10 },
    { id: '…', type: 'membership', name: 'Monthly', billingPeriod: 'monthly' },
  ] }
```

During M1 I'll put in a few placeholder gyms so the app can be tested; you replace them with the checked list before launch.

---

## 5. Testing strategy

- **Unit tests (Vitest):** all of `src/domain/` — this is where most bugs would hurt (wrong counts, wrong expiry). Dates are passed in as arguments rather than read from the clock, so tests can fix "today".
- **Component tests:** the add-pass form and the Use 1 / Undo flow.
- **End-to-end (Playwright):** the core flows from PRD §8, on a phone-sized screen, including offline mode.
- **CI:** GitHub Actions runs lint, typecheck and unit tests on every PR; Netlify builds a preview for every PR.

---

## 6. Decisions made before starting

| # | Question | Decision |
|---|---|---|
| Q1 | Last valid day | A pass is usable **on** its expiry date and expires at the end of that day. |
| Q2 | Membership edge cases | "Log visit" is blocked after the end date, with an "Edit end date?" link. It is allowed during a freeze, with a "frozen" note. |
| Q3 | User-added templates | A user's **own** templates also fill in the price and expiry they saved. Built-in templates fill in name and entries only. |
| Q4 | Icon | A simple generated placeholder icon until there is a logo. |
| Q5 | CI | A GitHub Actions workflow runs lint, typecheck and tests on every PR. |
