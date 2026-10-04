# Climb Pass Tracker — Product Requirements Document

| | |
|---|---|
| **Status** | Draft v2.4 — single-screen, local-only (no accounts), moves between devices with a backup file |
| **Date** | 2026-10-02 |
| **Product** | Climb Pass Tracker |
| **Platform** | Progressive Web App (PWA), phone-first |
| **Market** | Singapore climbing gyms at launch, usable anywhere |

---

## What changed in v2.4

**No accounts, no server, no sync (D37).** Earlier versions planned an optional Google sign-in that synced passes between devices. That is dropped to keep the app simple: everything stays in the browser on the device. To move to a new phone, or to keep a copy, a person downloads a **backup file** and opens it in the app on the other device (FR-62 to FR-66). Opening a backup adds to what is already on the device and never deletes anything of the device's own (D38). The built-in gym names are bundled with the app and update when the app updates (D11).

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
4. Keep everything on the device (no account, no server), and let a person **move to another device with a backup file**.
5. Add a pass in seconds by typing: the gym name autocompletes from a built-in list of Singapore gyms.

### Non-goals (v1)
- Tracking *who* used each entry (friends' names are deliberately not recorded).
- Showing or editing a history of individual uses (taps are recorded silently, D26).
- A separate screen for managing gyms, pass templates or built-in "pass options".
- Currencies other than SGD.
- Suggested prices or validity periods for gyms (users enter their own).
- Shared or collaborative passes between multiple people.
- Accounts, sign-in, or syncing between devices (D37). A backup file moves data by hand.
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
| D2 | Accounts | ~~No account needed. Optional Google sign-in for syncing.~~ **No accounts at all** (D37). | **Superseded** by D37 |
| D3 | Using entries | **One tap = one entry.** For 3 climbers, tap `−` 3 times. | Active |
| D4 | Who used it | **Not tracked.** No names. | Active |
| D5 | Editing uses | Uses can be edited, deleted and backdated. | **Superseded** by D25 and D26 |
| D6 | Several passes at one gym | Pre-select the soonest-expiring pass. | **Superseded**: every row has its own counter (D23) |
| D7 | Validity | Counts from the **purchase date**. The user enters the expiry date; the app does not suggest one. Quick buttons (+6 months, +12 months from the purchase date) are provided for convenience. | Active |
| D8 | After expiry | Shown in the Finished section as "Expired – X unused" and kept. The expiry date stays editable, to record extensions. | Updated (D27) |
| D9 | Reminders | Expiring soon **and** low entries. In-app banners in v1, push notifications later. | Active |
| D10 | Gym granularity | Tracked **per brand**. If an outlet has different pricing, the user types it as a separate gym name. | Active |
| D11 | Built-in gym data | **Gym names only** (no pass options, prices or validity periods). Bundled with the app, so names change when the app is updated. | Updated |
| D12 | User-added gyms | Created automatically when a new name is typed (D24). Visible only to the user who added them. Suggesting them for the built-in list is a future enhancement. | Updated |
| D13 | First sign-in | ~~Data already on the device is merged into the account.~~ There is no sign-in (D37). | **Removed** |
| D14 | Sign-out | ~~Data is cleared from the device.~~ There is no sign-out (D37). | **Removed** |
| D15 | Privacy | Data export is included, as a backup file (FR-62). A CSV export for spreadsheets was dropped (FR-45). The account deletion part is gone with the accounts (D37). | Updated |
| D16 | Pass types | **Multipass**, **Class / course pack** (behaves like a multipass), **Membership** (unlimited, or with a monthly allowance of entries, D32), **Single entry** (a pass with exactly 1 entry, D28). | Updated |
| D17 | Language | English only. | Active |
| D18 | Currency | **SGD only** in v1. There is no currency setting. | Active |
| D19 | Analytics | None in v1, to keep the free database tier small. | Active |
| D20 | Monetization | Core tracking stays free. Ways to make money are listed as future ideas only. | Active |
| D21 | Hosting | **Netlify** free plan, which allows commercial use. Launch on the free `.netlify.app` address. | Active |
| D22 | Gym data upkeep | The product owner checks the built-in gym names. How often is still to be decided. | Updated |
| D23 | Layout | **One main screen** of rows, `Gym \| Type \| Expiry \| Left`, not grouped by gym. Settings is reached from a **gear icon in the header**. No bottom tab bar (a two-item bar would waste space on a data-dense screen), no Gyms screen, no History screen. | New |
| D24 | Entering a gym | The first column is a text box with an autocomplete dropdown of existing gyms (built-in and the user's own). Typing a name that matches no gym saves it as a new gym. | New |
| D25 | Counter | `−` uses one entry. `+` gives one back. The counter stays between 0 and the total entered when the row was created (for a monthly membership, between 0 and the monthly allowance). | New |
| D26 | Use records | Each `−` is recorded silently with its timestamp, which keeps `+` (undo) working and leaves room for stats later. No screen shows these records in v1. | New |
| D27 | Finished passes | Used-up and expired passes move to a collapsed **Finished** section at the bottom, where they can be deleted. | New |
| D28 | Membership and single entry | A membership shows "Unlimited" unless it has a monthly allowance (D32). A single entry is a 1-entry pass. | New |
| D29 | Adding a row | A blank row at the bottom (hidden behind a button once there is a pass, D39). It saves itself once every required cell is valid and the user leaves the row (or presses Enter). | New |
| D30 | Extra fields | Price paid, purchase date, "already used" and comments live in a section that opens when a row is tapped. | New |
| D31 | Order | Rows are sorted by soonest expiry first. Passes with no expiry come last. | New |
| D32 | Monthly memberships | A membership has an optional **entries per month**. Left blank it is unlimited. With a number it has a counter for the current month that returns to the full allowance at each reset. Unused entries do **not** roll over. A freeze moves only the end date, not the reset day. | New |
| D33 | Reset day | The count resets on the same day of the month as the purchase (start) date. The user can change that day. A day the month doesn't have (such as the 31st in April) means the last day of that month. | New |
| D34 | Reset reminder | A banner 3 days before a reset when entries are left (the shortest of the reminder windows, so it follows the Settings value). It has its own on/off switch. The "low entries" banner and badge don't apply to monthly memberships, because they would appear every month. | New |
| D35 | Moved-to-Finished notice | When `−` uses the last entry of a pass and its row leaves the main list, a short notice at the bottom says where it went, with an Undo button that gives the entry back (the same as `+` in Finished). It narrows the removal of the Undo toast (FR-5): only this one case, because the row disappearing and the next row taking its place is confusing. | New |
| D36 | Editing | Tapping a row opens a panel under it with every field, including the gym, type, entries and expiry. The row's own cells stay read-only. The panel saves itself under the same rule as a new row (D29). | New |
| D37 | No accounts, no sync | The app has no accounts, no sign-in and no server. All data is saved in the browser on the device. Moving to another device is done by hand with a **backup file** (export and import). This replaces the Google sign-in and sync that earlier versions planned (D2, D13, D14). | New |
| D38 | Opening a backup | Opening a backup file **adds** to what the device already has. Rows are matched by id and the newer edit wins; nothing on the device is deleted, except a pass the backup says was deleted *later* than the device last changed it. A gym with the same name (ignoring case and punctuation) as one already here is the same gym, so no copy is made. Opening the same file twice changes nothing the second time. A file that is not a valid backup, or that is from a newer version of the app, is refused whole with a message, and nothing is changed. | New |
| D39 | Add a pass button | The blank row is shown only while there are **no active passes** (a list with only Finished passes counts as none). Once there is at least one, it is replaced by an **Add a pass** button; the button opens the row with the cursor in the Gym cell, and a **Close** button hides it again. After a pass is saved the row hides again. This keeps the main screen clean. | New |
| D40 | Install and data safety | Most people use an iPhone, where Safari clears a website's data after about a week without a visit, while an app on the home screen is not cleaned up. So the app (1) asks once, from the very first visit (before any pass, because on an iPhone the installed app does not see what was saved in a Safari tab), to be added to the home screen (iPhone: the three steps, since Apple allows no install button; Android and desktop Chrome: an Install button), staying away for good after "Not now", and (2) shows in Settings whether the data is safe: installed, kept by the browser, or at risk (with the steps and a reminder to download a backup file). It never nags: none in the installed app, none after "Not now". | New |

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
- **FR-5** **Removed.** There is no general Undo toast: `+` is the undo (D25). The one exception is FR-60.
- **FR-6 (P0)** Each row shows its status where it applies: *Expiring soon*, *Low* (not for monthly memberships, D34), *Frozen*. Finished rows show *Used up* or *Expired – X unused*.
- **FR-7 (P0)** Reminder banners at the top of the list, one per pass (see 6.6): a pass that is both expiring and low says so in one banner.
- **FR-8 (P0)** Empty state: only the blank add row, with a prompt such as "Type a gym to add your first pass".
- **FR-50 (P0)** **Finished section:** a collapsed "Finished (n)" section at the bottom lists used-up and expired passes in the same columns, newest expiry first. Their counters are inert, except that `+` on a used-up row gives the last entry back, to undo a mis-tap (FR-52). Each can be deleted (FR-19), and editing the expiry date to a later date moves the row back up (D8, D27).
- **FR-51 (P0)** A gear icon in the header opens Settings. There is no other screen and no bottom tab bar (D23).
- **FR-56 (P0)** Tapping a row (outside its buttons) opens its details panel (see 6.3, D36). The gym name is also a button that opens and closes it, for keyboard and screen-reader users. Only one panel is open at a time.

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
- **FR-15 (P0)** **Add a row:** the blank row at the bottom of the list is shown while there are no active passes; once there is one it is replaced by an **Add a pass** button that opens the row (D39). Its cells are Gym (autocomplete text box, FR-53), Type (default Multipass), Entries (counted types; a single entry is fixed at 1; for a membership it is the optional *entries per month*, left blank for unlimited) and Expiry.
- **FR-16** **Removed.** There are no pass templates (D11, D30).
- **FR-17 (P0)** Fields. In the row: gym, type, entries (the total), expiry (with +6 / +12 month quick buttons that count from the purchase date, D7). In the details section: purchase date (defaults to today; a membership's start date), price paid in S$ (optional), "already used" (entries used before the pass was added to the app), and comments (optional free text, up to 500 characters, for the user's own reference). For a membership with a monthly allowance: the reset day (FR-58), and "already used this month" in place of "already used".
- **FR-18 (P0)** Every field can be edited later in the details panel (D36): gym, type, entries, expiry, purchase date, price, already used, comments, and for a monthly membership the reset day and the entries already used this month. The panel saves itself when every field is valid and focus leaves it, or on Enter. Nothing half-finished is saved; every problem is listed at once; Close drops an invalid edit. Changing the type clears entries whose meaning changes (entries versus entries per month).
- **FR-19 (P0)** **Delete a row** from its details section, with confirmation. This also removes its recorded uses and freezes.
- **FR-20 (P1)** **Freeze** a membership: in the details section enter a start and end date. The end date is pushed back by the freeze length. Several freezes are allowed, and each can be edited or removed. A freeze moves only the end date; the monthly reset day is not affected (D32).
- **FR-21 (P1)** **Buy again** (details section): create a new row with the same gym, type, entries and price, leaving the expiry empty.
- **FR-22 (P0)** Validation, reporting every problem at once: entries (or entries per month) between 1 and 1000, reset day between 1 and 31, expiry not before the purchase date, "already used" not more than the total.
- **FR-54 (P0)** **A new row saves itself** once every required cell is valid and focus leaves the row (or Enter is pressed). Until then nothing is saved, and the cells that are missing or invalid say so. Afterwards the blank row hides behind the **Add a pass** button again (D29, D39).

### 6.4 Gyms
- **FR-23 (P0)** The built-in gym names are bundled with the app, so autocomplete works offline. They change when the app is updated.
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
- **FR-34 (P1)** Banners can be dismissed. Dismissing a banner dismisses everything it says. A dismissed reminder reappears when the pass reaches the next reminder window or has fewer entries left than when it was dismissed.
- **FR-35 (P2)** An app icon badge with the number of active reminders, using the Badging API where supported.
- **FR-55 (P0)** The row a banner is about is highlighted, so the warning and the pass are easy to match.
- **FR-59 (P0)** **Monthly reset reminder (D34):** show a banner when a membership with a monthly allowance has entries left and its next reset is within the shortest reminder window (default 3 days), for example "Climb Central: 3 entries reset in 3 days". A dismissed banner stays hidden until the next reset.
- **FR-60 (P0)** **Moved to Finished notice (D35):** when `−` uses the last entry of a counted pass or a single entry, a notice at the bottom of the screen reads "<gym>, <type> moved to Finished" with an **Undo** button. Undo gives the entry back. The notice goes away after 8 seconds (it waits only while a button in it has keyboard focus, never for the mouse pointer or a tap, which would hold it on screen), when the entry is given back some other way, or when a newer notice replaces it. A monthly membership never shows it, because it stays in the main list at 0. The page leaves room to scroll the last rows above it.
- **FR-61 (P2)** **Row motion (M3):** when a row moves to or from Finished, it slides out to the side while the rows below move up, and the reverse when it comes back. Skipped when the device's reduced-motion setting is on.

### 6.7 Data on the device, and moving it
- **FR-36 (P0)** The app works fully on the device with no account and no network. All data is stored on the device.
- **FR-37** **Removed.** There is no sign-in (D37).
- **FR-38** **Removed.** Replaced by opening a backup file (FR-64, D38).
- **FR-39** **Removed.** There is no sync (D37).
- **FR-40** **Removed.** The newer-edit-wins rule now applies when a backup is opened (D38).
- **FR-41** **Removed.** There is no sign-out (D37).
- **FR-42 (P0)** Settings tells the person, plainly, that their data lives **only on this device** (so clearing the app's data, changing phones or deleting the app loses it) and points them to the backup file (FR-62).
- **FR-62 (P0)** **Download a backup file** (Settings → Your data): one JSON file, named `climb-pass-tracker-backup-<date>.json`, holding everything the device has: the gyms the person added, every pass, freeze and recorded use (deleted ones too, so a deletion can travel), and the reminder settings. It is written on the device and goes nowhere by itself. Built-in gyms are not in it (every copy of the app has them).
- **FR-63** *Removed: a Share button did not work in Chrome on Android, and the person can send the downloaded file themselves.*
- **FR-64 (P0)** **Open a backup file:** the person picks a file. The app checks it completely first, then shows a preview of what it would add (new passes, passes updated, passes removed, recorded uses, gyms, reminder settings), and only changes anything when the person confirms. Cancel changes nothing. The merge rules are D38. The whole import is all-or-nothing.
- **FR-65 (P0)** A file that is not a backup, is damaged (the message names the first bad pass, use, freeze or gym), points at things it does not contain, is too big (over 20 MB), or comes from a newer version of the app is refused with a message that says why and that nothing was imported. A backup from the same or an older version is accepted. Fields a later version adds are ignored.
- **FR-66 (P0)** If everything in a backup is already on the device, the preview says so and offers nothing to add.

### 6.8 Settings and privacy
- **FR-43 (P0)** All amounts are entered and shown in SGD (S$). There is no currency setting (D18).
- **FR-44 (P0)** Reminder thresholds (see FR-33).
- **FR-45** **Removed.** A CSV export for spreadsheets was dropped to keep the app simple; the backup file (FR-62) is the way to take a copy.
- **FR-46** **Removed.** There are no accounts to delete (D37). Delete all local data is FR-47.
- **FR-47 (P1)** **Delete all local data** (Settings), with confirmation. It cannot be undone, so the text suggests downloading a backup file first.
- **FR-48 (P0)** Links to the privacy policy and terms, plus the app version.
- **FR-49 (P1)** **Add to home screen:** from the first visit, while the app is not installed, a dismissible card on the main screen says the app is designed to be installed and keeps the entries safely in the phone's storage, and shows the steps on an iPhone, or an **Install the app** button where the browser offers one (Chrome). **Not now** hides it for good. Not shown in the installed app. The steps stay in Settings (D40).
- **FR-67 (P1)** **Data status:** under Settings → Your data, one line says whether the browser can delete the passes: *installed*, *the browser has promised to keep the data*, or a warning (*could be erased by your browser*) with the steps and the Install button where available, and a pointer to the backup file (D40).

## 7. Data model (logical)

All user-owned records use client-generated UUIDs plus `created_at`, `updated_at`, and `deleted_at` (deletions are flagged rather than erased, so a backup file can carry them to another device). Amounts are stored as whole cents in SGD.

```
Gym (built-in, bundled with the app, read-only)
  id, name

UserGym (created by typing a new name)
  id, name

Pass (one row on the main screen)
  id, gym_ref (built-in or user gym), pass_type
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
  expiry_reminder_days [14, 3],
  low_entries_threshold 2, reminders_enabled flags, dismissed_banners
```

**Derived values (calculated, not stored):**
- `entries_left = total_entries − initial_used − count(uses not deleted)`, never below 0
- `effective_end_date = expiry_date + sum(freeze lengths)` for a membership
- for a monthly membership, the current period runs from the latest reset date on or before today (or the purchase date, if there is none yet) to the next reset date, and `entries_left = monthly_entries − count(uses in the current period)`, never below 0
- `status` and "Finished" are worked out from entries left, today's date, expiry, and any freezes.

**Backup file** (FR-62): `{ format: "climb-pass-tracker-backup", version: 1, exportedAt, userGyms, passes, uses, freezes, settings }`, the records above exactly as the device holds them, deleted ones included.

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
9. **New phone:** on the old phone, Settings → Download backup file → send the file to the new phone (message, email, AirDrop, cloud drive) → on the new phone, open the app → Settings → Open a backup file → check the preview → Add to this device → the same list, counts, expiry dates and gyms. If the new phone already has some passes, they stay.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Offline** | Every core flow (view, use, add, edit, download or open a backup file) works with no network. The app shell is cached by a service worker. |
| **Performance** | The main screen is usable within 2 s on a mid-range phone over 4G on first load, and within 1 s on repeat visits. Logging a use responds instantly. |
| **Installability** | Meets PWA install criteria (manifest, icons, service worker). Works in standalone mode on iOS Safari 16.4+ and Chrome on Android. |
| **Browsers** | Latest 2 versions of Safari (iOS/macOS), Chrome, Edge, and Firefox. |
| **Accessibility** | WCAG 2.1 AA: tap targets ≥ 44 px, sufficient contrast, screen-reader labels, works with large text. |
| **Theme** | Light and dark modes that follow the system setting. |
| **Security** | No accounts and no server: passes are only in the browser on the device, and in any backup file the person chooses to make. HTTPS only. Backup files are checked completely before they change anything. |
| **Privacy (PDPA)** | Nothing is collected: no accounts, no email, no analytics or tracking, no server that receives pass data. Data stays on the device unless the person exports it. Privacy policy published (it says this). Export and delete are in Settings. |
| **Cost** | Runs on free static hosting. There is no database and no analytics or log storage. |

## 10. Proposed technical approach

| Layer | Choice | Reason |
|---|---|---|
| Frontend | React + TypeScript + Vite | Widely used, fast, good PWA tooling. |
| Styling | Tailwind CSS | Quick to build a consistent, mobile-first UI. |
| PWA | `vite-plugin-pwa` (Workbox) | Service worker, offline caching, manifest. |
| Local storage | IndexedDB via Dexie | Reliable on-device storage with offline queries. |
| Backup file | A JSON file, checked with the same `zod` schemas as the forms, merged by row id and `updatedAt` | No server needed to move between devices (D37, D38). |
| Gym names | A bundled list (`src/data/gyms.ts`) | Works offline; updates with the app. |
| Hosting | Netlify, free plan (see 10.1) | HTTPS, CDN, preview deploys, deploys automatically from GitHub. |
| Testing | Vitest (unit), Playwright (end-to-end) | Covers the counting, expiry and backup-merge logic and the core flows, including moving data between two separate browser profiles. |

### 10.1 Hosting on Netlify

Netlify's free plan allows commercial use, so the app will not need to change host when it starts making money (D21). The app is a static Vite build (no server code), so Netlify only serves files.

- **Setup:** connect the GitHub repo in Netlify. Build command `npm run build`, publish directory `dist`. There are no environment variables or secrets.
- **Routing:** add a `netlify.toml` redirect that sends every path to `index.html` with status 200, so deep links work in a single-page app.
- **Service worker:** serve `sw.js` with `Cache-Control: no-cache` (set in `netlify.toml`) so users get app updates promptly.
- **Preview deploys:** each pull request gets its own preview URL for testing before merging.
- **Usage limits:** the free plan has monthly limits on bandwidth and builds. A small static app should stay well within them, but check the current limits before launch.
- **Address:** launch on the free `<site-name>.netlify.app` address (e.g. `climb-pass-tracker.netlify.app`, if available). A custom domain can be added later.

## 11. Seed gym data

The built-in list holds **gym names only**. It covers the main Singapore climbing gym brands. Example brands include Boulder Planet, Boulder+, Fit Bloc, Climb Central, BFF Climb, Lighthouse Climbing, Ark Bloc, Z-Vertigo, and others.

**Before launch, every gym name must be checked** against the gym's current website or front desk. This is tracked as a launch task. No pass options, prices or validity periods are included in v1 (D11).

## 12. Release plan

| Milestone | Scope |
|---|---|
| **M1 — Core, on-device only** | The main screen: rows, sorting, status and reminder highlights, counter with `−` / `+` (including memberships with a monthly allowance), the blank add row with gym autocomplete (built-in names bundled with the app), tap-to-open details, delete, the Finished section, reminder banners, Settings (reminder thresholds, delete local data, install instructions), PWA install and offline support. |
| **M2 — Move to another device** | Backup file: download, open with a preview and a merge that keeps what is already on the device (D37, D38). |
| **M3 — Launch polish** | Verified gym names, membership freezes, buy again, privacy policy and terms, accessibility pass, production deploy. |

## 13. Success measures

There are no analytics in v1, so success is judged by:
- Direct feedback from the climbing community (e.g. a feedback link in Settings).
- Being able to complete the core flows offline without errors (the end-to-end tests pass).
- Being able to move a full set of passes to another phone with a backup file (the end-to-end tests pass).

## 14. Future enhancements (out of scope for v1)

- **Push notifications** for expiry and low-entry reminders.
- **Manage my gyms** (rename a gym everywhere, merge duplicates, forget a gym) from Settings. In v1 a gym is fixed by whatever was typed into a row.
- **Gym suggestions:** users submit gyms they added to be considered for the built-in list.
- **Use history and stats:** the silently recorded uses (D26) can drive cost per climb, total spent, visits per gym or month, and entries wasted to expiry, with backdating and editing of past uses.
- **Type a number straight into the counter** to set entries left.
- **Roll-over of unused monthly entries**, and a record of entries lost at each reset, if gyms offer it.
- **Multiple currencies**, including conversion of existing amounts when the currency changes.
- **Suggested prices and validity periods** for built-in gyms.
- **Sharing with friends:** a read-only link, or sharing a pass with a friend's app.
- **Accounts and automatic sync between devices** (for example Google sign-in), if people ask for more than a backup file. v1 does not have them (D37).
- **Languages** other than English.
- **App store release** by wrapping the PWA with Capacitor.
- **Home-screen widgets** and quick actions (e.g. "Use one entry at Boulder Planet").
- **Ways to make money** (no decisions made): premium stats, gym partnerships or promotions, optional supporter tier. Core tracking stays free.
- **Privacy-friendly usage analytics**, if hosting allows it later.

## 15. Open questions

1. **Phone layout of the four columns:** *resolved in step 1.6.* The four columns are kept. On a phone (under 640 px) each row wraps onto two lines: gym and count on the first, type and expiry on the second, with status badges below. From 640 px wide it is a table with the column headings Gym, Type, Expiry, Left. The `−` / `+` buttons (step 1.7) go around the count in the Left column.
2. **Gym name review schedule:** how often the product owner checks the built-in gym names after launch (D22). To be planned later; it does not block development.
