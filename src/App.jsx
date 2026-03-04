import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase/config'
import { TripContext } from './context/TripContext'
import { ProfileProvider } from './context/ProfileContext'
import { useAuth } from './hooks/useAuth'
import { useFirestoreTrips } from './hooks/useFirestoreTrips'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ACTIONS } from './state/tripReducer'

// Auth
import AuthScreen from './components/auth/AuthScreen'

// Layout components
import Sidebar from './components/sidebar/Sidebar'
import TripHeader from './components/header/TripHeader'
import TabBar from './components/header/TabBar'
import BottomNav from './components/navigation/BottomNav'

// Modal
import NewTripModal from './components/modal/NewTripModal'

// Shared
import Toast from './components/shared/Toast'
import AIAssistant from './components/shared/AIAssistant'

// Tab components
import OverviewTab from './components/tabs/OverviewTab'
import ItineraryTab from './components/tabs/ItineraryTab'
import BookingsTab from './components/tabs/BookingsTab'
import BudgetTab from './components/tabs/BudgetTab'
import TodoTab from './components/tabs/TodoTab'
import VotingTab from './components/tabs/VotingTab'
import CitiesTab from './components/tabs/CitiesTab'
import PackingTab from './components/tabs/PackingTab'
import ConcertTab from './components/tabs/ConcertTab'

/* ─────────────────────────────────────────────────────────────
   Tab panel renderer
───────────────────────────────────────────────────────────── */
function TabPanel({ activeTab, onTabSwitch }) {
  switch (activeTab) {
    case 'overview': return <OverviewTab onTabSwitch={onTabSwitch} />
    case 'itinerary': return <ItineraryTab />
    case 'bookings': return <BookingsTab />
    case 'budget': return <BudgetTab />
    case 'todo': return <TodoTab />
    case 'voting': return <VotingTab />
    case 'cities': return <CitiesTab />
    case 'packing': return <PackingTab />
    case 'concert': return <ConcertTab />
    default: return <OverviewTab onTabSwitch={onTabSwitch} />
  }
}

/* ─────────────────────────────────────────────────────────────
   Empty state — shown when no trips exist
───────────────────────────────────────────────────────────── */
function EmptyState({ onNewTrip }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-fade-in-up">
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6 animate-pulse-warm">🧳</div>
        <h2 className="font-heading text-2xl font-bold text-text-primary mb-3">
          No trips yet
        </h2>
        <p className="text-text-muted text-sm leading-relaxed mb-8">
          Every great adventure starts with a plan. Create your first trip and let
          Wanderplan help you make it unforgettable.
        </p>
        <button
          onClick={onNewTrip}
          className="inline-flex items-center gap-2 px-6 py-3
                     bg-accent hover:bg-accent-hover text-text-inverse
                     font-semibold text-sm rounded-[var(--radius-md)]
                     transition-all duration-200 active:scale-[0.98]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Plan Your First Trip
        </button>
      </div>
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
   Loading screen — shown while auth or Firestore is initialising
───────────────────────────────────────────────────────────── */
function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse-warm">🗺️</div>
        <p className="text-text-muted text-sm animate-pulse">{message}</p>
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
  const { state, dispatch, activeTrip, sortedTrips, showToast, firestoreLoading } = useFirestoreTrips(user.uid)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showNewTripModal, setShowNewTripModal] = useState(false)

  const handleNewTrip = useCallback(() => {
    setShowNewTripModal(true)
    if (isMobile) dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
  }, [isMobile, dispatch])

  const handleCloseModal = useCallback(() => setShowNewTripModal(false), [])
  const handleOpenSidebar = useCallback(() => dispatch({ type: ACTIONS.SET_SIDEBAR, payload: true }), [dispatch])

  const handleTabSwitch = useCallback((tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
  }, [dispatch])

  const isConcertTab = state.activeTab === 'concert'

  if (firestoreLoading) {
    return <LoadingScreen message="Loading your trips…" />
  }

  return (
    <TripContext.Provider value={{ state, dispatch, activeTrip, sortedTrips, showToast, signOutUser }}>
      <div className="flex h-screen overflow-hidden bg-bg-primary text-text-secondary">

        <Sidebar
          isMobile={isMobile}
          isOpen={state.sidebarOpen}
          onNewTrip={handleNewTrip}
        />

        <main
          className={`
            flex-1 flex flex-col overflow-hidden bg-bg-primary
            ${isConcertTab ? 'concert-theme' : ''}
            transition-colors duration-300
          `}
        >
          {activeTrip ? (
            <>
              <TripHeader onOpenSidebar={handleOpenSidebar} isMobile={isMobile} />
              <TabBar />
              <div
                id={`panel-${state.activeTab}`}
                role="tabpanel"
                className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:pb-0 mb-14 md:mb-0"
              >
                <div className="px-4 sm:px-8 py-5 sm:py-7 max-w-[1400px] mx-auto">
                  <TabPanel activeTab={state.activeTab} onTabSwitch={handleTabSwitch} />
                </div>
              </div>
              <BottomNav />
            </>
          ) : (
            <EmptyState onNewTrip={handleNewTrip} />
          )}
        </main>

        <NewTripModal isOpen={showNewTripModal} onClose={handleCloseModal} />

        <AIAssistant />

        <Toast
          message={state.toast.message}
          type={state.toast.type}
          visible={state.toast.visible}
        />
      </div>
    </TripContext.Provider>
  )
}

/* ─────────────────────────────────────────────────────────────
   Hook: checks Firestore `users/{uid}` for `allowed: true`.
   Returns { checking: bool, isAllowed: bool }.
   To grant access to a user, set their uid doc to { allowed: true }
   in the Firebase console — no code redeploy needed.
───────────────────────────────────────────────────────────── */
function useAccessCheck(uid) {
  const [checking, setChecking] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    if (!uid) return
    getDoc(doc(db, 'users', uid))
      .then(snap => setIsAllowed(snap.exists() && snap.data()?.allowed === true))
      .catch(() => setIsAllowed(false))
      .finally(() => setChecking(false))
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
    return <LoadingScreen message="Loading…" />
  }

  if (!user) {
    return <AuthScreen onSignIn={signInWithGoogle} />
  }

  if (!isAllowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-center max-w-sm px-8">
          <div className="text-5xl mb-5">🔒</div>
          <h2 className="font-heading text-xl font-bold text-text-primary mb-2">
            Access restricted
          </h2>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            This app is private. You signed in as{' '}
            <span className="text-text-primary font-medium">{user.email}</span>,
            which isn't on the access list.
          </p>
          <button
            onClick={signOutUser}
            className="text-sm text-accent hover:underline"
          >
            Sign out and try another account
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProfileProvider user={user}>
      <AuthenticatedApp user={user} signOutUser={signOutUser} />
    </ProfileProvider>
  )
}
