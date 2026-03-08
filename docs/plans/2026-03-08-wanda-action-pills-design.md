# Wanda Generative UI — Action Pills (v1: Packing List)

**Date:** 2026-03-08
**Status:** Approved
**Approach:** Vercel AI SDK Native Tool Calling

---

## Problem

Wanda currently answers questions but cannot act on the trip. When she gives packing advice ("Osaka gets typhoon rain in September"), the user must manually navigate to the packing tab and add the item themselves. This breaks the conversational flow and wastes a high-intent moment.

## Goal

When Wanda mentions a packing-relevant item, she simultaneously emits a structured tool call. The frontend renders a clickable action pill beneath her message bubble. One tap adds the item to the packing list with an undo toast. No confirmation dialog, no navigation required.

---

## Architecture

### Approach Selected: Vercel AI SDK Native Tool Calling

The current stack uses `streamText` (Vercel AI SDK) in `api/chat.js` and `useChat` (`@ai-sdk/react`) in `AIAssistant.jsx`. Both have built-in tool call support — `streamText` accepts a `tools` parameter and emits tool-call stream events; `useChat` surfaces them as `m.toolInvocations` on each message. No new infrastructure needed.

### Tool Definition (`api/chat.js`)

```js
import { tool } from 'ai'
import { z } from 'zod'

tools: {
  add_to_packing_list: tool({
    description: "Add an item to the trip packing list when contextually relevant.",
    parameters: z.object({
      item:    z.string().describe('Item name, e.g. "Compact umbrella"'),
      section: z.enum(['Documents','Clothing','Toiletries','Electronics','Health','Misc']),
      emoji:   z.string().describe('Single relevant emoji'),
    }),
  }),
}
```

No `execute` function — server emits the call, client handles execution. Applied to all three `streamText` call sites (Gemini flash-lite, Gemini flash, OpenRouter fallback).

### System Prompt Instruction (`useAI.js` → `buildTripSystemPrompt`)

Append to the system prompt:

```
🔧 TOOL: add_to_packing_list
Call this tool proactively (alongside your text response, without asking first) when:
- You mention weather or climate conditions relevant to what to bring
- The user asks what to pack for a destination or activity
- You identify something destination-specific the user should not forget
Valid sections: Documents, Clothing, Toiletries, Electronics, Health, Misc
You may call this tool 1–3 times per response. Never call it for items already common knowledge.
```

---

## Data Flow

```
User: "Will it rain in Osaka in September?"
  ↓
api/chat.js → streamText({ tools: { add_to_packing_list } })
  ↓ emits two stream events concurrently:
  [text-delta]  "Osaka's September is typhoon season — expect heavy rain..."
  [tool-call]   add_to_packing_list({ item:"Compact umbrella", section:"Clothing", emoji:"☂️" })
  ↓
useChat hook: messages[n].toolInvocations = [{ state:"call", toolCallId, toolName, args }]
  ↓
AIAssistant renders:
  ┌─────────────────────────────────────────┐
  │ 🪄  Osaka's September is typhoon season │
  │     — expect heavy rain...              │
  │  ┌────────────────────────────┐         │
  │  │  ☂️  Add Compact umbrella  +│  ← pill│
  │  └────────────────────────────┘         │
  └─────────────────────────────────────────┘
  ↓ user taps pill
  1. const newId = generateId()
  2. dispatch ADD_PACKING_ITEM { name:"Compact umbrella", section:"Clothing" }
  3. addToolResult(toolCallId, "added")   ← closes the conversation tool loop
  4. showToast("☂️ Compact umbrella added", { undo: () => dispatch(DELETE_PACKING_ITEM, newId) })
  5. pill → green ✅ "Added" (non-interactive)
```

---

## Component Changes

### `AIAssistant.jsx`

1. Destructure `dispatch`, `showToast` from `TripContext` (already available, not currently used).
2. Import `ACTIONS` from `tripReducer`.
3. Import `generateId` from `helpers` (already used elsewhere).
4. Add `addToolResult` from `useChat` destructure (already returned by the hook).
5. Add inline `ActionPill` sub-component:
   - Props: `{ inv, activeTrip, dispatch, showToast, addToolResult }`
   - State: `done` (boolean, local)
   - Renders only for `toolName === 'add_to_packing_list'`
   - Disabled + grey tooltip if `!activeTrip`
   - On click: generate ID → dispatch → addToolResult → showToast with undo → setDone(true)
6. In the messages render loop, after each assistant message bubble, render pills for `m.toolInvocations`.

### Message Render Update

```jsx
{m.toolInvocations?.map(inv => (
  inv.toolName === 'add_to_packing_list' && (
    <ActionPill key={inv.toolCallId} inv={inv} ... />
  )
))}
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No active trip | Pill renders greyed-out; click does nothing; tooltip "Select a trip first" |
| AI emits malformed tool args | `inv.args` check — if `item` is missing, pill is not rendered |
| `addToolResult` throws | Swallowed silently; dispatch already succeeded |
| User clicks undo after tab change | `DELETE_PACKING_ITEM` fires against stored ID — always works regardless of current tab |
| AI calls tool 0 times | Normal response, no pills rendered — no UX regression |

---

## Files to Change

| File | Change |
|---|---|
| `api/chat.js` | Add `tool` + `z` imports; add `tools` param to all 3 `streamText` calls |
| `src/hooks/useAI.js` | Append tool instruction block to `buildTripSystemPrompt` |
| `src/components/shared/AIAssistant.jsx` | Destructure `dispatch`/`showToast`; add `addToolResult`; add `ActionPill`; render pills per message |

---

## Out of Scope (v1)

- Itinerary gap-filling actions
- Expense logging actions
- Idea pinning actions
- Multiple simultaneous action types
- Persistent "suggested by Wanda" tag on packing items
