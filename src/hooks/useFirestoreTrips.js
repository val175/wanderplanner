import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { tripReducer, ACTIONS } from '../state/tripReducer'
import { DEFAULT_TRIP } from '../data/defaultTrip'

const STORAGE_KEY = 'wanderplan_data'
const MIGRATION_FLAG = 'wanderplan_migrated'
const FIRESTORE_MIGRATION_FLAG = 'wanderplan_fs_migrated'

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

// Returns the Firestore collection ref scoped to this user:  users/{uid}/trips
function getUserTripsRef(userId) {
  return collection(db, 'users', userId, 'trips')
}

// ── Old Firestore migration helper ───────────────────────────────────────────
// Copies trips from the old root `trips` collection into `users/{uid}/trips`.
// Runs once per browser, guarded by a localStorage flag.
async function migrateFromOldFirestore(userId) {
  if (localStorage.getItem(FIRESTORE_MIGRATION_FLAG)) return false

  try {
    const oldRef = collection(db, 'trips')
    const snapshot = await getDocs(oldRef)
    if (snapshot.empty) {
      localStorage.setItem(FIRESTORE_MIGRATION_FLAG, 'true')
      return false
    }

    const newTripsRef = getUserTripsRef(userId)
    await Promise.all(
      snapshot.docs.map(docSnap =>
        setDoc(doc(newTripsRef, docSnap.id), {
          ...docSnap.data(),
          userId,
          _updatedAt: serverTimestamp(),
        })
      )
    )
    localStorage.setItem(FIRESTORE_MIGRATION_FLAG, 'true')
    console.log(`[Wanderplan] Migrated ${snapshot.size} trip(s) from root Firestore → users/${userId}/trips`)
    return true
  } catch (err) {
    console.warn('[Wanderplan] Firestore migration failed:', err)
    return false
  }
}

// ── localStorage migration helper ─────────────────────────────────────────────
// On first sign-in: if the user had trips in localStorage, write them to
// Firestore so nothing is lost. Runs only once, guarded by MIGRATION_FLAG.
async function migrateFromLocalStorage(userId) {
  if (localStorage.getItem(MIGRATION_FLAG)) return false

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false
    const parsed = JSON.parse(saved)
    if (!parsed.trips || Object.keys(parsed.trips).length === 0) return false

    const tripsRef = getUserTripsRef(userId)
    const trips = Object.values(parsed.trips)
    await Promise.all(
      trips.map(trip =>
        setDoc(doc(tripsRef, trip.id), {
          ...trip,
          userId,
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
export function useFirestoreTrips(userId) {
  const [state, dispatch] = useReducer(tripReducer, null, getInitialState)
  const [firestoreLoading, setFirestoreLoading] = useState(true)

  // Ref holding the last-synced trips map — used to diff for outbound writes
  const prevTripsRef = useRef({})

  // Flag: true when a state change was triggered BY a Firestore snapshot.
  // Prevents writing that data back to Firestore (echo-write loop prevention).
  const isRemoteUpdateRef = useRef(false)

  // ── 1. Real-time listener: Firestore → local state ───────────────────────
  useEffect(() => {
    if (!userId) return

    const tripsRef = getUserTripsRef(userId)

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

        // On first load with an empty user subcollection: try to migrate from
        // the old root `trips` collection first (one-time), then localStorage,
        // and finally seed with the demo trip if nothing at all is found.
        if (isFirstLoad && Object.keys(tripsFromFirestore).length === 0) {
          const fsmigrated = await migrateFromOldFirestore(userId)
          if (fsmigrated) {
            // onSnapshot will fire again with the migrated trips — wait for it
            return
          }

          const migrated = await migrateFromLocalStorage(userId)
          if (migrated) {
            // onSnapshot will fire again with the migrated trips — wait for it
            return
          }

          // No data anywhere — seed Firestore with the default demo trip
          await setDoc(doc(tripsRef, DEFAULT_TRIP.id), {
            ...DEFAULT_TRIP,
            userId,
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
  }, [userId])

  // ── 2. Outbound sync: local state → Firestore ────────────────────────────
  // Fires after every state.trips change. Diffs against prevTripsRef to write
  // only the trips that actually changed (by reference inequality).
  useEffect(() => {
    if (!userId) return

    // This change came from Firestore — skip to avoid echo-write loop
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false
      return
    }

    const tripsRef = getUserTripsRef(userId)
    const currentTrips = state.trips
    const previousTrips = prevTripsRef.current

    // Write trips that were added or mutated
    Object.keys(currentTrips).forEach((id) => {
      if (currentTrips[id] !== previousTrips[id]) {
        setDoc(
          doc(tripsRef, id),
          { ...currentTrips[id], userId, _updatedAt: serverTimestamp() }
        ).catch(console.error)
      }
    })

    // Delete trips that were removed
    Object.keys(previousTrips).forEach((id) => {
      if (!currentTrips[id]) {
        deleteDoc(doc(tripsRef, id)).catch(console.error)
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
