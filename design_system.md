# Wanderplan — Design System Reference

> This document is the canonical source of truth for all UI patterns, tokens, and component conventions in Wanderplan. Follow these specs when building new features or modifying existing components. When in doubt, look at an existing correct usage rather than inventing a new pattern.

---

## Design Tokens

All design tokens are CSS custom properties defined in the global stylesheet. Use token-based classes for app surfaces and controls. Raw hex values are acceptable only in isolated data/config files, map/presentation art direction, and third-party asset SVG fills.

### Colors

| Token | Usage |
|-------|-------|
| `var(--color-bg-primary)` | Page background |
| `var(--color-bg-secondary)` | Subtle section backgrounds, toggle tracks |
| `var(--color-bg-card)` | Card surfaces, popovers, modals |
| `var(--color-bg-sidebar)` | Sidebar background |
| `var(--color-bg-input)` | Input field backgrounds |
| `var(--color-bg-hover)` | Interactive element hover state |
| `var(--color-text-primary)` | Primary readable text |
| `var(--color-text-secondary)` | Secondary/supporting text |
| `var(--color-text-muted)` | Labels, placeholders, captions |
| `var(--color-border)` | Borders, dividers |
| `var(--color-accent)` | Brand accent (buttons, active states, highlights) |
| `var(--color-danger)` | Destructive actions, error states |

In Tailwind, these are surfaced as: `text-text-primary`, `bg-bg-card`, `border-border`, `text-accent`, etc.

### Border Radius

| Token | Tailwind | Usage |
|-------|----------|-------|
| `var(--radius-sm)` | `rounded-[var(--radius-sm)]` | Small interactive elements (toggle bg, day cells) |
| `var(--radius-md)` | `rounded-[var(--radius-md)]` | Inputs, selects, buttons, cards |
| `var(--radius-lg)` | `rounded-[var(--radius-lg)]` | Modals, popovers, drawers |
| `var(--radius-pill)` | `rounded-[var(--radius-pill)]` | Status badges, count chips, progress bars |

**Anti-pattern:** Do not use `rounded-full` for status badges or count chips — use `rounded-[var(--radius-pill)]` so the radius matches the token across themes.

---

## Typography

### Font Sizes

Use Tailwind's semantic size classes. **Never use arbitrary pixel sizes** (`text-[10px]`, `text-[13px]`, etc.) unless explicitly listed as an intentional exception below.

| Tailwind class | CSS size | Usage |
|----------------|----------|-------|
| `text-xs` | 12px | Labels, captions, badges, metadata, table headers |
| `text-sm` | 14px | Body text, inputs, list items, drawer fields |
| `text-base` | 16px | Card titles, medium emphasis |
| `text-lg` | 18px | Section headers |
| `text-xl`+ | 20px+ | Page/modal titles, hero text |

#### Intentional exceptions (do NOT change these)
- `text-[10px]` in `TripHeader.jsx` → `ProgressRing` label (`labelClassName`) — 12px overflows the ring SVG
- `text-[10px]` in `TripHeader.jsx` → `<kbd>` keyboard shortcut badge — intentionally tiny, matches system UI convention

### Font Families

- `font-heading` (Anthropic Sans) — use for headings, buttons, labels, navigation, and most UI chrome.
- `font-body` maps to the same sans stack and should stay limited to explicit prose/editorial treatment when needed.
- `.wanda-serif` (Instrument Serif italic) — use only for the word "Wanda" in Wanda-branded UI.

---

## Labels (Section Headers / Form Labels)

### Canonical spec
```
text-xs font-semibold text-text-muted uppercase tracking-wider
```

### Shared component
```jsx
import Label from '../shared/Label'

<Label>Category</Label>
<Label className="mb-2">Budget Limits</Label>
```

**Anti-patterns to avoid:**
- `font-bold` instead of `font-semibold` — too heavy
- `tracking-widest` instead of `tracking-wider` — too spaced
- `text-[10px]` or `text-[11px]` instead of `text-xs` — non-standard size
- `font-heading` on labels — reserved for actual headings

