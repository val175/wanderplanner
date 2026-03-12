# Wanderplan Design System

This document is the single source of truth for all styling, spacing, typography, and component conventions in the Wanderplan app. AI agents generating or modifying UI components must adhere strictly to these guidelines to maintain a cohesive user experience.

## Typography
Wanderplan uses custom Anthropic fonts to match the brand identity:
- **UI & Headings**: `Anthropic Sans`
- **Body Copy**: `Anthropic Serif`

**Font Families:**
- `font-heading`: Use for all titles, buttons, UI elements, and navigation.
- `font-body`: Use **only** for long-form prose or editorial paragraphs.

**Font Sizing (Tailwind standards mapped to specific usages):**
- `text-xs` (12px): Utility text, dense metadata, table headers, small badges.
- `text-sm` (14px): **Default body size** for the app UI. Used for lists, standard buttons, descriptions, and standard inputs.
- `text-base` (16px): Emphasized body text, large input fields, or primary callouts.
- `text-lg` (18px): Sub-section headers or very large buttons.
- `text-xl` (20px) / `text-2xl` (24px): Primary page headers and empty state titles.
- `text-3xl` (30px)+: Emoji icons acting as illustrations or hero stats.

**Font Weights:**
- Default: regular (400)
- `font-medium` (500): Standard for all buttons, tabs, and interactive labels.
- `font-semibold` (600): Used for prominent headers and section titles.

## Colors & Theming
Wanderplan uses a semantic color system that supports Light and Dark mode automatically through CSS variables.

**Emoji/Iconography:**
- **Wanda AI Features**: Always use the Magic Wand (`🪄`) emoji for any AI features associated with the assistant "Wanda" (e.g., "🪄 Ask Wanda", "🪄 Auto-fill with Wanda", "🪄 Generate with Wanda"). Do not use sparkles (`✨`).

**Backgrounds**
- `bg-bg-primary`: The main canvas color (light grège).
- `bg-bg-secondary`: Used for borders, inset areas, tight panels, and subtle callouts.
- `bg-bg-sidebar`: Distinct sidebar color.
- `bg-bg-card`: Pure white in light mode, darkest grey in dark mode. Most elevated surface.
- `bg-bg-hover`: Subtle state change for list items and table rows.
- `bg-bg-input`: Default background for text inputs.

**Text**
- `text-text-primary`: Pure black or pure white (highest contrast).
- `text-text-secondary`: Off-black/off-white for standard body text.
- `text-text-muted`: Grey for timestamps, empty states, and disabled text.

**Interactive Colors**
- `text-accent` / `bg-accent`: The primary brand color (warm orange/rust `D97757`). Use for primary actions.
- `hover:bg-accent-hover`: The hover state for primary brand buttons.
- Semantic states: `success` (green), `warning` (yellow), `danger` (red), `info` (blue).

## Spacing & Radii
### Border Radius
Using explicit variables ensures components don't drift in roundness.
- `rounded-[var(--radius-sm)]` (6px): Small inputs, tags, micro-buttons.
- `rounded-[var(--radius-md)]` (10px): **Default** for standard buttons, cards, list items, and inputs.
- `rounded-[var(--radius-lg)]` (14px): Large modals or hero elements.
- `rounded-[var(--radius-xl)]` (20px): Outer wrapper for large modals.
- `rounded-[var(--radius-pill)]` (999px): Fully rounded badges, jumper pills, or chips.

### Shadows
**NO SHADOWS ALLOWED.**
Per strict UX/UI guidelines for this application, drop shadows are strictly forbidden on all elements (cards, buttons, popups, etc.). Ensure that `shadow-sm`, `shadow-md`, `shadow-card`, etc., are **never** used. Elements should rely on borders, background colors, and typography to establish visual hierarchy.

## Iconography & Emojis
**Prioritize Emojis Over SVG Icons.**
For tab representation, category labels, navigation elements, or empty states, use Emojis instead of external icon libraries (like `lucide-react`) whenever possible. This ensures global consistency with the app's playful UI theme. Wait to use SVG icons (like `lucide-react` or `heroicons`) only for functional UI controls (e.g., search magnifying glass, close 'X', expand arrows, edit pencils, and trash cans).

## Standardized Components

### 1. Buttons (`src/components/shared/Button.jsx`)
Always use the centralized `Button` component instead of building raw `<button className="...">` tags for actions.

**Props:**
- `variant`: `primary` (bg-accent), `secondary` (bg-bg-secondary), `ghost` (tinted bg), or `danger` (red). Default is `primary`.
- `size`: `sm` (px-3 py-1.5, text-xs), `md` (px-4 py-2, text-sm), `lg` (px-6 py-3, text-sm). Default is `md`.
- `className`: For layout spacing (e.g. `w-full`, `mt-4`). Do not override core colors or paddings.

