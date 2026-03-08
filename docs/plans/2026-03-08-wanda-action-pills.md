# Wanda Action Pills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When Wanda gives packing advice, she emits a structured tool call that renders as a clickable action pill — one tap adds the item to the packing list with an undo toast.

**Architecture:** Vercel AI SDK native tool calling. `api/chat.js` adds a `tools` parameter to `streamText` defining `add_to_packing_list` (no `execute` — client-side only). `useChat` surfaces tool calls as `m.toolInvocations` on each message. `AIAssistant.jsx` renders `ActionPill` components for pending tool calls and dispatches to the trip reducer on click.

**Tech Stack:** Vercel AI SDK (`ai@6.0.105`), `@ai-sdk/react` (`useChat`), React, Zod (already a transitive dep), Firebase/Firestore trip reducer.

**Design doc:** `docs/plans/2026-03-08-wanda-action-pills-design.md`

---

## Task 1: Add tool definition to `api/chat.js`

**Files:**
- Modify: `api/chat.js`

### Step 1: Add imports

At the top of `api/chat.js`, add `tool` to the existing `ai` import and add `z` from `zod`:

```js
import { streamText, tool } from 'ai'
import { z } from 'zod'
```

The `zod` package is already installed as a transitive dep of `ai`. No `npm install` needed.

### Step 2: Define the shared tools object

Add this constant just above the `handler` function (after the `export const config` block):

```js
const WANDA_TOOLS = {
  add_to_packing_list: tool({
    description: 'Add an item to the trip packing list when contextually relevant (weather, destination-specific necessities, activity requirements).',
    parameters: z.object({
      item:    z.string().describe('Item name, e.g. "Compact umbrella" or "Reef-safe sunscreen"'),
      section: z.enum(['Documents', 'Clothing', 'Toiletries', 'Electronics', 'Health', 'Misc']).describe('Which packing section this belongs to'),
      emoji:   z.string().describe('A single relevant emoji for the item'),
    }),
  }),
}
```

### Step 3: Add `tools` to the Gemini flash-lite call

Find the first `streamText` call (the `gemini-3.1-flash-lite-preview` / `gemini-2.5-flash` loop). Add `tools: WANDA_TOOLS` to it:

```js
const result = await streamText({
    model: gemini.chat(modelId),
    system: systemPrompt,
    messages: modelMessages,
    tools: WANDA_TOOLS,         // ← add this line
})
```

### Step 4: Add `tools` to the OpenRouter fallback call

Same change on the second `streamText` call:

```js
const result = await streamText({
    model: openrouter.chat('mistralai/mistral-small-3.1-24b-instruct:free'),
    system: systemPrompt,
    messages: modelMessages,
    tools: WANDA_TOOLS,         // ← add this line
})
```

### Step 5: Verify the file looks correct

Run:
```bash
node --input-type=module --eval "import './api/chat.js'" 2>&1 | head -5
```
Expected: no output (no import errors). If you see "Cannot find package 'zod'" — run `npm install zod` in the project root.

### Step 6: Commit

```bash
git add api/chat.js
git commit -m "feat(chat): add add_to_packing_list tool to streamText"
```

---

## Task 2: Add tool instruction block to system prompt

**Files:**
- Modify: `src/hooks/useAI.js` — `buildTripSystemPrompt` function (ends around line 85)

### Step 1: Locate the return statement

Find the end of `buildTripSystemPrompt`. It currently returns a template literal ending with:
```
- Be warm and conversational, like a knowledgeable travel-savvy friend`
```

### Step 2: Append tool instruction block

Add this section to the END of the returned template literal, just before the closing backtick:

```
\n\n🔧 TOOLS AVAILABLE: add_to_packing_list
Call this tool proactively (alongside your conversational text, without asking permission) when:
- You mention weather, climate, or rainfall relevant to what to bring
- The user asks what to pack for a destination, activity, or climate
- You identify something destination-specific the user might forget
Valid sections: Documents, Clothing, Toiletries, Electronics, Health, Misc
You may call this tool 1–3 times per response. Do not call it for universally obvious items like "clothes".`
```

The full end of the return should now look like:

```js
  return `You are Wanda, a friendly AI travel assistant built into Wanderplan.
...
- Be warm and conversational, like a knowledgeable travel-savvy friend

🔧 TOOLS AVAILABLE: add_to_packing_list
Call this tool proactively (alongside your conversational text, without asking permission) when:
- You mention weather, climate, or rainfall relevant to what to bring
- The user asks what to pack for a destination, activity, or climate
- You identify something destination-specific the user might forget
Valid sections: Documents, Clothing, Toiletries, Electronics, Health, Misc
You may call this tool 1–3 times per response. Do not call it for universally obvious items like "clothes".`
```

### Step 3: Commit

```bash
git add src/hooks/useAI.js
git commit -m "feat(ai): add add_to_packing_list tool instruction to Wanda system prompt"
```

---

## Task 3: Add ActionPill + tool invocation rendering to `AIAssistant.jsx`

**Files:**
- Modify: `src/components/shared/AIAssistant.jsx`

This is the main frontend change. Do it in sub-steps.

