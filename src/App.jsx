import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { MotionConfig } from 'framer-motion'
import { doc, getDoc, getDocs, setDoc, collection, query, where, limit } from 'firebase/firestore'
import { db } from './firebase/config'
import { TripContext, useTripContext } from './context/TripContext'
import { ProfileProvider, useProfiles } from './context/ProfileContext'
import { useAuth } from './hooks/useAuth'
import { useFirestoreTrips } from './hooks/useFirestoreTrips'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ACTIONS } from './state/tripReducer'
import { getEffectiveStatus } from './utils/tripStatus'

// Auth
import AuthScreen from './components/auth/AuthScreen'
import WandWordmark from './components/shared/WandWordmark'
import Button from './components/shared/Button'
import EmptyState from './components/shared/EmptyState'

// Layout components
import Sidebar from './components/sidebar/Sidebar'
import TripHeader from './components/header/TripHeader'
import BottomNav from './components/navigation/BottomNav'

// Modal
import NewTripModal from './components/modal/NewTripModal'
import JoinTripModal from './components/modal/JoinTripModal'

// Shared
import Toast from './components/shared/Toast'
import CursorManager from './components/shared/CursorManager'
import ErrorBoundary from './components/shared/ErrorBoundary'

// Tab components
import OverviewTab from './components/tabs/OverviewTab'
import { wandaRuntime, setWandaRuntime } from './utils/wandaRuntime'

const ItineraryTab = lazy(() => import('./components/tabs/ItineraryTab'))
const BookingsTab = lazy(() => import('./components/tabs/BookingsTab'))
const BudgetTab = lazy(() => import('./components/tabs/BudgetTab'))
const TodoTab = lazy(() => import('./components/tabs/TodoTab'))
const DocumentsTab = lazy(() => import('./components/tabs/DocumentsTab'))
const VotingTab = lazy(() => import('./components/tabs/VotingTab'))
const HowToVideosTab = lazy(() => import('./components/tabs/HowToVideosTab'))
const CitiesTab = lazy(() => import('./components/tabs/CitiesTab'))
const PackingTab = lazy(() => import('./components/tabs/PackingTab'))
const ConcertTab = lazy(() => import('./components/tabs/ConcertTab'))
const WanderMapTab = lazy(() => import('./components/tabs/WanderMapTab'))
const WrapUpTab = lazy(() => import('./components/tabs/WrapUpTab'))

const AIAssistant = lazy(() => import('./components/shared/AIAssistant'))
const WalkieTalkieModal = lazy(() => import('./components/shared/WalkieTalkieModal'))
const GlobalSearchModal = lazy(() => import('./components/modal/GlobalSearchModal'))
const ShortcutsModal = lazy(() => import('./components/shared/ShortcutsModal'))
const LevelUpModal = lazy(() => import('./components/shared/LevelUpModal'))

/* ─────────────────────────────────────────────────────────────
   Tab panel renderer
───────────────────────────────────────────────────────────── */
function TabPanel({ activeTab, onTabSwitch }) {
  return (
    <Suspense fallback={<TabLoadingState activeTab={activeTab} />}>
      <div key={activeTab} className="animate-tab-enter w-full h-full">
        <ErrorBoundary
          onReset={() => console.log('Resetting tab:', activeTab)}
          fallbackAction={activeTab !== 'overview' ? () => onTabSwitch('overview') : undefined}
        >
          {(() => {
            switch (activeTab) {
              case 'overview': return <OverviewTab onTabSwitch={onTabSwitch} />
              case 'wandermap': return <WanderMapTab />
              case 'itinerary': return <ItineraryTab />
              case 'bookings': return <BookingsTab />
              case 'budget': return <BudgetTab />
              case 'todo': return <TodoTab />
              case 'documents': return <DocumentsTab />
              case 'voting': return <VotingTab />
              case 'videos': return <HowToVideosTab />
              case 'cities': return <CitiesTab />
              case 'packing': return <PackingTab />
              case 'concert': return <ConcertTab />
              case 'wrap-up': return <WrapUpTab />
              default: return <OverviewTab onTabSwitch={onTabSwitch} />
            }
          })()}
        </ErrorBoundary>
      </div>
    </Suspense>
  )
}