### 2. Cards (`src/components/shared/Card.jsx`)
All distinct blocks of content should be wrapped in a `Card`.
- Pass the `hover` boolean prop if the card should lift on hover (`<Card hover>`).

### 3. Modals (`src/components/shared/Modal.jsx`)
Standard wrapper for popovers and drawers.
- **MUST** use React Portals (`createPortal(..., document.body)`) to ensure they escape `overflow-hidden` or `relative` parent containers.
- Uses `fixed inset-0 z-[9999]` and `w-screen h-screen` to cover the canvas.
- Child content determines width using Tailwind max-w classes (e.g. `maxWidth="max-w-xl"`).

### 4. Inputs & Forms
When building raw inputs (if not using EditableText or DatePicker):
- **Base classes**: `w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary`
- **Focus states**: `focus:outline-none focus:border-accent`
- **Padding**: Usually `px-3 py-2` or `px-4 py-3` for larger search bars.

### 5. Tables
All tables (e.g., Budget Spending Log, Bookings Table, Packing Table) must follow these strict style rules to maintain a lightweight, spreadsheet-like feel:
- **Container**: Wrap the table in a `<Card className="overflow-hidden">` with an inner `<div className="overflow-x-auto scrollbar-thin">`. The Card provides the border and background; the inner div handles horizontal scroll.
- **Headers (`<th>`)**: `px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted`. No background colors.
- **Rows (`<tr>`)**: `border-t border-border/20 hover:bg-bg-hover transition-colors`.
- **Cells (`<td>`)**: `px-2 py-3 align-middle text-sm`. No vertical borders (`border-r`) between columns.
- **Inputs (`EditableText`)**: Add `inputClassName="w-full"` on every table cell `EditableText` so the input stays within its column width. Amounts should always be formatted via `formatCurrency`.
- **Grouped Tables (e.g., Itinerary)**: For tables broken into collapsible groups, the outer container may use standard card-like classes (`border border-border rounded-[var(--radius-md)] overflow-hidden bg-bg-card`) with a custom stylized header instead of `Card`. The internal `<table>` structure, headers, and rows must still adhere strictly to the design rules above.

### 6. Tab Layouts
When building a top-level Tab component (e.g., `BookingsTab`, `TodoTab`, `PackingTab`):
- **Layer 1: Tab Header (`TabHeader`)**: The `rightSlot` is STRICTLY for passive, read-only statistics (e.g., Progress Bars, "X of Y packed", "X items"). **Never** put primary or secondary action CTAs (like "+ New Item" or "Export") in the `rightSlot`.
- **TabHeader Spacing**: Use `pb-3 mb-4` on the TabHeader wrapper to keep the header-to-content gap aligned with the tighter spacing standard used in `OverviewTab`.
- **Layer 2: The Toolbar**: This layer sits below the TabHeader.
    - **Outer wrapper**: `<div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 mb-6 gap-2">` — stacks vertically on mobile, horizontal on desktop.
    - **Left Side (Filters/Search)**: `<div className="flex-1">` — stacks above the right side on mobile. If a tab uses category filters, use a standard `<select>` dropdown.
        - The first option must always be "All Categories" followed by specific categories.
        - **Classes**: `h-7 text-xs bg-bg-secondary border border-border rounded-[var(--radius-md)] px-3 pr-9 text-text-primary focus:outline-none focus:border-accent w-auto min-w-[140px] cursor-pointer appearance-none`.
        - **Chevron**: Wrap the `<select>` in `relative inline-flex` and place a `pointer-events-none` chevron icon at `right-3 top-1/2 -translate-y-1/2` with `text-text-muted` to ensure consistent spacing.
    - **Right Side (Toggles & CTAs)**: Use `<div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">` — horizontally scrollable on mobile. All internal buttons must have `shrink-0`. The EXACT horizontal order from left to right:
        1. **Scope Toggles** (e.g., "Everyone / Just Me") — always `shrink-0`
        2. **View Toggles** (e.g., "Table / Board") — always `shrink-0`
        3. **Secondary Actions** — keep visible but `shrink-0` (e.g., "Starter List") OR `hidden md:inline-flex shrink-0` if space is very tight
        4. **Primary Actions** — **MUST be `hidden md:inline-flex shrink-0`** on mobile (replaced by FAB below)
