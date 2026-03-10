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
- **Layer 1: Tab Header (`TabHeader`)**: The `rightSlot` is STRICTLY for passive, read-only statistics (e.g., Progress Bars, "X of Y packed", "X items"). **Never** put primary action CTAs (like "+ New Item") in the `rightSlot`.
- **Layer 2: The Toolbar**: This layer sits below the TabHeader (`<div className="flex items-center justify-between border-b border-border pb-4 mb-6">`).
    - **Left Side**: Filter pills or search bars.
    - **Right Side**: (`<div className="flex items-center gap-2 shrink-0">`) Strictly for View Toggles AND primary action CTAs (e.g., `<Button size="sm">+ New Item</Button>`). Multiple elements must be inline with `gap-2` or `gap-3`.
- **Width**: Tabs should naturally expand to fill the width provided by their parent container. Let them breathe horizontally (`w-full`).
- **Bottom Padding**: Always ensure the root wrapper of a tab has `pb-12` or `pb-24`.
- **Animation**: Use `className="space-y-6 animate-fade-in"` for the root tab container.

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

#### View Toggles
When a tab offers multiple layouts (e.g. Table vs Board, Grid vs Table), the standard toggle control must look like this:
- **Container**: `flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0`
- **Inactive Button**: `px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 text-text-muted hover:text-text-secondary`
- **Active Button**: `px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 bg-bg-card text-accent shadow-sm`

#### Portal Dropdowns
All portal-based dropdowns (category pickers, assignee pickers, traveler pickers) must **never** use shadow classes (`shadow-sm`, `shadow-md`, `shadow-lg`). Rely on `border border-border` for separation per the No Shadows rule in section 3.

