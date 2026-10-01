# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Climb Pass Tracker is a phone-first PWA for climbers to track gym passes (shareable multipasses, memberships, single entries, class packs), starting with Singapore gyms. **No code exists yet** — the repo currently holds only `docs/PRD.md`, which is the source of truth for scope and behaviour. Read it before implementing anything, and cite its decision IDs (D1–D22) and requirement IDs (FR-1…FR-49) when relevant. Update this file with real build/lint/test commands once the project is scaffolded.

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
