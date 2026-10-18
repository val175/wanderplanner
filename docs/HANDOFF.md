# Wanderplan — Handoff Brief

**Written:** 2026-10-18 · **Last commit:** `c79aa7ae`, 2026-08-31 · **734 commits** since 2026-02-18

Read `CLAUDE.md` first — it holds the operating rules, deploy topology, and the traps.
This file is the *state of play*: what's built, where it stands, what's next.

---

## What Wanderplan is

A collaborative group trip planner for real multi-city trips with ~10 travelers, built
around one idea: **the app should help the group decide, not just record decisions.**
Wanda, the AI assistant, is the decision accelerator — she proposes, the humans accept.

The seeded demo trip (`src/data/defaultTrip.js`) is a 9-day SEA group adventure
(Cebu → Singapore → Koh Samui → Kuala Lumpur → Cebu, Nov 2026, 10 travelers, PHP),
which exists so the app is never empty on first load.

Live: **https://planner.vlbonite.co**

---

## Current state

The app is **feature-complete and in production**, past the build-out phase and into
polish, hardening, and decision-layer work. The last stretch of commits was almost
entirely production-readiness rather than new surface area.

### Shipped most recently (reverse order)
- `c79aa7ae` Service worker never reloaded the page after an update — PWA update loop fix
- `3fd6a98e` Idea extractor called a relative `/api` path on a static host
- `d06e3300` Idea extraction from redirect-stub share links (Agoda `/sh-app/`, etc.)
- `1a1de4a4` / `7aece4f5` **Timezone correctness pass** — `today` computed in local time, not
  UTC, app-wide; city date ranges were off by one day per stop in UTC+ zones
- `6e3bebc0` Production polish — offline persistence, iOS PWA fixes, undo-delete, sidebar boundary
- `f5cb5d11` **Security** — Firebase auth required on the storage API, path traversal blocked,
  unused Firebase Storage bucket locked down
- `2210ce99` Map-first nights-allocation redesign of the Cities route view
- `c39f3a96` Stippl-inspired route planner, header rollup, packing templates, budget insights
- `162519ef` **Invite-only access** — member-only Firestore rules, `shareLinks` capability docs,
  no auto-whitelisting
- `3409a89b` Vitest seeded (splitwise + budget slice), CI on push to `main`
- `c2af5ef6` URL routing — `/trips/:tripId/:tab` deep links, Back/Forward, refresh persistence
- `4dead45b` Mobile nav IA — Overview/Itinerary/Bookings/Budget/More, Wanda as a FAB
- `8126b22a` Client error telemetry — write-only `clientErrors` drop box

### Note on the gap
There are **~7 weeks between the last commit (2026-08-31) and this handoff**. Nothing is
mid-flight in the working tree (clean, no stashes), so this is a clean stopping point
rather than an interrupted task. Two stale Claude branches exist remotely
(`claude/relaxed-merkle-c1ef7b`, `claude/sad-bun-106329`) plus the machine-generated
`deploy` branch — the `claude/*` ones can almost certainly be deleted.

---

## Roadmap: where the 15 ideas stand

Full table with complexity and model-fit: `docs/plans/2026-03-19-trip-planning-roadmap.md`.

**Appears already shipped** (inferred from code, worth confirming):
- *Co-traveler presence dots* — `usePresence.js`, `CursorManager.jsx` exist
- *Receipt-to-Split polish* — `ReceiptScannerModal.jsx` + `api/budget/scan-receipt.js`
- *Booking confirmation parser* — `api/extract-trip*.js`, `MagicImportFlow.jsx`
- *Template library* — packing templates landed in `c39f3a96`

**Next five in the recommended build order** (the ones that create daily value):
1. **Trip Health Summary Card** — aggregate readiness, overdue work, budget burn, next
   booking into one Overview view. `src/utils/readiness.js` already exists to build on.
2. **Budget Forecast Alerts** — alert logic + badges; `add_budget_alert` tool already exists.
3. **Gap Finder for Itinerary** — cross-reference schedule gaps against location, weather
   (`useLiveWeatherContext.js`), budget.
4. **Context-Aware Packing Suggestions** — rule engine + trustable one-tap add.
5. **Trip Change Digest** — diff summary of what changed since a traveler last looked.

**The big step-functions** (need schema + UX hardening first): Universal Trip Inbox
(unify receipts, ideas, confirmations into one triage queue), Voting→Action Pipeline
(idea → itinerary/booking/budget/task), Weather Disruption Playbooks, Discovery Map Clustering.

---

## Open threads / known debt

- **Duplicate design system.** Root `design_system.md` (369 lines, 2026-04-06) vs
  `docs/DESIGN_SYSTEM.md` (321 lines, 2026-03-15). Root is newer; they've diverged. Pick one.
- **Two paths produce the served bundle.** `dist/` is committed on purpose — `.gitignore`
  explicitly keeps it ("committed so Hostinger can deploy without a build step") and
  several commits exist purely to rebuild it (`b03c8987`, `e43dc204`). *Also*, the GH Action
  builds fresh and publishes `./dist` to the `deploy` branch. Worth confirming which one
  Hostinger actually serves, because a stale committed `dist/` could mask a good CI build
  (or vice versa). Until that's settled, rebuild `dist/` when you ship client changes.
- **Firebase web config is hardcoded in `.github/workflows/deploy.yml`** (not in secrets).
  Web API keys aren't secrets in the Firebase model, so this isn't a breach — but
  `VITE_MAPBOX_PART2` *is* in GH secrets, so the pattern is inconsistent.
- **Thin test coverage by design** — 3 test files, aimed at money and URL logic only.
  Reducer slices beyond budget are untested.
- **Free-tier AI ceiling** is the real scaling constraint, not compute. Any new AI feature
  has to budget requests (~15–30 RPM, 1500 RPD). `fuse.js` client-side fuzzy search was
  specced in the free-tier plan to offload search — verify whether that landed.
- **Storage API deploys are manual and risk `uploads/`.** Highest-consequence routine
  operation in the project. A backup step before every zip deploy is not optional.

---

## How to pick up

1. Read `CLAUDE.md` (rules + topology + traps), then the design system.
2. `npm install && npm run dev` → http://localhost:5173. The dev server proxies `/api` to
   the live Vercel functions, so AI features work locally without running anything else.
3. Pick a roadmap item, build it, commit straight to `main`, push. CI runs tests + build.
4. If you touched `firestore.rules`/`storage.rules` → `firebase deploy --only firestore:rules`.
   If you touched `hostinger-storage-api/` → back up `uploads/`, then zip-deploy via hPanel.
