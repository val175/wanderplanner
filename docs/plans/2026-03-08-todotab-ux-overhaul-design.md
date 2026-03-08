# TodoTab UX Overhaul — Design Doc
**Date:** 2026-03-08
**Status:** Approved

## Summary

Five targeted improvements to `TodoTab.jsx` to elevate Trip Tasks from a basic checklist into a workspace-grade tool. All changes are scoped to `TodoTab.jsx` and `src/index.css` (one new keyframe). No reducer, context, or constants changes required.

---

## 1. View Toggle — List ↔ Board (Kanban)

**State:** `viewMode: 'list' | 'board'` (local, `useState`)

**Toggle placement:** Header row, alongside existing "All Tasks / My Tasks" toggle. Uses the DS-standard pill toggle pattern:
- Container: `flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0`
- Active: `bg-bg-card text-accent` + list/board icon
- Inactive: `text-text-muted hover:text-text-secondary`

**List mode:** Existing `TodoPhaseGroup` layout — no changes.

**Board mode:**
- Outer container: `flex gap-4 overflow-x-auto pb-4` (horizontal scroll)
- Each phase column: `min-w-[270px] flex-shrink-0 flex flex-col`
- Column header: Phase name + `x/y` badge (same data, no table-column labels)
- Task rows: same `TodoItem` component, table header row hidden
- DnD: `DropPhaseBoard` already supports cross-phase drops; works in both modes

---

## 2. Global Quick Add Bar

**Placement:** Between page header and phase groups — always visible.

**Structure:** Single-line card: `[ input: "Quick add a task..." ] [ phase selector ▾ ] [ Add ]`
- Phase selector: native `<select>` styled to match design system inputs, defaulting to `planning`
- On submit: dispatches `ACTIONS.ADD_TODO` with `{ text, phase }` — zero new state
- Clears input after add; keeps selected phase sticky

**Per-phase `AddTodoPhaseForm`:** Retained in list mode (at bottom of each group). Removed from board mode columns to reduce clutter (quick add covers it).

---

## 3. Progressive Disclosure on Task Rows

**Principle:** Controls with no value set are hidden until hover. Controls with a value always show.

| Control | Hidden when | Show trigger |
|---|---|---|
| `DatePicker` | `!todo.dueDate` | `group-hover:opacity-100` |
| Deep-link icon | never had explicit value (auto-inferred) | removed from persistent display; moved to hover-only always |
| Notes chevron | `!todo.note` | `group-hover:opacity-100` |

**Implementation:** Wrap each control's container div with conditional opacity classes. Layout widths remain fixed to prevent reflow.

---

## 4. Always-visible Empty Phase Columns

**Change:** Remove the early-return empty-state `Card` that replaces the entire tab when `safeTodos.length === 0`.

**Replace with:** A slim inline Wanda banner shown only when `safeTodos.length === 0 && !isReadOnly && filter === 'all'`:
- Full-width, compact (single row): sparkle icon + "Don't know where to start? Let Wanda generate a smart, personalized checklist" + "Generate with Wanda" button
- Sits above the phase groups; phases always render below it

---

## 5. Micro-interactions

**Checkbox:** `animate-check-pop` already applied on `todo.done` (scale 1→1.2→1, 0.3s). No change needed.

**Task completion text:** Add `transition-all duration-300` to the task text span so the `line-through` + opacity fade is smooth rather than a snap.

**New keyframe in `index.css`:** None required — all animations exist.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/tabs/TodoTab.jsx` | All 5 improvements |
| No other files | — |

---

## Out of Scope

- Persistent view mode preference (localStorage) — YAGNI for now
- Mobile-specific layout adjustments to board mode — follow-up
- Making `getDeepLinkTarget` explicit/user-set — separate UX decision
