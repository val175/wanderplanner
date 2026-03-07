import { useMemo, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ProgressRing from '../shared/ProgressRing'
import AvatarCircle from '../shared/AvatarCircle'
import DatePicker from '../shared/DatePicker'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateReadiness } from '../../utils/readiness'
import { getTripStatus } from '../../utils/tripStatus'
import { formatDateRange } from '../../utils/helpers'
import { useCountdown } from '../../hooks/useCountdown'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import ShareTripModal from '../modal/ShareTripModal'

/* ─────────────────────────────────────────────────────────────
   TravelerPicker — portal-based dropdown (unchanged logic)
───────────────────────────────────────────────────────────── */
function TravelerPicker({ trip, travelerProfiles, dispatch, isReadOnly }) {
  const { profiles, resolveProfile } = useProfiles()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const dropdownRef = useRef(null)

  const toggleProfile = (id) => {
    const current = trip.travelerIds || []
    const isRemoving = current.includes(id)
    const next = isRemoving ? current.filter(x => x !== id) : [...current, id]

    // Keep memberIds in sync so co-planners can see the trip in their sidebar.
    // travelerIds stores profile IDs; memberIds must hold Firebase Auth UIDs.
    const resolvedUid = resolveProfile(id)?.uid
    const currentMemberIds = trip.memberIds || []
    const nextMemberIds = isRemoving
      ? currentMemberIds.filter(uid => uid !== resolvedUid)
      : resolvedUid ? [...new Set([...currentMemberIds, resolvedUid])] : currentMemberIds

    dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { travelerIds: next, travelers: Math.max(next.length, 1), memberIds: nextMemberIds } } })
  }

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left })
    }
    setOpen(o => !o)
  }

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
        onClick={isReadOnly ? undefined : handleOpen}
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)]
                   px-1.5 py-0.5 -mx-1.5 transition-colors group
                   ${isReadOnly ? 'cursor-default' : 'hover:bg-bg-hover'}`}
        title={isReadOnly ? "Wanderers" : "Edit wanderers"}
      >
        {travelerProfiles.length > 0 ? (
          <>
            {travelerProfiles.map((p, i) => (
              <span key={p.id} className={`inline-flex ${i === 0 ? '' : '-ml-2'}`}>
                <AvatarCircle profile={p} size={22} ring />
              </span>
            ))}
            <span className="ml-1 text-xs text-text-muted">
              {travelerProfiles.map(p => (p.name || 'Anonymous').split(' ')[0]).join(' & ')}
            </span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 text-text-muted">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="text-xs text-text-muted">
              {travelerCount} {travelerCount === 1 ? 'wanderer' : 'wanderers'}
            </span>
          </>
        )}
        {!isReadOnly && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left }}
          className="z-[9999] bg-bg-card border border-border rounded-[var(--radius-lg)] p-2 min-w-[180px]"
        >
          {profiles.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-1.5">No profiles yet — add wanderers from the sidebar.</p>
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
   CountdownPill — compact days to departure for new layout
───────────────────────────────────────────────────────────── */
function CountdownPill({ targetDate }) {
  const countdown = useCountdown(targetDate)
  if (!targetDate || countdown.expired) return null

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-bg-secondary border border-border text-[9px] font-bold uppercase tracking-wider text-text-muted whitespace-nowrap ml-1">
      <span className="text-accent font-bold mr-1">{countdown.days}</span> days away
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   InlineTripName — inline editable, tighter weight for new layout
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
    const trimmed = (draft || '').trim()
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
        className="font-heading text-xl md:text-2xl font-bold text-text-primary leading-tight
                   bg-transparent border-b border-accent outline-none w-full min-w-0"
        aria-label="Edit trip name"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center gap-1 min-w-0 text-left shrink"
      aria-label={`Trip name: ${value}. Click to edit.`}
    >
      <h1 className={`font-heading text-xl md:text-2xl font-bold text-text-primary
                       leading-tight truncate transition-all duration-150
                       ${hovered ? 'underline decoration-border-strong underline-offset-4' : ''}`}>
        {value}
      </h1>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`shrink-0 text-text-muted transition-opacity duration-150 mt-0.5
                    ${hovered ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   CityBreadcrumbs — compact, smaller text
───────────────────────────────────────────────────────────── */
function ChevronRight() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-text-muted mx-0.5 shrink-0 opacity-50">
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
          {i > 0 && <span className="text-text-muted mx-1">&middot;</span>}
          <span className="inline-flex items-center gap-1 text-sm text-text-secondary whitespace-nowrap font-medium">
            <span>{dest.flag}</span>
            <span>{dest.city}</span>
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <>
      <div className="sm:hidden">
        {!expanded ? (
          <button
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <span>{destinations[0]?.flag}{count > 1 ? '…' : ''}</span>
            <span>{count} {count === 1 ? 'city' : 'cities'}</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <DestChain dests={destinations} />
            <button onClick={() => setExpanded(false)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors self-start mt-0.5">
              ↑ collapse
            </button>
          </div>
        )}
      </div>
      <div className="hidden sm:block">
        <DestChain dests={destinations} />
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   TripHeader — sparse typographic hero layout.

   Design principle: the massive countdown number is the dominant
   visual. Everything else — name, date, cities — is secondary,
   rendered in small, controlled weights. Color (accent) appears
   only on the unit labels ("wks", "days") as a deliberate signal.

   The readiness ring moves here as a tiny compact element rather
   than competing with the overview tab content.
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   DateRangeEditor — click the date to edit start/end inline
───────────────────────────────────────────────────────────── */
function DateRangeEditor({ trip, dispatch, isReadOnly }) {
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(trip.startDate || '')
  const [end, setEnd] = useState(trip.endDate || '')
  const dateRange = formatDateRange(trip.startDate, trip.endDate)

  const openEdit = () => {
    setStart(trip.startDate || '')
    setEnd(trip.endDate || '')
    setEditing(true)
  }

  const save = () => {
    dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { startDate: start, endDate: end } } })
    setEditing(false)
  }

  const calIcon = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )

  if (!editing) {
    if (isReadOnly) {
      return (
        <span className="inline-flex items-center gap-1 text-sm text-text-muted">
          {calIcon}
          <span>{dateRange || 'Dates TBA'}</span>
        </span>
      )
    }

    return (
      <button
        onClick={openEdit}
        title="Edit trip dates"
        className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-accent transition-colors group"
      >
        {calIcon}
        <span className="group-hover:underline underline-offset-2">
          {dateRange || 'Add dates…'}
        </span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-60 transition-opacity ml-0.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {calIcon}
      <DatePicker
        value={start}
        onChange={val => {
          setStart(val)
          if (val && end && new Date(val) > new Date(end)) {
            setEnd(val) // ensure end date isn't before start date
          }
        }}
        placeholder="Start date"
        className="text-xs bg-transparent border-b border-accent/60 focus:border-accent outline-none text-text-primary px-1 hover:border-accent min-w-[90px]"
      />
      <span className="text-text-muted text-xs">→</span>
      <DatePicker
        value={end}
        onChange={setEnd}
        min={start} // Prevent selecting an end date before start date
        placeholder="End date"
        className="text-xs bg-transparent border-b border-accent/60 focus:border-accent outline-none text-text-primary px-1 hover:border-accent min-w-[90px]"
      />
      <button
        onClick={save}
        className="text-xs px-2 py-0.5 bg-accent text-white rounded-[var(--radius-sm)] font-semibold hover:bg-accent-hover transition-colors ml-1"
      >
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}

export default function TripHeader({ onOpenSidebar, isMobile }) {
  const { activeTrip, dispatch, isReadOnly, effectiveStatus } = useTripContext()
  const travelerProfiles = useTripTravelers()
  const readiness = useMemo(() => calculateReadiness(activeTrip), [activeTrip])
  const [showShareModal, setShowShareModal] = useState(false)

  if (!activeTrip) return null

  const trip = activeTrip
  const dateRange = formatDateRange(trip.startDate, trip.endDate)
  const tripStatus = getTripStatus(trip.startDate, trip.endDate)
  const destinations = trip.destinations || []

  const handleRename = (newName) => {
    if (newName) dispatch({ type: ACTIONS.RENAME_TRIP, payload: { id: trip.id, name: newName } })
  }

  return (
    <header className="animate-fade-in border-b border-border bg-bg-primary/95 backdrop-blur-sm relative z-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

          {/* LEFT — Typography and Sub-Details */}
          <div className="flex flex-col min-w-0 flex-1">
            {/* Top Row: Name + Draft Pill */}
            <div className="flex items-center gap-2 mb-1.5 min-w-0">
              {isMobile && (
                <button
                  onClick={onOpenSidebar}
                  className="p-1.5 -ml-1 text-text-secondary hover:bg-bg-hover rounded-[var(--radius-sm)] transition-colors"
                  aria-label="Open sidebar menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              )}
              {isReadOnly
                ? <h1 className="font-heading text-xl md:text-2xl font-bold text-text-primary leading-tight truncate shrink">{trip.emoji} {trip.name}</h1>
                : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xl md:text-2xl leading-none shrink-0" role="img" aria-label="Trip emoji">{trip.emoji}</span>
                    <InlineTripName value={trip.name} onSave={handleRename} />
                  </div>
                )
              }
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full bg-bg-secondary border border-border text-[9px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">
                {effectiveStatus === 'archived' ? 'Archived' :
                  effectiveStatus === 'completed' ? 'Memory' :
                    effectiveStatus === 'ongoing' ? 'Ongoing' : 'Upcoming'}
              </span>
            </div>

            {/* Bottom Row: Cities · Dates · Countdown */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted min-w-0">
              {destinations.length > 0 && (
                <>
                  <CityBreadcrumbs destinations={destinations} />
                  <span className="opacity-50 text-xs">&middot;</span>
                </>
              )}

              <DateRangeEditor trip={trip} dispatch={dispatch} isReadOnly={isReadOnly} />

              {!isReadOnly && trip.startDate && tripStatus === 'upcoming' && (
                <CountdownPill targetDate={trip.startDate} />
              )}
            </div>
          </div>

          {/* RIGHT — Global Actions + Status */}
          <div className="shrink-0 flex items-center justify-between lg:justify-end gap-4 border-t border-border pt-4 lg:pt-0 lg:border-t-0 mt-2 lg:mt-0">
            {/* Readiness */}
            <div className="flex items-center gap-2">
              <ProgressRing value={readiness} size={36} strokeWidth={3.5} labelClassName="text-[10px] font-bold" />
              <div className="flex flex-col justify-center hidden sm:flex">
                <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted leading-tight">Readiness</span>
                <span className={`text-xs font-semibold leading-tight ${readiness >= 100 ? 'text-success' : 'text-text-primary/70'}`}>
                  {readiness >= 100 ? 'Ready To Go!' : 'On Track'}
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px h-8 bg-border"></div>

            {/* Avatars */}
            <div className="flex items-center">
              <TravelerPicker trip={trip} travelerProfiles={travelerProfiles} dispatch={dispatch} isReadOnly={isReadOnly} />
            </div>

            {/* Share */}
            <button
              onClick={() => setShowShareModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 font-medium text-sm rounded-[var(--radius-md)] bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border transition-colors disabled:opacity-50"
            >
              Share Trip
            </button>
          </div>

        </div>
      </div>
      {showShareModal && (
        <ShareTripModal trip={trip} onClose={() => setShowShareModal(false)} />
      )}
    </header>
  )
}
