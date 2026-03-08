# TodoTab UX Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `TodoTab.jsx` with a List/Board view toggle, global quick-add bar, progressive disclosure on task rows, always-visible empty-phase structure, and smooth micro-interaction polish.

**Architecture:** All changes are self-contained in `TodoTab.jsx`. No reducer, context, constants, or CSS changes required. The DnD infrastructure (`DropPhaseBoard`, `SET_TODOS`) already supports cross-phase drops in both view modes. The design system's view-toggle pill pattern is already used in this file for "All Tasks / My Tasks" — the new toggle mirrors it exactly.

**Tech Stack:** React 18, @dnd-kit/core + sortable, Tailwind v4, Vite (no test runner — verify via `npm run dev`)

---

## Task 1: Add `viewMode` state + DS-compliant List/Board toggle

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — `TodoTab` component (~line 523)

**Step 1: Add `viewMode` state to `TodoTab`**

Inside `TodoTab`, alongside the existing `filter` and `hideCompleted` states, add:

```jsx
const [viewMode, setViewMode] = useState('list') // 'list' | 'board'
```

**Step 2: Add the view toggle to the header row**

The header row (`<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">`) currently has a single right-side `<div className="flex items-center gap-3">`. Add the new toggle **before** the existing "Hide Completed" button inside that div:

```jsx
{/* View Toggle — List / Board */}
<div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
  <button
    onClick={() => setViewMode('list')}
    className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5
      ${viewMode === 'list' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
    List
  </button>
  <button
    onClick={() => setViewMode('board')}
    className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5
      ${viewMode === 'board' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
  >
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
    </svg>
    Board
  </button>
</div>
```

**Step 3: Pass `viewMode` to the phase render section**

The bottom of `TodoTab` passes `canDrag` to `TodoPhaseGroup`. Also add `viewMode`:

```jsx
<TodoPhaseGroup
  key={phase.id}
  phase={phase}
  index={index}
  phaseTodos={grouped[phase.id]}
  canDrag={canDrag}
  isReadOnly={isReadOnly}
  dispatch={dispatch}
  handleToggle={handleToggle}
  handleDeepLink={handleDeepLink}
  resolveProfile={resolveProfile}
  tripTravelers={tripTravelers}
  currentUserProfile={currentUserProfile}
  viewMode={viewMode}   // ← ADD THIS
/>
```

**Step 4: Wrap the phase groups in a conditional layout container**

Replace the inner `<div className="space-y-4">` (the direct child of `DndContext`) with a conditional:

```jsx
<div className={viewMode === 'board'
  ? 'flex gap-4 overflow-x-auto pb-4 items-start'
  : 'space-y-4'
}>
  {TODO_PHASES.map((phase, index) => (
    <TodoPhaseGroup ... viewMode={viewMode} />
  ))}
</div>
```

**Step 5: Verify**
Run `npm run dev`. The header should show a "List / Board" pill toggle. Clicking Board should currently do nothing visible (we wire it up in Task 2). Clicking List should restore the vertical layout.

**Step 6: Commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "feat(todo): add list/board view toggle state and DS-compliant pill UI

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Board mode layout in `TodoPhaseGroup`

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — `TodoPhaseGroup` component (~line 409)

**Step 1: Accept `viewMode` prop in `TodoPhaseGroup`**

Update the function signature:

```jsx
function TodoPhaseGroup({
  phase, index, phaseTodos, canDrag, isReadOnly,
  dispatch, handleToggle, handleDeepLink,
  resolveProfile, tripTravelers, currentUserProfile,
  viewMode   // ← ADD
}) {
```

**Step 2: Wrap the entire component return in a board-mode column shell**

Replace the outer `<div className="mb-8 animate-fade-in">` with a conditional that adds column sizing in board mode:

```jsx
<div className={`animate-fade-in ${viewMode === 'board'
  ? 'min-w-[270px] flex-shrink-0 flex flex-col'
  : 'mb-8'
}`}>
```

**Step 3: Slim down the group header for board mode**

The current phase header is wide (it has `justify-between` with a progress indicator that needs ~140px). In board mode, the header should be compact — just the phase name + badge. Replace the header `<div>` contents with a conditional:

