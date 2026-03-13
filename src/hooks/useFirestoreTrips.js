import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { tripReducer, ACTIONS } from '../state/tripReducer'
import { DEFAULT_TRIP } from '../data/defaultTrip'
import { generateId } from '../utils/helpers'

const STORAGE_KEY = 'wanderplan_data'
const REVERSE_MIGRATION_FLAG = 'wanderplan_root_migrated'

function getInitialState() {
  let darkMode = false
  let aiViewMode = 'floating'
  let aiOpen = false
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      darkMode = parsed.darkMode || false
      aiViewMode = parsed.aiViewMode || 'floating'
      aiOpen = false
    }
  } catch { /* ignore */ }

  return {
    trips: {},
    activeTripId: null,
    activeTab: 'overview',
    sidebarOpen: false,
    aiViewMode,
    aiOpen,
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
  const [pendingInvite, setPendingInvite] = useState(null)
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
          const newId = generateId()
          await setDoc(doc(tripsRef, newId), {
            ...DEFAULT_TRIP,
            id: newId,
            memberIds: [userId],
            travelerIds: [userId],
            _updatedAt: serverTimestamp(),
          })
          return
        }

        // Calculate trips deleted since last snapshot
        const deletedIds = []
        if (!isFirstLoad) {
          Object.keys(prevTripsRef.current).forEach(id => {
            if (!tripsFromFirestore[id]) {
              deletedIds.push(id)
            }
          })
        }

        isRemoteUpdateRef.current = true
        prevTripsRef.current = tripsFromFirestore
        dispatch({
          type: ACTIONS.SET_TRIPS_FROM_FIRESTORE,
          payload: { trips: tripsFromFirestore, deletedIds }
        })
        setFirestoreLoading(false)
      },
      (error) => {
        console.error('[Wanderplan] Firestore listener error:', error)
        setFirestoreLoading(false)
      }
    )

    return unsubscribe
  }, [userId])

  // ── 1b. Share-link resolution: ?trip=<shareId> on page load ────────────────
  useEffect(() => {
    if (!userId || firestoreLoading) return // wait for trips to load

    const params = new URLSearchParams(window.location.search)
    const shareId = params.get('trip')
    if (!shareId) return

    // Clear the URL parameter immediately so it doesn't re-run
    window.history.replaceState({}, '', window.location.pathname)

      ; (async () => {
        try {
          // Check if the trip is already in local state first
          const localMatch = Object.values(state.trips).find(t => t.shareId === shareId)
          if (localMatch) {
            dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: localMatch.id })
            return
          }

          // Otherwise query Firestore for a trip with this shareId
          const q = query(tripsRef, where('shareId', '==', shareId))
          const snapshot = await getDocs(q)

          if (snapshot.empty) {
            console.warn('[Wanderplan] Share link not found:', shareId)
            return
          }

          const tripDoc = snapshot.docs[0]
          setPendingInvite({ id: tripDoc.id, ref: tripDoc.ref, ...tripDoc.data() })
        } catch (err) {
          console.error('[Wanderplan] Share link resolution failed:', err)
        }
      })()
  }, [userId, firestoreLoading])

  const acceptInvite = useCallback(async () => {
    if (!pendingInvite || !userId) return
    try {
      const memberIds = pendingInvite.memberIds || []
      const travelerIds = pendingInvite.travelerIds || []

      const newMemberIds = Array.from(new Set([...memberIds, userId]))
      const newTravelerIds = Array.from(new Set([...travelerIds, userId]))
      const travelersCount = Math.max(newTravelerIds.length, 1)

      // Fetch this user's profile so we can inject them into travelersSnapshot immediately
      let activeUserProfile = null
      try {
        const docRef = doc(db, 'users', userId, 'profile', 'data')
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          activeUserProfile = snap.data()
        }
      } catch (err) {
        console.warn('[Wanderplan] Failed to prefetch joining user profile:', err)
      }

      let newSnapshot = pendingInvite.travelersSnapshot || []
      if (activeUserProfile && !newSnapshot.some(s => s.id === userId)) {
        newSnapshot = [...newSnapshot, {
          id: userId,
          name: activeUserProfile.name || 'Traveler',
          avatar: activeUserProfile.customPhoto || activeUserProfile.photo || null
        }]
      }

      // Add user explicitly to both lists AND snapshot to guarantee access & visibility
      await updateDoc(pendingInvite.ref, {
        memberIds: newMemberIds,
        travelerIds: newTravelerIds,
        travelers: travelersCount,
        travelersSnapshot: newSnapshot
      })

      const updatedTrip = {
        ...pendingInvite,
        memberIds: newMemberIds,
        travelerIds: newTravelerIds,
        travelers: travelersCount,
        travelersSnapshot: newSnapshot
      }

      // Prevent our optimistic UI injection from triggering a recursive setDoc
      isRemoteUpdateRef.current = true

      // Inject into local state immediately so UI doesn't blink while waiting for snapshot
      dispatch({ type: ACTIONS.ADD_TRIP, payload: updatedTrip })
      dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: pendingInvite.id })
      dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: 'You joined the trip!', type: 'success' } })
      setPendingInvite(null)
    } catch (err) {
      console.error('[Wanderplan] Accept invite failed:', err)
      dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: 'Failed to join trip', type: 'error' } })
      setPendingInvite(null)
    }
  }, [pendingInvite, userId])

  const declineInvite = useCallback(() => {
    setPendingInvite(null)
  }, [])

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
        // Ensure current user and all travelerIds are in memberIds on write
        const memberIds = Array.from(new Set([
          ...(tripData.memberIds || []),
          ...(tripData.travelerIds || []),
          userId
        ]))

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
    // Persist UI prefs in localStorage (not trip data)
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const parsed = saved ? JSON.parse(saved) : {}
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, darkMode: state.darkMode, aiViewMode: state.aiViewMode, aiOpen: state.aiOpen }))
    } catch { /* ignore */ }
  }, [state.darkMode, state.aiViewMode])

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

  return {
    state, dispatch, activeTrip, sortedTrips,
    showToast, firestoreLoading,
    pendingInvite, acceptInvite, declineInvite
  }
}
// Cache Buster: 1771945353
