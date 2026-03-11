export const GLOBAL_CATEGORIES = [
  { id: 'lodging', label: 'Lodging', emoji: '🏠' },
  { id: 'flight', label: 'Flights', emoji: '✈️' },
  { id: 'food', label: 'Restaurants', emoji: '🍴' },
  { id: 'activity', label: 'Activity', emoji: '🎯' },
  { id: 'transport', label: 'Transport', emoji: '🚗' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'concert', label: 'Concert', emoji: '🎵' },
  { id: 'other', label: 'Other', emoji: '✨' },
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