```jsx
{/* Group Header */}
<div className={`group/phase relative flex items-center py-2 mb-2 ${viewMode === 'board' ? 'justify-between' : 'justify-between'}`}>
  <div className="flex items-center gap-2">
    <div className="text-text-muted opacity-0 hover:opacity-100 transition-opacity mr-2 select-none">⠿</div>
    <button
      onClick={() => setExpanded(!expanded)}
      className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center border border-border rounded bg-bg-card"
    >
      <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
    </button>
    <div className="flex flex-col ml-2">
      <h3 className={`font-heading text-lg font-bold leading-tight flex items-center gap-2 ${phase.textClass}`}>
        <span>{index + 1}.</span> {viewMode === 'board' ? phase.label.split(' ')[0] : phase.label}
      </h3>
      {viewMode === 'list' && (
        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-0.5">{phase.subtitle}</p>
      )}
    </div>
  </div>

  {/* Progress — full bar in list, badge only in board */}
  {viewMode === 'list' ? (
    <div className="flex flex-col items-end min-w-[140px]">
      <span className="text-[10px] font-bold text-text-muted tracking-wider mb-1.5 uppercase">
        {phaseDone}/{phaseTotal} Completed
      </span>
      <div className="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden border border-border/30">
        <div className={`h-full ${phase.color} transition-all duration-500 ease-out`} style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
  ) : (
    <span className="text-[11px] font-bold text-text-muted bg-bg-secondary border border-border rounded-full px-2 py-0.5">
      {phaseDone}/{phaseTotal}
    </span>
  )}
</div>
```

**Step 4: Hide table column headers in board mode**

The column label header (`TASK / DUE DATE / WHO`) only makes sense in list mode. Wrap it:

```jsx
{viewMode === 'list' && (
  <div className="flex items-center gap-2 px-0 py-2 border-b border-border/40 bg-bg-secondary/10">
    {/* ...existing column labels... */}
  </div>
)}
```

**Step 5: Hide per-phase AddTodoPhaseForm in board mode**

The quick-add bar (Task 3) covers this in board mode:

```jsx
{!isReadOnly && viewMode === 'list' && (
  <div className="border-t border-border/30 bg-accent/[0.02]">
    <AddTodoPhaseForm
      phase={phase}
      onAdd={data => dispatch({ type: ACTIONS.ADD_TODO, payload: data })}
    />
  </div>
)}
```

**Step 6: Verify**
Run `npm run dev`. Switch to Board mode — each phase should render as a narrow column side-by-side with horizontal scroll if overflow. Phase names should truncate to first word ("Planning", "Logistics", etc.). Progress shows as a small `x/y` badge. Switch back to List — all original content restored.

**Step 7: Commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "feat(todo): implement kanban board layout for TodoPhaseGroup

Phase columns min-w-[270px], progress badge, hidden table headers/add-form.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Global Quick Add bar

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — new `QuickAddBar` component + usage in `TodoTab`

**Step 1: Add the `QuickAddBar` component**

Add this new component *above* the `TodoTab` export (e.g., after `DropPhaseBoard`):

```jsx
function QuickAddBar({ dispatch, isReadOnly }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('planning')

  const handleAdd = () => {
    if (!text.trim()) return
    dispatch({ type: ACTIONS.ADD_TODO, payload: { text: text.trim(), phase } })
    setText('')
    triggerHaptic('light')
  }

  if (isReadOnly) return null

  return (
    <div className="flex items-center gap-3 bg-bg-card border border-border rounded-[var(--radius-md)] px-4 py-2.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
        <path d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Quick add a task... (e.g. 'Book flights to Rio')"
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-w-0"
      />
      <select
        value={phase}
        onChange={e => setPhase(e.target.value)}
        className="text-xs bg-bg-secondary border border-border rounded-[var(--radius-sm)] px-2 py-1 text-text-secondary outline-none focus:border-accent shrink-0 cursor-pointer"
      >
        {TODO_PHASES.map((p, i) => (
          <option key={p.id} value={p.id}>{i + 1}. {p.label.split(' ')[0]}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>Add</Button>
    </div>
  )
}
```

