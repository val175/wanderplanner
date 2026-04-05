# AI Free-Tier Optimization & Scaling Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Make sure to commit after each logical task. Our primary goal is to drastically reduce token usage and API calls to stay safely within the Google AI Studio free tier limits (15-30 RPM, 1500 RPD).

## Task 1: Dynamic Context Windowing in `useAI.js`
**Goal:** Stop sending the entire 15,000+ token trip state on every single chat turn. Only send what is relevant to the user's current context.
**Files to Modify:** `src/hooks/useAI.js`

**Instructions for Claude:**
1. Locate `buildTripSystemPrompt(trip)` in `src/hooks/useAI.js`.
2. Update the function signature to accept `(trip, activeTab = 'overview')`.
3. Refactor the string generation so that:
   - **Core details** (Name, Location, Dates, Travelers, Total Budget, Status) are *always* included.
   - **Tab-specific details** are dynamically injected:
     - If `activeTab === 'budget'`, include the detailed `budgetSummary`.
     - If `activeTab === 'itinerary' || activeTab === 'cities'`, include the `itinerarySummary` and `dayLocationTable`.
     - If `activeTab === 'voting'`, include the `votingIdeas` context.
     - If `activeTab === 'packing'`, include the packing list stats.
     - If `activeTab === 'todo'`, include the todos.
4. Ensure the prompt explicitly tells Wanda her tools are available regardless of the tab, but her context is currently focused on `activeTab`.

## Task 2: Refactor Wanda Tools to Accept Arrays
**Goal:** Prevent the LLM from making multiple independent tool calls (which eats output tokens and risks timing out). Batch them into arrays.
**Files to Modify:** `api/chat.js`

**Instructions for Claude:**
1. In `api/chat.js`, locate `WANDA_TOOLS`.
2. Update `add_to_packing_list`:
   - Change `item`, `section`, and `emoji` parameters to instead be an `items` array containing objects with `item`, `section`, and `emoji`.
   - Update the description: *"Add one or more specific packing items... Call ONCE with an array of items."* Provide a corrected JSON example.
3. Update `add_idea_to_voting_room`:
   - Change parameters to an `ideas` array containing objects with `title`, `type`, `description`, `emoji`, `priceDetails`.
   - Update the description: *"Add one or more travel recommendations... Call ONCE with an array of ideas."* Provide a corrected JSON example.
4. Update `add_budget_alert`:
   - Change parameters to an `alerts` array.
   - Update the description to enforce calling ONCE with an array.

## Task 3: The Hybrid Search Overhaul (Part 1 - Minified AI Payload)
**Goal:** Drastically reduce the token cost of `api/semantic-search.js` by filtering the JSON before sending it to the model.
**Files to Modify:** The frontend file calling the search endpoint (likely `src/components/modal/GlobalSearchModal.jsx` or similar, check where `/api/semantic-search` is fetched).

**Instructions for Claude:**
1. Locate the fetch call to `/api/semantic-search`.
2. Instead of passing the raw `trip` object, create a `minifiedTrip` object.
3. `minifiedTrip` should ONLY include:
   - `id`, `name`, `destinations`
   - `ideas`: Mapped to just `{ id, title, description, type }` (strip out comments, votes, creator IDs).
   - `itinerary`: Mapped to just `{ id, dayNumber, location, activities: activities.map(a => ({ id, name, category, location })) }`.
4. Do NOT include budget, todos, packing list, or bookings in this payload.

## Task 4: The Hybrid Search Overhaul (Part 2 - Client-Side Fuzzy Search)
**Goal:** Use 0-cost client-side search for standard lists (Todos, Packing, Budget) to save AI requests.
**Files to Modify:** `src/components/modal/GlobalSearchModal.jsx` (or wherever search state is managed), `package.json`.

