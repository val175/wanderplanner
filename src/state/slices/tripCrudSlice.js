import { generateId, cloneDeep } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'
import { getEffectiveStatus } from '../../utils/tripStatus'

// ── Budget actuals recompute ──────────────────────────────────────────────────
// Same alias table as budgetSlice — kept in sync manually if updated.
const BUDGET_ALIASES = [
  ['flight',    ['flight', 'flights', 'airfare', 'airline', 'air']],
  ['food',      ['food', 'restaurant', 'restaurants', 'dining', 'meal', 'meals', 'drinks', 'drink', 'food & drink']],
  ['lodging',   ['lodging', 'hotel', 'accommodation', 'accommodations', 'hostel', 'resort', 'stay', 'airbnb']],
  ['activity',  ['activity', 'activities', 'tour', 'ticket', 'tickets', 'event', 'entrance', 'admission']],
  ['transport', ['transport', 'transportation', 'transfer', 'bus', 'train', 'taxi', 'grab', 'transit', 'car', 'ferry']],
  ['shopping',  ['shopping', 'retail', 'store', 'mall']],
  ['concert',   ['concert', 'music', 'show', 'festival', 'gig']],
]

function resolveToName(category, budget) {
  if (!category) return category
  const norm = String(category).toLowerCase().trim()
  const exact = budget.find(b => b.name?.toLowerCase() === norm)
  if (exact) return exact.name
  for (const [, terms] of BUDGET_ALIASES) {
    if (terms.includes(norm)) {
      const matched = budget.find(b => {
        const bNorm = b.name?.toLowerCase() ?? ''
        return terms.some(t => bNorm === t || bNorm.includes(t))
      })
      if (matched) return matched.name
    }
  }
  const sub = budget.find(b => {
    const bNorm = b.name?.toLowerCase() ?? ''
    return bNorm.includes(norm) || norm.includes(bNorm)
  })
  return sub ? sub.name : category
}

/**
 * Recomputes budget[].actual from the spendingLog in place.
 * Also normalises spending entry categories to the resolved budget name.
 */
function recomputeBudgetActuals(trip) {
  if (!trip?.budget?.length) return trip
  const zero = Object.fromEntries(trip.budget.map(b => [b.name, 0]))
  const spendingLog = (trip.spendingLog || []).map(entry => {
    const resolved = resolveToName(entry.category, trip.budget)
    if (zero[resolved] !== undefined) zero[resolved] += Number(entry.amount) || 0
    return resolved !== entry.category ? { ...entry, category: resolved } : entry
  })
  // Accumulate entries whose resolved name didn't match any budget category
  const budget = trip.budget.map(b => ({
    ...b,
    actual: zero[b.name] ?? b.actual ?? 0,
  }))
  return { ...trip, spendingLog, budget }
}

