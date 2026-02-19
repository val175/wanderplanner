// Auto-assigned colors for destination tags
export const DESTINATION_COLORS = [
  { bg: 'bg-accent/10', text: 'text-accent', border: 'border-accent/20' },
  { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  { bg: 'bg-[#9B7DCF]/10', text: 'text-[#9B7DCF]', border: 'border-[#9B7DCF]/20' },
  { bg: 'bg-[#E07BA0]/10', text: 'text-[#E07BA0]', border: 'border-[#E07BA0]/20' },
  { bg: 'bg-[#5BB5A2]/10', text: 'text-[#5BB5A2]', border: 'border-[#5BB5A2]/20' },
]

export function getDestinationColor(index) {
  return DESTINATION_COLORS[index % DESTINATION_COLORS.length]
}

// Gradient stops for hero banner based on destination colors
export const GRADIENT_COLORS = [
  '#D97757', '#6A9BCC', '#788C5D', '#D4A72C',
  '#C15F3C', '#9B7DCF', '#E07BA0', '#5BB5A2',
]