**Step 2: Place `QuickAddBar` in `TodoTab`**

Inside `TodoTab`'s return, add it *between* the Wanda banner slot and the `DndContext`. It should always render (the component itself returns null for read-only):

```jsx
{/* Quick Add Bar — always visible */}
<QuickAddBar dispatch={dispatch} isReadOnly={isReadOnly} />

{/* Phase Groups */}
<DndContext ...>
```

**Step 3: Verify**
Run `npm run dev`. A persistent input bar should appear above the phase groups. Type a task, select a phase from the dropdown, press Enter or click Add — the task should appear in the correct phase column. Input clears after add.

**Step 4: Commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "feat(todo): add persistent QuickAddBar above phase groups

Always-visible global task entry with phase selector, Enter-to-add support.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Progressive disclosure on task rows

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — `TodoItem` component (~line 188)

**Step 1: Apply opacity-hide to the DatePicker container when no value**

Find the DatePicker wrapper div:
```jsx
{/* BEFORE */}
<div className="w-[140px] shrink-0 flex justify-end px-2">
  <DatePicker ... />
</div>
```

Replace with:
```jsx
{/* AFTER */}
<div className={`w-[140px] shrink-0 flex justify-end px-2 transition-opacity duration-150
  ${!todo.dueDate ? 'opacity-0 group-hover:opacity-100' : ''}`}>
  <DatePicker ... />
</div>
```

**Step 2: Make the deep-link icon always hover-only**

The deep-link icon is auto-inferred from text, so always show it on hover only. Find:
```jsx
{!editing && deepLink && !todo.done && (
  <button
    onClick={() => onDeepLink(deepLink)}
    className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors group/link"
    title={`Go to ${deepLink} tab`}
  >
```

Add `opacity-0 group-hover:opacity-100` to the className:
```jsx
className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all opacity-0 group-hover:opacity-100"
```

**Step 3: Hide notes chevron when no note and not expanded**

Find the notes toggle div:
```jsx
{/* BEFORE */}
<div className="w-[30px] shrink-0 flex justify-center">
  <button onClick={() => setExpanded(!expanded)} ...>
```

Replace the outer div className:
```jsx
{/* AFTER */}
<div className={`w-[30px] shrink-0 flex justify-center transition-opacity duration-150
  ${!todo.note && !expanded ? 'opacity-0 group-hover:opacity-100' : ''}`}>
  <button onClick={() => setExpanded(!expanded)} ...>
```

**Step 4: Verify**
Run `npm run dev`. On a task with no date, no note, hover over it — the date picker and note toggle should fade in. Move cursor away — they fade out. On a task that has a due date set, the date should always be visible. Click the note chevron — it stays visible while expanded.

**Step 5: Commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "feat(todo): progressive disclosure for date/notes/deeplink on task rows

Controls with no value hide until hover; persistent when value is set.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Always-visible empty phase structure + slim Wanda banner

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — `TodoTab` return (~line 710)

**Step 1: Replace the large full-tab empty-state card with a slim banner**

Find and delete the entire block:
```jsx
{safeTodos.length === 0 && !isReadOnly && filter === 'all' && (
  <div className="bg-bg-card border border-border rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center shadow-sm">
    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-xl mb-3 border border-accent/20">✨</div>
    <h3 className="font-heading text-lg font-bold text-text-primary mb-2">Start Your Checklist</h3>
    <p className="text-sm text-text-secondary mb-5 max-w-sm mx-auto leading-relaxed">Not sure where to begin? Ask Wanda to generate a smart, personalized checklist for your trip.</p>
    <Button onClick={handleGenerateChecklist} disabled={isGenerating}>
      {isGenerating ? 'Wanda is thinking...' : 'Ask Wanda for a checklist'}
    </Button>
  </div>
)}
```

