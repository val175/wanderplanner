import { useReducer, useEffect, useCallback } from 'react'
import { tripReducer, ACTIONS } from '../state/tripReducer'
import { DEFAULT_TRIP } from '../data/defaultTrip'

const STORAGE_KEY = 'wanderplan_data'

function loadInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.trips && Object.keys(parsed.trips).length > 0) {
        return {
          trips: parsed.trips,
          activeTripId: parsed.activeTripId || Object.keys(parsed.trips)[0],
          activeTab: 'overview',
          sidebarOpen: false,
          darkMode: parsed.darkMode || false,
          toast: { message: '', type: 'success', visible: false },
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load saved data:', e)
  }

  // Default: load demo trip
  return {
    trips: { [DEFAULT_TRIP.id]: DEFAULT_TRIP },
    activeTripId: DEFAULT_TRIP.id,
    activeTab: 'overview',
    sidebarOpen: false,
    darkMode: false,
    toast: { message: '', type: 'success', visible: false },
  }
}

export function useTrips() {
  const [state, dispatch] = useReducer(tripReducer, null, loadInitialState)

  // Persist to localStorage (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          trips: state.trips,
          activeTripId: state.activeTripId,
          darkMode: state.darkMode,
        }))
      } catch (e) {
        console.warn('Failed to save:', e)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [state.trips, state.activeTripId, state.darkMode])

  // Dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
  }, [state.darkMode])

  // Toast auto-dismiss
  useEffect(() => {
    if (state.toast.visible) {
      const timer = setTimeout(() => {
        dispatch({ type: ACTIONS.HIDE_TOAST })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.toast.visible])

  // Helper to get active trip
  const activeTrip = state.activeTripId ? state.trips[state.activeTripId] : null

  // Get sorted trips array
  const sortedTrips = Object.values(state.trips).sort((a, b) => {
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return new Date(a.startDate) - new Date(b.startDate)
  })

  // Toast helper
  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message, type } })
  }, [])

  return { state, dispatch, activeTrip, sortedTrips, showToast }
}
