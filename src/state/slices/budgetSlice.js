import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

// Alias groups: each entry is [canonical id, terms[] that map to it].
// Keeps spending entries like 'flight' rolling into a 'Flights' budget category.
const BUDGET_ALIASES = [
  ['flight',    ['flight', 'flights', 'airfare', 'airline', 'air']],
  ['food',      ['food', 'restaurant', 'restaurants', 'dining', 'meal', 'meals', 'drinks', 'drink', 'food & drink']],
  ['lodging',   ['lodging', 'hotel', 'accommodation', 'accommodations', 'hostel', 'resort', 'stay', 'airbnb']],
  ['activity',  ['activity', 'activities', 'tour', 'ticket', 'tickets', 'event', 'entrance', 'admission']],
  ['transport', ['transport', 'transportation', 'transfer', 'bus', 'train', 'taxi', 'grab', 'transit', 'car', 'ferry']],
  ['shopping',  ['shopping', 'retail', 'store', 'mall']],
  ['concert',   ['concert', 'music', 'show', 'festival', 'gig']],
]

/**
 * Resolves a category string (e.g. 'flight') to the exact name of a matching
 * budget category (e.g. 'Flights'). Falls back to the first budget entry or
 * the raw value if nothing matches.
 */
function resolveToBudgetName(category, budget = []) {
  if (!category || !budget.length) return category
  const norm = String(category).toLowerCase().trim()

  // 1. Exact name match (case-insensitive)
  const exact = budget.find(b => b.name?.toLowerCase() === norm)
  if (exact) return exact.name

  // 2. Alias group match
  for (const [, terms] of BUDGET_ALIASES) {
    if (terms.includes(norm)) {
      // Find the budget category whose name falls in the same alias group
      const matched = budget.find(b => {
        const bNorm = b.name?.toLowerCase() ?? ''
        return terms.some(t => bNorm === t || bNorm.includes(t))
      })
      if (matched) return matched.name
    }
  }

  // 3. Substring match (budget name contains the category or vice-versa)
  const sub = budget.find(b => {
    const bNorm = b.name?.toLowerCase() ?? ''
    return bNorm.includes(norm) || norm.includes(bNorm)
  })
  if (sub) return sub.name

  return category // unchanged as last resort
}

export const budgetCases = {
  UPDATE_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: trip.budget.map(b => b.id === payload.id ? { ...b, ...payload.updates } : b),
    }))
  },

  ADD_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: [...trip.budget, {
        id: generateId(),
        name: payload.name || 'New Category',
        emoji: payload.emoji || '📌',
        min: 0,
        max: payload.max || 0,
        actual: 0,
      }],
    }))
  },

  DELETE_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: trip.budget.filter(b => b.id !== payload),
    }))
  },

  // Log entry AND update the matching budget category's actual spend
  ADD_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      // Resolve raw type strings (e.g. 'flight') to the real budget category name ('Flights')
      const resolvedCategory = resolveToBudgetName(payload.category, trip.budget)
      const entry = {
        id: payload.id || generateId(),
        date: new Date().toISOString().slice(0, 10),
        ...payload,
        category: resolvedCategory, // store the normalised name so the table shows correctly
      }
      const budget = trip.budget.map(b =>
        b.name === resolvedCategory
          ? { ...b, actual: (b.actual || 0) + (payload.amount || 0) }
          : b
      )
      return { ...trip, spendingLog: [...trip.spendingLog, entry], budget }
    })
  },

  // Edit an existing log entry in place
  UPDATE_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const old = trip.spendingLog.find(s => s.id === payload.id)
      if (!old) return trip
      const updatedCategory = payload.updates.category
        ? resolveToBudgetName(payload.updates.category, trip.budget)
        : old.category
      const updated = { ...old, ...payload.updates, category: updatedCategory }
      const spendingLog = trip.spendingLog.map(s => s.id === payload.id ? updated : s)
      const oldResolved = resolveToBudgetName(old.category, trip.budget)
      const budget = trip.budget.map(b => {
        let actual = b.actual || 0
        if (b.name === oldResolved) actual = Math.max(0, actual - (old.amount || 0))
        if (b.name === updatedCategory) actual += updated.amount
        return b.name === oldResolved || b.name === updatedCategory ? { ...b, actual } : b
      })
      return { ...trip, spendingLog, budget }
    })
  },

  DELETE_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const entry = trip.spendingLog.find(s => s.id === payload)
      if (!entry) return { ...trip, spendingLog: trip.spendingLog.filter(s => s.id !== payload) }
      const resolvedCategory = resolveToBudgetName(entry.category, trip.budget)
      const budget = trip.budget.map(b =>
        b.name === resolvedCategory
          ? { ...b, actual: Math.max(0, (b.actual || 0) - (entry.amount || 0)) }
          : b
      )
      return { ...trip, spendingLog: trip.spendingLog.filter(s => s.id !== payload), budget }
    })
  },
}