export const tripCrudCases = {
  SET_ACTIVE_TRIP: (state, payload) =>
    ({ ...state, activeTripId: payload, activeTab: 'overview' }),

  ADD_TRIP: (state, payload) => {
    const trips = { ...state.trips, [payload.id]: payload }
    return { ...state, trips, activeTripId: payload.id, activeTab: 'overview' }
  },

  UPDATE_TRIP: (state, payload) =>
    updateTrip(state, payload.id, payload.updates),

  DELETE_TRIP: (state, payload) => {
    const trips = { ...state.trips }
    delete trips[payload]
    const documentsByTrip = { ...(state.documentsByTrip || {}) }
    delete documentsByTrip[payload]
    const remaining = Object.keys(trips)
    return {
      ...state,
      trips,
      documentsByTrip,
      activeTripId: remaining.length > 0 ? remaining[0] : null,
      activeTab: 'overview',
    }
  },

  DUPLICATE_TRIP: (state, payload) => {
    const original = state.trips[payload]
    if (!original) return state
    const newId = generateId()
    const clone = cloneDeep(original)
    clone.id = newId
    clone.name = original.name + ' (Copy)'
    clone.createdAt = new Date().toISOString()
    return { ...state, trips: { ...state.trips, [newId]: clone }, activeTripId: newId }
  },

  RENAME_TRIP: (state, payload) =>
    updateTrip(state, payload.id, { name: payload.name }),

  REFRESH_TRAVELER_SNAPSHOT: (state, payload) =>
    updateTrip(state, state.activeTripId, trip => {
      const { travelerId, name, photo } = payload
      const snapshot = trip.travelersSnapshot || []
      const exists = snapshot.some(s => s.id === travelerId)
      const newEntry = { id: travelerId, name, photo }
      const nextSnapshot = exists
        ? snapshot.map(s => s.id === travelerId ? { ...s, ...newEntry } : s)
        : [...snapshot, newEntry]
      return { ...trip, travelersSnapshot: nextSnapshot }
    }),

  UPDATE_NOTES: (state, payload) =>
    updateTrip(state, state.activeTripId, { notes: payload }),

  // LOG_ACTIVITY — defined in ACTIONS but not yet implemented; returns state unchanged
  LOG_ACTIVITY: (state, _payload) => state,

  GENERATE_SHARE_LINK: (state, payload) =>
    updateTrip(state, payload.tripId, { shareId: payload.shareId }),

  REVOKE_SHARE_LINK: (state, payload) =>
    updateTrip(state, payload, { shareId: null }),

  ARCHIVE_TRIP: (state, payload) =>
    updateTrip(state, payload, { archivedAt: new Date().toISOString() }),

  UNARCHIVE_TRIP: (state, payload) =>
    updateTrip(state, payload, { archivedAt: null }),

  DUPLICATE_AS_TEMPLATE: (state, payload) => {
    const { tripId, profileId, uid } = payload
    const original = state.trips[tripId]
    if (!original) return state
    const newId = generateId()
    const clone = cloneDeep(original)
    clone.id = newId
    clone.name = original.name + ' (Template)'
    clone.createdAt = new Date().toISOString()
    clone.startDate = ''
    clone.endDate = ''
    clone.shareId = null
    clone.archivedAt = null
    clone.spendingLog = []
    clone.bookings = (clone.bookings || []).map(b => ({
      ...b,
      confirmationNumber: '',
      amountPaid: 0,
      status: 'not_started',
    }))
    clone.itinerary = (clone.itinerary || []).map(d => ({
      ...d,
      id: generateId(),
      date: '',
    }))
    clone.packingList = (clone.packingList || []).map(p => ({ ...p, packed: false, packedBy: null }))
    clone.memberIds = uid ? [uid] : []
    clone.travelerIds = profileId ? [profileId] : []
    return { ...state, trips: { ...state.trips, [newId]: clone }, activeTripId: newId }
  },

  // Replaces the entire trips map with data from a Firestore snapshot.
  // Preserves activeTripId if the active trip still exists in the new map.
  SET_TRIPS_FROM_FIRESTORE: (state, payload) => {
    const { trips: newTrips, deletedIds = [] } = payload.trips
      ? payload
      : { trips: payload, deletedIds: [] }

    const mergedTrips = { ...state.trips }
    // Recompute budget actuals from the spending log — fixes stale data where
    // entries stored with category 'flight' weren't rolling into 'Flights'.
    Object.entries(newTrips || {}).forEach(([id, trip]) => {
      mergedTrips[id] = recomputeBudgetActuals(trip)
    })
    deletedIds.forEach(id => { delete mergedTrips[id] })
    const documentsByTrip = { ...(state.documentsByTrip || {}) }
    Object.entries(newTrips || {}).forEach(([tripId, trip]) => {
      if (trip?.documents && typeof trip.documents === 'object') {
        documentsByTrip[tripId] = trip.documents
      }
    })
    deletedIds.forEach(id => { delete documentsByTrip[id] })

    const ids = Object.keys(mergedTrips)
    const currentActiveId = state.activeTripId
    let newActiveId = currentActiveId && mergedTrips[currentActiveId] ? currentActiveId : null

    if (!newActiveId && ids.length > 0) {
      const priorityMap = { ongoing: 4, upcoming: 3, completed: 2, archived: 1 }
      const sortedIds = ids.sort((a, b) => {
        const statusA = getEffectiveStatus(mergedTrips[a])
        const statusB = getEffectiveStatus(mergedTrips[b])
        return (priorityMap[statusB] || 0) - (priorityMap[statusA] || 0)
      })
      newActiveId = sortedIds[0]
    }

    return { ...state, trips: mergedTrips, documentsByTrip, activeTripId: newActiveId }
  },
}
