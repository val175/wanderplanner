import { useState, useCallback } from 'react'
import { TripContext } from './context/TripContext'
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

// Modal
import NewTripModal from './components/modal/NewTripModal'

// Shared
import Toast from './components/shared/Toast'

// Tab components
import OverviewTab from './components/tabs/OverviewTab'
import ItineraryTab from './components/tabs/ItineraryTab'
import BookingsTab from './components/tabs/BookingsTab'
import BudgetTab from './components/tabs/BudgetTab'
import TodoTab from './components/tabs/TodoTab'
import CitiesTab from './components/tabs/CitiesTab'
import PackingTab from './components/tabs/PackingTab'
import ConcertTab from './components/tabs/ConcertTab'

/* ─────────────────────────────────────────────────────────────
   Tab panel renderer
───────────────────────────────────────────────────────────── */
function TabPanel({ activeTab }) {
  switch (activeTab) {
    case 'overview':    return <OverviewTab />
    case 'itinerary':  return <ItineraryTab />
    case 'bookings':   return <BookingsTab />
    case 'budget':     return <BudgetTab />
    case 'todo':       return <TodoTab />
    case 'cities':     return <CitiesTab />
    case 'packing':    return <PackingTab />
    case 'concert':    return <ConcertTab />
    default:           return <OverviewTab />
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
   Mobile hamburger button
───────────────────────────────────────────────────────────── */
function HamburgerButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 left-4 z-30 p-2.5
                 bg-bg-secondary border border-border
                 rounded-[var(--radius-md)]
                 text-text-secondary hover:text-text-primary
                 transition-colors duration-150
                 md:hidden"
      aria-label="Open sidebar"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
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
function AuthenticatedApp({ signOutUser }) {
  const { state, dispatch, activeTrip, sortedTrips, showToast, firestoreLoading } = useFirestoreTrips()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showNewTripModal, setShowNewTripModal] = useState(false)

  const handleNewTrip = useCallback(() => {
    setShowNewTripModal(true)
    if (isMobile) dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
  }, [isMobile, dispatch])

  const handleCloseModal = useCallback(() => setShowNewTripModal(false), [])
  const handleOpenSidebar = useCallback(() => dispatch({ type: ACTIONS.SET_SIDEBAR, payload: true }), [dispatch])

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

        {isMobile && <HamburgerButton onClick={handleOpenSidebar} />}

        <main
          className={`
            flex-1 flex flex-col overflow-hidden bg-bg-primary
            ${isConcertTab ? 'concert-theme' : ''}
            transition-colors duration-300
          `}
        >
          {activeTrip ? (
            <>
              <TripHeader />
              <TabBar />
              <div
                id={`panel-${state.activeTab}`}
                role="tabpanel"
                className="flex-1 overflow-y-auto"
              >
                <div className="px-8 py-7 max-w-4xl mx-auto">
                  <TabPanel activeTab={state.activeTab} />
                </div>
              </div>
            </>
          ) : (
            <EmptyState onNewTrip={handleNewTrip} />
          )}
        </main>

        <NewTripModal isOpen={showNewTripModal} onClose={handleCloseModal} />

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
   App root — handles auth gating.
   useAuth lives here; AuthenticatedApp only mounts when signed in.
───────────────────────────────────────────────────────────── */
export default function App() {
  const { user, authLoading, signInWithGoogle, signOutUser } = useAuth()

  if (authLoading) {
    return <LoadingScreen message="Loading…" />
  }

  if (!user) {
    return <AuthScreen onSignIn={signInWithGoogle} />
  }

  // Email allowlist — only these two accounts can access the app
  const ALLOWED_EMAILS = ['valentin.bonite@gmail.com', 'juliannsibi@gmail.com']
  if (!ALLOWED_EMAILS.includes(user.email)) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <div className="text-center max-w-sm px-8">
          <div className="text-5xl mb-5">🔒</div>
          <h2 className="font-heading text-xl font-bold text-text-primary mb-2">
            Access restricted
          </h2>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            This app is private. You signed in as <span className="text-text-primary font-medium">{user.email}</span>, which isn't on the access list.
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

  return <AuthenticatedApp signOutUser={signOutUser} />
}