---

## Status Badges / Pills

### Baseline spec (from `StatusBadge.jsx`)
```
inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-[var(--radius-pill)]
```

### Inline contextual badges (booking status, todo priority, etc.)
Use `font-semibold` (slightly bolder than the global badge, intentional for inline contrast):
```
inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-[var(--radius-pill)]
```

### Count chips (e.g., kanban column counts, notification dots)
```
inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-pill)] bg-bg-secondary text-text-muted
```

### Anti-patterns
- `rounded-full` → use `rounded-[var(--radius-pill)]`
- `text-[10px]` → use `text-xs`
- `px-2` on primary badges → use `px-2.5`
- `py-1` → use `py-0.5`
- `font-heading` on badges — never

---

## Buttons

Buttons are provided by `src/components/shared/Button.jsx`. Always use the shared component.

| Variant | Usage |
|---------|-------|
| `variant="primary"` (default) | Primary actions: "Add", "Save", "Confirm" |
| `variant="secondary"` | Secondary/filter actions: "Cancel", "Export", column toggles |
| `variant="ghost"` | Icon-only or subtle inline actions |
| `variant="danger"` | Destructive actions: "Delete" |

| Size | Usage |
|------|-------|
| `size="sm"` | Toolbar actions, tab header buttons |
| `size="md"` (default) | Modal/drawer actions |
| `size="lg"` | Primary CTAs in empty state or hero sections |

Shared button behavior:
- Use `Button` for all primary, secondary, ghost, and destructive actions.
- Keep focus rings and disabled state styling in the shared component instead of duplicating them.
- Prefer `Button` over raw `<button>` unless the control is purely structural inside another primitive.

## Cards

Use `src/components/shared/Card.jsx` for surfaces that need the standard border/radius treatment.

- Default: static surface with `bg-bg-card border border-border rounded-[var(--radius-md)]`
- Hoverable surface: pass `hover`
- Interactive surface: pass `onClick`; the shared card renders as a button with accessible focus styling
- Default padding: `p-5`; override with `padding="p-0"` or a tighter spacing class when the card contains its own layout chrome

---

## Inputs

Standard input pattern:
```jsx
<input
  className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
             text-text-primary placeholder:text-text-muted px-3 py-2
             focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40
             focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary transition-colors"
/>
```

Compact (drawer/inline) variant — use `px-2 py-1.5`:
```jsx
<input
  className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
             text-text-primary placeholder:text-text-muted px-2 py-1.5
             focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40
             focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary transition-colors"
/>
```

Shared select pattern:
- `src/components/shared/Select.jsx` is the canonical dropdown primitive.
- Use `bg-bg-input`, `rounded-[var(--radius-md)]`, and the tokenized focus ring for all select triggers.
- Keep the trigger text aligned with standard inputs instead of inventing per-tab dropdown styles.

## Modals

Use `src/components/shared/Modal.jsx` for all dialogs, drawers, and sheet-style forms.

- Mobile: bottom sheet with rounded top corners and safe-area padding
- Desktop: centered dialog with the same surface tokens
- Always provide a `Dialog.Title` through the shared component
- Keep the close control inside the modal chrome instead of duplicating a separate header bar
- Prefer the shared modal surface over custom overlays so focus handling and escape behavior stay consistent

---

## Tab Headers

All tab toolbars use the `TabHeader` component from `src/components/common/TabHeader.jsx`.

```jsx
import TabHeader from '../common/TabHeader'

<TabHeader
  leftSlot={
    // Search input or stats/progress bar
  }
  rightSlot={
    // Filters (Select), view toggles, action buttons
  }
/>
```

`TabHeader` handles: responsive flex layout (`flex-col` on mobile → `flex-row` on desktop), border-bottom, and consistent padding. It should observe the nearest tab panel via a ref-driven scroll signal rather than a document query. Do not re-implement this with a custom `div`.

---

## Empty States

Use `src/components/shared/EmptyState.jsx` for all empty states. Never use inline `<p>` or custom `<div>` with centered text.

