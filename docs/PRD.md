# Climb Pass Tracker — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v2.1 — single-screen redesign, with monthly-allowance memberships, for review |
| **Date** | 2026-10-02 |
| **Product** | Climb Pass Tracker |
| **Platform** | Progressive Web App (PWA), phone-first |
| **Market** | Singapore climbing gyms at launch, usable anywhere |

---

## What changed in v2.0

v1.x described a dashboard of cards grouped by gym, plus separate Gyms and History screens and a three-step "add pass" flow. The intended product is simpler: **one main screen that is a list of rows**, one row per pass, where everything happens in place.

- **One screen.** The main screen is the whole app. Settings is reached from a gear icon. There is no Gyms screen, no History screen and no bottom tab bar (D23).
- **Rows, not groups.** A row is `Gym | Type | Expiry | Left`. The same gym can appear in many rows, for example two separate multipasses (D23).
- **Gyms are typed, not managed.** The first column is a text box with autocomplete. A name that matches no gym is saved as a new gym automatically (D24).
- **A plain counter.** `−` uses an entry and `+` gives one back (D25). Individual uses are recorded silently but never shown (D26).
- **Monthly memberships.** A membership can have a monthly allowance of entries that resets every month, on a day the user can change (D32–D34).
- **Removed:** pass templates and pass options, per-use history and backdating, the use Undo toast, hiding gyms, the gym list screen, pass names and billing periods.

Requirement (FR) and decision (D) numbers are kept stable so references elsewhere stay valid. Anything replaced is marked **Superseded** or **Removed** where it stands.

---

## 1. Overview

Climbers in Singapore usually buy **shareable multipasses** (for example, 10 entries for a fixed price) from one or more gyms. These expire after a set time, usually 6 or 12 months. Climbers often hold several passes at the same gym or at different gyms and use them for friends too. That makes it easy to lose count of how many entries are left and when each pack expires, so passes go unused and money is wasted.

**Climb Pass Tracker** is a simple, offline-capable web app. Its main screen is a list of the passes a climber owns, one per row, each with a counter for entries left and an expiry date, plus reminders before entries are wasted.

## 2. Goals and non-goals

### Goals (v1)
1. Use a pass entry in **one tap** on the main screen while standing at the gym counter, even with no internet.
2. See at a glance how many entries are left and when each pass expires, across all gyms, in one list.
3. Warn users before passes expire with entries left, and when a pass is nearly used up.
4. Work fully **without an account**, with optional Google sign-in to sync across devices.
5. Add a pass in seconds by typing: the gym name autocompletes from a built-in list of Singapore gyms.

