/**
 * Shared Framer Motion spring presets.
 * Import these instead of defining local spring configs in each component.
 */
export const spring = {
  /** Buttons, cards — snappy response with minimal overshoot */
  snappy: { type: 'spring', stiffness: 400, damping: 28 },
  /** Toasts, modal entrances — slightly softer feel */
  bouncy: { type: 'spring', stiffness: 380, damping: 26 },
  /** Drawers, panels — smooth slide with no bounce */
  gentle: { type: 'spring', stiffness: 280, damping: 28 },
}
