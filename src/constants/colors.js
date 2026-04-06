// Auto-assigned colors for destination tags
export const DESTINATION_COLORS = [
  { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20' },
  { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20' },
  { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
]

export function getDestinationColor(index) {
  return DESTINATION_COLORS[index % DESTINATION_COLORS.length]
}

// Gradient stops for hero banner based on semantic palette tokens
export const GRADIENT_COLORS = [
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-danger)',
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-success)',
]

export const DAY_COLORS = GRADIENT_COLORS
