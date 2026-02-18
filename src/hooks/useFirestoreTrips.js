import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { tripReducer, ACTIONS } from '../state/tripReducer'
import { DEFAULT_TRIP } from '../data/defaultTrip'

const TRIPS_COLLECTION = 'trips'
const STORAGE_KEY = 'wanderplan_data'
const MIGRATION_FLAG = 'wanderplan_migrated'

function getInitialState() {
  // Restore dark mode preference from localStorage so it survives sign-out/sign-in
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

// ── Migration helper ─────────────────────────────────────────────────────────
// On first sign-in: if the user had trips in localStorage, write them to
// Firestore so nothing is lost. Runs only once, guarded by MIGRATION_FLAG.
async function migrateFromLocalStorage() {
  if (localStorage.getItem(MIGRATION_FLAG)) return false

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false
    const parsed = JSON.parse(saved)
    if (!parsed.trips || Object.keys(parsed.trips).length === 0) return false

    const trips = Object.values(parsed.trips)
    await Promise.all(
      trips.map(trip =>
        setDoc(doc(db, TRIPS_COLLECTION, trip.id), {
          ...trip,
          _updatedAt: serverTimestamp(),
        })
      )
    )
    localStorage.setItem(MIGRATION_FLAG, 'true')
    console.log(`[Wanderplan] Migrated ${trips.length} trip(s) from localStorage → Firestore`)
    return true
  } catch (err) {
    console.warn('[Wanderplan] Migration failed:', err)
    return false
  }
}

// ── Main hook ────────────────────────────────────────────────────────────────
export function useFirestoreTrips() {
  const [state, dispatch] = useReducer(tripReducer, null, getInitialState)
  const [firestoreLoading, setFirestoreLoading] = useState(true)

  // Ref holding the last-synced trips map — used to diff for outbound writes
  const prevTripsRef = useRef({})

  // Flag: true when a state change was triggered BY a Firestore snapshot.
  // Prevents writing that data back to Firestore (echo-write loop prevention).
  const isRemoteUpdateRef = useRef(false)

  // ── 1. Real-time listener: Firestore → local state ───────────────────────
  useEffect(() => {
    const tripsRef = collection(db, TRIPS_COLLECTION)

    const unsubscribe = onSnapshot(
      tripsRef,
      async (snapshot) => {
        // Build a plain trips map from the snapshot, strip Firestore metadata
        const tripsFromFirestore = {}
        snapshot.forEach((docSnap) => {
          const { _updatedAt, ...trip } = docSnap.data()
          tripsFromFirestore[docSnap.id] = trip
        })

        const isFirstLoad = Object.keys(prevTripsRef.current).length === 0

        // On first load with an empty Firestore collection:
        // check for localStorage data to migrate, or seed with the demo trip
        if (isFirstLoad && Object.keys(tripsFromFirestore).length === 0) {
          const migrated = await migrateFromLocalStorage()
          if (migrated) {
            // onSnapshot will fire again with the migrated trips — wait for it
            return
          }

          // No local data either — seed Firestore with the default demo trip
          await setDoc(doc(db, TRIPS_COLLECTION, DEFAULT_TRIP.id), {
            ...DEFAULT_TRIP,
            _updatedAt: serverTimestamp(),
          })
          // onSnapshot fires again with the seeded trip — wait for it
          return
        }

        // Mark this update as remote so the outbound effect skips it
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
  }, [])

  // ── 2. Outbound sync: local state → Firestore ────────────────────────────
  // Fires after every state.trips change. Diffs against prevTripsRef to write
  // only the trips that actually changed (by reference inequality).
  useEffect(() => {
    // This change came from Firestore — skip to avoid echo-write loop
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false
      return
    }

    const currentTrips = state.trips
    const previousTrips = prevTripsRef.current

    // Write trips that were added or mutated
    Object.keys(currentTrips).forEach((id) => {
      if (currentTrips[id] !== previousTrips[id]) {
        setDoc(
          doc(db, TRIPS_COLLECTION, id),
          { ...currentTrips[id], _updatedAt: serverTimestamp() }
        ).catch(console.error)
      }
    })

    // Delete trips that were removed
    Object.keys(previousTrips).forEach((id) => {
      if (!currentTrips[id]) {
        deleteDoc(doc(db, TRIPS_COLLECTION, id)).catch(console.error)
      }
    })

    prevTripsRef.current = currentTrips
  }, [state.trips])

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
