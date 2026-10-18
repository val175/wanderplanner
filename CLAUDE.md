# Wanderplan — Operating Context

Wanderplan is a collaborative, AI-assisted group trip planner. React SPA, Firestore
backend, serverless AI endpoints, PWA. Repo: `val175/wanderplanner`, branch `main`.

Product north star: a shared travel operating system that helps the group **decide**,
not just record. Each tab answers exactly one job (see `docs/plans/2026-03-19-trip-planning-roadmap.md`).

---

## Non-negotiables

### Git workflow
- **Commit directly to `main` and push immediately.** No feature branches, no PRs,
  unless explicitly asked.
- One step: `git add <files> && git commit -m "..." && git push`
- Conventional commits: `<type>(<scope>): <subject>` — e.g. `feat(ui): add ellipsis menu to header`
- CI (`.github/workflows/ci.yml`) is the safety net, not a gate to wait on.

### AI model
- Primary model for all Wanda features: **`gemini-3.1-flash-lite`** via `@ai-sdk/google`.
- **Do not change this model without being explicitly asked.** It is a deliberate
  free-tier choice, not a default.
- Also in use: `gemini-embedding-2-preview` (semantic search),
  `gemini-3.1-flash-live-preview` (Wanda Live voice).

### API calls from the client are absolute, never relative
The client is served from a **static host** that has no `/api` routes. Every call goes to
the Vercel deployment by absolute URL:

```js
const VERCEL_API = 'https://wanderplan-rust.vercel.app'
```

**Never refactor these to relative `/api/...` paths.** That breaks production
immediately (see commit `3fd6a98e`). Vite dev proxies `/api` to the same host, so
relative paths appear to work locally and fail once deployed.

---

## Deployment topology

Four independently deployed pieces. Knowing which one you changed determines how it ships.

| Piece | Lives in | Deployed to | How |
|---|---|---|---|
| React client | `src/`, `index.html` | https://planner.vlbonite.co (Hostinger static) | auto: push to `main` → GH Action builds → publishes `./dist` to the `deploy` branch |
| AI / serverless API | `api/*.js` | https://wanderplan-rust.vercel.app | auto: push to `main` → GH Action runs `vercel --prod` |
| File-storage API | `hostinger-storage-api/server.js` | https://api.vlbonite.co (Hostinger Web App) | **manual zip upload only** |
| Security rules | `firestore.rules`, `storage.rules` | Firebase project `wanderplanner-dbee7` | **manual `firebase deploy`** |

Both GitHub Actions jobs are in `.github/workflows/deploy.yml` and run in parallel on
every push to `main`.

### The two things `git push` does NOT deploy

**1. Firestore / Storage rules.** Requires:
```bash
firebase deploy --only firestore:rules
```
Ship rules changes **together with** the client deploy. Cached older clients use the old
query paths and will throw permission errors against new rules.

**2. The storage API.** `git push` never updates `api.vlbonite.co`. There is no SSH/VPS
access. Every `server.js` change needs a fresh zip through hPanel → Websites →
api.vlbonite.co → Deployments:
```bash
cd hostinger-storage-api && npm install && \
  zip -rq ../output/storage-api-deploy.zip server.js package.json package-lock.json node_modules
```
Files at zip root, `node_modules` included. hPanel settings: framework Express, Node 22.x,
root `./`, entry `server.js`, npm. `PUBLIC_URL=https://api.vlbonite.co` is set in hPanel
(no `.env` in the zip).

⚠️ **Deploys can wipe the app directory including `uploads/` (real user files).** Back it
up via hPanel File Browser first.

Verify after deploy: `curl -X POST https://api.vlbonite.co/upload` → `{"error":"Unauthorized"}`

---

## Architecture

### Stack
React 18 · Vite 6 · Tailwind 4 · Firebase 12 (Firestore + Auth) · AI SDK v6
(`ai`, `@ai-sdk/google`) · Mapbox via `react-map-gl` · Radix UI primitives ·
dnd-kit (drag/reorder) · Framer Motion · Remotion (how-to videos) · PWA via
`vite-plugin-pwa` (`registerType: 'autoUpdate'`) · Vitest

### State
`useReducer`, not Redux. `src/state/tripReducer.js` composes **10 domain slices** in
`src/state/slices/`: itinerary, booking, budget, todo, packing, voting, cities, tripCrud,
document. All action types are centralised in the `ACTIONS` const.

Two contexts: `TripContext` (active trip + dispatch) and `ProfileContext` (user + traveler
directory). Firestore sync via `useFirestoreTrips`; offline persistence is enabled.