### Step 1: Add imports

At the top of `AIAssistant.jsx`, add:

```js
import { generateId } from '../../utils/helpers'
import { ACTIONS } from '../../state/tripReducer'
```

### Step 2: Destructure additional context values

Find the line:
```js
const { activeTrip } = useContext(TripContext);
```

Replace it with:
```js
const { activeTrip, dispatch, showToast } = useContext(TripContext);
```

### Step 3: Destructure `addToolResult` from `useChat`

Find the `useChat` destructure:
```js
const { messages, sendMessage, status, error } = useChat({
```

Replace with:
```js
const { messages, sendMessage, status, error, addToolResult } = useChat({
```

### Step 4: Add the `ActionPill` sub-component

Add this component definition INSIDE the `AIAssistant` function body, just before the `return (` statement. (Defined inside so it closes over `dispatch`, `showToast`, `activeTrip`, `addToolResult` without prop-drilling.)

```jsx
// Renders a single action pill for a pending tool call
const ActionPill = ({ inv }) => {
  const [done, setDone] = useState(false)
  const { item, section, emoji } = inv.args || {}
  if (!item) return null

  const canAct = !!activeTrip && !done

  const handleClick = () => {
    if (!canAct) return
    const newId = generateId()
    dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: { id: newId, name: item, section: section || 'Misc' } })
    addToolResult({ toolCallId: inv.toolCallId, result: 'added' })
    showToast(`${emoji || '🧳'} ${item} added to packing`, {
      undo: () => dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: newId }),
    })
    setDone(true)
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
      <span style={{ fontSize: '14px' }}>{done ? '✅' : (emoji || '🧳')}</span>
      <span>{done ? 'Added' : `Add ${item}`}</span>
      {!done && <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: '2px' }}>+</span>}
    </button>
  )
}
```

> **Note on `useState`:** `ActionPill` uses `useState`, which is already imported at the top of the file (`import React, { useState, ... } from 'react'`). No new import needed.

### Step 5: Render pills after each assistant message bubble

Find the messages render loop. Currently it renders each message like:
```jsx
{messages.map(m => (
  <div key={m.id} style={{ display: 'flex', justifyContent: ... }}>
    {m.role === 'assistant' && ( /* avatar */ )}
    <div style={{ padding: '9px 13px', ... }}>
      {m.parts ? m.parts.filter(...).map(...) : m.content}
    </div>
  </div>
))}
```

After the closing `</div>` of the message bubble (but inside the outer `<div key={m.id}>`), add the pills:

```jsx
{messages.map(m => (
  <div
    key={m.id}
    style={{
      display: 'flex',
      justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
      flexDirection: 'column',        // ← change from default to column so pills stack below
      alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
    }}
  >
    <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
      {m.role === 'assistant' && ( /* existing avatar div unchanged */ )}
      <div style={{ padding: '9px 13px', ... }}>
        {m.parts ? ... : m.content}
      </div>
    </div>

    {/* Action pills — rendered for assistant messages with tool invocations */}
    {m.role === 'assistant' && m.toolInvocations?.map(inv =>
      inv.toolName === 'add_to_packing_list' ? (
        <ActionPill key={inv.toolCallId} inv={inv} />
      ) : null
    )}
  </div>
))}
```

> **Important:** The outer div needs `flexDirection: 'column'` so pills render below the bubble row, not beside it. Wrap the existing avatar + bubble in an inner flex row div.

### Step 6: Manual verification

Start the dev server:
```bash
npm run dev
```

Open Wanda. With a trip selected, ask: **"What should I pack for rainy weather in Osaka?"**

Expected result:
1. Wanda streams a text response about rain gear
2. Below the message bubble, one or more accent-colored pills appear (e.g. `☂️ Add Compact umbrella +`)
3. Click a pill → it turns green (`✅ Added`), a toast appears at top/bottom of screen
4. Navigate to the Packing tab → the item is present under the correct section
5. Click "Undo" in the toast → item disappears from the packing list

Also test with **no trip selected**: pills should appear greyed-out and be non-clickable.

### Step 7: Commit

```bash
git add src/components/shared/AIAssistant.jsx
git commit -m "feat(ui): add ActionPill component for Wanda packing list tool calls"
```

---

## Task 4: Deploy

```bash
vercel --prod
```

Verify on production URL that the feature works end-to-end with a real Gemini API call.

```bash
git push
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Pills never appear | AI not calling the tool | Check system prompt was updated; ask "what should I pack?" explicitly |
| `Cannot find module 'zod'` on deploy | Zod not in `package.json` deps | `npm install zod && git add package.json package-lock.json && git commit -m "chore: add zod dep"` |
| Tool call appears but pill state resets on next message | `done` state lost on re-render | Normal — `done` is local per-render. If needed, track in a `Set` ref at the `AIAssistant` level |
| `addToolResult is not a function` | Old version of `@ai-sdk/react` | Check `package.json` — needs `@ai-sdk/react` ≥ 0.0.20 |
| Pill renders but dispatch doesn't fire | `dispatch` undefined | Verify `TripContext` is a parent of `AIAssistant` in `App.jsx` (it is — confirmed in codebase) |
