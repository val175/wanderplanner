# Design: Wanda `add_idea_to_voting_room` Tool

**Date:** 2026-03-09
**Status:** Approved

## Summary

Extend Wanda's tool-calling system with a second tool — `add_idea_to_voting_room` — that lets users ask for activity, hotel, or restaurant recommendations and instantly add Wanda's suggestions to the trip's voting room with one click.

## Approach

**Approach B — Generic `ActionPill` base + tool-specific wrappers.**

The existing `ActionPill` component becomes a shared base that handles: `done` state derivation, button styling, `addToolResult` call, and toast. Two thin wrapper components — `PackingPill` and `VotingPill` — map their tool's `inv.input` fields onto the base. The message renderer does a single unified pass over all `tool-*` parts.

## Data Flow

```
User: "What should we do in Kyoto?"
  → Gemini calls add_idea_to_voting_room (x2-3)
    → Frontend receives tool-add_idea_to_voting_room parts (state: input-available)
      → VotingPill renders: "🎭 Add Fushimi Inari Hike +"
        → User clicks
          → dispatch(ADD_IDEA, { title, type, description, emoji, priceDetails, sourceName, proposerId })
          → addToolResult({ tool, toolCallId, output: 'added' })
          → showToast with undo
```

## Tool Schema (`api/chat.js`)

```js
add_idea_to_voting_room: tool({
  description: [
    'Add ONE travel idea/recommendation to the trip voting room.',
    'IMPORTANT: Call once per idea — never group multiple ideas in one call.',
    'Correct: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail", emoji: "⛩️", priceDetails: "Free" }',
    'Correct: { title: "Nishiki Market", type: "food", description: "Street food and local snacks", emoji: "🍜", priceDetails: "~$15/person" }',
    'Call up to 3 times per response for different recommendations.',
  ].join(' '),
  parameters: z.object({
    title:        z.string().describe('Name of the place or activity, e.g. "Fushimi Inari Hike"'),
    type:         z.enum(['lodging', 'activity', 'food', 'transport', 'shopping', 'other']).describe('Category'),
    description:  z.string().describe('One sentence describing the idea'),
    emoji:        z.string().describe('One relevant emoji, e.g. "⛩️"'),
    priceDetails: z.string().describe('Estimated cost, e.g. "~$50/person", "Free", or "TBD"'),
  }),
})
```

## Idea Payload (client-side construction)

All voting room table columns must be populated:

| Column       | Source                          |
|--------------|---------------------------------|
| title        | `inv.input.title`               |
| type         | `inv.input.type`                |
| description  | `inv.input.description`         |
| emoji        | `inv.input.emoji`               |
| priceDetails | `inv.input.priceDetails`        |
| proposerId   | `auth.currentUser?.uid`         |
| sourceName   | `'Wanda AI'` (hardcoded)        |
| createdAt    | auto-set by reducer             |
| url          | `null` (Wanda has no URLs)      |
| imageUrl     | `null`                          |

## Component Refactor (`AIAssistant.jsx`)

### Before
```jsx
const ActionPill = ({ inv }) => { /* packing-specific */ }
// ...filter for tool-add_to_packing_list only
```

### After
```jsx
// Shared base — styling, done state, addToolResult, toast
const ActionPill = ({ inv, toolName, emoji, label, onConfirm, onUndo, toastLabel }) => { ... }

// Packing wrapper
const PackingPill = ({ inv }) => {
  const { item, section, emoji } = inv.input || {}
  return <ActionPill inv={inv} toolName="add_to_packing_list" emoji={emoji} label={item}
    onConfirm={id => dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: { id, name: item, section: section || 'Misc' } })}
    onUndo={id => dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: id })}
    toastLabel="added to packing" />
}

// Voting wrapper
const VotingPill = ({ inv }) => {
  const { title, type, description, emoji, priceDetails } = inv.input || {}
  return <ActionPill inv={inv} toolName="add_idea_to_voting_room" emoji={emoji} label={title}
    onConfirm={id => dispatch({ type: ACTIONS.ADD_IDEA, payload: {
      id, title, type: type || 'other', description: description || '',
      emoji: emoji || '✨', priceDetails: priceDetails || 'TBD',
      sourceName: 'Wanda AI', proposerId: auth.currentUser?.uid || null,
      url: null, imageUrl: null,
    }})}
    onUndo={id => dispatch({ type: ACTIONS.DELETE_IDEA, payload: id })}
    toastLabel="added to voting room" />
}

// Unified renderer
{m.role === 'assistant' && m.parts
  ?.filter(p => ['tool-add_to_packing_list', 'tool-add_idea_to_voting_room'].includes(p.type) && p.state !== 'input-streaming')
  .map(p => p.type === 'tool-add_to_packing_list'
    ? <PackingPill key={p.toolCallId} inv={p} />
    : <VotingPill key={p.toolCallId} inv={p} />
  )
}
```

## System Prompt Addition (`useAI.js`)

```
🔧 TOOL: add_idea_to_voting_room
Call proactively when the user asks for recommendations on what to do, where to stay, or where to eat.
Rules: Call ONCE per idea. Never group ideas. Call up to 3 times per response.
Example — for Kyoto activities, make 3 separate calls:
  call 1: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail", emoji: "⛩️", priceDetails: "Free" }
  call 2: { title: "Arashiyama Bamboo Grove", type: "activity", description: "Iconic bamboo forest walk", emoji: "🎋", priceDetails: "Free" }
  call 3: { title: "Nishiki Market", type: "food", description: "Street food and local snacks", emoji: "🍜", priceDetails: "~$15/person" }
```

## Files Changed

1. `api/chat.js` — add `add_idea_to_voting_room` to `WANDA_TOOLS`
2. `src/hooks/useAI.js` — add tool instructions to system prompt
3. `src/components/shared/AIAssistant.jsx` — refactor `ActionPill`, add `PackingPill` + `VotingPill`, update renderer
