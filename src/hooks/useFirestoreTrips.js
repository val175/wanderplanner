import { useState, useReducer, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  doc,
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
import { parseTripPath } from '../utils/urlState'

const STORAGE_KEY = 'wanderplan_data'
const REVERSE_MIGRATION_FLAG = 'wanderplan_root_migrated'

// Captured once at module load, before any effect can rewrite the URL.
// ?trip=<shareId> is the invite entry point (see useShareTrip).
const INITIAL_SHARE_ID = new URLSearchParams(window.location.search).get('trip')

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

  // Deep link: /trips/:tripId/:tab seeds navigation before first render.
  // SET_TRIPS_FROM_FIRESTORE validates the tripId once data arrives and
  // falls back to its priority pick when the trip doesn't exist.
  const deepLink = parseTripPath(window.location.pathname)

  return {
    trips: {},
    documentsByTrip: {},
    activeTripId: deepLink?.tripId || null,
    activeTab: deepLink?.tab || 'overview',
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
  const prevDocsByTripRef = useRef({})
  const isRemoteUpdateRef = useRef(false)
  const syncTimeoutRef = useRef(null)
  const pendingSyncIdsRef = useRef(new Set())

  // ── 1. Real-time listener: Shared Root → local state ─────────────────────
  useEffect(() => {
    if (!userId) return

    // Query for trips where the current user is a member
    const q = query(tripsRef, where('memberIds', 'array-contains', userId))

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const tripsFromFirestore = {}
        const deletedIds = []
        snapshot.forEach((docSnap) => {
          const { _updatedAt, deletedAt, ...trip } = docSnap.data()
          if (deletedAt) {
            deletedIds.push(docSnap.id)
            return
          }
          tripsFromFirestore[docSnap.id] = trip
        })

        const isFirstLoad = Object.keys(prevTripsRef.current).length === 0

        // Handle migration and seeding on first load
        if (isFirstLoad && Object.keys(tripsFromFirestore).length === 0) {
          const migrated = await migrateToSharedRoot(userId)
          if (migrated) return // onSnapshot will fire again

          // Arriving via an invite link? Don't seed a default trip — the
          // user is here to join an existing one.
          if (INITIAL_SHARE_ID) {
            setFirestoreLoading(false)
            return
          }

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
  // Resolved via the shareLinks/{shareId} capability doc — non-members have
  // no read access to /trips, so the invite preview comes from the snapshot
  // stored alongside the link (see useShareTrip.buildShareSnapshot).
  const shareHandledRef = useRef(false)
  useEffect(() => {
    if (!userId || firestoreLoading) return // wait for trips to load

    const shareId = INITIAL_SHARE_ID
    if (!shareId || shareHandledRef.current) return
    shareHandledRef.current = true

    // Strip the parameter from the address bar (keeps the path intact)
    const cleaned = new URLSearchParams(window.location.search)
    cleaned.delete('trip')
    const rest = cleaned.toString()
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''))

      ; (async () => {
        try {
          // Check if the trip is already in local state first (already a member)
          const localMatch = Object.values(state.trips).find(t => t.shareId === shareId)
          if (localMatch) {
            dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: localMatch.id })
            return
          }

          const linkSnap = await getDoc(doc(db, 'shareLinks', shareId))
          if (!linkSnap.exists()) {
            console.warn('[Wanderplan] Share link not found or revoked:', shareId)
            dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: 'This invite link is invalid or was revoked. Ask for a fresh one!', type: 'warning' } })
            return
          }

          const link = linkSnap.data()
          // Already a member of the referenced trip? Just switch to it.
          if (state.trips[link.tripId]) {
            dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: link.tripId })
            return
          }

          setPendingInvite({ id: link.tripId, shareId, ...link })
        } catch (err) {
          console.error('[Wanderplan] Share link resolution failed:', err)
        }
      })()
  }, [userId, firestoreLoading])

  const acceptInvite = useCallback(async () => {
    if (!pendingInvite || !userId) return
    try {
      const tripRef = doc(db, 'trips', pendingInvite.id)

      // Step 1 — the join. This is the ONLY write security rules allow a
      // non-member to make: append your own uid to memberIds/travelerIds.
      // arrayUnion keeps the diff minimal so the rule's affectedKeys check passes.
      await updateDoc(tripRef, {
        memberIds: arrayUnion(userId),
        travelerIds: arrayUnion(userId),
      })

      // Step 2 — now a member, read the full trip.
      const tripSnap = await getDoc(tripRef)
      if (!tripSnap.exists()) throw new Error('Trip vanished after join')
      const { _updatedAt, ...tripData } = tripSnap.data()

      // Step 3 — member-level cleanup: traveler count + snapshot visibility.
      let newSnapshot = tripData.travelersSnapshot || []
      try {
        const profSnap = await getDoc(doc(db, 'users', userId, 'profile', 'data'))
        if (profSnap.exists() && !newSnapshot.some(s => s.id === userId)) {
          const p = profSnap.data()
          newSnapshot = [...newSnapshot, {
            id: userId,
            name: p.name || 'Traveler',
            avatar: p.customPhoto || p.photo || null
          }]
        }
      } catch (err) {
        console.warn('[Wanderplan] Failed to prefetch joining user profile:', err)
      }

      const travelersCount = Math.max((tripData.travelerIds || []).length, 1)
      await updateDoc(tripRef, {
        travelers: travelersCount,
        travelersSnapshot: newSnapshot
      })

      const updatedTrip = { ...tripData, id: pendingInvite.id, travelers: travelersCount, travelersSnapshot: newSnapshot }

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

  // ── 2. Outbound sync: local state → Firestore (trips + documents, unified) ──
  // Writing both in one setDoc prevents a feedback loop where separate document
  // writes trigger Firestore snapshots that set isRemoteUpdateRef, causing the
  // trip sync (with spendingLog) to be skipped indefinitely.
  useEffect(() => {
    if (!userId) return
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false
      // Update prev refs so we don't re-write Firestore data on the next local change
      prevTripsRef.current = state.trips
      prevDocsByTripRef.current = state.documentsByTrip || {}
      return
    }

    const currentTrips = state.trips
    const previousTrips = prevTripsRef.current
    const currentDocs = state.documentsByTrip || {}
    const previousDocs = prevDocsByTripRef.current

    // Collect all trip IDs where either the trip data or its documents changed
    const idsToSync = new Set([
      ...Object.keys(currentTrips).filter(id => currentTrips[id] !== previousTrips[id]),
      ...Object.keys(currentDocs).filter(id => JSON.stringify(currentDocs[id]) !== JSON.stringify(previousDocs[id])),
    ])

    // Add to pending sync IDs to gather changes occurring during the debounce window
    idsToSync.forEach(id => pendingSyncIdsRef.current.add(id))

    if (pendingSyncIdsRef.current.size === 0) {
      prevTripsRef.current = currentTrips
      prevDocsByTripRef.current = currentDocs
      return
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = setTimeout(() => {
      pendingSyncIdsRef.current.forEach((id) => {
        const tripData = currentTrips[id]
        if (!tripData || tripData?.deletedAt) return
        const memberIds = Array.from(new Set([
          ...(tripData.memberIds || []),
          ...(tripData.travelerIds || []),
          userId
        ]))
        setDoc(
          doc(tripsRef, id),
          { ...tripData, documents: currentDocs[id] || {}, memberIds, _updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(console.error)
      })

      Object.keys(previousTrips).forEach((id) => {
        if (!currentTrips[id]) {
          console.warn(`[Wanderplan] Trip ${id} deleted locally. Outbound sync no longer auto-deletes.`)
        }
      })
      
      pendingSyncIdsRef.current.clear()
    }, 1000)

    prevTripsRef.current = currentTrips
    prevDocsByTripRef.current = currentDocs
  }, [state.trips, state.documentsByTrip, userId])

  // ── 3. Dark mode ─────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode)
    const themeColor = state.darkMode ? '#1A1918' : '#F4F2EF'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
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
      // Toasts with an action button (e.g. Undo) get a longer window
      const ms = state.toast.action ? 6000
        : state.toast.type === 'error' ? 5000 : state.toast.type === 'warning' ? 4000 : 3000
      const timer = setTimeout(() => dispatch({ type: ACTIONS.HIDE_TOAST }), ms)
      return () => clearTimeout(timer)
    }
  }, [state.toast.visible, state.toast.type, state.toast.action])

  // ── Return shape — identical to useTrips so no components need to change ─
  const activeTrip = state.activeTripId ? state.trips[state.activeTripId] : null

  const sortedTrips = Object.values(state.trips).sort((a, b) => {
    if (!a.startDate) return 1
    if (!b.startDate) return -1
    return new Date(a.startDate) - new Date(b.startDate)
  })

  // action: optional { label, onClick } — renders a button in the toast (e.g. Undo)
  const showToast = useCallback((message, type = 'success', action = null) => {
    dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message, type, action } })
  }, [])

  return {
    state, dispatch, activeTrip, sortedTrips,
    showToast, firestoreLoading,
    pendingInvite, acceptInvite, declineInvite
  }
}
// Cache Buster: 1771945353
