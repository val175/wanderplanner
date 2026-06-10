import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'
import ProfileManager from '../shared/ProfileManager'
import AvatarCircle from '../shared/AvatarCircle'
import Label from '../shared/Label'
import { useAuth } from '../../hooks/useAuth'
import { useProfiles } from '../../context/ProfileContext'
import { getEffectiveStatus } from '../../utils/tripStatus'
import { getLevelForXp, getXpProgress, getNextLevel } from '../../constants/xpLevels'

const THE_PLAN_IDS = ['overview', 'wandermap', 'itinerary', 'cities', 'bookings']
// 'videos' (How-To) is excluded from the nav — accessible via the footer Help button
const COLLABORATE_NAV_IDS = ['budget', 'todo', 'voting', 'documents', 'packing', 'concert']

// ─────────────────────────────────────────────────
// Trip Switcher sub-components
// ─────────────────────────────────────────────────

function TripGroup({ title, trips, activeTripId, onSelect }) {
  if (!trips || trips.length === 0) return null
  return (
    <div className="mb-2 last:mb-0">
      <div className="px-3 py-1 mb-0.5">
        <Label>{title}</Label>
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
    <div className="relative px-3 py-2.5" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-md)] hover:bg-bg-hover transition-colors text-left group"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {activeTrip && (
            <span className="text-lg shrink-0">{activeTrip.emoji}</span>
          )}
          <div className="flex flex-col overflow-hidden">
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider leading-none mb-0.5">
              Active Trip
            </span>
            <span className="text-sm font-semibold text-text-primary truncate leading-tight">
              {activeTrip ? (activeTrip.name || 'Untitled Trip') : 'Select a Trip'}
            </span>
          </div>
        </div>
        <svg
          className={`shrink-0 w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-[90%] left-3 right-3 mt-1 bg-bg-card border border-border rounded-[var(--radius-md)] z-50 py-1.5 max-h-[60vh] overflow-y-auto">
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

// ─────────────────────────────────────────────────
// NavLink
// ─────────────────────────────────────────────────

function NavLink({ tabId, label, icon: Icon, isActive, onClick, hasNotification }) {
  return (
    <motion.button
      onClick={() => onClick(tabId)}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[var(--radius-sm)] transition-colors text-sm ${isActive ? 'bg-accent/10 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center gap-2.5">
        <Icon size={16} strokeWidth={1.75} className={isActive ? 'text-accent' : 'text-text-muted'} aria-hidden="true" />
        <span>{label}</span>
      </div>
      {hasNotification && (
        <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse mr-1" />
      )}
    </motion.button>
  )
}

// ─────────────────────────────────────────────────
// Main Sidebar
// ─────────────────────────────────────────────────

export default function Sidebar({ isMobile, isOpen, onNewTrip }) {
  const { state, dispatch, activeTrip, sortedTrips } = useTripContext()
  const { user, signOutUser } = useAuth()
  const { currentUserProfile } = useProfiles()
  const [showProfiles, setShowProfiles] = useState(false)
  // Visual tiering: the five core destinations stay prominent; the Tools
  // group is collapsible (persisted) so the default view stays calm.
  const [toolsOpen, setToolsOpen] = useState(() => {
    try { return localStorage.getItem('wanderplan_tools_open') !== 'false' } catch { return true }
  })
  const toggleTools = () => {
    setToolsOpen(prev => {
      try { localStorage.setItem('wanderplan_tools_open', String(!prev)) } catch { /* ignore */ }
      return !prev
    })
  }

  // XP / level derived values
  const xp = currentUserProfile?.xp || 0
  const currentLevel = getLevelForXp(xp)
  const nextLevel = getNextLevel(xp)
  const xpProgress = getXpProgress(xp)

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

  const handleHelpClick = () => {
    dispatch({ type: ACTIONS.SET_TAB, payload: 'videos' })
    if (isMobile) closeSidebar()
  }

  const thePlanTabs = TAB_CONFIG.filter(t => THE_PLAN_IDS.includes(t.id))
  let collaborateTabs = TAB_CONFIG.filter(t => COLLABORATE_NAV_IDS.includes(t.id))
  // Filter conditional concert tab
  collaborateTabs = collaborateTabs.filter(t => !t.conditional || (t.conditional && activeTrip?.concertTheme))

  const hasTrips = sortedTrips.length > 0

  const sidebarContent = (
    <aside className="flex flex-col h-full w-[var(--sidebar-width)] bg-bg-sidebar border-r border-border">

      {/* ══════════════════════════════════════ */}
      {/* ZONE 1: USER IDENTITY CARD            */}
      {/* Floating card — breathes with air on   */}
      {/* all sides. Not competing with header.  */}
      {/* 40px avatar, XP bar with numbers.      */}
      {/* ══════════════════════════════════════ */}
      <div className="px-3 pt-3 pb-2">
        <div className="p-3">

          {/* Avatar row */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfiles(true)}
              className="rounded-full shrink-0 hover:opacity-85 transition-opacity"
              aria-label="Your profile and wanderers"
              title="Manage wanderers"
            >
              <AvatarCircle
                profile={currentUserProfile || { name: user?.displayName, photo: user?.photoURL }}
                size={40}
                levelColor={currentLevel.frameColor}
              />
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate leading-tight">
                {currentUserProfile?.name || user?.displayName || 'Traveler'}
              </p>
              <p className="text-[10px] font-medium truncate leading-none mt-0.5" style={{ color: currentLevel.frameColor }}>
                {currentLevel.emoji} {currentLevel.title} · Lvl {currentLevel.level}
              </p>
            </div>
          </div>

          {/* XP bar — full tracker with numbers, per user preference */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">XP Progress</span>
              <span className="text-[9px] font-semibold tabular-nums" style={{ color: currentLevel.frameColor }}>
                {nextLevel ? `${xpProgress.current} / ${xpProgress.needed} XP` : '✨ Max Level'}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border/30 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${xpProgress.pct}%`,
                  background: currentLevel.frameColor,
                  boxShadow: `0 0 6px ${currentLevel.frameColor}88`,
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════ */}
      {/* ZONE 2: TRIP SWITCHER                  */}
      {/* ══════════════════════════════════════ */}
      <TripSwitcher
        trips={sortedTrips}
        activeTrip={activeTrip}
        activeTripId={state.activeTripId}
        onSelect={handleSelectTrip}
        onNewTrip={onNewTrip}
      />

      {/* ══════════════════════════════════════ */}
      {/* ZONE 3: PRIMARY NAV (scrollable)       */}
      {/* ══════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-hide flex flex-col gap-6 mt-2">
        {hasTrips && (
          <>
            {/* The Plan */}
            <div>
              <div className="px-3 mb-1">
                <Label>Planning</Label>
              </div>
              <nav className="flex flex-col gap-[2px]">
                {thePlanTabs.map(tab => (
                  <NavLink
                    key={tab.id}
                    tabId={tab.id}
                    label={tab.label}
                    icon={tab.icon}
                    isActive={state.activeTab === tab.id}
                    onClick={handleTabClick}
                  />
                ))}
              </nav>
            </div>

            {/* Collaborate (renamed from "Tools & Collab", How-To removed) */}
            <div>
              <button
                onClick={toggleTools}
                aria-expanded={toolsOpen}
                className="w-full flex items-center justify-between px-3 mb-1 group/tools"
              >
                <Label>Tools</Label>
                <svg
                  className={`w-3 h-3 text-text-muted opacity-0 group-hover/tools:opacity-100 transition-all ${toolsOpen ? '' : '-rotate-90'}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              {/* Keep the active tab reachable even while collapsed */}
              {(toolsOpen
                ? collaborateTabs
                : collaborateTabs.filter(t => t.id === state.activeTab)
              ).length > 0 && (
                <nav className="flex flex-col gap-[2px]">
                  {(toolsOpen ? collaborateTabs : collaborateTabs.filter(t => t.id === state.activeTab)).map(tab => (
                    <NavLink
                      key={tab.id}
                      tabId={tab.id}
                      label={tab.label}
                      icon={tab.icon}
                      isActive={state.activeTab === tab.id}
                      onClick={handleTabClick}
                      hasNotification={tab.id === 'voting' && activeTrip?.polls?.filter(p => !p.resolved).length > 0}
                    />
                  ))}
                </nav>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════ */}
      {/* ZONE 4: FOOTER (pinned)               */}
      {/* No border — subtle bg tint + spacing   */}
      {/* Logo left — Help + Dark Mode + Logout  */}
      {/* ══════════════════════════════════════ */}
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Branding */}
        <div className="flex items-center gap-1.5 px-1 text-text-primary">
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">🪄</span>
          <span style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontWeight: 400,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            <span style={{ fontStyle: 'italic' }}>Wander</span>plan
          </span>
        </div>

        {/* Utility actions: Help · Dark Mode · Sign Out */}
        <div className="flex items-center gap-0.5">
          {/* Help → opens the How-To / Videos tab */}
          <button
            onClick={handleHelpClick}
            className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${state.activeTab === 'videos' ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
            aria-label="Open How-To tutorials"
            title="How-To tutorials"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={handleToggleDarkMode}
            className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label={state.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title="Toggle theme"
          >
            {state.darkMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={signOutUser}
            className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
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
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-drawer
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
