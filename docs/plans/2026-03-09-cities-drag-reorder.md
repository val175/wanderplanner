# Cities Drag-to-Reorder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Cities tab table rows drag-to-reorder using the same native HTML5 drag-and-drop pattern as the Itinerary tab, with the new order syncing to `trip.destinations` so the Mapbox route map updates accordingly.

**Architecture:** Two changes — (1) add `REORDER_CITIES` reducer action that reorders `trip.cities` and stable-sorts `trip.destinations` to match, (2) make `CityRow` draggable with a `.city-drag-handle` grip icon, `dataTransfer` JSON messaging, and `dragOver` visual ring feedback — identical to how `DayGroupTable` works in `ItineraryTab.jsx`.

**Tech Stack:** React, native HTML5 drag-and-drop API (`draggable`, `dataTransfer`), existing `ACTIONS` / `tripReducer`, Tailwind CSS.

---

### Task 1: Add `REORDER_CITIES` to the reducer

**Files:**
- Modify: `src/state/tripReducer.js`

**Step 1: Add the action type**

In `src/state/tripReducer.js`, find the `ACTIONS` object (around line 4). Inside the `// ─── Cities ───` block add:

```js
REORDER_CITIES: 'REORDER_CITIES',
```

Place it alongside the other city actions (`UPDATE_CITY`, `ADD_CITY`, `DELETE_CITY`).

**Step 2: Add the reducer case**

Find the `// ─── Cities ───` section of the `switch` statement (around line 566). Add this case **before** `case ACTIONS.UPDATE_CITY`:

```js
// payload: { fromIndex, toIndex }
case ACTIONS.REORDER_CITIES: {
  return updateTrip(state, activeTripId, trip => {
    const cities = [...trip.cities]
    const [moved] = cities.splice(payload.fromIndex, 1)
    cities.splice(payload.toIndex, 0, moved)

    // Sync destinations order: stable-sort destinations so they follow
    // the new cities order. Destinations whose city name is not in
    // the cities array (e.g. a round-trip return leg) sort to the end.
    const cityOrder = Object.fromEntries(cities.map((c, i) => [c.city, i]))
    const destinations = [...(trip.destinations || [])].sort((a, b) => {
      const ai = cityOrder[a.city] ?? Infinity
      const bi = cityOrder[b.city] ?? Infinity
      return ai - bi
    })

    return { ...trip, cities, destinations }
  })
}
```

**Step 3: Verify**

Start the dev server (`npm run dev`) and open the app. No crashes = reducer is wired up. The action won't do anything visible yet.

**Step 4: Commit**

```bash
git add src/state/tripReducer.js
git commit -m "feat(cities): add REORDER_CITIES reducer action with destinations sync"
```

---

### Task 2: Make `CityRow` draggable

**Files:**
- Modify: `src/components/tabs/CitiesTab.jsx`

**Context — how ItineraryTab does it:**

`DayGroupTable` (in `ItineraryTab.jsx`) sets `draggable={!isReadOnly}` on a `<div>`. It guards `onDragStart` with `e.target.closest('.group-drag-handle')` so only the grip icon starts a drag. It stores the source id in `dataTransfer` as JSON. On `onDrop` it reads the JSON, looks up both indices in `trip.itinerary`, and calls `onReorderDay`. It tracks `dragOverGroup` state to show a `ring-2 ring-accent` highlight.

Do exactly the same on `<tr>` in `CityRow`.

**Step 1: Add `dragOver` state and drag handlers to `CityRow`**

`CityRow` currently receives only `{ city }`. It already has access to `activeTrip` and `dispatch` from `useTripContext()`. Add `dragOver` state and the four drag event handlers.

Replace the current `CityRow` function signature and body up through the `return` statement:

```jsx
function CityRow({ city }) {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  const handleWandaFill = async () => {
    triggerHaptic('medium')
    setLoading(true)
    try {
      const guideObj = await generateCityGuide(city, activeTrip)
      updateCity(guideObj)
    } catch (e) {
      console.error(e)
      dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: "Wanda couldn't generate the guide right now.", type: 'error' } })
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    if (isReadOnly) return
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    const { type, cityId } = JSON.parse(raw)
    if (type !== 'city') return
    const cities = activeTrip.cities || []
    const fromIndex = cities.findIndex(c => c.id === cityId)
    const toIndex = cities.findIndex(c => c.id === city.id)
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      dispatch({ type: ACTIONS.REORDER_CITIES, payload: { fromIndex, toIndex } })
    }
  }

  const needsInspiration = !(city.weather || city.currencyTip || city.mustDo)
```

**Step 2: Add drag attributes and the handle cell to `<tr>`**

Replace the opening `<tr>` line:

```jsx
  return (
    <tr
      className={`group hover:bg-bg-hover transition-colors border-t border-border/20 ${dragOver && !isReadOnly ? 'ring-2 ring-inset ring-accent' : ''}`}
      draggable={!isReadOnly}
      onDragStart={e => {
        if (isReadOnly || !e.target.closest('.city-drag-handle')) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'city', cityId: city.id }))
      }}
      onDragOver={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
```

**Step 3: Add the drag handle `<td>` as the first cell (before the flag cell)**

Insert this as the very first `<td>` inside the `<tr>`, before the existing flag cell:

```jsx
      {!isReadOnly && (
        <td className="px-1 py-3 align-middle text-center w-6 shrink-0">
          <div className="city-drag-handle cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity select-none">
            ⠿
          </div>
        </td>
      )}
```

**Step 4: Update the table header to include the handle column**

In `CitiesTab` (the main export), find the `<thead>` block. Add a matching empty header cell as the **first** `<th>`:

```jsx
{!isReadOnly && (
  <th className="px-1 py-2 w-6 shrink-0"></th>
)}
```

Place it before the flag `<th>` (the one with `width: '48px'`).

**Step 5: Verify visually**

1. Start dev server and go to the Cities tab.
2. Hover over a row — the `⠿` handle should appear (faint, then opaque on hover).
3. Grab the handle and drag a row — the row you drag over should get an accent ring.
4. Drop it — the row should move to the new position.
5. Go to the Overview tab — the Mapbox route should reflect the new city order.
6. Verify `isReadOnly` trips show no handle and rows are not draggable.

**Step 6: Commit**

```bash
git add src/components/tabs/CitiesTab.jsx
git commit -m "feat(cities): add drag-to-reorder rows matching ItineraryTab pattern"
git push
```
