# Climb Pass Tracker — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v1.4 — for review |
| **Date** | 2026-10-01 |
| **Product** | Climb Pass Tracker |
| **Platform** | Progressive Web App (PWA), phone-first |
| **Market** | Singapore climbing gyms at launch, usable anywhere |

---

## 1. Overview

Climbers in Singapore usually buy **shareable multipasses** (for example, 10 entries for a fixed price) from one or more gyms. These expire after a set time, usually 6 or 12 months. Climbers often hold passes at several gyms at once and use them for friends too. That makes it easy to lose count of how many entries are left and when each pack expires, so passes go unused and money is wasted.

**Climb Pass Tracker** is a simple, offline-capable web app that tracks every pass a climber owns: how many entries are left, when each pass expires, and a reminder before entries are wasted.

## 2. Goals and non-goals

### Goals (v1)
1. Log a pass use in **one tap** while standing at the gym counter, even with no internet.
2. Show at a glance how many entries are left and when each pass expires, across all gyms.
3. Warn users before passes expire with entries left, and when a pass is nearly used up.
4. Work fully **without an account**, with optional Google sign-in to sync across devices.
5. Ship with built-in Singapore gym data so adding a pass takes seconds.

### Non-goals (v1)
- Tracking *who* used each entry (friends' names are deliberately not recorded).
- Currencies other than SGD.
- Suggested prices or validity periods for gyms (users enter their own).
- Shared or collaborative passes between multiple accounts.
- Booking, payments, or any integration with gym systems.
- Native iOS or Android store apps.
- Usage analytics or crash-reporting services.
- Languages other than English.

## 3. Target users

| Persona | Description | Main need |
|---|---|---|
| **Pass owner** (primary) | Climbs 1–3 times a week. Holds passes at 1–3 gyms. Often brings friends who use their passes. | Know what's left and don't let entries expire. |
| **Gym hopper** | Climbs at many gyms and buys a pack wherever they go. | One place to see every pass and its expiry. |
| **Member** | Has a monthly or yearly membership, plus the occasional pass elsewhere. | Renewal reminders, and how often they actually go. |

Friends who use the owner's passes are **not** users of the app. The owner records their uses by tapping once per entry.

## 4. Key decisions (from discovery)

| # | Topic | Decision |
|---|---|---|
| D1 | Platform | PWA, phone-first. Works in desktop browsers too. |
| D2 | Accounts | No account needed. Optional **Google sign-in** for syncing. |
| D3 | Logging uses | **One tap = one entry.** For 3 climbers, tap 3 times. |
| D4 | Who used it | **Not tracked.** No names. |
| D5 | Editing uses | Uses can be edited, deleted, and backdated. The remaining count updates automatically. |
| D6 | Several active passes at one gym | The pass expiring soonest is **pre-selected**, and the user can switch with one tap. |
| D7 | Validity | Counts from the **purchase date**. The user enters the expiry date; the app does not suggest one. Quick buttons (+6 months, +12 months from purchase) are provided for convenience. |
| D8 | After expiry | Shown as "Expired – X unused" and kept in history. The expiry date stays editable, to record extensions. |
| D9 | Reminders | Expiring soon **and** low entries. In-app banners in v1, push notifications later. |
| D10 | Gym granularity | Tracked **per brand**. If an outlet has different pricing, it is listed as a separate gym name. |
| D11 | Built-in gym data | Gym names and pass options (type, name, number of entries) only. **No prices or validity periods are suggested in v1.** Stored in the backend database so it can be updated without releasing a new app version. |
| D12 | User-added gyms | Visible only to the user who added them. Suggesting them for the built-in list is a future enhancement. |
| D13 | First sign-in | Data already on the device is **merged** into the account. |
| D14 | Sign-out | Data is **cleared** from the device, since it is safe in the account. |
| D15 | Privacy | Data export (CSV) and account deletion are included. |
| D16 | Pass types | Multipass, Membership, Single entry, Class / course pack. |
| D17 | Language | English only. |
| D18 | Currency | **SGD only** in v1. There is no currency setting. |
| D19 | Analytics | None in v1, to keep the free database tier small. |
| D20 | Monetization | Core tracking and sync stay free. Ways to make money are listed as future ideas only. |
| D21 | Hosting | **Netlify** free plan, which allows commercial use. Launch on the free `.netlify.app` address. |
| D22 | Gym data upkeep | The product owner checks the built-in gym names and pass options. How often is still to be decided. |

## 5. Pass types

| Type | Has a counter | Validity | What a "use" means | Ends when |
|---|---|---|---|---|
| **Multipass** | Yes (N entries) | Purchase date → expiry date | Uses 1 entry | All entries used **or** expired |
| **Class / course pack** | Yes (N sessions) | Same as multipass | Uses 1 session | All sessions used **or** expired |
| **Membership** | No (unlimited) | Start → end date, pushed back by freezes | Logs 1 visit (for history only) | End date reached |
| **Single entry** | No | One date | Recorded as a visit when created | Immediately: it goes straight into history |

Class packs behave exactly like multipasses with a different label.

## 6. Functional requirements

Priority: **P0** = must have for launch, **P1** = should have for launch, **P2** = nice to have.

### 6.1 Home dashboard
- **FR-1 (P0)** Show all active passes as cards, grouped by gym, sorted by soonest expiry.
- **FR-2 (P0)** Each multipass or class-pack card shows: gym, pass name, **entries left / total** (e.g. "7 / 10"), expiry date, and days left.
- **FR-3 (P0)** Each membership card shows: gym, end date, days left, and visits this month.
- **FR-4 (P0)** Each card has a large **"Use 1"** button (multipass and class pack) or **"Log visit"** button (membership).
- **FR-5 (P0)** After a tap, show a confirmation toast with **Undo**, available for at least 5 seconds.
- **FR-6 (P0)** Status badges: *Active*, *Expiring soon*, *Low*, *Used up*, *Expired – X unused*, *Frozen*.
- **FR-7 (P0)** Reminder banners at the top of the dashboard (see 6.6).
- **FR-8 (P0)** Empty state: a friendly prompt to add the first pass.

### 6.2 Logging use
- **FR-9 (P0)** One tap logs **one** entry dated today, at the current time.
- **FR-10 (P0)** If the gym has more than one active counted pass, the pass expiring soonest is pre-selected, with a one-tap way to switch (D6).
- **FR-11 (P0)** A use cannot be logged on a pass with 0 entries left.
- **FR-12 (P0)** A pass is usable through the whole of its expiry date. A use cannot be logged for today on a pass whose expiry date has passed. A membership past its end date is blocked the same way ("Edit end date?"), but visits are allowed during a freeze, with a note that it is frozen. Instead, show "This pass expired on <date>. Edit expiry?" A backdated use on or before the expiry date is allowed.
- **FR-13 (P0)** In the pass detail screen, the user can add a use for a past date, change a use's date, or delete a use. The remaining count is recalculated.
- **FR-14 (P0)** Each use record: date, time, and an optional short note (e.g. "with friends"). No names are stored.

### 6.3 Adding and editing passes
- **FR-15 (P0)** Add-pass flow: **choose gym** (search the built-in list or user-added gyms) → **choose pass type / template** → **check the filled-in details** → save.
- **FR-16 (P0)** Choosing a **built-in** template fills in the pass name and entry count only. The user enters the price and expiry date. A template the user created themselves also fills in the price and validity they saved. All fields stay editable.
- **FR-17 (P0)** Fields for each pass type:
  - Multipass / class pack: name, number of entries, price paid, purchase date, expiry date (entered by the user, with +6 / +12 month quick buttons), entries already used (for passes bought before installing the app), notes.
  - Membership: name, price paid, billing period (monthly / yearly / custom), start date, end date, notes.
  - Single entry: date, price paid, notes.
- **FR-18 (P0)** Edit any field later, including the expiry date (D8).
- **FR-19 (P0)** Delete a pass, with confirmation. This also removes its use records.
- **FR-20 (P1)** **Freeze** a membership: enter a start and end date. The end date is pushed back by the freeze length. Several freezes are allowed, and each can be edited or removed.
- **FR-21 (P1)** **Renew** a membership or **buy again** for a multipass: create a new pass with the same details filled in.
- **FR-22 (P0)** Check that the expiry date is not before the purchase date, and that the entry count is at least 1.

### 6.4 Gyms
- **FR-23 (P0)** The built-in gym list loads from the backend and is **cached on the device** so it works offline. It refreshes when the device is online.
- **FR-24 (P0)** Each built-in gym has: name, optional website, and one or more **pass templates** (type, name, entries). No price or validity.
- **FR-25 (P0)** Users can add their own gym (name required, website optional) and their own pass templates. These are visible only to that user (D12).
- **FR-26 (P1)** Users can hide built-in gyms they never go to, so the gym picker stays short.
- **FR-27 (P0)** A gym list screen shows each gym with the user's active pass count.

### 6.5 History
- **FR-28 (P0)** A pass detail screen shows all uses, newest first, grouped by month.
- **FR-29 (P0)** A history / archive screen lists used-up, expired, and single-entry passes, with a filter by gym.
- **FR-30 (P1)** Each expired pass shows how many entries went unused.

### 6.6 Reminders (in-app, v1)
- **FR-31 (P0)** **Expiring soon:** show a banner when a counted pass with entries left, or a membership, is within the reminder windows. Defaults: **14 days** and **3 days** before expiry.
- **FR-32 (P0)** **Low entries:** show a banner when a counted pass has **2 or fewer** entries left.
- **FR-33 (P0)** Users can change both thresholds in Settings, or turn each reminder type off.
- **FR-34 (P1)** Banners can be dismissed. A dismissed banner reappears when the pass reaches the next reminder window.
- **FR-35 (P2)** An app icon badge with the number of active reminders, using the Badging API where supported.

### 6.7 Accounts and sync
- **FR-36 (P0)** The app works fully without signing in. Data is stored on the device.
- **FR-37 (P0)** Optional **Sign in with Google**.
- **FR-38 (P0)** On first sign-in, data on the device is uploaded and merged with any existing account data (D13).
- **FR-39 (P0)** While signed in, changes are saved on the device first and synced in the background. Changes made offline are queued and sent when the device reconnects.
- **FR-40 (P0)** When the same record is edited on two devices, the most recent change wins. Deletions are synced too.
- **FR-41 (P0)** Sign-out clears data from the device, with a warning first (D14).
- **FR-42 (P0)** Users who are not signed in see a gentle note that their data lives only on this device, plus a reminder to export it or sign in.

### 6.8 Settings and privacy
- **FR-43 (P0)** All amounts are entered and shown in SGD (S$). There is no currency setting (D18).
- **FR-44 (P0)** Reminder thresholds (see FR-33).
- **FR-45 (P0)** **Export data** as CSV (passes and uses). Available with or without an account.
- **FR-46 (P0)** **Delete account:** permanently deletes all of the user's data from the server and signs them out, with confirmation.
- **FR-47 (P1)** **Delete all local data** for users without an account.
- **FR-48 (P0)** Links to the privacy policy and terms, plus the app version.
- **FR-49 (P1)** "Install app" prompt with instructions for adding it to the home screen on iOS and Android.

## 7. Data model (logical)

All user-owned records use client-generated UUIDs plus `created_at`, `updated_at`, and `deleted_at` (deletions are flagged rather than erased, so they can sync). Amounts are stored as numbers in SGD.

```
Gym (built-in, read-only to users)
  id, name, website?, is_active, sort_order

GymTemplate (built-in)
  id, gym_id, pass_type, name, entries?, billing_period?

UserGym (user-added, private)
  id, user_id, name, website?

UserTemplate (user-added, private)
  id, user_id, gym_ref, pass_type, entries?, price?, validity_months?, billing_period?, comments?
  -- no name of its own: the pass type is its name; comments are the user's own notes

HiddenGym
  user_id, gym_id

Pass
  id, user_id?, gym_ref (built-in or user gym), pass_type
  name, price?, notes?
  -- counted types (multipass / class pack)
  total_entries, initial_used, purchase_date, expiry_date
  -- membership
  start_date, end_date (base), billing_period
  -- single entry
  visit_date

Freeze (memberships)
  id, pass_id, start_date, end_date

Use
  id, pass_id, used_at (date + time), note?

Settings
  user_id?, expiry_reminder_days [14, 3],
  low_entries_threshold 2, reminders_enabled flags, dismissed_banners
```

**Derived values (calculated, not stored):**
- `entries_left = total_entries − initial_used − count(uses not deleted)`
- `effective_end_date = end_date + sum(freeze lengths)`
- `status` is worked out from entries left, today's date, expiry, and any freezes.

## 8. Key user flows

1. **First launch:** Welcome → "Add your first pass" → pick gym → pick template → save → dashboard. No sign-up wall.
2. **At the gym with 2 friends:** Open app → tap **Use 1** three times on the pass → toast "3 entries used · 4 left" with Undo.
3. **Forgot to log yesterday:** Pass detail → **Add past use** → pick yesterday → save.
4. **Expiry warning:** Dashboard banner: "Boulder Planet 10-pass expires in 14 days — 4 entries left."
5. **Second device:** Settings → Sign in with Google → local data merged → sign in on another device → same data.
6. **Gym not in list:** Add pass → search → "Can't find it? Add your own gym."

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Offline** | Every core flow (view, use, add, edit) works with no network. The app shell and gym list are cached by a service worker. |
| **Performance** | The dashboard is usable within 2 s on a mid-range phone over 4G on first load, and within 1 s on repeat visits. Logging a use responds instantly. |
| **Installability** | Meets PWA install criteria (manifest, icons, service worker). Works in standalone mode on iOS Safari 16.4+ and Chrome on Android. |
| **Browsers** | Latest 2 versions of Safari (iOS/macOS), Chrome, Edge, and Firefox. |
| **Accessibility** | WCAG 2.1 AA: tap targets ≥ 44 px, sufficient contrast, screen-reader labels, works with large text. |
| **Theme** | Light and dark modes that follow the system setting. |
| **Security** | Google OAuth through the backend's auth provider. Row-level security so each user can only read and write their own records. HTTPS only. |
| **Privacy (PDPA)** | Only the minimum is collected: Google account email and ID, plus the user's pass data. No analytics or tracking. Privacy policy published. Export and delete available. |
| **Cost** | Runs on free tiers (hosting + database). There is no analytics or log storage, and records are small, so database growth stays low. |

## 10. Proposed technical approach

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Widely used, fast, good PWA tooling. |
| Styling | Tailwind CSS | Quick to build a consistent, mobile-first UI. |
| PWA | `vite-plugin-pwa` (Workbox) | Service worker, offline caching, manifest. |
| Local storage | IndexedDB via Dexie | Reliable on-device storage with offline queries. |
| Backend | Supabase (Postgres, Auth, Row-Level Security) | Free tier, built-in Google sign-in, a database to hold the built-in gym list. |
| Sync | Local-first: write to IndexedDB, then push and pull changed rows by `updated_at` | Offline-first, simple last-write-wins. |
| Hosting | Netlify, free plan (see 10.1) | HTTPS, CDN, preview deploys, deploys automatically from GitHub. |
| Testing | Vitest (unit), Playwright (end-to-end) | Covers the counting, expiry and sync logic and the core flows. |

### 10.1 Hosting on Netlify

Netlify's free plan allows commercial use, so the app will not need to change host when it starts making money (D21). The app is a static Vite build (no server code), and Supabase runs separately, so Netlify only serves files.

- **Setup:** connect the GitHub repo in Netlify. Build command `npm run build`, publish directory `dist`. Supabase keys are set as environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). The anon key is safe to expose because row-level security protects the data.
- **Routing:** add a `netlify.toml` redirect that sends every path to `index.html` with status 200, so deep links work in a single-page app.
- **Service worker:** serve `sw.js` with `Cache-Control: no-cache` (set in `netlify.toml`) so users get app updates promptly.
- **Google sign-in:** add the Netlify URL (and any future custom domain) to the allowed redirect URLs in Supabase and Google Cloud.
- **Preview deploys:** each pull request gets its own preview URL for testing before merging.
- **Usage limits:** the free plan has monthly limits on bandwidth and builds. A small static app should stay well within them, but check the current limits before launch.
- **Address:** launch on the free `<site-name>.netlify.app` address (e.g. `climb-pass-tracker.netlify.app`, if available). A custom domain can be added later.

