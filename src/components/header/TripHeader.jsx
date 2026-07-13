import { useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import AnimatedNumber from '../shared/AnimatedNumber'
import { TRIP_EMOJIS } from '../../constants/emojis'
import { db } from '../../firebase/config'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import ProgressRing from '../shared/ProgressRing'
import AvatarCircle from '../shared/AvatarCircle'
import DatePicker from '../shared/DatePicker'
import ConfirmDialog from '../shared/ConfirmDialog'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateReadiness } from '../../utils/readiness'
import { getTripStatus } from '../../utils/tripStatus'
import { formatDateRange, formatCurrency, daysBetween } from '../../utils/helpers'
import { useCountdown } from '../../hooks/useCountdown'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { Search as SearchIcon } from 'lucide-react'
import ShareTripModal from '../modal/ShareTripModal'
import NotificationBell from '../shared/NotificationBell'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Popover from '@radix-ui/react-popover'
import CelebrationEffect from '../shared/CelebrationEffect'

// Heavy (html2canvas, AI calls, image fetchers) and only shown on demand —
// keep it out of the main bundle.
const PresentationMode = lazy(() => import('../shared/PresentationMode'))

/* ─────────────────────────────────────────────────────────────
   TravelerPicker — Radix Popover (keyboard nav, focus management,
   Escape/outside-click handled by the primitive)
───────────────────────────────────────────────────────────── */
function TravelerPicker({ trip, travelerProfiles, dispatch, isReadOnly }) {
  const { profiles, resolveProfile } = useProfiles()

  const toggleProfile = (id) => {
    const current = trip.travelerIds || []
    const isRemoving = current.includes(id)
    const next = isRemoving ? current.filter(x => x !== id) : [...current, id]

    const resolvedUid = resolveProfile(id)?.uid
    const currentMemberIds = trip.memberIds || []
    const nextMemberIds = isRemoving
      ? currentMemberIds.filter(uid => uid !== resolvedUid)
      : resolvedUid ? [...new Set([...currentMemberIds, resolvedUid])] : currentMemberIds

    dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { travelerIds: next, travelers: Math.max(next.length, 1), memberIds: nextMemberIds } } })
  }

  const travelerCount = trip.travelers || 1
  const visibleProfiles = travelerProfiles.slice(0, 4)
  const hiddenCount = Math.max(travelerProfiles.length - visibleProfiles.length, 0)
  const labelNames = travelerProfiles.slice(0, 2).map(p => (p.name || 'Anonymous').split(' ')[0])
  const travelerLabel = hiddenCount > 0
    ? `${labelNames.join(' & ')} +${hiddenCount}`
    : travelerProfiles.map(p => (p.name || 'Anonymous').split(' ')[0]).join(' & ')

  return (
    <Popover.Root>
      <Popover.Trigger asChild disabled={isReadOnly}>
      <button
        className={`inline-flex items-center gap-2 rounded-[var(--radius-sm)]
                   py-0.5 transition-colors group focus-ring
                   ${isReadOnly ? 'cursor-default' : 'hover:bg-bg-hover'}`}
        title={isReadOnly ? "Wanderers" : "Edit wanderers"}
        aria-label="Edit wanderers"
      >
        {travelerProfiles.length > 0 ? (
          <>
            <div className="flex items-center">
              {visibleProfiles.map((p, i) => (
                <div key={p.id} className={`inline-flex ${i === 0 ? '' : '-ml-2'} border-2 border-bg-primary rounded-full`}>
                  <AvatarCircle profile={p} size={24} />
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="-ml-2 border-2 border-bg-primary rounded-full bg-bg-secondary text-[10px] font-bold text-text-muted w-6 h-6 flex items-center justify-center">
                  +{hiddenCount}
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-text-secondary truncate max-w-[120px]">
              {travelerLabel}
            </span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
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
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className="text-text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[9999] bg-bg-card border border-border rounded-[var(--radius-lg)] p-2 min-w-[180px] focus:outline-none"
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
                    role="checkbox"
                    aria-checked={selected}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-sm transition-colors focus-ring
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ─────────────────────────────────────────────────────────────
   CountdownInline — simple inline text, not a pill badge
───────────────────────────────────────────────────────────── */
function CountdownInline({ targetDate, fallback, className = 'text-sm text-text-muted' }) {
  const countdown = useCountdown(targetDate)
  if (!targetDate || countdown.expired) return fallback ? <span className={`whitespace-nowrap ${className}`}>{fallback}</span> : null
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}>
      <AnimatedNumber value={countdown.days} className="font-semibold tabular-nums" stiffness={60} damping={18} />
      {' '}days away
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   InlineTripName — inline editable trip title
───────────────────────────────────────────────────────────── */
function InlineTripName({ value, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
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
        className="font-heading text-xl md:text-2xl font-semibold text-text-primary leading-tight
                   bg-transparent border-b border-accent outline-none w-full min-w-0"
        aria-label="Edit trip name"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      className="group flex items-center gap-1 min-w-0 text-left flex-1"
      aria-label={`Trip name: ${value}. Click to edit.`}
    >
      <h1 className="font-heading text-lg md:text-2xl font-bold text-text-primary
                       leading-tight truncate transition-all duration-150
                       group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">
        {value}
      </h1>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 text-text-muted transition-opacity duration-150 mt-0.5
                    opacity-0 group-hover:opacity-100"
        aria-hidden="true">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   TripTitleEditor — unified emoji + title editor
   Clicking emoji or title both enter edit mode.
   Emoji picker appears alongside the input.
───────────────────────────────────────────────────────────── */
function TripTitleEditor({ trip, onRename, onEmojiChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(trip.name)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [emojiPickerCoords, setEmojiPickerCoords] = useState({ top: 0, left: 0 })
  const inputRef = useRef(null)
  const emojiBtnRef = useRef(null)
  const emojiPickerRef = useRef(null)

  useEffect(() => { if (!editing) setDraft(trip.name) }, [trip.name, editing])

  const startEdit = () => {
    setDraft(trip.name)
    setEditing(true)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
  }

  const save = () => {
    const trimmed = (draft || '').trim()
    if (trimmed && trimmed !== trip.name) onRename(trimmed)
    else setDraft(trip.name)
    setEditing(false)
    setEmojiPickerOpen(false)
  }

  const cancel = () => { setDraft(trip.name); setEditing(false); setEmojiPickerOpen(false) }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  const handleEmojiButtonClick = () => {
    if (!editing) startEdit()
    if (emojiBtnRef.current) {
      const r = emojiBtnRef.current.getBoundingClientRect()
      setEmojiPickerCoords({ top: r.bottom + 6, left: r.left })
    }
    setEmojiPickerOpen(o => !o)
  }

  const handleEmojiSelect = (emoji) => {
    onEmojiChange(emoji)
    setEmojiPickerOpen(false)
  }

  useEffect(() => {
    if (!emojiPickerOpen) return
    const handler = (e) => {
      if (
        emojiBtnRef.current && !emojiBtnRef.current.contains(e.target) &&
        emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)
      ) setEmojiPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [emojiPickerOpen])

  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">

      {/* Emoji — clicking enters edit mode + opens picker */}
      <button
        ref={emojiBtnRef}
        onClick={handleEmojiButtonClick}
        className="text-lg md:text-2xl leading-none shrink-0 rounded-[var(--radius-sm)] hover:bg-bg-hover p-1 -m-1 transition-colors"
        title={editing ? 'Change emoji' : 'Edit trip'}
        aria-label="Edit trip emoji"
      >
        {trip.emoji}
      </button>

      {/* Title — view or input */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className="font-heading text-xl md:text-2xl font-semibold text-text-primary leading-tight
                     bg-transparent border-b border-accent outline-none min-w-0 flex-1"
          aria-label="Edit trip name"
        />
      ) : (
        <button
          onClick={startEdit}
          className="group flex items-center gap-1 min-w-0 text-left flex-1"
          aria-label={`Trip name: ${trip.name}. Click to edit.`}
        >
          <h1 className="font-heading text-lg md:text-2xl font-bold text-text-primary
                         leading-tight truncate
                         group-hover:underline group-hover:decoration-border-strong group-hover:underline-offset-4">
            {trip.name}
          </h1>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 text-text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}

      {/* Emoji picker portal */}
      {emojiPickerOpen && createPortal(
        <div
          ref={emojiPickerRef}
          style={{ position: 'fixed', top: emojiPickerCoords.top, left: emojiPickerCoords.left }}
          className="z-[9999] bg-bg-card border border-border rounded-[var(--radius-lg)] p-2.5 shadow-xl w-[232px]"
        >
          <div className="grid grid-cols-8 gap-1 mb-2">
            {TRIP_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiSelect(emoji)}
                className={`w-7 h-7 flex items-center justify-center text-base rounded-[var(--radius-sm)] transition-all
                  ${trip.emoji === emoji
                    ? 'bg-accent/15 ring-2 ring-accent scale-110'
                    : 'hover:bg-bg-hover'
                  }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Or type any emoji…"
            className="w-full text-sm px-2 py-1.5 rounded-[var(--radius-sm)] bg-bg-secondary border border-border text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
            onChange={e => {
              const match = e.target.value.match(/\p{Emoji}/u)
              if (match) handleEmojiSelect(match[0])
            }}
          />
        </div>,
        document.body
      )}

    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   CityBreadcrumbs — compact destination display
───────────────────────────────────────────────────────────── */
function CityBreadcrumbs({ destinations }) {
  if (!destinations?.length) return null

  const MAX = 3
  const visible = destinations.slice(0, MAX)
  const overflow = destinations.length - MAX

  return (
    <div className="flex items-center flex-nowrap gap-x-1">
      {visible.map((dest, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <span className="text-text-muted/40 mx-1">&middot;</span>}
          <span className="inline-flex items-center gap-1 text-sm text-text-secondary whitespace-nowrap font-medium">
            <span>{dest.flag}</span>
            <span>{dest.city}</span>
          </span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex items-center">
          <span className="text-text-muted/40 mx-1">&middot;</span>
          <span className="text-xs text-text-muted font-medium whitespace-nowrap">+{overflow} more</span>
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   DateRangeEditor — click to edit start/end dates inline
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
            setEnd(val)
          }
        }}
        placeholder="Start date"
        className="text-xs bg-transparent border-b border-accent/60 focus:border-accent outline-none text-text-primary px-1 hover:border-accent min-w-[90px]"
      />
      <span className="text-text-muted text-xs">→</span>
      <DatePicker
        value={end}
        onChange={setEnd}
        min={start}
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

/* ─────────────────────────────────────────────────────────────
   HeaderOptionsDropdown — share, rename, duplicate, delete
───────────────────────────────────────────────────────────── */
function HeaderOptionsDropdown({ trip, dispatch, isReadOnly, onRenameRequest }) {
  const { showToast } = useTripContext()
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)

  const handleShare = () => { setShowShareModal(true) }
  const handleRename = () => { onRenameRequest() }
  const handleDuplicate = () => {
    dispatch({ type: ACTIONS.DUPLICATE_TRIP, payload: trip.id })
    showToast('Trip duplicated')
  }
  const handleDeleteConfirm = async () => {
    try {
      await updateDoc(doc(db, 'trips', trip.id), {
        deletedAt: serverTimestamp(),
        memberIds: [],
        travelerIds: [],
      })
      dispatch({ type: ACTIONS.DELETE_TRIP, payload: trip.id })
      showToast('Trip deleted', 'info')
    } catch (err) {
      console.error('Failed to delete trip:', err)
      showToast('Failed to delete trip', 'error')
    }
    setShowDeleteConfirm(false)
  }

  const ShareIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
  )
  const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  )
  const CopyIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  )
  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
  )

  const itemCls = `
    flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer
    select-none outline-none rounded-[var(--radius-sm)]
    text-text-secondary
    data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary
    transition-colors duration-100
  `
  const dangerItemCls = `
    flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer
    select-none outline-none rounded-[var(--radius-sm)]
    text-danger data-[highlighted]:bg-danger/10
    transition-colors duration-100
  `

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-[var(--radius-md)] bg-bg-primary hover:bg-bg-hover text-text-primary border border-border transition-colors"
            aria-label="Trip actions"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-[9999] min-w-[180px] bg-bg-card border border-border rounded-[var(--radius-md)] py-1 shadow-lg animate-scale-in focus:outline-none"
          >
            <DropdownMenu.Item className={itemCls} onSelect={handleShare}>
              <ShareIcon />
              Share trip
            </DropdownMenu.Item>
            <DropdownMenu.Item className={itemCls} onSelect={() => setShowPresentation(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              Present to group
            </DropdownMenu.Item>

            {!isReadOnly && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-border mx-2" />
                <DropdownMenu.Item className={itemCls} onSelect={handleRename}>
                  <EditIcon />
                  Rename trip
                </DropdownMenu.Item>
                <DropdownMenu.Item className={itemCls} onSelect={handleDuplicate}>
                  <CopyIcon />
                  Duplicate
                </DropdownMenu.Item>
              </>
            )}

            <DropdownMenu.Separator className="my-1 h-px bg-border mx-2" />
            <DropdownMenu.Item className={dangerItemCls} onSelect={() => setShowDeleteConfirm(true)}>
              <TrashIcon />
              Delete trip
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {showShareModal && trip && (
        <ShareTripModal
          trip={trip}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showPresentation && (
        <Suspense fallback={null}>
          <PresentationMode onClose={() => setShowPresentation(false)} />
        </Suspense>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete trip?"
        message={`Are you sure you want to delete "${trip.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger={true}
      />
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   TripHeader — two-row mobile layout with proper hierarchy.

   Mobile layout (< lg):
     Row 1: [☰ hamburger] [emoji] [Trip Name — truncated]
     Row 2: [Status] · [Cities] · [Dates] [Countdown] ··· [👤 Travelers] [🔍] [⋮]

   Desktop layout (≥ lg):
     Left:  [emoji] [Trip Name] / [Status · Cities · Dates · Countdown]
     Right: [Readiness ring] [Travelers] [Search ⌘K] [⋮]

   Touch targets: all action buttons ≥ 44×44px on mobile.
───────────────────────────────────────────────────────────── */
export default function TripHeader({ onOpenSidebar, isMobile }) {
  const { activeTrip, dispatch, isReadOnly, effectiveStatus, showToast } = useTripContext()
  const { currentUserProfile } = useProfiles()
  const travelerProfiles = useTripTravelers()
  const myUid = currentUserProfile?.uid || currentUserProfile?.id
  const readiness = useMemo(() => calculateReadiness(activeTrip), [activeTrip])
  const [celebrationTrigger, setCelebrationTrigger] = useState(0)
  const prevReadinessRef = useRef(readiness)

  useEffect(() => {
    if (readiness === 100 && prevReadinessRef.current < 100) {
      setCelebrationTrigger(prev => prev + 1)
    }
    prevReadinessRef.current = readiness
  }, [readiness])

  if (!activeTrip) return null

  const trip = activeTrip
  const tripStatus = getTripStatus(trip.startDate, trip.endDate)
  const destinations = trip.destinations || []

  // Trip rollup — nights allocated across cities vs total trip nights, and total
  // logged spend. Both render as quiet inline stats in the desktop identity strip.
  const nightsPlanned = (trip.cities || []).reduce((s, c) => s + (Number(c.nights) || 0), 0)
  const tripNights = trip.startDate && trip.endDate
    ? Math.max(0, daysBetween(trip.startDate, trip.endDate) - 1)
    : 0
  const totalSpent = (trip.spendingLog || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const nightsLabel = tripNights > 0
    ? `${nightsPlanned}/${tripNights} nights`
    : nightsPlanned > 0 ? `${nightsPlanned} nights` : null

  const statusLabel =
    effectiveStatus === 'archived' ? 'Archived' :
    effectiveStatus === 'completed' ? 'Memory' :
    effectiveStatus === 'ongoing' ? 'Ongoing' : 'Upcoming'

  const handleRename = (newName) => {
    if (newName) dispatch({ type: ACTIONS.RENAME_TRIP, payload: { id: trip.id, name: newName } })
  }

  const handleRenameClick = () => {
    const newName = window.prompt('Rename trip:', trip.name)
    if (newName && newName.trim() && newName.trim() !== trip.name) {
      dispatch({ type: ACTIONS.RENAME_TRIP, payload: { id: trip.id, name: newName.trim() } })
      showToast('Trip renamed')
    }
  }

  const handleEmojiChange = (emoji) =>
    dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { emoji } } })

  /* ── Mobile-only quiet status badge ── */
  const StatusBadge = () => (
    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] bg-bg-secondary text-[11px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap">
      {statusLabel}
    </span>
  )

  return (
    <>
      <CelebrationEffect trigger={celebrationTrigger} />
      <header className="animate-fade-in border-b border-border bg-bg-primary/95 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-4">

          {/* ── LEFT — Title + Meta ── */}
          <div className="flex flex-col min-w-0 flex-1 gap-2 sm:gap-3">

            {/* Row 1: Hamburger + Emoji + Trip Name + (Mobile Actions) */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                {isMobile && (
                  <button
                    onClick={onOpenSidebar}
                    className="flex items-center justify-center w-10 h-10 -ml-2 shrink-0 text-text-secondary hover:bg-bg-hover rounded-[var(--radius-md)] transition-colors"
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
                  ? <h1 className="font-heading text-lg md:text-2xl font-bold text-text-primary leading-tight truncate flex-1 min-w-0">{trip.emoji} {trip.name}</h1>
                  : <TripTitleEditor trip={trip} onRename={handleRename} onEmojiChange={handleEmojiChange} />
                }
              </div>

              {/* Mobile main actions: Status, Bell, Search, Dots */}
              <div className="flex items-center gap-1 lg:hidden">
                <StatusBadge />
                <NotificationBell myUid={myUid} />
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                  className="flex items-center justify-center w-10 h-10 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  aria-label="Search"
                >
                  <SearchIcon size={18} />
                </button>
                <HeaderOptionsDropdown trip={trip} dispatch={dispatch} isReadOnly={isReadOnly} onRenameRequest={handleRenameClick} />
              </div>
            </div>

            {/* Row 2 (Mobile): Travelers + Dates */}
            <div className="flex lg:hidden items-center justify-start gap-4 px-0.5 pl-10 md:pl-0">
               <div className="flex items-center min-w-0">
                  <TravelerPicker trip={trip} travelerProfiles={travelerProfiles} dispatch={dispatch} isReadOnly={isReadOnly} />
               </div>
               <div className="shrink-0">
                  <DateRangeEditor trip={trip} dispatch={dispatch} isReadOnly={isReadOnly} />
               </div>
            </div>

            {/* Meta row (desktop): Dates · Cities · Wanderers — full trip identity strip */}
            <div className="flex items-center min-w-0 pl-10 md:pl-0">
              <div className="flex items-center gap-x-2 flex-1 min-w-0 text-sm text-text-muted overflow-x-auto scrollbar-hide whitespace-nowrap mask-fade-right">

                {/* Date anchors the row — desktop only */}
                <div className="hidden lg:flex shrink-0 items-center">
                  <DateRangeEditor trip={trip} dispatch={dispatch} isReadOnly={isReadOnly} />
                </div>

                {/* Cities follow */}
                {destinations.length > 0 && (
                  <>
                    <span className="hidden lg:inline opacity-40 text-xs shrink-0">·</span>
                    <div className="hidden lg:flex shrink-0 min-w-0">
                      <CityBreadcrumbs destinations={destinations} />
                    </div>
                  </>
                )}

                {/* Wanderers — part of trip identity, not actions */}
                <span className="hidden lg:inline opacity-40 text-xs shrink-0">·</span>
                <div className="hidden lg:flex shrink-0 items-center">
                  <TravelerPicker trip={trip} travelerProfiles={travelerProfiles} dispatch={dispatch} isReadOnly={isReadOnly} />
                </div>

                {/* Nights planned — trip rollup */}
                {nightsLabel && (
                  <>
                    <span className="hidden lg:inline opacity-40 text-xs shrink-0">·</span>
                    <span className="hidden lg:inline-flex shrink-0 items-center gap-1 text-sm text-text-muted tabular-nums whitespace-nowrap">
                      <span aria-hidden="true">🌙</span>{nightsLabel}
                    </span>
                  </>
                )}

                {/* Total spend — trip rollup */}
                {totalSpent > 0 && (
                  <>
                    <span className="hidden lg:inline opacity-40 text-xs shrink-0">·</span>
                    <span className="hidden lg:inline-flex shrink-0 items-center gap-1 text-sm font-medium text-text-secondary tabular-nums whitespace-nowrap" title="Total logged spend">
                      {formatCurrency(Math.round(totalSpent), trip.currency)}
                    </span>
                  </>
                )}

              </div>
            </div>
          </div>

          {/* ── RIGHT — Desktop-only global actions ── */}
          <div className="hidden lg:flex shrink-0 items-center justify-end gap-3">

            {/* Trip Status + Readiness + Countdown — unified "trip health" widget */}
            <div className="flex items-center gap-2.5">
              <ProgressRing value={readiness} size={36} strokeWidth={3.5} labelClassName="text-[10px] font-semibold" />
              <div className="flex flex-col justify-center">
                {/* Status pill */}
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-bg-secondary text-[10px] font-bold uppercase tracking-wider text-text-muted whitespace-nowrap w-fit mb-1">
                  {statusLabel}
                </span>
                {/* Readiness quality · Countdown on one line */}
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-semibold leading-tight whitespace-nowrap ${readiness >= 100 ? 'text-success' : 'text-text-primary/70'}`}>
                    {readiness >= 100 ? 'Ready!' : 'On Track'}
                  </span>
                {tripStatus === 'upcoming' && trip.startDate && (
                    <>
                      <span className="text-text-muted/40 text-[11px]">·</span>
                      <CountdownInline
                        targetDate={trip.startDate}
                        className={`text-[11px] font-semibold leading-tight ${readiness >= 100 ? 'text-success' : 'text-text-primary/70'}`}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <NotificationBell myUid={myUid} />

            {/* Search */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
              className="flex items-center gap-1.5 px-2 py-2 rounded-[var(--radius-md)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors border border-border bg-bg-secondary"
              title="Search (⌘K)"
              aria-label="Search"
            >
              <SearchIcon size={16} />
              <kbd className="hidden sm:inline-flex px-1 py-0.5 rounded text-[10px] font-sans font-semibold bg-bg-card border border-border text-text-muted/70">
                ⌘K
              </kbd>
            </button>

            <HeaderOptionsDropdown trip={trip} dispatch={dispatch} isReadOnly={isReadOnly} onRenameRequest={handleRenameClick} />
          </div>

        </div>
      </div>
    </header>
    </>
  )
}
