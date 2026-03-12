export const GLOBAL_CATEGORIES = [
  { id: 'lodging', label: 'Lodging', emoji: '🏠', color: 'indigo' },
  { id: 'flight', label: 'Flights', emoji: '✈️', color: 'sky' },
  { id: 'food', label: 'Restaurants', emoji: '🍴', color: 'amber' },
  { id: 'activity', label: 'Activity', emoji: '🎯', color: 'emerald' },
  { id: 'transport', label: 'Transport', emoji: '🚗', color: 'slate' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: 'pink' },
  { id: 'concert', label: 'Concert', emoji: '🎵', color: 'violet' },
  { id: 'other', label: 'Other', emoji: '✨', color: 'rose' },
]

export const CATEGORY_MAP = Object.fromEntries(
  GLOBAL_CATEGORIES.map(c => [c.id, c])
)

/**
 * Helper to get category by ID with a fallback to 'other'
 */
export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP.other
}
