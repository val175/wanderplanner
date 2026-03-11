import { useState, useRef, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'
import ProfileManager from '../shared/ProfileManager'
import AvatarCircle from '../shared/AvatarCircle'
import { useAuth } from '../../hooks/useAuth'
import { useProfiles } from '../../context/ProfileContext'
import { getEffectiveStatus } from '../../utils/tripStatus'

const THE_PLAN_IDS = ['overview', 'wandermap', 'itinerary', 'cities', 'bookings']
const TOOLS_IDS = ['voting', 'budget', 'todo', 'packing', 'concert']

function TripGroup({ title, trips, activeTripId, onSelect }) {
  if (!trips || trips.length === 0) return null
  return (
    <div className="mb-2 last:mb-0">
      <div className="px-3 py-1 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </div>
      {trips.map(trip => (
        <button
          key={trip.id}
          onClick={() => onSelect(trip.id)}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center justify-between rounded-[var(--radius-sm)] ${trip.id === activeTripId ? 'bg-accent/10 text-accent font-medium' : 'text-text-primary hover:bg-bg-hover'}`}
        >
          <span className="truncate">{trip.emoji} {trip.name || 'Untitled Trip'}</span>
          {trip.id === activeTripId && (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          )}
        </button>
      ))}
    </div>
  )
}

function TripSwitcher({ trips, activeTrip, activeTripId, onSelect, onNewTrip }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const upcomingTrips = trips.filter(t => getEffectiveStatus(t) === 'upcoming')
  const ongoingTrips = trips.filter(t => getEffectiveStatus(t) === 'ongoing')
  const completedTrips = trips.filter(t => {
    const s = getEffectiveStatus(t)
    return s === 'completed' || s === 'archived'
  })

  return (
    <div className="relative px-3 pt-4 pb-2" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-[var(--radius-md)] hover:bg-bg-hover transition-colors text-left"
      >
        <div className="flex flex-col overflow-hidden">
          <span className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mb-0.5">Trip</span>
          <span className="text-sm font-semibold text-text-primary truncate">
            {activeTrip ? `${activeTrip.emoji} ${activeTrip.name || 'Untitled Trip'}` : 'Select a Trip'}
          </span>
        </div>
        <svg className={`shrink-0 w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {isOpen && (
        <div className="absolute top-[85%] left-3 right-3 mt-1 bg-bg-card border border-border rounded-[var(--radius-md)] z-50 py-1.5 max-h-[60vh] overflow-y-auto">
          {trips.length > 0 ? (
            <>
              <TripGroup title="Ongoing" trips={ongoingTrips} activeTripId={activeTripId} onSelect={(id) => { onSelect(id); setIsOpen(false) }} />
              <TripGroup title="Upcoming" trips={upcomingTrips} activeTripId={activeTripId} onSelect={(id) => { onSelect(id); setIsOpen(false) }} />
              <TripGroup title="Completed" trips={completedTrips} activeTripId={activeTripId} onSelect={(id) => { onSelect(id); setIsOpen(false) }} />
            </>
          ) : (
            <div className="px-3 py-2 text-xs text-text-muted text-center">No trips available</div>
          )}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { onNewTrip(); setIsOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create New Trip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NavLink({ tabId, label, emoji, isActive, onClick, hasNotification }) {
  return (
    <button
      onClick={() => onClick(tabId)}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors text-sm ${isActive ? 'bg-accent/10 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{emoji}</span>
        <span>{label}</span>
      </div>
      {hasNotification && (
        <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse mr-1" />
      )}
    </button>
  )
}

export default function Sidebar({ isMobile, isOpen, onNewTrip }) {
  const { state, dispatch, activeTrip, sortedTrips } = useTripContext()
  const { user, signOutUser } = useAuth()
  const { currentUserProfile } = useProfiles()
  const [showProfiles, setShowProfiles] = useState(false)

  const handleToggleDarkMode = () => {
    dispatch({ type: ACTIONS.TOGGLE_DARK_MODE })
  }

  const closeSidebar = () => {
    dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
  }

  const handleSelectTrip = (tripId) => {
    dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: tripId })
    if (isMobile) closeSidebar()
  }

  const handleTabClick = (tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
    if (isMobile) closeSidebar()
  }

  const thePlanTabs = TAB_CONFIG.filter(t => THE_PLAN_IDS.includes(t.id))
  let toolsTabs = TAB_CONFIG.filter(t => TOOLS_IDS.includes(t.id))
  // Filter conditional concert tab
  toolsTabs = toolsTabs.filter(t => !t.conditional || (t.conditional && activeTrip?.concertTheme))

  const hasTrips = sortedTrips.length > 0

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[var(--sidebar-width)] bg-bg-sidebar border-r border-border">
      {/* Workspace Switcher */}
      <TripSwitcher
        trips={sortedTrips}
        activeTrip={activeTrip}
        activeTripId={state.activeTripId}
        onSelect={handleSelectTrip}
        onNewTrip={onNewTrip}
      />

      <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide flex flex-col gap-6 mt-2">
        {hasTrips && (
          <>
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">The Plan</p>
              <nav className="flex flex-col gap-[2px]">
                {thePlanTabs.map(tab => (
                  <NavLink
                    key={tab.id}
                    tabId={tab.id}
                    label={tab.label}
                    emoji={tab.emoji}
                    isActive={state.activeTab === tab.id}
                    onClick={handleTabClick}
                  />
                ))}
              </nav>
            </div>

            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">Tools & Collab</p>
              <nav className="flex flex-col gap-[2px]">
                {toolsTabs.map(tab => (
                  <NavLink
                    key={tab.id}
                    tabId={tab.id}
                    label={tab.label}
                    emoji={tab.emoji}
                    isActive={state.activeTab === tab.id}
                    onClick={handleTabClick}
                    // Basic placeholder notification logic, can be hooked into poll data
                    hasNotification={tab.id === 'voting' && activeTrip?.polls?.filter(p => !p.resolved).length > 0}
                  />
                ))}
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Footer / Global Actions */}
      <div className="px-4 py-4 border-t border-border mt-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary px-1">
            Wanderplan
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowProfiles(true)}
              className="p-1.5 rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Manage wanderer profiles"
              title="Wanderer profiles"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
            <button
              onClick={handleToggleDarkMode}
              className="p-1.5 rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {state.darkMode ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <button
          onClick={signOutUser}
          className="w-full flex items-center gap-2.5 text-left px-2 py-1.5 text-xs font-medium text-text-muted hover:text-text-danger hover:bg-bg-hover rounded-[var(--radius-sm)] transition-colors group"
        >
          <div className="grayscale group-hover:grayscale-0 transition-all">
            <AvatarCircle profile={currentUserProfile || { name: user?.displayName, photo: user?.photoURL }} size={20} />
          </div>
          Sign out
        </button>
      </div>
    </aside>
  )

  // Desktop: static sidebar
  if (!isMobile) {
    return (
      <>
        {sidebarContent}
        {showProfiles && <ProfileManager isOpen onClose={() => setShowProfiles(false)} />}
      </>
    )
  }

  // Mobile: slide-in drawer with backdrop
  return (
    <>
      {showProfiles && <ProfileManager isOpen onClose={() => setShowProfiles(false)} />}
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
            className="absolute top-5 right-3 p-1.5 rounded-[var(--radius-sm)]
                       text-text-muted hover:text-text-primary hover:bg-bg-hover
                       transition-colors z-50 bg-bg-sidebar border border-border"
            aria-label="Close sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </>
  )
}