### Routing
Real URLs — `/trips/:tripId/:tab` — driven by `useUrlSync` + `src/utils/urlState.js`.
Back/Forward and refresh must keep working; `urlState.test.js` guards this.

### Tabs (12, one job each)
`overview` (resolves uncertainty) · `wandermap` (place) · `itinerary` (timing) ·
`bookings` (commitments) · `budget` (spend) · `todo` (follow-through) ·
`voting` (decisions) · `videos` (how-to) · `cities` (context) · `documents` ·
`packing` (readiness) · `concert` (conditional).
Defined in `src/constants/tabs.js`. Nav chrome uses **lucide icons**; emoji are reserved
for content surfaces, never primary nav.

### Wanda (the AI assistant)
`api/chat.js` streams with 5 tools: `add_to_packing_list`, `add_idea_to_voting_room`,
`generate_day_itinerary`, `add_budget_alert`, `recommend_from_voting_room`.

Tools take **arrays**, deliberately — one call with many items instead of many calls.
This is a free-tier cost control (Google AI Studio: ~15–30 RPM, 1500 RPD). Same reason
`useAI.js` does **dynamic context windowing**: core trip details always go in the system
prompt, tab-specific detail only when that tab is active. Do not reintroduce
whole-trip-state prompts (~15k tokens/turn). Background: `docs/plans/2026-04-05-ai-free-tier-optimization.md`.

Other endpoints: `extract-idea` / `extract` / `extract-trip` / `extract-trip-pdf` /
`extract-pin` (share-link and document ingestion), `semantic-search`, `resolve-location`,
`generate-checklist`, `generate-postcard`, `multimodal-ingest`, `parse-trip`,
`wanda-plan-trip`, `wanda-live-token`, `budget/scan-receipt`, `cities/auto-fill`.
`vercel.json` sets `maxDuration: 60` and pins CORS to `https://planner.vlbonite.co`.

### Security model
- **Trips are member-only** (`memberIds`). Not "any signed-in Google account" — that was
  the old, broken state.
- Invites use **`shareLinks/{shareId}` capability docs**: the doc id *is* the secret,
  `get` allowed, `list` forbidden. Holds a small preview snapshot + `tripId` so an invitee
  sees what they're joining with no access to the trip itself.
- The only non-member write permitted on a trip is a join whose diff adds **nothing but
  the joiner's own uid** to `memberIds`/`travelerIds`. Enforced in `firestore.rules`.
- `users/{uid}.allowed` is a **UX gate only** — never treat it as the security boundary.
- `clientErrors/` is a write-only drop box (create-only, strict key allowlist, read/update/delete false).
- Storage API verifies **Firebase ID tokens via `jose`**, and blocks path traversal.
- Share links created before 2026-06-10 have no `shareLinks` doc; re-copying the link from
  `ShareTripModal` backfills it.

---

## Conventions

- **Design system is canonical** — read it before building UI. ⚠️ Two copies exist:
  root `design_system.md` (369 lines, updated 2026-04-06) is **newer** than
  `docs/DESIGN_SYSTEM.md` (321 lines, 2026-03-15). Treat the root file as current and
  dedupe when convenient. Includes a pre-merge inconsistency checklist and a full
  map/cartography spec (WanderPath route line, tiered marker anatomy, haptics).
- **AI output must stay editable, attributable, and reversible.** Never write AI content
  the user can't correct or undo.
- Reduce tab switching; surface the next best action; keep the spreadsheet/Notion
  editing feel.
- Money is always formatted — never raw floats.
- Tests: `npm test` (Vitest). Coverage is intentionally thin and targeted at money and URL
  logic: `splitwise.test.js`, `budgetSlice.test.js`, `urlState.test.js`. Changes to
  splitting, budget math, or URL state should extend these.
- QA: `.agents/skills/wanderplan-tester/SKILL.md` is a product-sense audit skill
  (incl. the "Potato Test" for Wanda's playful-but-not-overeager balance).

## Commands

```bash
npm run dev      # Vite on :5173, proxies /api → wanderplan-rust.vercel.app
npm run build    # vite build --emptyOutDir
npm test         # vitest run
```

Env: copy `.env.example` → `.env.local`. Client needs the `VITE_FIREBASE_*` set,
`VITE_MAPBOX_PART2`, `VITE_STORAGE_API_URL=https://api.vlbonite.co`.
Server needs `GEMINI_API_KEY` (set in Vercel). Firebase project: `wanderplanner-dbee7`.
