/**
 * Shared utilities used across tripReducer and all slice files.
 * Kept here to avoid circular imports.
 */
import { normalizeTimeString, addMinutesToTime } from '../utils/helpers'

export function updateTrip(state, tripId, updater) {
  const trips = { ...state.trips }
  const trip = trips[tripId]
  if (!trip) return state
  trips[tripId] = typeof updater === 'function' ? updater(trip) : { ...trip, ...updater }
  return { ...state, trips }
}

export const parseToMins = (str) => {
  const normalized = normalizeTimeString(str)
  if (!normalized) return null
  const [hours, mins] = normalized.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
  return (hours * 60) + mins
}

export const sortActivities = (activities) => {
  return activities.sort((a, b) => {
    if (!a.time && !b.time) return 0
    if (!a.time) return 1
    if (!b.time) return -1
    const aMins = parseToMins(a.time)
    const bMins = parseToMins(b.time)
    if (aMins === null && bMins === null) return 0
    if (aMins === null) return 1
    if (bMins === null) return -1
    return aMins - bMins
  })
}

export const sortItineraryDays = (itinerary) => [...(itinerary || [])].sort((a, b) => {
  const aNum = Number(a?.dayNumber || 0)
  const bNum = Number(b?.dayNumber || 0)
  return aNum - bNum
})

export const STATUS_CYCLE = ['not_started', 'in_progress', 'booked']