### Non-goals (v1)
- Tracking *who* used each entry (friends' names are deliberately not recorded).
- Showing or editing a history of individual uses (taps are recorded silently, D26).
- A separate screen for managing gyms, pass templates or built-in "pass options".
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
| **Pass owner** (primary) | Climbs 1–3 times a week. Holds passes at 1–3 gyms, sometimes several packs at the same gym. Often brings friends who use their passes. | Know what's left and don't let entries expire. |
| **Gym hopper** | Climbs at many gyms and buys a pack wherever they go. | One list of every pass and its expiry. |
| **Member** | Has a monthly or yearly membership, plus the occasional pass elsewhere. | Renewal reminders. |

Friends who use the owner's passes are **not** users of the app. The owner taps `−` once per entry used.

## 4. Key decisions (from discovery)

Status column: **Active**, **Updated** (still applies, reworded for v2.0) or **Superseded** (replaced by the decision named).

| # | Topic | Decision | Status |
|---|---|---|---|
| D1 | Platform | PWA, phone-first. Works in desktop browsers too. | Active |
| D2 | Accounts | No account needed. Optional **Google sign-in** for syncing. | Active |
| D3 | Using entries | **One tap = one entry.** For 3 climbers, tap `−` 3 times. | Active |
| D4 | Who used it | **Not tracked.** No names. | Active |
| D5 | Editing uses | Uses can be edited, deleted and backdated. | **Superseded** by D25 and D26 |
| D6 | Several passes at one gym | Pre-select the soonest-expiring pass. | **Superseded**: every row has its own counter (D23) |
| D7 | Validity | Counts from the **purchase date**. The user enters the expiry date; the app does not suggest one. Quick buttons (+6 months, +12 months from the purchase date) are provided for convenience. | Active |
| D8 | After expiry | Shown in the Finished section as "Expired – X unused" and kept. The expiry date stays editable, to record extensions. | Updated (D27) |
| D9 | Reminders | Expiring soon **and** low entries. In-app banners in v1, push notifications later. | Active |
| D10 | Gym granularity | Tracked **per brand**. If an outlet has different pricing, the user types it as a separate gym name. | Active |
| D11 | Built-in gym data | **Gym names only** (no pass options, prices or validity periods). Stored in the backend database in milestone 2 so names can be updated without releasing a new app version. | Updated |
| D12 | User-added gyms | Created automatically when a new name is typed (D24). Visible only to the user who added them. Suggesting them for the built-in list is a future enhancement. | Updated |
| D13 | First sign-in | Data already on the device is **merged** into the account. | Active |
| D14 | Sign-out | Data is **cleared** from the device, since it is safe in the account. | Active |
| D15 | Privacy | Data export (CSV) and account deletion are included. | Active |
| D16 | Pass types | **Multipass**, **Class / course pack** (behaves like a multipass), **Membership** (unlimited, or with a monthly allowance of entries, D32), **Single entry** (a pass with exactly 1 entry, D28). | Updated |
| D17 | Language | English only. | Active |
| D18 | Currency | **SGD only** in v1. There is no currency setting. | Active |
| D19 | Analytics | None in v1, to keep the free database tier small. | Active |
| D20 | Monetization | Core tracking and sync stay free. Ways to make money are listed as future ideas only. | Active |
| D21 | Hosting | **Netlify** free plan, which allows commercial use. Launch on the free `.netlify.app` address. | Active |
| D22 | Gym data upkeep | The product owner checks the built-in gym names. How often is still to be decided. | Updated |
| D23 | Layout | **One main screen** of rows, `Gym \| Type \| Expiry \| Left`, not grouped by gym. Settings is reached from a **gear icon in the header**. No bottom tab bar (a two-item bar would waste space on a data-dense screen), no Gyms screen, no History screen. | New |
| D24 | Entering a gym | The first column is a text box with an autocomplete dropdown of existing gyms (built-in and the user's own). Typing a name that matches no gym saves it as a new gym. | New |
| D25 | Counter | `−` uses one entry. `+` gives one back. The counter stays between 0 and the total entered when the row was created (for a monthly membership, between 0 and the monthly allowance). | New |
| D26 | Use records | Each `−` is recorded silently with its timestamp, which keeps `+` (undo) working and leaves room for stats later. No screen shows these records in v1. | New |
| D27 | Finished passes | Used-up and expired passes move to a collapsed **Finished** section at the bottom, where they can be deleted. | New |
| D28 | Membership and single entry | A membership shows "Unlimited" unless it has a monthly allowance (D32). A single entry is a 1-entry pass. | New |
| D29 | Adding a row | An always-visible blank row at the bottom. It saves itself once every required cell is valid and the user leaves the row (or presses Enter). | New |
| D30 | Extra fields | Price paid, purchase date, "already used" and comments live in a section that opens when a row is tapped. | New |
| D31 | Order | Rows are sorted by soonest expiry first. Passes with no expiry come last. | New |
| D32 | Monthly memberships | A membership has an optional **entries per month**. Left blank it is unlimited. With a number it has a counter for the current month that returns to the full allowance at each reset. Unused entries do **not** roll over. A freeze moves only the end date, not the reset day. | New |
| D33 | Reset day | The count resets on the same day of the month as the purchase (start) date. The user can change that day. A day the month doesn't have (such as the 31st in April) means the last day of that month. | New |
| D34 | Reset reminder | A banner 3 days before a reset when entries are left (the shortest of the reminder windows, so it follows the Settings value). It has its own on/off switch. The "low entries" banner and badge don't apply to monthly memberships, because they would appear every month. | New |

## 5. Pass types

| Type | "Left" column | Expiry | `−` does | Finished when |
|---|---|---|---|---|
| **Multipass** | `7 / 10` with `−` and `+` | Required | Uses one entry | 0 left, or past the expiry date |
| **Class / course pack** | `3 / 4` with `−` and `+` (sessions) | Required | Uses one session | 0 left, or past the expiry date |
| **Membership** (unlimited) | "Unlimited", no controls | Required (the end date; freezes push it back) | — | Past the (freeze-extended) end date |
| **Membership with monthly entries** | `5 / 8` with `−` and `+`, and "resets 15 Nov" | Required (the end date; freezes push it back) | Uses one of this month's entries | Past the (freeze-extended) end date. Reaching 0 does **not** finish it: the count returns at the next reset |
| **Single entry** | `1 / 1` with `−` and `+` | Optional | Uses it | 0 left, or past the expiry date if there is one |

Class packs behave exactly like multipasses with a different label. A pass is usable through the whole of its expiry date.

A membership's monthly allowance runs in periods. Each period starts on a reset day and lasts until the next one. The first period starts on the purchase date and gets the full allowance, even if it is shorter than a month.

## 6. Functional requirements

Priority: **P0** = must have for launch, **P1** = should have for launch, **P2** = nice to have.

### 6.1 Main screen
- **FR-1 (P0)** The main screen is a list of rows, one per active pass, with the columns **Gym | Type | Expiry | Left**. Rows are not grouped by gym, and the same gym can appear in many rows. Sorted by soonest expiry first (D31).
- **FR-2 (P0)** A multipass, class-pack or single-entry row shows entries left with the total (`7 / 10`), the expiry date, and the days left in small text. A membership with a monthly allowance shows this month's entries left (`5 / 8`) and the date it next resets.
- **FR-3 (P0)** A membership without a monthly allowance shows "Unlimited", the end date and the days left.
- **FR-4 (P0)** Counted rows and memberships with a monthly allowance have large `−` and `+` buttons (at least 44 px tap targets). See 6.2.
- **FR-5** **Removed.** There is no Undo toast: `+` is the undo (D25).
- **FR-6 (P0)** Each row shows its status where it applies: *Expiring soon*, *Low* (not for monthly memberships, D34), *Frozen*. Finished rows show *Used up* or *Expired – X unused*.
- **FR-7 (P0)** Reminder banners at the top of the list (see 6.6).
- **FR-8 (P0)** Empty state: only the blank add row, with a prompt such as "Type a gym to add your first pass".
- **FR-50 (P0)** **Finished section:** a collapsed "Finished (n)" section at the bottom lists used-up and expired passes in the same columns, newest expiry first. Their counters are inert, except that `+` on a used-up row gives the last entry back, to undo a mis-tap (FR-52). Each can be deleted (FR-19), and editing the expiry date to a later date moves the row back up (D8, D27).
- **FR-51 (P0)** A gear icon in the header opens Settings. There is no other screen and no bottom tab bar (D23).
- **FR-56 (P0)** Tapping a row (outside its buttons and cells) opens its details section (see 6.3).

### 6.2 Counter
- **FR-9 (P0)** `−` uses one entry immediately, with no confirmation.
- **FR-10** **Removed.** Every row has its own counter (D6 superseded).
- **FR-11 (P0)** `−` is disabled when 0 entries are left. The row then moves to Finished. A monthly membership is the exception: at 0 it stays in the main list with `−` disabled until the next reset (FR-57).
- **FR-12 (P0)** A pass is usable through the whole of its expiry date. After that its row is Finished and the counter does nothing; editing the expiry date to a later date brings it back.
- **FR-13** **Removed.** There is no adding, changing or deleting of individual past uses.
- **FR-14 (P0)** Each `−` silently records a use: the timestamp only. No names and no notes are stored (D4, D26).
- **FR-52 (P0)** `+` gives one entry back by removing the most recent recorded use. If no use is recorded (for example the pass was entered with some entries already used), it lowers the "already used" count instead. `+` is disabled when all entries are available. For a monthly membership it removes the latest use in the current period, and is disabled when nothing was used this period.
- **FR-57 (P0)** **Monthly allowance (D32):** a membership may have *entries per month*. Its counter shows this month's entries left out of that allowance, and the date of the next reset. `−` and `+` work as above. At each reset the count returns to the full allowance and unused entries are lost.
- **FR-58 (P0)** **Reset day (D33):** the day of the month the count resets. It defaults to the day of the purchase date and can be changed in the details section (1 to 31). In a month without that day the reset happens on the month's last day. Changing the reset day or the allowance recalculates the current count straight away from the recorded uses.

### 6.3 Adding and editing rows
- **FR-15 (P0)** **Add a row:** the blank row at the bottom of the list is always visible. Its cells are Gym (autocomplete text box, FR-53), Type (default Multipass), Entries (counted types; a single entry is fixed at 1; for a membership it is the optional *entries per month*, left blank for unlimited) and Expiry.
- **FR-16** **Removed.** There are no pass templates (D11, D30).
- **FR-17 (P0)** Fields. In the row: gym, type, entries (the total), expiry (with +6 / +12 month quick buttons that count from the purchase date, D7). In the details section: purchase date (defaults to today; a membership's start date), price paid in S$ (optional), "already used" (entries used before the pass was added to the app), and comments (optional free text, up to 500 characters, for the user's own reference). For a membership with a monthly allowance: the reset day (FR-58), and "already used this month" in place of "already used".
- **FR-18 (P0)** Every field can be edited later: the row's cells directly, the rest in the details section.
- **FR-19 (P0)** **Delete a row** from its details section, with confirmation. This also removes its recorded uses and freezes.
- **FR-20 (P1)** **Freeze** a membership: in the details section enter a start and end date. The end date is pushed back by the freeze length. Several freezes are allowed, and each can be edited or removed. A freeze moves only the end date; the monthly reset day is not affected (D32).
- **FR-21 (P1)** **Buy again** (details section): create a new row with the same gym, type, entries and price, leaving the expiry empty.
- **FR-22 (P0)** Validation, reporting every problem at once: entries (or entries per month) between 1 and 1000, reset day between 1 and 31, expiry not before the purchase date, "already used" not more than the total.
- **FR-54 (P0)** **A new row saves itself** once every required cell is valid and focus leaves the row (or Enter is pressed). Until then nothing is saved, and the cells that are missing or invalid say so. Afterwards the blank row is empty again, ready for the next pass (D29).

### 6.4 Gyms
- **FR-23 (P0)** The built-in gym names are bundled with the app in milestone 1. In milestone 2 they load from the backend and are cached on the device so autocomplete works offline.
- **FR-24 (P0)** A built-in gym has a name only (D11).
- **FR-25 (P0)** Typing a name that matches no existing gym saves it as a new gym for that user (spaces trimmed and collapsed). It is private to the user and appears in autocomplete from then on (D12, D24).
- **FR-26** **Removed.** There is no hiding of gyms.
- **FR-27** **Removed.** There is no gym list screen.
- **FR-53 (P0)** **Gym autocomplete:** as the user types, a dropdown lists matching gyms (built-in and their own), ignoring case and punctuation and matching on words, so "boulder+" finds "Boulder+" and "plan" finds "Boulder Planet". Choosing a match fills the cell. If the typed text equals an existing gym name (ignoring case and punctuation) that gym is used, so no duplicate is created. If nothing matches, the dropdown shows "Add “text” as a new gym". Items are at least 44 px tall and usable by keyboard.

### 6.5 Finished passes
- **FR-28** **Removed.** There is no per-pass use history screen.
- **FR-29** **Removed.** The Finished section (FR-50) replaces the History screen.
- **FR-30 (P1)** Each expired pass in Finished shows how many entries went unused.

### 6.6 Reminders (in-app, v1)
- **FR-31 (P0)** **Expiring soon:** show a banner when a counted pass with entries left, or a membership, is within the reminder windows. Defaults: **14 days** and **3 days** before expiry.
- **FR-32 (P0)** **Low entries:** show a banner when a counted pass has **2 or fewer** entries left. This does not apply to memberships with a monthly allowance (D34) or to a single entry, which only ever has one.
- **FR-33 (P0)** Users can change both thresholds in Settings, or turn each reminder type off (expiring soon, low entries, monthly reset).
- **FR-34 (P1)** Banners can be dismissed. A dismissed banner reappears when the pass reaches the next reminder window.
- **FR-35 (P2)** An app icon badge with the number of active reminders, using the Badging API where supported.
- **FR-55 (P0)** The row a banner is about is highlighted, so the warning and the pass are easy to match.
- **FR-59 (P0)** **Monthly reset reminder (D34):** show a banner when a membership with a monthly allowance has entries left and its next reset is within the shortest reminder window (default 3 days), for example "Climb Central: 3 entries reset in 3 days". A dismissed banner stays hidden until the next reset.

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
- **FR-45 (P0)** **Export data** as CSV (passes and recorded uses). Available with or without an account.
- **FR-46 (P0)** **Delete account:** permanently deletes all of the user's data from the server and signs them out, with confirmation.
- **FR-47 (P1)** **Delete all local data** for users without an account.
- **FR-48 (P0)** Links to the privacy policy and terms, plus the app version.
- **FR-49 (P1)** "Install app" prompt with instructions for adding it to the home screen on iOS and Android.

## 7. Data model (logical)

All user-owned records use client-generated UUIDs plus `created_at`, `updated_at`, and `deleted_at` (deletions are flagged rather than erased, so they can sync). Amounts are stored as whole cents in SGD.

```
Gym (built-in, read-only to users)
  id, name, is_active, sort_order

UserGym (created by typing a new name; private)
  id, user_id, name

Pass (one row on the main screen)
  id, user_id?, gym_ref (built-in or user gym), pass_type
  purchase_date            -- defaults to today; a membership's start date
  expiry_date              -- the Expiry column. A membership's base end date
                              before freezes. Optional for single_entry only
  price?, comments?
  -- multipass, class_pack, single_entry (total fixed at 1)
  total_entries, initial_used
  -- membership only
  monthly_entries?         -- entries per month; absent = unlimited
  reset_day?               -- 1-31, the day of the month the count resets.
                              Defaults to the day of purchase_date

Freeze (memberships only)
  id, pass_id, start_date, end_date

Use (recorded silently on every "−"; never shown in v1)
  id, pass_id, used_at

Settings
  user_id?, expiry_reminder_days [14, 3],
  low_entries_threshold 2, reminders_enabled flags, dismissed_banners
```

**Derived values (calculated, not stored):**
- `entries_left = total_entries − initial_used − count(uses not deleted)`, never below 0
- `effective_end_date = expiry_date + sum(freeze lengths)` for a membership
- for a monthly membership, the current period runs from the latest reset date on or before today (or the purchase date, if there is none yet) to the next reset date, and `entries_left = monthly_entries − count(uses in the current period)`, never below 0
- `status` and "Finished" are worked out from entries left, today's date, expiry, and any freezes.

**Gone since v1.x:** GymTemplate, UserTemplate, HiddenGym, the pass name, the membership billing period, the separate single-entry visit date, and the note on a use.

## 8. Key user flows

1. **First launch:** an empty list and a blank row. Type "Fit" → pick "Fit Bloc" from the dropdown → leave Type as Multipass → enter 10 entries → pick an expiry (+6 months) → press Enter → the row appears. No sign-up wall.
2. **At the gym with 2 friends:** open the app → tap `−` three times on the right row → the counter drops from 7 to 4.
3. **Mistake:** tap `+` to give an entry back.
4. **Two packs at the same gym:** two separate rows, each with its own expiry and counter.
5. **Gym not in the list:** type its name and finish the row; it is saved as your gym and shows up in autocomplete next time.
6. **Expiry warning:** a banner at the top says "Boulder Planet 10-pass expires in 14 days — 4 entries left", and that row is highlighted.
7. **Pass runs out or expires:** the row moves to the collapsed Finished section.
8. **Monthly membership:** type a gym, choose Membership, enter 8 entries per month and the end date. The row shows `8 / 8`, "resets 15 Nov" (the purchase date's day). Tap `−` at the gym; at `0 / 8` the button is disabled until 15 Nov, when it shows `8 / 8` again. Three days before, a banner warns if entries are left.
9. **Second device:** Settings → Sign in with Google → local data merged → sign in on another device → same list.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Offline** | Every core flow (view, use, add, edit) works with no network. The app shell and gym list are cached by a service worker. |
| **Performance** | The main screen is usable within 2 s on a mid-range phone over 4G on first load, and within 1 s on repeat visits. Logging a use responds instantly. |
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

The built-in list holds **gym names only**. It covers the main Singapore climbing gym brands. Example brands include Boulder Planet, Boulder+, Fit Bloc, Climb Central, BFF Climb, Lighthouse Climbing, Ark Bloc, Z-Vertigo, and others.

**Before launch, every gym name must be checked** against the gym's current website or front desk. This is tracked as a launch task. No pass options, prices or validity periods are included in v1 (D11).

## 12. Release plan

| Milestone | Scope |
|---|---|
| **M1 — Core, on-device only** | The main screen: rows, sorting, status and reminder highlights, counter with `−` / `+` (including memberships with a monthly allowance), the blank add row with gym autocomplete (built-in names bundled with the app), tap-to-open details, delete, the Finished section, reminder banners, Settings (reminder thresholds, CSV export, delete local data, install instructions), PWA install and offline support. |
| **M2 — Accounts and sync** | Supabase setup, Google sign-in, built-in gym names moved to the database, merge on first sign-in, background sync, sign-out clearing, account deletion. |
| **M3 — Launch polish** | Verified gym names, membership freezes, buy again, privacy policy and terms, accessibility pass, end-to-end tests, production deploy. |

## 13. Success measures

There are no analytics in v1, so success is judged by:
- Number of signed-in accounts (from the auth provider's own user count).
- Direct feedback from the climbing community (e.g. a feedback link in Settings).
- Being able to complete the core flows offline without errors (the end-to-end tests pass).

## 14. Future enhancements (out of scope for v1)

- **Push notifications** for expiry and low-entry reminders.
- **Manage my gyms** (rename a gym everywhere, merge duplicates, forget a gym) from Settings. In v1 a gym is fixed by whatever was typed into a row.
- **Gym suggestions:** users submit gyms they added to be considered for the built-in list.
- **Use history and stats:** the silently recorded uses (D26) can drive cost per climb, total spent, visits per gym or month, and entries wasted to expiry, with backdating and editing of past uses.
- **Type a number straight into the counter** to set entries left.
- **Roll-over of unused monthly entries**, and a record of entries lost at each reset, if gyms offer it.
- **Multiple currencies**, including conversion of existing amounts when the currency changes.
- **Suggested prices and validity periods** for built-in gyms.
- **Sharing with friends:** a read-only link, or sharing a pass across accounts.
- **Languages** other than English.
- **App store release** by wrapping the PWA with Capacitor.
- **Home-screen widgets** and quick actions (e.g. "Use one entry at Boulder Planet").
- **Ways to make money** (no decisions made): premium stats, gym partnerships or promotions, optional supporter tier. Core tracking and sync stay free.
- **Privacy-friendly usage analytics**, if hosting allows it later.

## 15. Open questions

1. **Phone layout of the four columns:** *resolved in step 1.6.* The four columns are kept. On a phone (under 640 px) each row wraps onto two lines: gym and count on the first, type and expiry on the second, with status badges below. From 640 px wide it is a table with the column headings Gym, Type, Expiry, Left. The `−` / `+` buttons (step 1.7) go around the count in the Left column.
2. **Gym name review schedule:** how often the product owner checks the built-in gym names after launch (D22). To be planned later; it does not block development.
