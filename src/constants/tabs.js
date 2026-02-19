export const TAB_CONFIG = [
  { id: 'overview',  label: 'Overview',   emoji: '🗺️' },
  { id: 'itinerary', label: 'Itinerary',  emoji: '📅' },
  { id: 'bookings',  label: 'Bookings',   emoji: '🎫' },
  { id: 'budget',    label: 'Budget',     emoji: '💰' },
  { id: 'todo',      label: 'To-Do',      emoji: '✅' },
  { id: 'cities',    label: 'Cities',     emoji: '🏙️' },
  { id: 'packing',   label: 'Packing',    emoji: '🧳' },
  { id: 'concert',   label: 'Concert',    emoji: '🎵', conditional: true },
]

export const BOOKING_CATEGORIES = [
  { id: 'flight',     label: 'Flight',     emoji: '✈️' },
  { id: 'hotel',      label: 'Hotel',      emoji: '🏨' },
  { id: 'experience', label: 'Experience', emoji: '🎯' },
  { id: 'concert',    label: 'Concert',    emoji: '🎵' },
  { id: 'transport',  label: 'Transport',  emoji: '🚕' },
  { id: 'custom',     label: 'Custom',     emoji: '📌' },
]

export const BOOKING_STATUSES = [
  { id: 'not_started', label: 'Not Started', color: 'text-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'warning' },
  { id: 'booked',      label: 'Booked ✓',    color: 'success' },
]

export const TODO_CATEGORIES = ['Admin', 'Finances', 'Tech', 'Health', 'Misc']

export const PACKING_SECTIONS = ['Documents', 'Clothing', 'Tech', 'Concert Essentials', 'Toiletries', 'Misc']
