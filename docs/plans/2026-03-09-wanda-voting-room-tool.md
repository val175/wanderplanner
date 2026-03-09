# Wanda Voting Room Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an `add_idea_to_voting_room` Wanda tool that renders clickable pills — identical UX to packing list pills — so users can one-tap Wanda's recommendations into the trip voting room.

**Architecture:** Refactor the existing `ActionPill` component in `AIAssistant.jsx` into a generic base that accepts props for label, emoji, onConfirm, and onUndo. Wrap the existing packing logic in a thin `PackingPill` and add a parallel `VotingPill`. Register the new tool in `api/chat.js` and add system prompt instructions in `useAI.js`.

**Tech Stack:** React (Vite), Vercel AI SDK `ai@6` (`useChat`, `addToolResult`), `@ai-sdk/google`, Zod, Firebase Auth (for `proposerId`)

---

### Task 1: Add `add_idea_to_voting_room` tool to the backend

**Files:**
- Modify: `api/chat.js` — extend `WANDA_TOOLS`

**Step 1: Open `api/chat.js` and locate `WANDA_TOOLS`**

The object currently has one entry: `add_to_packing_list`. Add a second entry immediately after it:

```js
add_idea_to_voting_room: tool({
    description: [
        'Add ONE travel recommendation to the trip voting room.',
        'IMPORTANT: Call once per idea — never group multiple ideas in one call.',
        'Correct: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail", emoji: "⛩️", priceDetails: "Free" }',
        'Correct: { title: "The Peninsula Hotel", type: "lodging", description: "Luxury hotel in city center", emoji: "🏨", priceDetails: "~$300/night" }',
        'Call up to 3 times per response for different recommendations.',
    ].join(' '),
    parameters: z.object({
        title:        z.string().describe('Name of the place or activity, e.g. "Fushimi Inari Hike". Plain string, not an array.'),
        type:         z.enum(['lodging', 'activity', 'food', 'transport', 'shopping', 'other']).describe('Category of the idea'),
        description:  z.string().describe('One sentence describing why this is worth considering'),
        emoji:        z.string().describe('One relevant emoji character, e.g. "⛩️"'),
        priceDetails: z.string().describe('Estimated cost as a plain string, e.g. "~$50/person", "Free", or "TBD"'),
    }),
}),
```

**Step 2: Verify the file parses cleanly**

```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner"
node --input-type=module < api/chat.js 2>&1 | head -5
```
Expected: no output (or only the "no handler invoked" edge-runtime note — not a syntax error).

**Step 3: Commit**

```bash
git add api/chat.js
git commit -m "feat(wanda): add add_idea_to_voting_room tool schema"
```

---

### Task 2: Add system prompt instructions for the new tool

**Files:**
- Modify: `src/hooks/useAI.js` — append to the tools section at the bottom of `buildTripSystemPrompt`

**Step 1: Locate the tools section in `useAI.js`**

Find the block that starts with `🔧 TOOL: add_to_packing_list`. It ends with the backtick that closes the template literal. Append a new block immediately before that closing backtick:

```js
// existing packing tool block ends here...
Do not call it for universally obvious items like "clothes" or "shoes".

🔧 TOOL: add_idea_to_voting_room
Call proactively when the user asks for recommendations on what to do, where to stay, or where to eat.
Rules: Call ONCE per idea with individual fields. Never pass arrays. Call up to 3 times per response.
Example — for Kyoto recommendations, make 3 separate calls:
  call 1: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail through thousands of torii", emoji: "⛩️", priceDetails: "Free" }
  call 2: { title: "Arashiyama Bamboo Grove", type: "activity", description: "Iconic bamboo forest walk in western Kyoto", emoji: "🎋", priceDetails: "Free" }
  call 3: { title: "Nishiki Market", type: "food", description: "Street food and local snacks in narrow arcade", emoji: "🍜", priceDetails: "~$15/person" }
Do not call it for generic suggestions like "find a hotel" — only specific named places.`  // ← this is the closing backtick of the template literal
```

**Step 2: Verify the system prompt renders correctly**

Open the browser dev console after the local dev server is running and check that `_systemPromptRef` (the module-level variable) contains the new tool block. Or simply read the file and confirm the template literal is still valid (no unclosed backticks).

**Step 3: Commit**

```bash
git add src/hooks/useAI.js
git commit -m "feat(wanda): add voting room tool instructions to system prompt"
```

---

### Task 3: Refactor `ActionPill` into generic base + `PackingPill` wrapper

**Files:**
- Modify: `src/components/shared/AIAssistant.jsx` lines 88–140 (the `ActionPill` component)

**Step 1: Replace the existing `ActionPill` with a generic base and `PackingPill` wrapper**

Delete the current `ActionPill` component (lines 88–140) and replace it with:

```jsx
// ── Generic pill base ────────────────────────────────────────────────────────
// Handles shared logic: done state, styling, addToolResult, toast + undo.
// Tool-specific wrappers (PackingPill, VotingPill) map inv.input → these props.
const ActionPill = ({ inv, toolName, emoji, label, onConfirm, onUndo, toastLabel }) => {
  const [localDone, setLocalDone] = useState(false)
  const done = localDone || inv.state === 'output-available'
  if (!label) return null

  const canAct = !!activeTrip && !done

  const handleClick = () => {
    if (!canAct) return
    const newId = generateId()
    onConfirm(newId)
    try { addToolResult({ tool: toolName, toolCallId: inv.toolCallId, output: 'added' }) } catch {}
    showToast(`${emoji || '✨'} ${label} ${toastLabel}`, {
      undo: () => onUndo(newId),
    })
    setLocalDone(true)
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canAct}
      title={!activeTrip ? 'Select a trip first' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        marginTop: '6px',
        borderRadius: '9999px',
        border: `1px solid ${done ? 'var(--color-success, #22c55e)' : 'var(--color-accent)'}`,
        background: done ? 'rgba(34,197,94,0.08)' : 'transparent',
        color: done ? 'var(--color-success, #22c55e)' : 'var(--color-accent)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: canAct ? 'pointer' : 'default',
        opacity: !activeTrip ? 0.45 : 1,
        transition: 'all 0.15s',
        letterSpacing: '-0.01em',
      }}
    >
      <span style={{ fontSize: '14px' }}>{done ? '✅' : (emoji || '✨')}</span>
      <span>{done ? 'Added' : `Add ${label}`}</span>
      {!done && <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: '2px' }}>+</span>}
    </button>
  )
}

