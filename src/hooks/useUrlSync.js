import { useEffect, useRef } from 'react'
import { ACTIONS } from '../state/tripReducer'
import { parseTripPath, buildTripPath } from '../utils/urlState'

/**
 * Bidirectional sync between the address bar and reducer navigation state.
 *
 *  state → URL : trip/tab changes push a history entry (so Back works
 *                like iOS: it returns you to where you were).
 *  URL → state : popstate (Back/Forward) dispatches SET_ACTIVE_TRIP/SET_TAB.
 *
 * Deep links on cold load are handled in getInitialState (useFirestoreTrips),
 * which seeds activeTripId/activeTab from the URL before first render.
 */
export function useUrlSync({ state, dispatch, firestoreLoading, effectiveTab }) {
  const { activeTripId, trips } = state
  // Suppresses the state→URL write that would otherwise follow a URL→state dispatch
  const applyingPopRef = useRef(false)
  const initializedRef = useRef(false)

  // ── URL → state: browser Back/Forward ────────────────────────────────
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseTripPath(window.location.pathname)
      if (!parsed) return
      applyingPopRef.current = true
      dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: parsed.tripId })
      dispatch({ type: ACTIONS.SET_TAB, payload: parsed.tab })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [dispatch])

  // ── state → URL ───────────────────────────────────────────────────────
  useEffect(() => {
    if (firestoreLoading) return
    // Only write URLs for trips that actually exist (deep link to a deleted
    // or foreign trip falls back via SET_TRIPS_FROM_FIRESTORE's priority pick)
    if (!activeTripId || !trips[activeTripId]) return

    const target = buildTripPath(activeTripId, effectiveTab)
    const current = window.location.pathname

    if (applyingPopRef.current) {
      applyingPopRef.current = false
      return
    }
    if (target === current) {
      initializedRef.current = true
      return
    }

    // First write replaces (normalises "/" or a stale deep link without
    // polluting history); subsequent writes push so Back steps through tabs.
    const search = window.location.search // preserve e.g. an unresolved ?trip=
    if (initializedRef.current) {
      window.history.pushState({}, '', target + search)
    } else {
      window.history.replaceState({}, '', target + search)
      initializedRef.current = true
    }
  }, [firestoreLoading, activeTripId, effectiveTab, trips])
}
