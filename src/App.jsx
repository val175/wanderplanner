import { useState, useCallback } from 'react'
import { TripContext } from './context/TripContext'
import { useTrips } from './hooks/useTrips'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ACTIONS } from './state/tripReducer'

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
   Centralizes which component maps to which tab id.
   concert-theme CSS class applies the dark red concert aesthetic.
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
   Empty state — shown when no trips exist at all
───────────────────────────────────────────────────────────── */
function EmptyState({ onNewTrip }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-fade-in-up">
      <div className="text-center max-w-sm">
        {/* Illustration */}
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
   Mobile hamburger button — renders only on small screens.
   Dispatches SET_SIDEBAR to toggle the slide-in drawer.
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
   Inner app — consumes TripContext.
   Separated so it sits inside the context provider.
───────────────────────────────────────────────────────────── */
function AppInner() {
  const { state, dispatch, activeTrip, sortedTrips, showToast } = useTrips()
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Modal open/close state lives here so Sidebar can open it
  const [showNewTripModal, setShowNewTripModal] = useState(false)

  const handleNewTrip = useCallback(() => {
    setShowNewTripModal(true)
    // On mobile, also close the sidebar drawer when modal opens
    if (isMobile) {
      dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
    }
  }, [isMobile, dispatch])

  const handleCloseModal = useCallback(() => {
    setShowNewTripModal(false)
  }, [])

  const handleOpenSidebar = useCallback(() => {
    dispatch({ type: ACTIONS.SET_SIDEBAR, payload: true })
  }, [dispatch])

  const isConcertTab = state.activeTab === 'concert'

  return (
    // TripContext.Provider wraps everything — all child components
    // access state/dispatch/activeTrip/etc via useTripContext()
    <TripContext.Provider value={{ state, dispatch, activeTrip, sortedTrips, showToast }}>
      {/* Root layout: flex row — sidebar + main panel */}
      <div className="flex h-screen overflow-hidden bg-bg-primary text-text-secondary">

        {/* ── Sidebar ─────────────────────────────────── */}
        {/* Desktop: always visible. Mobile: slide-in drawer. */}
        {/* We pass onNewTrip so Sidebar opens the modal wizard
            instead of calling createEmptyTrip() directly. */}
        <Sidebar
          isMobile={isMobile}
          isOpen={state.sidebarOpen}
          onNewTrip={handleNewTrip}
        />

        {/* ── Mobile hamburger ────────────────────────── */}
        {isMobile && (
          <HamburgerButton onClick={handleOpenSidebar} />
        )}

        {/* ── Main content panel ──────────────────────── */}
        {/* concert-theme CSS class overrides design tokens for dark red aesthetic */}
        <main
          className={`
            flex-1 flex flex-col overflow-hidden bg-bg-primary
            ${isConcertTab ? 'concert-theme' : ''}
            transition-colors duration-300
          `}
        >
          {activeTrip ? (
            <>
              {/* Trip header: emoji, name, destination chain, readiness, countdowns */}
              <TripHeader />

              {/* Tab navigation bar — sticky, scrollable on mobile */}
              <TabBar />

              {/* Tab content — scrollable area */}
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
            /* No trips at all — show welcome empty state */
            <EmptyState onNewTrip={handleNewTrip} />
          )}
        </main>

        {/* ── New Trip Modal ──────────────────────────── */}
        {/* 4-step wizard modal. isOpen/onClose controlled by App state. */}
        <NewTripModal
          isOpen={showNewTripModal}
          onClose={handleCloseModal}
        />

        {/* ── Toast notifications ─────────────────────── */}
        {/* Fixed bottom-center, auto-dismisses via useTrips hook */}
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
   App root — kept thin intentionally.
   AppInner does the heavy lifting inside the context boundary.
───────────────────────────────────────────────────────────── */
export default function App() {
  return <AppInner />
}