```jsx
import EmptyState from '../shared/EmptyState'

// Full-section empty (default)
<EmptyState
  emoji="🎫"
  title="No bookings added yet."
  subtitle="Enter one below or drop a booking board."
/>

// In-card / compact empty
<EmptyState
  emoji="💰"
  title="No budget limits defined"
  compact
  className="border-none bg-transparent"
/>
```

| Prop | Default | Usage |
|------|---------|-------|
| `emoji` | required | Visual icon |
| `title` | required | Short descriptive label |
| `subtitle` | — | Optional helper text |
| `compact` | `false` | Use inside cards/tables where full padding is too large |
| `className` | `''` | Pass `border-none bg-transparent` to strip card-like styling inside container elements |

Empty-state guidance:
- Keep the composition centered and short.
- Use `action` for the primary CTA, and `wandaPrompt` when Wanda can help users move forward.
- Prefer this shared block over inventing a one-off hero or helper message inside each tab.

---

## Performance / React Loading

- Lazy-load heavyweight tab panels and overlays from the app shell instead of importing everything into `App.jsx`.
- Keep the initial surface centered on the active tab and defer rare tools like WanderMap, AI panels, search overlays, and walkthrough modals.
- Prefer ref-driven effects for scroll and panel state. Avoid global DOM queries when the component can observe its own nearest container.

---

## Drawers

Drawers (booking, activity, todo) share a consistent internal layout:

- **Content wrapper spacing:** `space-y-6` (not `space-y-8`)
- **Section labels:** `<Label>` component
- **Input padding:** `px-2 py-1.5` (compact variant)
- **Textarea padding:** `px-2 py-1.5`

Reference: `BookingDrawer.jsx`, `ActivityDrawer.jsx` — these are the canonical drawer implementations.

---

## Navigation Arrows (Calendar / Carousel)

For prev/next navigation buttons (DatePicker, weather card, etc.), use Tailwind hover utilities. **Never use `onMouseEnter`/`onMouseLeave` JS handlers for hover styling.**

```jsx
<button
  type="button"
  onClick={prevMonth}
  className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)]
             bg-transparent hover:bg-bg-hover text-text-muted text-lg
             cursor-pointer transition-colors border-none"
>
  ‹
</button>
```

---

## Currency Formatting

Always use `formatCurrency(amount, currency)` from `src/utils/formatCurrency.js`. **Never hard-code currency symbols** (e.g., `₱`, `$`, `€`).

```jsx
import { formatCurrency } from '../../utils/formatCurrency'

// ✅ Correct
formatCurrency(totalSpent, trip.currency)

// ❌ Wrong
`₱${Math.round(totalSpent).toLocaleString()}`
```

---

## Sidebar Navigation

Section labels in the sidebar use the canonical label spec plus `px-3`:
```jsx
<p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
  The Plan
</p>
```

**Anti-pattern:** `text-[10px] tracking-widest` — use `text-xs tracking-wider`.

Sidebar conventions:
- Use `Label` for section headings and trip-group titles.
- Keep the trip switcher, tab list, and footer controls token-based instead of inline-styled.

---

## Conditional / Concert Theme Tab

The concert tab in the sidebar is hidden unless `activeTrip?.concertTheme` is truthy. This is filtered in `Sidebar.jsx` via:
```js
toolsTabs = toolsTabs.filter(t => !t.conditional || (t.conditional && activeTrip?.concertTheme))
```

When adding new conditional tabs, set `conditional: true` in `TAB_CONFIG` and ensure Sidebar's filter handles it.

---

## Deferred / Future Work

The following improvements are still open:

- **B5/M3:** Wanda mobile toggle fix for the AI assistant panel on mobile
- **B9:** React ErrorBoundary for tab-level error isolation
- **D1:** CelebrationEffect wiring when readiness reaches 100%
- **D3:** Wanda typing indicator
- **P1+P2:** Dynamic Wanda pills per active tab
- **F4:** Trip URL import UI
- **F1:** Co-traveler presence dots

---
