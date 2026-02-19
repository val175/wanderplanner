import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import TripCard from './TripCard'
import SidebarFooter from './SidebarFooter'
import { useAuth } from '../../hooks/useAuth'

// onNewTrip is passed from App.jsx — it opens the 4-step NewTripModal wizard
// rather than creating an empty trip directly (separation of concerns).
export default function Sidebar({ isMobile, isOpen, onNewTrip }) {
  const { state, dispatch, sortedTrips } = useTripContext()
  const { signOutUser } = useAuth()

  const handleNewTrip = () => {
    if (onNewTrip) {
      onNewTrip()
    }
  }

  const handleToggleDarkMode = () => {
    dispatch({ type: ACTIONS.TOGGLE_DARK_MODE })
  }

  const closeSidebar = () => {
    dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
  }

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[var(--sidebar-width)] bg-bg-sidebar border-r border-border">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-0.5">
          <h1 className="font-heading text-xl font-bold tracking-tight text-text-primary">
            Wanderplan
          </h1>
          <button
            onClick={handleToggleDarkMode}
            className="p-1.5 rounded-[var(--radius-md)] text-text-muted hover:text-text-secondary transition-colors"
            aria-label={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {state.darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Every trip, perfectly planned.
        </p>
      </div>

      {/* New Trip Button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleNewTrip}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                     bg-accent hover:bg-accent-hover text-text-inverse
                     font-medium text-sm rounded-[var(--radius-md)]
                     transition-all duration-200 active:scale-[0.98]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Trip
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-2 border-t border-border" />

      {/* Trip List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 scrollbar-hide">
        {sortedTrips.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs text-text-muted">No trips yet.</p>
            <p className="text-xs text-text-muted mt-1">Create one to get started!</p>
          </div>
        ) : (
          sortedTrips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              isActive={trip.id === state.activeTripId}
              isMobile={isMobile}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <SidebarFooter count={sortedTrips.length} onSignOut={signOutUser} />
    </aside>
  )

  // Desktop: static sidebar
  if (!isMobile) {
    return sidebarContent
  }

  // Mobile: slide-in drawer with backdrop
  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Close button for mobile */}
        <div className="relative h-full">
          {sidebarContent}
          <button
            onClick={closeSidebar}
            className="absolute top-4 right-3 p-1.5 rounded-[var(--radius-sm)]
                       text-text-muted hover:text-text-primary hover:bg-bg-hover
                       transition-colors"
            aria-label="Close sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
