import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import TimePicker from '../shared/TimePicker'
import AvatarCircle from '../shared/AvatarCircle'
import LocationAutocomplete from '../shared/LocationAutocomplete'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import { GLOBAL_CATEGORIES } from '../../constants/categories'
import { getDayLocationMap, detectLocationConflict } from '../../utils/tripGeo'
import { MapPin } from 'lucide-react'

function CategorySelect({ value, onChange, disabled }) {
  return (
    <select
      value={value || 'other'}
      onChange={e => { hapticSelection(); onChange(e.target.value) }}
      disabled={disabled}
      className="bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-medium text-text-secondary px-2 py-1.5 focus:outline-none focus:border-accent transition-colors w-full"
    >
      {GLOBAL_CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
      ))}
    </select>
  )
}

export default function ActivityDrawer({ activity, dayId, onClose, onViewOnMap }) {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const feedRef = useRef(null)
  const actorId = currentUserProfile?.uid || currentUserProfile?.id

  // Derive day context for display and location proximity
  const day = useMemo(() =>
    activeTrip?.itinerary?.find(d => d.id === dayId),
    [activeTrip?.itinerary, dayId]
  )
  const proximity = useMemo(() => {
    if (!day?.location || !activeTrip?.cities?.length) return ''
    const city = activeTrip.cities.find(c =>
      c.city && day.location.toLowerCase().includes(c.city.toLowerCase())
    ) || activeTrip.cities[0]
    return city?.lat && city?.lng ? `${city.lng},${city.lat}` : ''
  }, [day?.location, activeTrip?.cities])

  const dayLocationMap = useMemo(() => getDayLocationMap(activeTrip), [activeTrip])
  const locationConflict = useMemo(() =>
    detectLocationConflict(activity?.location, dayLocationMap.get(dayId)),
    [activity?.location, dayId, dayLocationMap]
  )
  const [conflictDismissed, setConflictDismissed] = useState(false)

  const locationString = activity?.location?.placeName
    || (typeof activity?.location === 'string' ? activity.location : '')
    || ''
  const locationRating = activity?.location?.rating
  const locationReviewCount = activity?.location?.reviewCount
  const locationHours = activity?.location?.openingHours
  const locationOpenNow = activity?.location?.isOpenNow
  const locationWebsite = activity?.location?.website

  useEffect(() => {
    setMounted(true)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
      cancelAnimationFrame(raf)
    }
  }, [onClose])

  const comments = useMemo(() => {
    if (!activity?.comments?.length) return []
    return [...activity.comments]
  }, [activity?.comments])

  useEffect(() => {
    setNotesDraft(activity?.notes || '')
    setIsEditingNotes(false)
  }, [activity?.id, activity?.notes])

  useEffect(() => {
    setConflictDismissed(false)
  }, [activity?.id, activity?.location])

  useEffect(() => {
    if (!feedRef.current) return
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [comments.length])

  const update = (updates) =>
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId, activityId: activity.id, updates } })

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    dispatch({ type: ACTIONS.ADD_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, text, actorId } })
    setDraftComment('')
    hapticImpact('medium')
  }

  const handleSaveEdit = (commentId) => {
    const text = editDraft.trim()
    if (!text) return
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId, text } })
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleSaveNotes = () => {
    update({ notes: notesDraft })
    setIsEditingNotes(false)
  }

  const formatDayDate = (isoDate) => {
    if (!isoDate) return ''
    const d = new Date(isoDate + 'T12:00:00')
    if (Number.isNaN(d.getTime())) return isoDate
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTimestamp = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return String(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (!activity || !mounted) return null

  return createPortal(
    <div className="relative z-[9999] font-heading">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-bg-primary/50 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed w-full flex flex-col bg-bg-card border-border transform transition-transform duration-300 ease-drawer inset-x-0 bottom-0 rounded-t-2xl min-h-[92dvh] max-h-[92dvh] border-t overflow-x-hidden md:inset-y-0 md:right-0 md:left-auto md:max-w-xl md:rounded-none md:min-h-0 md:max-h-none md:border-t-0 md:border-l ${visible ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}`}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
            <span className="text-2xl shrink-0">{activity.emoji || '📍'}</span>
            <EditableText
              value={activity.name}
              onSave={val => update({ name: val })}
              className="font-heading text-xl font-bold text-text-primary block"
              placeholder="Activity name"
              readOnly={isReadOnly}
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary rounded-full hover:bg-bg-hover transition-colors shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">

          {/* Day label */}
          {day && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="text-base">{day.emoji || '📍'}</span>
              <span className="font-medium text-text-secondary">Day {day.dayNumber}</span>
              {day.location && <><span>·</span><span>{day.location}</span></>}
              {day.date && <><span>·</span><span>{formatDayDate(day.date)}</span></>}
            </div>
          )}

          {/* Properties Panel */}
          <div className="rounded-[var(--radius-md)] border border-border/40 divide-y divide-border/30">

            {/* Time */}
            <div className="flex items-center gap-3 px-3 min-h-[42px] rounded-t-[var(--radius-md)]">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Time</span>
              <div className="flex items-center gap-1.5 flex-1 py-1.5 flex-wrap">
                <TimePicker
                  value={activity.time}
                  onChange={time => update({ time })}
                  className="border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1 text-sm font-mono"
                  placeholder="—"
                  disabled={isReadOnly}
                />
                <span className="text-text-muted/50 text-xs shrink-0">→</span>
                <TimePicker
                  value={activity.endTime}
                  onChange={endTime => update({ endTime })}
                  className="border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1 text-sm font-mono"
                  placeholder="—"
                  disabled={isReadOnly}
                />
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    value={activity.duration || 60}
                    onChange={e => update({ duration: Math.max(5, parseInt(e.target.value) || 60) })}
                    disabled={isReadOnly}
                    min={5}
                    step={15}
                    className="w-14 text-center bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-mono text-text-secondary px-1.5 py-1 focus:outline-none focus:border-accent"
                  />
                  <span className="text-[11px] text-text-muted">min</span>
              </div>
            </div>

            {onViewOnMap && (
              <button
                onClick={() => onViewOnMap(day, activity)}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 text-xs font-semibold text-text-primary hover:bg-bg-hover transition-colors"
              >
                <MapPin size={13} />
                View on Map
              </button>
            )}
          </div>

            {/* Category */}
            <div className="flex items-center gap-3 px-3 min-h-[42px]">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Category</span>
              <div className="flex-1 py-1.5">
                <CategorySelect
                  value={activity.category || 'other'}
                  onChange={val => update({ category: val })}
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 px-3">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wider pt-[13px]">Location</span>
              <div className="flex-1 min-w-0 py-2">
                {editingLocation ? (
                  <div>
                    <LocationAutocomplete
                      initialValue={locationString}
                      proximity={proximity}
                      cityHint={day?.location || ''}
                      onSelect={(locationData) => {
                        update({ location: locationData })
                        setEditingLocation(false)
                        hapticSelection()
                      }}
                    />
                    <button
                      onClick={() => setEditingLocation(false)}
                      className="mt-1.5 text-xs text-text-muted hover:text-text-primary"
                    >Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-text-secondary">
                        {locationString || <span className="italic text-text-muted">No location set</span>}
                      </span>
                      {(locationRating != null || locationHours || locationOpenNow != null) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-text-muted">
                          {locationRating != null && <span>⭐ {locationRating}</span>}
                          {locationReviewCount != null && <span>({locationReviewCount.toLocaleString()})</span>}
                          {locationOpenNow != null && <span className={locationOpenNow ? 'text-success' : 'text-danger'}>{locationOpenNow ? 'Open' : 'Closed'}</span>}
                          {locationHours && <span>· {locationHours}</span>}
                        </span>
                      )}
                      {locationWebsite && (
                        <a href={locationWebsite} target="_blank" rel="noopener noreferrer" className="block text-[11px] text-accent hover:underline mt-0.5">
                          Visit website
                        </a>
                      )}
                      {locationConflict && !conflictDismissed && !isReadOnly && (
                        <div className="flex items-start gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-warning/10 border border-warning/20 text-warning text-xs mt-2">
                          <span className="mt-0.5 shrink-0">⚠️</span>
                          <span className="flex-1">
                            <span className="font-semibold">Location mismatch</span>
                            {locationConflict.isTransit
                              ? ` — Day ${day?.dayNumber} is a transit day`
                              : ` — Day ${day?.dayNumber} is in ${locationConflict.expectedCity}`}
                            {locationConflict.detectedCity && `, but this appears to be in ${locationConflict.detectedCity}`}. Add anyway?
                          </span>
                          <button
                            onClick={() => setConflictDismissed(true)}
                            className="shrink-0 text-warning/60 hover:text-warning transition-colors"
                            title="Dismiss"
                          >✕</button>
                        </div>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button
                        onClick={() => setEditingLocation(true)}
                        className="text-[11px] text-text-muted hover:text-accent transition-colors shrink-0 mt-0.5"
                      >
                        {locationString ? 'Change' : 'Add'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Link */}
            <div className="flex items-center gap-3 px-3 min-h-[42px] rounded-b-[var(--radius-md)]">
              <span className="w-20 shrink-0 text-[11px] font-semibold text-text-muted uppercase tracking-wider">Link</span>
              <div className="flex-1 min-w-0 py-1.5">
                <EditableText
                  value={activity.link || ''}
                  onSave={val => update({ link: val })}
                  className="text-sm text-accent font-mono block truncate"
                  placeholder="Add reservation URL…"
                  readOnly={isReadOnly}
                />
              </div>
            </div>

          </div>

          <hr className="border-border/30" />

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</label>
            {isEditingNotes && !isReadOnly ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={4}
                  placeholder="Reservation details, tips, reminders…"
                  className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-heading"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveNotes}>Save Notes</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setNotesDraft(activity.notes || ''); setIsEditingNotes(false) }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { if (isReadOnly) return; hapticSelection(); setIsEditingNotes(true) }}
                className={`text-sm leading-relaxed border border-border/30 rounded-[var(--radius-md)] px-3 py-2 min-h-[64px] ${isReadOnly ? 'cursor-default' : 'cursor-text'} ${notesDraft ? 'text-text-secondary' : 'text-text-muted italic'}`}
              >
                {notesDraft || 'Click to add notes…'}
              </div>
            )}
          </div>

          <hr className="border-border/30" />

          {/* Updates Feed */}
          <div className="space-y-6">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Updates</label>
            {comments.length === 0 ? (
              <p className="text-sm text-text-muted py-2">No updates yet. Start the conversation.</p>
            ) : (
              <div ref={feedRef} className="max-h-[320px] overflow-y-auto pr-1 pt-1 space-y-6 scrollbar-thin">
                {comments.map((comment, index) => {
                  const author = resolveProfile(comment.authorId)
                  const isLast = index === comments.length - 1
                  const isEditing = editingCommentId === comment.id
                  return (
                    <div key={comment.id} className="flex items-start gap-4 group">
                      <div className="flex flex-col items-center gap-2">
                        <AvatarCircle profile={author} size={28} />
                        <div className={`w-px flex-1 bg-border/60 ${isLast ? 'opacity-0' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className="font-semibold text-text-primary">{author?.name || 'Unknown'}</span>
                          <span>•</span>
                          <span>{formatTimestamp(comment.timestamp)}</span>
                          {!isReadOnly && comment.authorId === actorId && (
                            <div className="flex items-center gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingCommentId(comment.id); setEditDraft(comment.text || '') }} className="text-xs text-text-muted hover:text-text-primary">Edit</button>
                              <button
                                onClick={() => dispatch({ type: ACTIONS.DELETE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId: comment.id } })}
                                className="text-xs text-text-muted hover:text-danger"
                              >Delete</button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="mt-2 space-y-2">
                            <textarea
                              value={editDraft}
                              onChange={e => setEditDraft(e.target.value)}
                              rows={3}
                              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-heading"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(comment.id)}>Save</Button>
                              <Button size="sm" variant="secondary" onClick={() => { setEditingCommentId(null); setEditDraft('') }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-text-secondary leading-relaxed">{comment.text}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 bg-bg-card">
          <div className="flex items-center gap-3">
            <AvatarCircle profile={currentUserProfile} size={28} />
            <input
              value={draftComment}
              onChange={e => setDraftComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePost() } }}
              onFocus={() => hapticSelection()}
              placeholder={isReadOnly ? 'Updates are read-only' : 'Write an update…'}
              disabled={isReadOnly}
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted font-heading"
            />
            <Button size="sm" onClick={handlePost} disabled={isReadOnly || !draftComment.trim()}>Post</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
