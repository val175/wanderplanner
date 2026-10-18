# Moving Wanderplan to the Team Plan

Everything needed so a fresh Claude on the new plan picks up exactly where this one left off.

---

## What travels by itself

These are committed to `val175/wanderplanner`, so cloning the repo on the new plan carries
them with zero setup:

| File | Role |
|---|---|
| `CLAUDE.md` | **Auto-loaded operating context** — rules, deploy topology, traps. The single most important file. |
| `docs/HANDOFF.md` | State of play: what shipped, where the roadmap stands, open debt |
| `docs/TEAM_PLAN_MIGRATION.md` | This file |
| `design_system.md` | Canonical design system (newer of the two copies) |
| `docs/plans/*.md` | 10 design + implementation plans, incl. the 15-idea roadmap |
| `.agents/skills/wanderplan-tester/SKILL.md` | Product-sense QA audit skill |
| `.claude/launch.json` | Dev server config (`Wanderplan Dev` on :5173, `Mockup` on :3457) |
| `git_commit.md` | Commit protocol (now also in `CLAUDE.md`) |

---

## What does NOT travel — re-add these

### 1. Local project memory (now redundant, but know where it was)
```
~/.claude/projects/-Users-val-Documents-Claude-Projects-Trip-Planner/memory/
├── MEMORY.md
├── invite-flow-sharelinks.md
└── hostinger-storage-api-deploy.md
```
This lived outside the repo and was tied to this machine + account. **Its full substance is
now folded into `CLAUDE.md`**, so the new plan gets it from git instead. If you're on the
same Mac, you can also just copy that folder across — but you no longer need to.

### 2. Permission allowlist
`.claude/settings.local.json` is gitignored (`*.local`), so ~60 approved Bash patterns
don't carry over. You'll get fresh permission prompts. Nothing to recover — just re-approve
as you go, or run `/fewer-permission-prompts` once you've worked a bit.

### 3. Secrets — names only; values must be re-entered by hand
Never commit these. `.env.local` → rebuild from `.env.example`:

| Where | Variables |
|---|---|
| `.env.local` (local dev) | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_MAPBOX_PART2`, `VITE_STORAGE_API_URL` |
| Vercel project env | `GEMINI_API_KEY` |
| GitHub Actions secrets | `VITE_MAPBOX_PART2`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| Hostinger hPanel env | `PUBLIC_URL=https://api.vlbonite.co` |

Firebase project: `wanderplanner-dbee7`. The `VITE_FIREBASE_*` values are also visible in
`.github/workflows/deploy.yml` (web config, not secret in Firebase's model).

### 4. Connectors / MCP servers — need re-authorisation on the new account
Relevant to this project specifically:
- **Firebase** — Firestore rules + data (was failing to connect in the old session; worth a fresh setup)
- **Vercel** — deployments, logs, env vars for `wanderplan-rust`
- **GitHub** — `val175/wanderplanner`
- **Playwright** — browser QA runs (this repo has a `.playwright-mcp/` scratch dir)
- **Firecrawl** — competitor/idea research (`.firecrawl/` scratch dir)

OAuth can't be started from inside Claude — authorise them in the new account's connector
settings before expecting any of them to work.

### 5. Accounts that own production
Confirm the new plan's identity still has access to: GitHub (`val175`), Vercel (project
`wanderplan`), Firebase (`wanderplanner-dbee7`), Hostinger hPanel (`planner.vlbonite.co`
static + `api.vlbonite.co` Web App), Mapbox.

---

## Paste-ready project instructions

If the Team plan uses a claude.ai Project for Wanderplan, paste this into **Project
instructions** and upload `CLAUDE.md` + `docs/HANDOFF.md` + `design_system.md` as project
knowledge.

```text
Wanderplan is a collaborative AI-assisted group trip planner (React 18 + Vite 6 +
Tailwind 4 + Firebase/Firestore + AI SDK v6). Live at planner.vlbonite.co. Repo:
val175/wanderplanner, branch main. Product north star: help the travel group DECIDE,
not just record — each of the 12 tabs answers exactly one job.

WORKFLOW — commit directly to main and push immediately. No feature branches, no PRs
unless I explicitly ask. Conventional commits: type(scope): subject. CI is the safety
net, not a gate.

AI MODEL — all Wanda features use gemini-3.1-flash-lite via @ai-sdk/google. Never change
this without me asking. It's a deliberate Google AI Studio free-tier choice (~15-30 RPM,
1500 RPD), which is also why Wanda's tools take arrays (one batched call, not many) and
why useAI.js does dynamic context windowing instead of sending whole trip state.

CRITICAL — the client calls the API by ABSOLUTE URL
(const VERCEL_API = 'https://wanderplan-rust.vercel.app'), in ~16 places. Never refactor
these to relative /api paths. The client is served from a static host with no /api routes,
so relative paths work in Vite dev and break production instantly.

DEPLOYS — four independent pieces. Push to main auto-deploys the React client (GH Action →
Hostinger static) and the api/*.js functions (GH Action → Vercel). Two things push does
NOT deploy: (1) firestore.rules / storage.rules need `firebase deploy --only
firestore:rules`, shipped alongside the client so cached clients don't hit permission
errors; (2) hostinger-storage-api/server.js needs a manual zip upload via hPanel — and
those deploys can wipe uploads/ (real user files), so back it up first.

SECURITY — trips are member-only via memberIds. Invites use shareLinks/{shareId}
capability docs (doc id IS the secret; get allowed, list forbidden). The only non-member
write permitted is a join whose diff adds nothing but the joiner's own uid.
users/{uid}.allowed is a UX gate only, never the security boundary.

DESIGN — read design_system.md before building UI. AI-generated content must always stay
editable, attributable, and reversible. Reduce tab switching, surface the next best
action, keep the spreadsheet/Notion editing feel. Money is always formatted.

Before building anything new, read docs/HANDOFF.md for current state and the roadmap in
docs/plans/2026-03-19-trip-planning-roadmap.md.
```

---

## First session on the new plan — a 5-minute sanity pass

```bash
git clone https://github.com/val175/wanderplanner.git && cd wanderplanner
npm install
cp .env.example .env.local   # then fill in the real values
npm test                     # 3 suites: splitwise, budgetSlice, urlState
npm run dev                  # :5173, proxies /api to live Vercel functions
```

Then confirm production is still healthy:
```bash
curl -X POST https://api.vlbonite.co/upload        # expect {"error":"Unauthorized"}
curl -s -o /dev/null -w "%{http_code}\n" https://planner.vlbonite.co
```

If all of that passes, the new plan is fully picked up — ask for a roadmap item and go.
