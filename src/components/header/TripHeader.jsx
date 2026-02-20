import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ProgressRing from '../shared/ProgressRing'
import AvatarCircle from '../shared/AvatarCircle'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateReadiness } from '../../utils/readiness'
import { formatDateRange } from '../../utils/helpers'
import { useCountdown } from '../../hooks/useCountdown'

/* ─────────────────────────────────────────────────────────────
   TravelerPicker — click the traveler row to assign/remove
   profiles for this trip. Appears as a small dropdown.
───────────────────────────────────────────────────────────── */
function TravelerPicker({ trip, travelerProfiles, dispatch }) {
  const { profiles } = useProfiles()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)

  const toggleProfile = (id) => {
    const current = trip.travelerIds || []
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { travelerIds: next, travelers: Math.max(next.length, 1) } } })
  }

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on scroll / resize so coords don't go stale
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  const travelerCount = trip.travelers || 1

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] hover:bg-bg-hover px-1.5 py-0.5 -mx-1.5 transition-colors group"
        title="Edit travelers"
      >
        {travelerProfiles.length > 0 ? (
          <>
            {travelerProfiles.map((p, i) => (
              <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }} className="inline-flex">
                <AvatarCircle profile={p} size={26} ring />
              </span>
            ))}
            <span className="ml-1 text-sm text-text-muted">
              {travelerProfiles.map(p => p.name.split(' ')[0]).join(' & ')}
            </span>
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 text-text-muted">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-sm text-text-muted">
              {travelerCount} {travelerCount === 1 ? 'traveler' : 'travelers'}
            </span>
          </>
        )}
        {/* Subtle chevron hint */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className="text-text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Portal — renders at document.body so it's above TabBar and everything else */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
          className="bg-bg-card border border-border rounded-[var(--radius-lg)] shadow-xl p-2 min-w-[180px]"
        >
          {profiles.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-1.5">No profiles yet — add travelers from the sidebar.</p>
          ) : (
            <div className="space-y-0.5">
              {profiles.map(p => {
                const selected = (trip.travelerIds || []).includes(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleProfile(p.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm transition-colors
                      ${selected ? 'bg-accent/10 text-text-primary' : 'hover:bg-bg-hover text-text-secondary'}`}
                  >
                    <AvatarCircle profile={p} size={24} />
                    <span className="flex-1 text-left font-medium">{p.name}</span>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   Compact countdown badge in header
───────────────────────────────────────────────────────────── */
function CountdownBadge({ targetDate, emoji }) {
  const countdown = useCountdown(targetDate)
  if (!targetDate || countdown.expired) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
      <span>{emoji}</span>
      <span className="font-heading font-semibold text-text-primary">{countdown.days}</span>
      <span className="text-xs">days</span>
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   Notion-style inline trip name editor
   - Hover reveals pencil icon + underline
   - Click swaps h1 for <input> with identical font metrics
   - Enter/blur saves · Escape cancels
───────────────────────────────────────────────────────────── */
function InlineTripName({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  const cancel = () => { setDraft(value); setEditing(false) }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className="font-heading text-2xl md:text-3xl font-bold text-text-primary leading-tight
                   bg-transparent border-b-2 border-accent outline-none w-full min-w-0"
        style={{ fontFamily: 'var(--font-heading)' }}
        aria-label="Edit trip name"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center gap-2 min-w-0 max-w-full text-left"
      aria-label={`Trip name: ${value}. Click to edit.`}
    >
      <h1 className={`font-heading text-2xl md:text-3xl font-bold text-text-primary
                       leading-tight truncate transition-all duration-150
                       ${hovered ? 'underline decoration-border-strong underline-offset-4' : ''}`}>
        {value}
      </h1>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`shrink-0 text-text-muted transition-opacity duration-150 mt-1
                    ${hovered ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   City breadcrumb trail with mobile collapse
   Mobile: shows 2, rest behind "+N more" chip
   Desktop: shows all inline
───────────────────────────────────────────────────────────── */
function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-text-muted mx-0.5 shrink-0 opacity-60">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function CityBreadcrumbs({ destinations }) {
  const [expanded, setExpanded] = useState(false)
  if (!destinations?.length) return null

  const count = destinations.length

  const DestChain = ({ dests }) => (
    <div className="flex items-center flex-wrap gap-x-0.5 gap-y-1">
      {dests.map((dest, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <ChevronRight />}
          <span className="inline-flex items-center gap-1 text-sm text-text-secondary whitespace-nowrap">
            <span>{dest.flag}</span>
            <span>{dest.city}</span>
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <>
      {/* Mobile: collapsed → "N cities" pill, expanded → full chain */}
      <div className="sm:hidden">
        {!expanded ? (
          /* Collapsed summary pill */
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1.5 text-sm text-text-secondary
                       px-2.5 py-0.5 rounded-full border border-border hover:border-border-strong
                       hover:bg-bg-hover transition-colors duration-150"
          >
            <span className="text-base leading-none">
              {destinations[0]?.flag}{count > 1 ? '…' : ''}
            </span>
            <span className="font-medium">{count} {count === 1 ? 'city' : 'cities'}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-text-muted">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : (
          /* Expanded full chain */
          <div className="flex flex-col gap-1">
            <DestChain dests={destinations} />
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors self-start mt-0.5"
            >
              ↑ collapse
            </button>
          </div>
        )}
      </div>
      {/* Desktop: always full chain */}
      <div className="hidden sm:block">
        <DestChain dests={destinations} />
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   TripHeader — single source of truth for trip identity.
   Dates, travelers, cities all live exclusively here.
───────────────────────────────────────────────────────────── */
export default function TripHeader() {
  const { activeTrip, dispatch } = useTripContext()
  const { profiles } = useProfiles()

  const readiness = useMemo(() => calculateReadiness(activeTrip), [activeTrip])

  if (!activeTrip) return null

  const trip = activeTrip
  const dateRange = formatDateRange(trip.startDate, trip.endDate)
  const travelerCount = trip.travelers || 1
  const destinations = trip.destinations || []

  // Resolve avatar profiles for this trip (travelerIds → profile objects)
  const travelerProfiles = (trip.travelerIds || [])
    .map(id => profiles.find(p => p.id === id))
    .filter(Boolean)

  const handleRename = (newName) => {
    if (newName) dispatch({ type: ACTIONS.RENAME_TRIP, payload: { id: trip.id, name: newName } })
  }

  return (
    <header className="animate-fade-in border-b border-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-5 pb-4">
        <div className="flex items-start gap-3 sm:gap-4">

          {/* Emoji */}
          <span className="text-4xl sm:text-[44px] leading-none shrink-0 mt-0.5"
            role="img" aria-label="Trip emoji">
            {trip.emoji}
          </span>

          {/* Identity block */}
          <div className="flex-1 min-w-0">
            <InlineTripName value={trip.name} onSave={handleRename} />

            {/* Meta — stacks naturally on mobile via flex-wrap */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              {dateRange && (
                <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="shrink-0">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {dateRange}
                </span>
              )}
              <TravelerPicker trip={trip} travelerProfiles={travelerProfiles} dispatch={dispatch} />
              {trip.startDate && (
                <CountdownBadge targetDate={trip.startDate} emoji="✈️" />
              )}
            </div>

            {/* City breadcrumbs */}
            {destinations.length > 0 && (
              <div className="mt-2">
                <CityBreadcrumbs destinations={destinations} />
              </div>
            )}
          </div>

          {/* Readiness ring */}
          <div className="shrink-0 flex flex-col items-center gap-1 mt-0.5">
            <ProgressRing value={readiness} size={68} strokeWidth={5} labelClassName="text-sm" />
            <span className="text-[10px] text-text-muted font-medium tracking-wide uppercase">Ready</span>
          </div>
        </div>
      </div>
    </header>
  )
}
