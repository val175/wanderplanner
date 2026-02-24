import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { tripReducer, ACTIONS } from '../state/tripReducer'
import { DEFAULT_TRIP } from '../data/defaultTrip'

const STORAGE_KEY = 'wanderplan_data'
const REVERSE_MIGRATION_FLAG = 'wanderplan_root_migrated'

function getInitialState() {
  let darkMode = false
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) darkMode = JSON.parse(saved).darkMode || false
  } catch { /* ignore */ }

  return {
    trips: {},
    activeTripId: null,
    activeTab: 'overview',
    sidebarOpen: false,
    darkMode,
    toast: { message: '', type: 'success', visible: false },
  }
}

// ── Shared Root Trips Reference ─────────────────────────────────────────────
const tripsRef = collection(db, 'trips')

// ── Migration Helper: No-op (migration complete) ─────────────────────────────
// All trips are now in the root /trips collection. The old user-scoped
// users/{uid}/trips path is no longer used or readable by Firestore rules.
async function migrateToSharedRoot(userId) {
  // Always mark migration as done — nothing to migrate
  localStorage.setItem(REVERSE_MIGRATION_FLAG, 'true')
  return false
}

// ── Main hook ────────────────────────────────────────────────────────────────
export function useFirestoreTrips(userId) {
  const [state, dispatch] = useReducer(tripReducer, null, getInitialState)
  const [firestoreLoading, setFirestoreLoading] = useState(true)
  const prevTripsRef = useRef({})
  const isRemoteUpdateRef = useRef(false)

  // ── 1. Real-time listener: Shared Root → local state ─────────────────────
  useEffect(() => {
    if (!userId) return

    // Query for trips where the current user is a member
    const q = query(tripsRef, where('memberIds', 'array-contains', userId))

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const tripsFromFirestore = {}
        snapshot.forEach((docSnap) => {
          const { _updatedAt, ...trip } = docSnap.data()
          tripsFromFirestore[docSnap.id] = trip
        })

        const isFirstLoad = Object.keys(prevTripsRef.current).length === 0

        // Handle migration and seeding on first load
        if (isFirstLoad && Object.keys(tripsFromFirestore).length === 0) {
          const migrated = await migrateToSharedRoot(userId)
          if (migrated) return // onSnapshot will fire again

          // No data anywhere — seed with default trip
          await setDoc(doc(tripsRef, DEFAULT_TRIP.id), {
            ...DEFAULT_TRIP,
            memberIds: [userId],
            _updatedAt: serverTimestamp(),
          })
          return
        }

        isRemoteUpdateRef.current = true
        prevTripsRef.current = tripsFromFirestore
        dispatch({ type: ACTIONS.SET_TRIPS_FROM_FIRESTORE, payload: tripsFromFirestore })
        setFirestoreLoading(false)
      },
      (error) => {
        console.error('[Wanderplan] Firestore listener error:', error)
        setFirestoreLoading(false)
      }
    )

    return unsubscribe
  }, [userId])

  // ── 2. Outbound sync: local state → Firestore ────────────────────────────
  useEffect(() => {
    if (!userId) return
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false
      return
    }

    const currentTrips = state.trips
    const previousTrips = prevTripsRef.current

    Object.keys(currentTrips).forEach((id) => {
      if (currentTrips[id] !== previousTrips[id]) {
        const tripData = currentTrips[id]
        // Ensure current user is always in memberIds on write
        const memberIds = Array.from(new Set([...(tripData.memberIds || []), userId]))

        setDoc(
          doc(tripsRef, id),
          { ...tripData, memberIds, _updatedAt: serverTimestamp() }
        ).catch(console.error)
      }
    })

    Object.keys(previousTrips).forEach((id) => {
      if (!currentTrips[id]) {
        console.warn(`[Wanderplan] Trip ${id} deleted locally. Outbound sync no longer auto-deletes.`)
      }
    })

    prevTripsRef.current = currentTrips
  }, [state.trips, userId])

  // ── 3. Dark mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
    // Persist dark mode pref in localStorage (UI preference, not trip data)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, darkMode: state.darkMode }))
    } catch { /* ignore */ }
  }, [state.darkMode])

  // ── 4. Toast auto-dismiss ────────────────────────────────────────────────
  useEffect(() => {
    if (state.toast.visible) {
      const timer = setTimeout(() => dispatch({ type: ACTIONS.HIDE_TOAST }), 3000)
      return () => clearTimeout(timer)
    }
  }, [state.toast.visible])

  // ── Return shape — identical to useTrips so no components need to change ─
  const activeTrip = state.activeTripId ? state.trips[state.activeTripId] : null

  const sortedTrips = Object.values(state.trips).sort((a, b) => {
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return new Date(a.startDate) - new Date(b.startDate)
  })

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message, type } })
  }, [])

  return { state, dispatch, activeTrip, sortedTrips, showToast, firestoreLoading }
}
// Cache Buster: 1771945353
