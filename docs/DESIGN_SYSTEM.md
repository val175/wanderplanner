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
All tables (e.g., Budget Spending Log, Bookings Table) must follow these strict style rules to maintain a lightweight, spreadsheet-like feel:
- **Container**: No outer border radius or `bg-bg-card` wrapping the table. Let it bleed to the edges or use `-mx-5` on mobile. Use `overflow-x-auto overflow-y-visible`.
- **Headers (`<th>`)**: `px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted`. No background colors.
- **Rows (`<tr>`)**: `border-t border-border/20 hover:bg-bg-hover transition-colors`.
- **Cells (`<td>`)**: `px-2 py-3 align-middle text-sm`. No vertical borders (`border-r`) between columns.
