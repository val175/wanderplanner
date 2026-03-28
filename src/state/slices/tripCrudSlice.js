import { generateId, cloneDeep } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'
import { getEffectiveStatus } from '../../utils/tripStatus'

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
    const remaining = Object.keys(trips)
    return {
      ...state,
      trips,
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
    Object.assign(mergedTrips, newTrips)
    deletedIds.forEach(id => { delete mergedTrips[id] })

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

    return { ...state, trips: mergedTrips, activeTripId: newActiveId }
  },
}