- **Visibility**: Hide all Secondary and Primary CTAs if `isReadOnly` is true.
- **Width**: Tabs should naturally expand to fill the width provided by their parent container (`w-full`).
- **Bottom Padding**: Always ensure the root wrapper of a tab has `pb-12` or `pb-24`.
- **Animation**: Use `className="space-y-6 animate-fade-in"` for the root tab container.

#### Mobile FAB Pattern (< 768px)
Every tab with a primary CTA must include a Floating Action Button shown only on mobile (`block md:hidden`). The FAB replaces the `hidden md:inline-flex` primary button.

**Single CTA FAB:**
```jsx
{!isReadOnly && (
  <button
    onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
    className="fixed bottom-[80px] right-4 z-40 block md:hidden shadow-lg bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
  >
    <svg width="16" height="16" ...>+</svg>
    New Item
  </button>
)}
```

**Dual CTA FAB (2 primary actions, e.g. ItineraryTab):** Stack in a vertical column with the primary action at the bottom (accent bg) and secondary at the top (card bg):
```jsx
{!isReadOnly && (
  <div className="fixed bottom-[80px] right-4 z-40 flex flex-col gap-2 md:hidden">
    <button onClick={() => { hapticImpact('medium'); /* secondary action */ }}
      className="shadow-lg bg-bg-card border border-border text-text-primary rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm">
      Secondary
    </button>
    <button onClick={() => { hapticImpact('medium'); /* primary action */ }}
      className="shadow-lg bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm">
      Primary
    </button>
  </div>
)}
```

**Haptic feedback:** Always import `hapticImpact` from `../../utils/haptics`. Call `hapticImpact('medium')` on FAB click handlers. Call `hapticSelection()` on swipe threshold events and toggle changes.

#### Mobile Table-to-Card Pattern
For tabs with data tables (`BookingsTable`, Spending Log in `BudgetTab`, Packing List, Cities), wrap the desktop `<table>` / `<Card>` in `hidden md:block` and add a mobile-only sibling card list:

```jsx
{/* Mobile card view */}
<div className="flex flex-col gap-3 md:hidden">
  {data.map(item => (
    <div key={item.id} className="bg-bg-card border border-border p-3 rounded-[var(--radius-md)]">
      {/* Card content — reuse sub-components from the table column definitions */}
    </div>
  ))}
</div>

{/* Desktop table view */}
<Card className="hidden md:block overflow-hidden">
  {/* Original table unchanged */}
</Card>
```

**Rules:**
- Mobile cards map the same `data` array the table uses — never fetch or derive data differently
- Reuse existing sub-components (e.g. `PackedCheckbox`, `CategoryPill`) inside the card layout — they already handle touch sizing
- Delete buttons are always visible on cards (not `opacity-0 group-hover:opacity-100` like table rows)

### 7. Common UI Patterns

#### Tab-Level Page Headers
Every tab view **must** begin with a clearly branded page header that includes an emoji prefix matching the navigation tab icon.
- **Markup**: Use `<h1>` or `<h2>` with `font-heading font-bold text-text-primary`.
- **Size**: `text-xl` (inside card headers, e.g. Packing, Itinerary) or `text-2xl` (standalone headers, e.g. To-Do, Voting).
- **Emoji**: Inline in the string — e.g. `✅ Trip Tasks`, `📅 Itinerary`, `🧳 Packing List`. Do **not** omit the emoji.

#### Qty Steppers (+ / − micro-buttons)
Increment/decrement icon buttons (e.g. in packing qty, seat counts) must use:
- `w-5 h-5 rounded-[var(--radius-sm)]` — **not** `rounded-full`. Circular + and − buttons feel out of place.
- `bg-bg-secondary hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors`.

#### Category / Tag Pills
Inline category labels (e.g. packing category, booking type) use a **single neutral style** — do not apply per-category hardcoded colors (avoid `bg-cyan-500/10 text-cyan-600` etc.).
- **Classes**: `inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover`
- The emoji + label inside provides sufficient visual distinction without color coding.

**Exception — ItineraryTab Only:** Activity cards/blocks in the Itinerary tab (table rows, kanban cards, and calendar blocks) may use per-category tinted backgrounds and borders for fast scanning. This exception does **not** apply to generic category/tag pills elsewhere in the app.

#### View Toggles
When a tab offers multiple layouts (e.g. Table vs Board, Grid vs Table), the standard toggle control must look like this:
- **Container**: `flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0`
- **Inactive Button**: `px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 text-text-muted hover:text-text-secondary`
- **Active Button**: `px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 bg-bg-card text-accent shadow-sm`

