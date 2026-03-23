---
name: wanderplan-tester
description: A high-fidelity UX/UI and functional QA skill for Wanderplan. Tests for PM-level design standards, accessibility, and feature-complete travel planning flows.
---

# Wanderplan Senior QA & UX Audit Skill

Use this skill to perform a comprehensive "Product Sense" audit. The agent must evaluate the app not just as a developer, but as a UX Researcher and Product Manager.

## 🎨 UX/UI Audit Pillars

### 1. Navigation & Mental Model (The "Flow")
* **Tab Logic:** Verify the transition between tabs (Overview → Itinerary → Budget). Does the `BottomNav` (mobile) sync perfectly with the `Sidebar` (desktop)?
* **Empty States:** Navigate to a brand-new trip. Are the `EmptyState.jsx` components helpful? Do they provide a "Call to Action" (e.g., "Add your first city") or just a blank screen?
* **Modals & Overlays:** Test the `NewTripModal` and `ShareTripModal`. Ensure they have clear 'Cancel' vs 'Submit' priority and that clicking outside the modal closes it correctly.

### 2. Form UX & Input Precision
* **Date/Time Pickers:** Use the `DatePicker` and `TimePicker`. Are they thumb-friendly on mobile? Do they prevent "Impossible Dates" (e.g., end date before start date)?
* **Autocomplete:** Test `LocationAutocomplete.jsx`. Does it provide immediate feedback? Does it handle "No results found" gracefully without crashing?
* **Snap-to-Add:** Verify the `SnapToAddZone.jsx` logic. Is it clear to the user where they should drop or click to add items?

### 3. Visual Consistency & Polish
* **Currency/Number Formatting:** Ensure ALL money values are formatted consistently. No raw floats (e.g., use ₱1,200.00 instead of 1200.0012).
* **Loading States:** Trigger a Wanda tool call. Is there a "Wanda is thinking" skeleton or spinner? The UI should never feel "frozen" while the AI is working.
* **Map UX:** Open the `WanderMapTab`. Do the markers have clear labels? Does the "Focus City" action smoothly animate the map?

### 4. Accessibility (The "Table Stakes")
* **Focus States:** Tab through the app. Are there visible focus rings on buttons and inputs?
* **Contrast:** Check the `StatusBadge.jsx` colors. Are "Success" (Green) and "Danger" (Red) text combinations readable?
* **ARIA:** Check that icons (like the trash can for deleting) have `aria-label="Delete"` so screen readers understand them.

## ⚙️ Functional Features (Recall Previous Pillars)

### 5. The Voting Room
* Verify ideas added via Wanda or manually appear in real-time.
* Test that upvotes/downvotes update the Firestore state correctly.

### 6. The "Potato Test" (Wanda Balance)
* **Goal:** Playful but professional.
* Ask Wanda: "What's the best potato dish in [Current City]?" (Should answer with food advice).
* Ask Wanda: "I love potatoes." (Should respond playfully but **NOT** generate an itinerary).

## 🚀 How to Execute Audit
1. Start the dev environment (`npm run dev`).
2. **Phase 1 (Wanda):** Perform the "Potato Test" to verify logic balance.
3. **Phase 2 (UX Walkthrough):** Click through every tab in the `Sidebar`. Resize the window to test `BottomNav` responsiveness.
4. **Phase 3 (Error Handling):** Try to add a budget item with a negative number or a trip with no name. See if the app "breaks" or "guides."