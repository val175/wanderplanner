import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

export const citiesCases = {
  // payload: { fromIndex, toIndex }
  REORDER_CITIES: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const cities = [...(trip.cities || [])]
      if (cities.length === 0 || payload.fromIndex === payload.toIndex) return trip

      const [moved] = cities.splice(payload.fromIndex, 1)
      cities.splice(payload.toIndex, 0, moved)

      // Sync destinations: re-sort only the waypoints whose city appears in
      // the cities guide. Waypoints outside the guide stay at their original positions.
      const cityOrder = Object.fromEntries(cities.map((c, i) => [c.city, i]))
      const destinations = [...(trip.destinations || [])]

      const inCityIndices = destinations
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => cityOrder[d.city] !== undefined)
        .map(({ i }) => i)

      const inCityDests = inCityIndices
        .map(i => destinations[i])
        .sort((a, b) => cityOrder[a.city] - cityOrder[b.city])

      inCityIndices.forEach((destIdx, j) => {
        destinations[destIdx] = inCityDests[j]
      })

      return { ...trip, cities, destinations }
    })
  },

  UPDATE_CITY: (state, payload) => {
    const activeTripId = state.activeTripId
    const currentTrip = state.trips[activeTripId]
    const oldCity = (currentTrip?.cities || []).find(c => c.id === payload.id)
    const oldName = oldCity?.city
    const { city: newName, country: newCountry, flag: newFlag, lat: newLat, lng: newLng } = payload.updates
    const identityChanged = newName !== undefined || newCountry !== undefined || newFlag !== undefined || newLat !== undefined || newLng !== undefined

    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      cities: trip.cities.map(c => {
        if (c.id !== payload.id) return c
        const sanitizedUpdates = Object.fromEntries(
          Object.entries(payload.updates).filter(([_, v]) => v !== undefined)
        )
        return { ...c, ...sanitizedUpdates }
      }),
      destinations: (identityChanged && oldName)
        ? (trip.destinations || []).map(d =>
          d.city === oldName
            ? {
              ...d,
              ...(newName !== undefined && { city: newName }),
              ...(newCountry !== undefined && { country: newCountry }),
              ...(newFlag !== undefined && { flag: newFlag }),
              ...(newLat !== undefined && { lat: newLat ?? null }),
              ...(newLng !== undefined && { lng: newLng ?? null }),
            }
            : d
        )
        : trip.destinations,
    }))
  },

  // payload: { city, country, flag }
  ADD_CITY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      cities: [...(trip.cities || []), {
        id: generateId(),
        city: payload.city || 'New City',
        country: payload.country || '',
        flag: payload.flag || '🌍',
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        highlights: '',
        mustDo: '',
        weather: '',
        currencyTip: '',
        notes: '',
        savedPins: [],
      }],
      destinations: [...(trip.destinations || []), {
        city: payload.city || 'New City',
        country: payload.country || '',
        flag: payload.flag || '🌍',
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
      }],
    }))
  },

  DELETE_CITY: (state, payload) => {
    const activeTripId = state.activeTripId
    const currentTrip = state.trips[activeTripId]
    const deletedCity = (currentTrip?.cities || []).find(c => c.id === payload)
    const deletedName = deletedCity?.city

    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      cities: trip.cities.filter(c => c.id !== payload),
      destinations: deletedName
        ? (trip.destinations || []).filter(d => d.city !== deletedName)
        : trip.destinations,
    }))
  },
}