#### Portal Dropdowns
All portal-based dropdowns (category pickers, assignee pickers, traveler pickers) must **never** use shadow classes (`shadow-sm`, `shadow-md`, `shadow-lg`). Rely on `border border-border` for separation per the No Shadows rule in section 3.

## Inconsistency Checklist (Pre-Merge Audit)
Before submitting a new component or UI refactor, ensure it passes this "AI Aesthetic Cleanliness" check:

1. **Primitive Alignment**: Does the component use `Radix UI` primitives for popovers, selects, and modals? (No manual `getBoundingClientRect` positioning).
2. **Token Compliance**: Are all colors using `bg-bg-*` or `text-text-*` tokens? Ensure no hardcoded `bg-blue-500` or `text-gray-400` classes exist.
3. **Shadow Ban**: Is there **zero** usage of `shadow-*` classes? (Exceptions: standard Radix `shadow-sm` on active view toggles only).
4. **Radii Consistency**: Are border radii using `var(--radius-*)`? Buttons/Inputs should be `md`, Modals `xl`.
5. **Interactive Symmetry**: Do hover/focus states match the "Gold Standard" (`DatePicker`, `Button`)?
6. **Focus Rings**: Are you using `focus:border-accent`? Avoid adding `focus:ring` unless absolutely necessary for accessibility.
7. **Pills & Badges**: Are status/category labels using the neutral `bg-bg-secondary` style instead of vibrant colored backgrounds?


---

## 8. Maps & Cartography

All map-related UI must follow these standards to ensure visual coherence between the `OverviewTab` mini-map and the full-screen `WanderMapTab`.

### Map Style
- **Base style**: `mapbox://styles/mapbox/light-v11` — consistent across all map surfaces.
- **Fog**: Always `null` (disabled). No atmospheric effects; the design language is clean and flat.
- **Scroll zoom**: Disabled when embedded inline (e.g., `OverviewTab`). Enabled in full-screen `WanderMapTab`.

### WanderPath (Route Line)
The animated route line connecting destinations is a core brand element:
- **Color**: `#D97757` (brand accent = `--color-accent`).
- **Width**: `2.5px` at macro zoom, up to `3px` at micro zoom.
- **Opacity**: `1` at macro zoom, `0.45` at micro zoom (markers remain primary).
- **Animation**: Route lines are static by default; animations (Flow Path) are reserved for active navigation modes only.
- **Shadow Ban**: NO `filter: drop-shadow` or `line-blur`. Contrast via color only.

### Marker Anatomy (Tiered Hierarchy)

#### Tier 1 — Macro View City Markers (`zoom < 8`)

```
       ┌─────────┐  ← Dark label pill
       │  Tokyo  │    bg: #0F172A | text: white | font: 10px semibold
       └────┬────┘    rounded: 6px
            │  ← CSS triangle pointer (color matches border)
       ┌────┴────┐
       │  🇯🇵   │  ← Pin Head: w-9 h-9, rounded-full, bg-bg-card
       └─────────┘    border-2, color-coded:
                        Start:  #7CA2CE (blue)
                        End:    #E58F76 (coral)
                        Middle: #89A88F (sage)
```

- Label pill MUST use `bg-[#0F172A]` (not `bg-bg-card`) — legible over both light and dark map tiles.
- Never use Lucide icons in pin heads; always use country flag emoji from destination data.

#### Tier 2 — Micro View Activity Markers (`zoom ≥ 8`)
- **Shape**: `w-9 h-9` `bg-bg-card` `border border-border` `rounded-[var(--radius-md)]` (square, not circular).
- **Icon**: Category emoji only (🏨 🍽️ ✈️ etc.). No Lucide icons.
- **Hover label**: `bg-[#0F172A]` pill, `opacity-0 group-hover:opacity-100 transition-opacity`.
- **Hover border**: transitions to `border-accent`.

#### Tier 3 — Discovery Pins
- Plain `text-xl` emoji (✨), no container.
- `whileHover={{ scale: 1.2 }}` via Framer Motion.

### Map Overlays
- All floating controls: `bg-bg-card/90 backdrop-blur-xl border border-border`.
- **Shadow Ban**: Zero `shadow-*` on all overlays. Border alone provides elevation signal.
- Popups: `closeButton={false}`, `closeOnClick={false}`, `anchor="bottom-right"` to avoid covering the selected pin.
- **Popup Container**: MUST be transparent shells for internal components; default Mapbox tips (`.mapboxgl-popup-tip`) and background containers (`.mapboxgl-popup-content`) must be disabled or set to `background: none`.

### Haptics
| Action | Haptic |
|--------|--------|
| Toggle a layer | `hapticSelection()` |
| Click a pin or recenter | `hapticImpact('medium')` |