**Instructions for Claude:**
1. Run `npm install fuse.js`.
2. In the search component, implement a `Fuse` instance that searches the local `trip.todos`, `trip.packingList`, `trip.budget`, and `trip.bookings`.
3. When the user types a query, run the local `Fuse` search immediately to populate instant results for those tabs.
4. Only trigger the fetch to `/api/semantic-search` (using the minified payload from Task 3) for deep semantic matches in Ideas and Itinerary. Merge the AI results with the local Fuse results.

## Here is a structured, task-by-task implementation plan ready for Claude Code. You can save this as `docs/plans/2026-04-05-ai-free-tier-optimization.md` and instruct Claude to execute it.

***

# AI Free-Tier Optimization & Scaling Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Make sure to commit after each logical task. Our primary goal is to drastically reduce token usage and API calls to stay safely within the Google AI Studio free tier limits (15-30 RPM, 1500 RPD).

## Task 1: Dynamic Context Windowing in `useAI.js`
**Goal:** Stop sending the entire 15,000+ token trip state on every single chat turn. Only send what is relevant to the user's current context.
**Files to Modify:** `src/hooks/useAI.js`

**Instructions for Claude:**
1. Locate `buildTripSystemPrompt(trip)` in `src/hooks/useAI.js`.
2. Update the function signature to accept `(trip, activeTab = 'overview')`.
3. Refactor the string generation so that:
   - **Core details** (Name, Location, Dates, Travelers, Total Budget, Status) are *always* included.
   - **Tab-specific details** are dynamically injected:
     - If `activeTab === 'budget'`, include the detailed `budgetSummary`.
     - If `activeTab === 'itinerary' || activeTab === 'cities'`, include the `itinerarySummary` and `dayLocationTable`.
     - If `activeTab === 'voting'`, include the `votingIdeas` context.
     - If `activeTab === 'packing'`, include the packing list stats.
     - If `activeTab === 'todo'`, include the todos.
4. Ensure the prompt explicitly tells Wanda her tools are available regardless of the tab, but her context is currently focused on `activeTab`.

## Task 2: The Hybrid Search Overhaul (Part 1 - Minified AI Payload)
**Goal:** Drastically reduce the token cost of `api/semantic-search.js` by filtering the JSON before sending it to the model.
**Files to Modify:** The frontend file calling the search endpoint (likely `src/components/modal/GlobalSearchModal.jsx` or similar, check where `/api/semantic-search` is fetched).

**Instructions for Claude:**
1. Locate the fetch call to `/api/semantic-search`.
2. Instead of passing the raw `trip` object, create a `minifiedTrip` object.
3. `minifiedTrip` should ONLY include:
   - `id`, `name`, `destinations`
   - `ideas`: Mapped to just `{ id, title, description, type }` (strip out comments, votes, creator IDs).
   - `itinerary`: Mapped to just `{ id, dayNumber, location, activities: activities.map(a => ({ id, name, category, location })) }`.
4. Do NOT include budget, todos, packing list, or bookings in this payload.

## Task 3: Harden the Lite Model for Magic Onboarding (Revised)
**Goal:** Since we are strictly bound to `gemini-3.1-flash-lite-preview`, we need to constrain its creativity during the heavy JSON generation to prevent schema errors and timeouts.
**Files to Modify:** `api/wanda-plan-trip.js`

**Instructions for Claude:**
1. Locate the `generateObject` call in `api/wanda-plan-trip.js`.
2. Do **not** change the model; keep it as `google('gemini-3.1-flash-lite-preview')`.
3. Add `temperature: 0.1` to the `generateObject` configuration. (Lowering the temperature makes the Lite model highly deterministic, drastically reducing the chance of it deviating from the Zod schema).
4. Add `maxTokens: 2500` to ensure it doesn't arbitrarily cut off mid-JSON generation.
5. In the `prompt` string, add a final line enforcing strictness: *"CRITICAL: You must return ONLY valid JSON matching the exact schema provided. Do not include any conversational filler."*

***