// ── Packing list pill ────────────────────────────────────────────────────────
const PackingPill = ({ inv }) => {
  const { item, section, emoji } = inv.input || {}
  return (
    <ActionPill
      inv={inv}
      toolName="add_to_packing_list"
      emoji={emoji || '🧳'}
      label={item}
      onConfirm={newId => dispatch({
        type: ACTIONS.ADD_PACKING_ITEM,
        payload: { id: newId, name: item, section: section || 'Misc' },
      })}
      onUndo={newId => dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: newId })}
      toastLabel="added to packing"
    />
  )
}

// ── Voting room pill ─────────────────────────────────────────────────────────
const VotingPill = ({ inv }) => {
  const { title, type, description, emoji, priceDetails } = inv.input || {}
  return (
    <ActionPill
      inv={inv}
      toolName="add_idea_to_voting_room"
      emoji={emoji || '💡'}
      label={title}
      onConfirm={newId => dispatch({
        type: ACTIONS.ADD_IDEA,
        payload: {
          id: newId,
          title,
          type: type || 'other',
          description: description || '',
          emoji: emoji || '✨',
          priceDetails: priceDetails || 'TBD',
          sourceName: 'Wanda AI',
          proposerId: auth.currentUser?.uid || null,
          url: null,
          imageUrl: null,
        },
      })}
      onUndo={newId => dispatch({ type: ACTIONS.DELETE_IDEA, payload: newId })}
      toastLabel="added to voting room"
    />
  )
}
```

**Step 2: Update the message renderer to handle both tools**

Find the existing pills render block (currently filters for `tool-add_to_packing_list` only) and replace it:

```jsx
{/* Action pills — both tools handled; type is 'tool-{name}' in ai@6 */}
{m.role === 'assistant' && m.parts
  ?.filter(p =>
    (p.type === 'tool-add_to_packing_list' || p.type === 'tool-add_idea_to_voting_room')
    && p.state !== 'input-streaming'
  )
  .map(p => p.type === 'tool-add_to_packing_list'
    ? <PackingPill key={p.toolCallId} inv={p} />
    : <VotingPill key={p.toolCallId} inv={p} />
  )
}
```

**Step 3: Verify local dev server compiles without errors**

Check the preview server logs — should be zero Babel/React errors:
```bash
# In the preview tool or terminal watching the dev server
# Expected: no red errors in the console, login page renders
```

**Step 4: Commit**

```bash
git add src/components/shared/AIAssistant.jsx
git commit -m "feat(wanda): refactor ActionPill + add VotingPill for voting room tool"
```

---

### Task 4: Deploy and verify end-to-end

**Files:** none (deploy only)

**Step 1: Deploy to production**

```bash
cd "/Users/val/Documents/Claude Projects/Trip Planner"
vercel --prod
```

Expected: build completes, aliased to `https://wanderplan-rust.vercel.app`

**Step 2: Manual smoke test — packing pills still work**

1. Open https://wanderplan-rust.vercel.app, log in, select a trip
2. Ask Wanda: *"What should I pack for a rainy trip?"*
3. Expected: text response + 1–3 pills showing `🧥 Add Rain jacket +`
4. Click a pill → item appears in packing list tab, toast shows with undo

**Step 3: Manual smoke test — voting room pills**

1. Ask Wanda: *"What are some good restaurants in Tokyo?"*
2. Expected: text response + 1–3 pills showing e.g. `🍣 Add Tsukiji Outer Market +`
3. Click a pill → idea appears in voting room tab with:
   - ✅ Title populated
   - ✅ Category set (e.g. "Restaurants" / food)
   - ✅ Est. cost populated (e.g. "~$20/person")
   - ✅ Added by: current user
   - ✅ Date: today
   - ✅ Source: "Wanda AI"
4. Undo toast works (idea removed)

**Step 4: Commit + push if not already pushed**

```bash
git push
```

---

### Task 5: Clean up and final commit

**Step 1: Remove the debug `console.log` lines from `api/chat.js`** (optional — they're low-noise but worth cleaning)

Lines added during debugging:
```js
console.log(`[chat] trying model=${modelId}`)
// ...
console.log(`[chat] streaming with model=${modelId}`)
```

**Step 2: Commit**

```bash
git add api/chat.js
git commit -m "chore: remove debug console.logs from chat api"
git push
```