## 11. Seed gym data

The built-in list will cover the main Singapore climbing gym brands. Example brands include Boulder Planet, Boulder+, Fit Bloc, Climb Central, BFF Climb, Lighthouse Climbing, Ark Bloc, Z-Vertigo, and others.

**Before launch, every gym's name and pass options (type and number of entries) must be checked against the gym's current website or front desk.** This is tracked as a launch task. No prices or validity periods are included in v1 (D11).

## 12. Release plan

| Milestone | Scope |
|---|---|
| **M1 — Core, on-device only** | Dashboard, all four pass types, logging use with Undo, editing / backdating, gyms (built-in list stored with the app for now + user-added), history, in-app reminders, CSV export, PWA install and offline support. |
| **M2 — Accounts and sync** | Supabase setup, Google sign-in, built-in gym list moved to the database, merge on first sign-in, background sync, sign-out clearing, account deletion. |
| **M3 — Launch polish** | Verified seed data, membership freezes, renew / buy again, hide gyms, privacy policy and terms, accessibility pass, end-to-end tests, production deploy. |

## 13. Success measures

There are no analytics in v1, so success is judged by:
- Number of signed-in accounts (from the auth provider's own user count).
- Direct feedback from the climbing community (e.g. a feedback link in Settings).
- Being able to complete the core flows offline without errors (the end-to-end tests pass).

## 14. Future enhancements (out of scope for v1)

- **Push notifications** for expiry and low-entry reminders.
- **Gym suggestions:** users submit gyms they added to be considered for the built-in list.
- **Stats:** cost per climb, total spent, visits per gym or month, entries wasted to expiry.
- **Multiple currencies**, including conversion of existing amounts when the currency changes.
- **Suggested prices and validity periods** for built-in gym pass options.
- **Sharing with friends:** a read-only link, or sharing a pass across accounts.
- **Languages** other than English.
- **App store release** by wrapping the PWA with Capacitor.
- **Home-screen widgets** and quick actions (e.g. "Use 1 at Boulder Planet").
- **Ways to make money** (no decisions made): premium stats, gym partnerships or promotions, optional supporter tier. Core tracking and sync stay free.
- **Privacy-friendly usage analytics**, if hosting allows it later.

## 15. Open questions

1. **Gym data review schedule:** how often the product owner checks the built-in gym names and pass options after launch (D22). To be planned later; it does not block development.