Replace it with this slim inline banner (place between `QuickAddBar` and `DndContext`):
```jsx
{safeTodos.length === 0 && !isReadOnly && filter === 'all' && (
  <div className="flex items-center gap-4 bg-bg-card border border-border rounded-[var(--radius-md)] px-5 py-3.5">
    <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center text-base border border-accent/20 shrink-0">✨</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-text-primary leading-snug">Don't know where to start?</p>
      <p className="text-xs text-text-secondary leading-snug">Let Wanda generate a smart, personalized checklist based on your destination.</p>
    </div>
    <Button onClick={handleGenerateChecklist} disabled={isGenerating} size="sm" className="shrink-0">
      {isGenerating ? 'Thinking...' : 'Generate with Wanda'}
    </Button>
  </div>
)}
```

**Step 2: Verify**
Run `npm run dev` on a trip with no todos. The phases (Planning, Logistics, etc.) should be visible with their empty-state message ("No tasks in this phase yet."). The Wanda banner should appear as a compact one-line strip above the phases, not replacing them. Add a task via QuickAddBar — the banner disappears.

**Step 3: Commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "feat(todo): show phases on empty state; replace full-screen Wanda card with slim banner

Users now see the phase structure immediately. Wanda prompt is a compact strip.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Micro-interaction polish + shadow cleanup

**Files:**
- Modify: `src/components/tabs/TodoTab.jsx` — `TodoItem` + misc DS violations

**Step 1: Smooth the task completion opacity transition**

In `TodoItem`, the outer div currently has `transition-opacity` but no explicit duration. Add `duration-200`:

```jsx
{/* BEFORE */}
<div className={`flex flex-col group transition-opacity ${todo.done ? 'opacity-60' : ''}`}>

{/* AFTER */}
<div className={`flex flex-col group transition-opacity duration-200 ${todo.done ? 'opacity-60' : ''}`}>
```

**Step 2: Add transition to task text span for smoother line-through**

```jsx
{/* BEFORE */}
<span
  className={`text-[14px] font-medium transition-colors
    ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-b hover:border-accent/30'}
    ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
>

{/* AFTER */}
<span
  className={`text-[14px] font-medium transition-all duration-200
    ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-b hover:border-accent/30'}
    ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
>
```

**Step 3: Remove `shadow-sm` DS violations**

Per DESIGN_SYSTEM.md, shadows are forbidden on cards and general elements (the DS only permits `shadow-sm` on the active pill button inside segmented toggles). Fix:

```jsx
// Line ~437: phase accordion expand button
// BEFORE:
className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center shadow-sm bg-bg-card border border-border rounded"
// AFTER:
className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center bg-bg-card border border-border rounded"

// Line ~469: phase Card wrapper
// BEFORE:
<Card className="p-0 overflow-hidden border border-border/50 shadow-sm">
// AFTER:
<Card className="p-0 overflow-hidden border border-border/50">
```

> Note: Keep `shadow-sm` on the toggle active buttons (lines ~693, ~699) — those ARE specified by the DS for segmented toggle active states.

**Step 4: Verify**
Run `npm run dev`. Check a task — the fade to 60% opacity should feel smooth (200ms). The strikethrough text color change should transition. Inspect the phase card borders — no shadow should be visible.

**Step 5: Final commit**
```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner" && git add src/components/tabs/TodoTab.jsx && git commit -m "fix(todo): smooth completion transitions; remove shadow-sm DS violations

200ms opacity/text transition on done state. Remove illegal shadows from
card and accordion button per DESIGN_SYSTEM.md no-shadows rule.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Verification Checklist

After all 6 tasks:

- [ ] **List mode** looks identical to before (except slim Wanda banner + quick add bar)
- [ ] **Board mode** shows 4 horizontal columns with min-width 270px + horizontal scroll
- [ ] **Cross-phase DnD** works in both modes (drag a card from Planning to Booking)
- [ ] **Quick Add** creates a task in the selected phase via Enter or button click
- [ ] **Progressive disclosure**: date, notes chevron, deep-link all hide on tasks with no value; appear on hover
- [ ] **Progressive disclosure**: date on a task with `dueDate` set always shows (no hide)
- [ ] **Empty state**: phases visible immediately; Wanda banner is a slim strip above them
- [ ] **Completion animation**: checking a task fades smoothly (200ms) + checkbox pops
- [ ] **No shadows** on cards or buttons (except toggle active states)
- [ ] **Read-only mode**: quick add bar hidden, all interactions disabled