function describeMapPoint(point) {
  if (!point) return ''
  if (point.type === 'activity') return point.activity?.name || point.activityId || 'activity'
  if (point.type === 'dest') return point.city || point.dayId || 'destination'
  if (point.type === 'idea') return point.idea?.title || point.ideaId || 'idea'
  return 'selected point'
}

const TAB_LABELS = {
  overview: 'Overview',
  itinerary: 'Itinerary',
  bookings: 'Bookings',
  budget: 'Budget',
  todo: 'Tasks',
  documents: 'Documents',
  voting: 'Voting',
  videos: 'How-To',
  cities: 'Cities',
  packing: 'Packing',
  concert: 'Concert',
  wandermap: 'Map',
  'wrap-up': 'Wrap-up',
}

// Skeleton block helper
function Sk({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

function TabLoadingState({ activeTab }) {
  // Table-style skeleton for list-heavy tabs
  if (['bookings', 'budget', 'todo', 'packing', 'documents'].includes(activeTab)) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-bg-card border border-border rounded-[var(--radius-md)] overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <Sk className="h-4 w-28" />
            <Sk className="h-7 w-20 rounded-[var(--radius-md)]" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-t border-border/20">
              <Sk className="h-4 w-4 rounded-sm shrink-0" />
              <Sk className="h-3.5 flex-1" style={{ maxWidth: `${55 + (i * 7) % 30}%` }} />
              <Sk className="h-5 w-16 rounded-[var(--radius-pill)]" />
              <Sk className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Bento-style skeleton for overview + map-adjacent tabs
  if (['overview', 'cities', 'voting'].includes(activeTab)) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in">
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Hero card */}
          <div className="bg-bg-card border border-border rounded-[var(--radius-md)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Sk className="h-3 w-24" />
              <Sk className="h-5 w-28 rounded-[var(--radius-pill)]" />
            </div>
            <div className="flex gap-3">
              <Sk className="h-10 w-10 rounded-[var(--radius-md)] shrink-0" />
              <div className="flex-1 space-y-2">
                <Sk className="h-4 w-40" />
                <Sk className="h-3 w-full" />
                <Sk className="h-3 w-3/4" />
              </div>
            </div>
          </div>
          {/* Attention card */}
          <div className="bg-bg-card border border-border rounded-[var(--radius-md)] overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <Sk className="h-3 w-32" />
              <Sk className="h-5 w-14 rounded-[var(--radius-pill)]" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-t border-border/20">
                <Sk className="h-10 w-10 rounded-[var(--radius-md)] shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Sk className="h-3.5 w-44" />
                  <Sk className="h-2.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Health card */}
          <div className="bg-bg-card border border-border rounded-[var(--radius-md)] overflow-hidden">
            {['weather', 'readiness', 'budget'].map((section) => (
              <div key={section} className="p-4 border-t first:border-t-0 border-border/40 space-y-3">
                <Sk className="h-3 w-20" />
                <Sk className="h-8 w-16" />
                <Sk className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          {/* Destinations card */}
          <div className="bg-bg-card border border-border rounded-[var(--radius-md)] overflow-hidden">
            <div className="px-4 py-3 border-b border-border/40">
              <Sk className="h-3 w-24" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-t border-border/20">
                <Sk className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Sk className="h-3.5 w-24" />
                  <Sk className="h-2.5 w-16" />
                </div>
                <Sk className="h-3 w-6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Simple single-card skeleton for everything else
  return (
    <div className="bg-bg-card border border-border rounded-[var(--radius-md)] p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <Sk className="h-4 w-32" />
        <Sk className="h-7 w-24 rounded-[var(--radius-md)]" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Sk className="h-3 flex-1" style={{ maxWidth: `${60 + (i * 9) % 35}%` }} />
          <Sk className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
   Loading screen — shown ONLY while auth or Firestore is actually
   initialising. It never blocks: the moment data is ready the app
   renders, even mid-animation. The wordmark animation plays at most
   once per page load; any later loading screens show the static mark.
───────────────────────────────────────────────────────────── */
let splashPlayed = false

function LoadingScreen({ message = 'Loading…' }) {
  const [isStatic] = useState(() => splashPlayed)
  useEffect(() => { splashPlayed = true }, [])
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <WandWordmark static={isStatic} />
        <p className="text-text-muted text-sm animate-pulse mt-6">{message}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Authenticated app — only mounts AFTER the user is signed in.
   Keeping it separate means useFirestoreTrips only runs when
   we have a valid auth session (Firestore rules require auth).
───────────────────────────────────────────────────────────── */
function AuthenticatedApp({ user, signOutUser }) {
  const {
    state, dispatch, activeTrip, sortedTrips,
    showToast, firestoreLoading,
    pendingInvite, acceptInvite, declineInvite
  } = useFirestoreTrips(user.uid)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Read-only mode: active when the trip is completed or manually archived
  const effectiveStatus = getEffectiveStatus(activeTrip)
  const isReadOnly = effectiveStatus === 'completed' || effectiveStatus === 'archived'
  const effectiveTab = isReadOnly && state.activeTab === 'overview' ? 'wrap-up' : state.activeTab

  useEffect(() => {
    setWandaRuntime({
      activeTab: effectiveTab,
      uiContext: wandaRuntime.selectedMapPoint
        ? `${effectiveTab} · ${describeMapPoint(wandaRuntime.selectedMapPoint)}`
        : effectiveTab,
    })
  }, [effectiveTab, activeTrip?.id])

  useEffect(() => {
    document.title = activeTrip?.name ? `${activeTrip.name} · Wanderplan` : 'Wanderplan'
  }, [activeTrip?.name])

  const handleNewTrip = useCallback(() => {
    setShowNewTripModal(true)
    if (isMobile) dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
  }, [isMobile, dispatch])

  const handleCloseModal = useCallback(() => setShowNewTripModal(false), [])
  const handleOpenSidebar = useCallback(() => dispatch({ type: ACTIONS.SET_SIDEBAR, payload: true }), [dispatch])

  const [showSearch, setShowSearch] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [levelUpEvent, setLevelUpEvent] = useState(null)
  useEffect(() => {
    const handleOpenSearch = () => setShowSearch(true)
    window.addEventListener('open-global-search', handleOpenSearch)
    return () => window.removeEventListener('open-global-search', handleOpenSearch)
  }, [])
  useEffect(() => {
    const handleKeyDown = (e) => {
      const inInput = document.activeElement?.matches?.('input, textarea') || document.activeElement?.isContentEditable
      if (e.key === '?' && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowShortcuts(prev => !prev)
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch])

  useEffect(() => {
    const handleLevelUp = (e) => setLevelUpEvent(e)
    window.addEventListener('xp-level-up', handleLevelUp)
    return () => window.removeEventListener('xp-level-up', handleLevelUp)
  }, [])

  const handleTabSwitch = useCallback((tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
  }, [dispatch])

  const { addProfile, profiles } = useProfiles()

  const handleAcceptInvite = useCallback(async () => {
    if (!pendingInvite) return
    await acceptInvite()

    // Auto-populate the new user's traveler DB using the snapshot in the shared trip
    if (pendingInvite.travelersSnapshot) {
      pendingInvite.travelersSnapshot.forEach(profile => {
        if (profile.id !== user.uid) { // Don't add self to travelers
          addProfile(profile)
        }
      })
    }
  }, [pendingInvite, acceptInvite, addProfile, user.uid])

  const isConcertTab = state.activeTab === 'concert'
  const showSidebarWanda = !isMobile && state.aiViewMode === 'sidebar'

  // Auto-heal missing profiles from active trip
  const fetchAttempted = useRef(new Set())
  useEffect(() => {
    if (!activeTrip?.travelerIds || !user?.uid) return

    const missingIds = activeTrip.travelerIds.filter(
      id => id !== user.uid && !profiles.some(p => p.id === id) && !fetchAttempted.current.has(id)
    )

    missingIds.forEach(async (id) => {
      fetchAttempted.current.add(id)
      try {
        const snap = await getDoc(doc(db, 'users', id, 'profile', 'data'))
        if (snap.exists()) {
          const fetchedProfile = { ...snap.data(), id: id, uid: id }
          addProfile(fetchedProfile)
        }
      } catch (err) {
        console.warn(`[Wanderplan] Failed to fetch profile for ${id}:`, err)
      }
    })
  }, [activeTrip?.travelerIds, profiles, user?.uid, addProfile])

  // Sync current user's latest name/photo to the shared travelersSnapshot for others to see
  const { currentUserProfile } = useProfiles()
  useEffect(() => {
    if (!activeTrip || !currentUserProfile) return
    const myId = currentUserProfile.uid || currentUserProfile.id
    const snapshotEntry = activeTrip.travelersSnapshot?.find(s => s.id === myId)
    
    const latestName = currentUserProfile.name || 'Traveler'
    const latestPhoto = currentUserProfile.customPhoto || currentUserProfile.photo || null
    const snapPhoto = snapshotEntry?.photo || null
    
    const needsRefresh = !snapshotEntry || 
                        snapshotEntry.name !== latestName || 
                        snapPhoto !== latestPhoto
                        
    if (needsRefresh) {
      dispatch({ 
        type: ACTIONS.REFRESH_TRAVELER_SNAPSHOT, 
        payload: { travelerId: myId, name: latestName, photo: latestPhoto } 
      })
    }
  }, [activeTrip?.id, currentUserProfile, dispatch])

  if (firestoreLoading) {
    return <LoadingScreen message="Eleka nahmen nahmen, ah tum ah tum, eleka nahmen..." />
  }

  return (
    <MotionConfig reducedMotion="user">
    <TripContext.Provider value={{ state, dispatch, activeTrip, sortedTrips, showToast, signOutUser, isReadOnly, effectiveStatus }}>
      <div className="flex h-screen overflow-hidden bg-bg-primary text-text-secondary antialiased">
        {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-[10000] bg-orange-500 text-white text-[11px] font-semibold px-4 py-1 text-center shadow-md animate-fade-in">
            Offline Mode: Working locally (changes will sync when reconnected)
          </div>
        )}
        {activeTrip && <CursorManager tripId={activeTrip.id} userId={user.uid} tabId={effectiveTab} />}

        <Sidebar
          isMobile={isMobile}
          isOpen={state.sidebarOpen}
          onNewTrip={handleNewTrip}
        />

        <div className="flex flex-1 overflow-hidden">
          <main
            className={`
              flex-1 flex flex-col overflow-hidden bg-bg-primary
              ${isConcertTab ? 'concert-theme' : ''}
              transition-colors duration-300
            `}
          >
            {activeTrip ? (
              <>
                {effectiveTab !== 'wrap-up' && (
                  <TripHeader onOpenSidebar={handleOpenSidebar} isMobile={isMobile} />
                )}
                <div
                  id={`panel-${effectiveTab}`}
                  role="tabpanel"
                  className={`flex-1 overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom)] md:pb-0 mb-14 md:mb-0 ${effectiveTab === 'wandermap' ? '' : 'px-4 sm:px-8 py-5 sm:py-7'}`}
                >
                  <div className={effectiveTab === 'wandermap' ? 'h-full w-full relative' : 'max-w-[1400px] mx-auto'}>
                    <TabPanel activeTab={effectiveTab} onTabSwitch={handleTabSwitch} />
                  </div>
                </div>
                <BottomNav />
              </>
            ) : (
              <EmptyState
                emoji="🧳"
                title="No trips yet"
                subtitle="Every great adventure starts with a plan. Create your first trip and let Wanderplan help you make it unforgettable."
                action={
                  <Button onClick={handleNewTrip}>
                    + Plan Your First Trip
                  </Button>
                }
              />
            )}
          </main>

          {!isMobile && (
            <aside
              id="wanda-sidebar-slot"
              className={`hidden md:flex overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                showSidebarWanda
                  ? 'w-[360px] border-l border-border bg-bg-card'
                  : 'w-0'
              }`}
            />
          )}
        </div>

        <NewTripModal isOpen={showNewTripModal} onClose={handleCloseModal} />

        <JoinTripModal
          pendingInvite={pendingInvite}
          onAccept={handleAcceptInvite}
          onDecline={declineInvite}
        />

        <Suspense fallback={null}>
          <GlobalSearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
          <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
          <AIAssistant />
          <WalkieTalkieModal />
          {levelUpEvent && (
            <LevelUpModal event={levelUpEvent} onClose={() => setLevelUpEvent(null)} />
          )}
        </Suspense>

        <Toast
          message={state.toast.message}
          type={state.toast.type}
          visible={state.toast.visible}
          onDismiss={() => dispatch({ type: ACTIONS.HIDE_TOAST })}
        />
      </div>
    </TripContext.Provider>
    </MotionConfig>
  )
}

/* ─────────────────────────────────────────────────────────────
   Hook: invite-only access gate.
   A signed-in user may enter when any of these hold:
     1. users/{uid}.allowed === true   (manual grant via Firebase console,
        or cached from a previous successful check)
     2. The URL carries a ?trip=<shareId> invite — they're here to join.
     3. They're already a member of at least one trip.
   Anyone else sees the "Access restricted" screen. No auto-grant.

   NOTE: this gate is UX only. The real boundary is firestore.rules —
   trips are readable exclusively by their memberIds.
───────────────────────────────────────────────────────────── */
function useAccessCheck(uid) {
  const [checking, setChecking] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    if (!uid) return
    let cancelled = false

    ;(async () => {
      try {
        // 2. Invite link present — let them through to the join flow.
        if (new URLSearchParams(window.location.search).has('trip')) {
          if (!cancelled) { setIsAllowed(true); setChecking(false) }
          return
        }

        // 1. Explicit / cached grant
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists() && snap.data()?.allowed === true) {
          if (!cancelled) { setIsAllowed(true); setChecking(false) }
          return
        }

        // 3. Member of any trip already?
        const member = await getDocs(
          query(collection(db, 'trips'), where('memberIds', 'array-contains', uid), limit(1))
        )
        if (!member.empty) {
          // Cache so future loads skip the membership query
          setDoc(doc(db, 'users', uid), { allowed: true }, { merge: true }).catch(() => {})
          if (!cancelled) { setIsAllowed(true); setChecking(false) }
          return
        }

        if (!cancelled) { setIsAllowed(false); setChecking(false) }
      } catch (err) {
        console.error('[Wanderplan] Access check failed:', err)
        if (!cancelled) { setIsAllowed(false); setChecking(false) }
      }
    })()

    return () => { cancelled = true }
  }, [uid])

  return { checking, isAllowed }
}

/* ─────────────────────────────────────────────────────────────
   App root — handles auth gating.
   useAuth lives here; AuthenticatedApp only mounts when signed in.
───────────────────────────────────────────────────────────── */
export default function App() {
  const { user, authLoading, signInWithGoogle, signOutUser } = useAuth()
  const { checking, isAllowed } = useAccessCheck(user?.uid)

  if (authLoading || (user && checking)) {
    return <LoadingScreen message="Eleka nahmen nahmen, ah tum ah tum, eleka nahmen..." />
  }

  if (!user) {
    return <AuthScreen onSignIn={signInWithGoogle} />
  }

  if (!isAllowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary px-6">
        <EmptyState
          emoji="🔒"
          title="Access restricted"
          subtitle={`Wanderplan is invite-only. You signed in as ${user.email}, which isn't a member of any trip yet — ask a friend for an invite link to get started.`}
          action={
            <Button variant="secondary" onClick={signOutUser}>
              Sign out and try another account
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <ProfileProvider user={user}>
      <AuthenticatedApp user={user} signOutUser={signOutUser} />
    </ProfileProvider>
  )
}
