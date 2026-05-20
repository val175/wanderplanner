import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import TimePicker from '../shared/TimePicker'
import AvatarCircle from '../shared/AvatarCircle'
import TravelerMultiSelect from '../shared/TravelerMultiSelect'
import LocationAutocomplete from '../shared/LocationAutocomplete'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import { GLOBAL_CATEGORIES } from '../../constants/categories'
import { getDayLocationMap, detectLocationConflict } from '../../utils/tripGeo'
import { MapPin } from 'lucide-react'
import Label from '../shared/Label'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import MentionTextarea from '../shared/MentionTextarea'
import CommentText from '../shared/CommentText'
import { generateId } from '../../utils/helpers'

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
  const travelers = useTripTravelers()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  
  // Tab control state
  const [activeTab, setActiveTab] = useState('updates')
  
  // Collaborative threaded replies & likes state
  const [expandedComments, setExpandedComments] = useState(new Set())
  const [replyDrafts, setReplyDrafts] = useState({})

  const [editingLocation, setEditingLocation] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [draftMentions, setDraftMentions] = useState([])
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const feedRef = useRef(null)
  const actorId = currentUserProfile?.uid || currentUserProfile?.id
  const tripTravelerIds = useMemo(() => travelers.map(t => t.id).filter(Boolean), [travelers])
  const activityParticipantIds = useMemo(() => {
    if (Array.isArray(activity?.participantIds) && activity.participantIds.length > 0) return activity.participantIds
    return tripTravelerIds
  }, [activity?.participantIds, tripTravelerIds])

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
  }, [comments.length, activeTab])

  const update = (updates) =>
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId, activityId: activity.id, updates } })

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    dispatch({ type: ACTIONS.ADD_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, text, actorId, mentions: draftMentions } })
    setDraftComment('')
    setDraftMentions([])
    hapticImpact('medium')
  }

  const handleSaveEdit = (commentId) => {
    const text = editDraft.trim()
    if (!text) return
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId, text } })
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleToggleLike = (comment) => {
    if (isReadOnly) return
    const isLiked = (comment.likes || []).includes(actorId)
    const nextLikes = isLiked
      ? (comment.likes || []).filter(id => id !== actorId)
      : [...(comment.likes || []), actorId]
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId: comment.id, likes: nextLikes } })
    hapticSelection()
  }

  const handlePostReply = (commentId) => {
    if (isReadOnly) return
    const text = replyDrafts[commentId]?.trim()
    if (!text) return
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    const reply = {
      id: generateId(),
      authorId: actorId,
      text,
      timestamp: new Date().toISOString(),
    }
    const nextReplies = [...(comment.replies || []), reply]
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId, replies: nextReplies } })
    setReplyDrafts(prev => ({ ...prev, [commentId]: '' }))
    hapticImpact('light')
  }

  const handleDeleteReply = (commentId, replyId) => {
    if (isReadOnly) return
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    const nextReplies = (comment.replies || []).filter(r => r.id !== replyId)
    dispatch({ type: ACTIONS.UPDATE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId, replies: nextReplies } })
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
        <div className="flex items-center justify-between p-4 border-b border-border/20 shrink-0 bg-bg-card">
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

        {/* Sleek Flat Monday.com top Tab Navigation bar */}
        <div className="flex border-b border-border/20 px-6 shrink-0 bg-bg-card gap-5">
          <button
            onClick={() => setActiveTab('updates')}
            className={`py-3 text-sm font-semibold relative transition-colors ${activeTab === 'updates' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Updates
            {comments.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-bold">
                {comments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`py-3 text-sm font-semibold relative transition-colors ${activeTab === 'properties' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Properties
          </button>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          
          {/* UPDATES TAB */}
          {activeTab === 'updates' && (
            <div className="space-y-6">
              {/* Large styled rich Composer */}
              <div className="bg-bg-card border border-border/50 rounded-[var(--radius-md)] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3">
                <div className="flex gap-3">
                  <AvatarCircle profile={currentUserProfile} size={32} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <MentionTextarea
                      value={draftComment}
                      onChange={setDraftComment}
                      onMentionsChange={setDraftMentions}
                      travelers={travelers}
                      onEnter={handlePost}
                      placeholder={isReadOnly ? 'Updates are read-only' : 'Write an update... (@ to tag)'}
                      disabled={isReadOnly}
                      className="w-full bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted resize-none min-h-[70px] leading-relaxed font-heading"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border/10 pt-3 shrink-0">
                  <span className="text-[11px] text-text-muted">Tip: Use @ to tag travelers</span>
                  <Button
                    size="sm"
                    onClick={handlePost}
                    disabled={isReadOnly || !draftComment.trim()}
                  >
                    Post Update
                  </Button>
                </div>
              </div>

              {/* Comments Feed */}
              {comments.length === 0 ? (
                <div className="text-center py-10 text-text-muted border border-dashed border-border/40 rounded-[var(--radius-md)]">
                  <span className="text-2xl block mb-2">💬</span>
                  <p className="text-xs">No updates posted yet. Start collaborating!</p>
                </div>
              ) : (
                <div ref={feedRef} className="space-y-5">
                  {comments.map((comment) => {
                    const author = resolveProfile(comment.authorId)
                    const isEditing = editingCommentId === comment.id
                    const isLiked = (comment.likes || []).includes(actorId)
                    const likesCount = (comment.likes || []).length
                    const hasReplies = (comment.replies || []).length > 0
                    const isExpanded = expandedComments.has(comment.id)

                    return (
                      <div key={comment.id} className="border border-border/50 rounded-[var(--radius-md)] bg-bg-card shadow-[0_1px_3px_rgba(0,0,0,0.01)] p-4 space-y-3.5 hover:shadow-md transition-shadow group">
                        
                        {/* Card Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AvatarCircle profile={author} size={28} className="shrink-0" />
                            <div>
                              <span className="font-semibold text-text-primary text-sm block leading-tight">{author?.name || 'Unknown'}</span>
                              <span className="text-[10px] text-text-muted block mt-0.5">{formatTimestamp(comment.timestamp)}</span>
                            </div>
                          </div>
                          {!isReadOnly && comment.authorId === actorId && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingCommentId(comment.id); setEditDraft(comment.text || '') }} className="text-[11px] text-text-muted hover:text-accent font-medium">Edit</button>
                              <button
                                onClick={() => dispatch({ type: ACTIONS.DELETE_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, commentId: comment.id } })}
                                className="text-[11px] text-text-muted hover:text-danger font-medium"
                              >Delete</button>
                            </div>
                          )}
                        </div>

                        {/* Card Content */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editDraft}
                              onChange={e => setEditDraft(e.target.value)}
                              rows={3}
                              className="w-full text-xs bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => handleSaveEdit(comment.id)}>Save</Button>
                              <Button size="sm" variant="secondary" onClick={() => { setEditingCommentId(null); setEditDraft('') }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-text-secondary text-sm leading-relaxed pl-1 whitespace-pre-wrap">
                            <CommentText text={comment.text} travelers={travelers} />
                          </div>
                        )}

                        {/* Action buttons (Like & Reply) */}
                        <div className="flex items-center gap-4 pt-2 border-t border-border/10 text-xs shrink-0">
                          <button
                            onClick={() => handleToggleLike(comment)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-bg-hover transition-colors font-medium ${isLiked ? 'text-accent bg-accent/5 font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                          >
                            <span className="text-sm">👍</span>
                            <span>{likesCount > 0 ? `Liked (${likesCount})` : 'Like'}</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              const next = new Set(expandedComments)
                              if (next.has(comment.id)) {
                                next.delete(comment.id)
                              } else {
                                next.add(comment.id)
                              }
                              setExpandedComments(next)
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-bg-hover transition-colors font-medium ${isExpanded || hasReplies ? 'text-accent bg-accent/5 font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                          >
                            <span className="text-sm">💬</span>
                            <span>{comment.replies?.length > 0 ? `Replies (${comment.replies.length})` : 'Reply'}</span>
                          </button>
                        </div>

                        {/* Nested threaded replies */}
                        {(isExpanded || hasReplies) && (
                          <div className="bg-bg-secondary/20 dark:bg-bg-secondary/15 border border-border/20 rounded-[var(--radius-md)] p-3.5 space-y-3.5 mt-2.5">
                            {/* Replies List */}
                            {(comment.replies || []).map((reply) => {
                              const replyAuthor = resolveProfile(reply.authorId)
                              return (
                                <div key={reply.id} className="flex items-start gap-2.5 text-xs group/reply">
                                  <AvatarCircle profile={replyAuthor} size={22} className="shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0 bg-bg-card border border-border/20 rounded-md p-2.5 relative shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="font-semibold text-text-primary">{replyAuthor?.name || 'Unknown'}</span>
                                      <span className="text-[9px] text-text-muted">{formatTimestamp(reply.timestamp)}</span>
                                    </div>
                                    <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">{reply.text}</p>
                                    {!isReadOnly && reply.authorId === actorId && (
                                      <button
                                        onClick={() => handleDeleteReply(comment.id, reply.id)}
                                        className="absolute right-2 top-2 text-[10px] text-text-muted hover:text-danger opacity-0 group-hover/reply:opacity-100 transition-opacity font-medium"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}

                            {/* Inline Reply Composer */}
                            <div className="flex items-center gap-2 pt-1 border-t border-border/10 shrink-0">
                              <AvatarCircle profile={currentUserProfile} size={22} className="shrink-0" />
                              <input
                                type="text"
                                value={replyDrafts[comment.id] || ''}
                                onChange={e => setReplyDrafts({ ...replyDrafts, [comment.id]: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handlePostReply(comment.id) }}
                                placeholder="Write a reply..."
                                disabled={isReadOnly}
                                className="flex-1 bg-bg-input border border-border rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors"
                              />
                              <button
                                onClick={() => handlePostReply(comment.id)}
                                disabled={isReadOnly || !(replyDrafts[comment.id] || '').trim()}
                                className="text-xs text-accent hover:text-accent-hover font-semibold px-2 py-1.5 disabled:opacity-40 shrink-0 transition-opacity"
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        )}
                        
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* PROPERTIES TAB */}
          {activeTab === 'properties' && (
            <div className="space-y-6">
              
              {/* Day Context Hint */}
              {day && (
                <div className="flex items-center gap-2 text-sm text-text-muted bg-bg-secondary/40 border border-border/30 rounded-[var(--radius-md)] px-4 py-2.5">
                  <span className="text-base">{day.emoji || '📍'}</span>
                  <span className="font-medium text-text-secondary">Day {day.dayNumber}</span>
                  {day.location && <><span>·</span><span>{day.location}</span></>}
                  {day.date && <><span>·</span><span>{formatDayDate(day.date)}</span></>}
                </div>
              )}

              <div className="space-y-5">
                {/* Side-by-Side Settings Header Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Category Card */}
                  <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5 justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Category</Label>
                    <CategorySelect
                      value={activity.category || 'other'}
                      onChange={val => update({ category: val })}
                      disabled={isReadOnly}
                    />
                  </div>

                  {/* Duration Card */}
                  <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5 justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Duration</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={activity.duration || 60}
                        onChange={e => update({ duration: Math.max(5, parseInt(e.target.value) || 60) })}
                        disabled={isReadOnly}
                        min={5}
                        step={15}
                        className="w-full bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-mono text-text-secondary px-2 py-1 focus:outline-none focus:border-accent"
                      />
                      <span className="text-xs text-text-muted shrink-0">min</span>
                    </div>
                  </div>
                </div>

                {/* Schedule & Location Card */}
                <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                    <span className="text-accent text-sm">⏰</span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Schedule & Location</h4>
                  </div>
                  <div className="space-y-3.5 divide-y divide-border/10">
                    {/* Time row */}
                    <div className="flex items-center gap-3 pt-1 first:pt-0">
                      <Label className="w-20 shrink-0 text-xs font-semibold text-text-muted">Time</Label>
                      <div className="flex items-center gap-1.5 flex-wrap flex-1">
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
                      </div>
                    </div>

                    {/* Location row */}
                    <div className="flex items-start gap-3 pt-3">
                      <Label className="w-20 shrink-0 text-xs font-semibold text-text-muted mt-1.5">Location</Label>
                      <div className="flex-1 min-w-0">
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
                          <div className="min-w-0">
                            <span className="text-sm text-text-secondary truncate block">
                              {locationString || <span className="italic text-text-muted text-xs">No location set</span>}
                            </span>
                            {(locationRating != null || locationHours || locationOpenNow != null) && (
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                                {locationRating != null && <span>⭐ {locationRating}</span>}
                                {locationReviewCount != null && <span>({locationReviewCount.toLocaleString()})</span>}
                                {locationOpenNow != null && <span className={locationOpenNow ? 'text-success' : 'text-danger'}>{locationOpenNow ? 'Open' : 'Closed'}</span>}
                                {locationHours && <span>· {locationHours}</span>}
                              </span>
                            )}
                            {locationWebsite && (
                              <a href={locationWebsite} target="_blank" rel="noopener noreferrer" className="block text-xs text-accent hover:underline mt-0.5 font-mono">
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
                            <div className="flex items-center gap-3 mt-1.5">
                              {!isReadOnly && (
                                <button
                                  onClick={() => setEditingLocation(true)}
                                  className="text-xs text-text-muted hover:text-accent transition-colors"
                                >
                                  {locationString ? 'Change' : 'Add location'}
                                </button>
                              )}
                              {onViewOnMap && (
                                <button
                                  onClick={() => onViewOnMap(day, activity)}
                                  className="flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
                                >
                                  <MapPin size={11} />
                                  View on map
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Travelers Card */}
                <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <span className="text-accent text-sm">👥</span>
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Travelers</h4>
                    </div>
                    <span className="text-xs text-text-muted font-semibold bg-bg-secondary px-2 py-0.5 rounded-full">
                      {activityParticipantIds.length} pax
                    </span>
                  </div>
                  <TravelerMultiSelect
                    travelers={travelers}
                    selectedIds={activityParticipantIds}
                    onChange={next => update({ participantIds: next })}
                    label="Included travelers"
                    helperText="Select everyone who is part of this activity."
                    disabled={isReadOnly}
                    collapsible
                    className="!mb-0"
                  />
                </div>

                {/* Reference Details Card */}
                <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                    <span className="text-accent text-sm">🔑</span>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Reference Details</h4>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <Label className="w-20 shrink-0 text-xs font-semibold text-text-muted">Link</Label>
                    <div className="flex-1 min-w-0">
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

                {/* Notes Block */}
                <div className="space-y-2 pt-2 border-t border-border/20">
                  <Label className="text-xs uppercase tracking-wider text-text-muted font-bold">Notes</Label>
                  {isEditingNotes && !isReadOnly ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesDraft}
                        onChange={e => setNotesDraft(e.target.value)}
                        rows={4}
                        placeholder="Reservation details, tips, reminders…"
                        className="w-full text-sm bg-bg-note border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-serif"
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
                      className={`text-sm leading-relaxed border-l-2 border-accent/50 border-y border-r border-border-note bg-bg-note rounded-r-[var(--radius-md)] rounded-l-[4px] px-4 py-3 min-h-[72px] shadow-[0_1px_2px_rgba(0,0,0,0.01)] relative group/note ${isReadOnly ? 'cursor-default' : 'cursor-text hover:border-accent/30'} transition-all`}
                    >
                      {notesDraft ? (
                        <div className="text-text-secondary whitespace-pre-wrap font-serif leading-relaxed">
                          {notesDraft}
                        </div>
                      ) : (
                        <span className="text-text-muted italic text-xs font-serif">Click to add notes, tips, or reminders…</span>
                      )}
                      {!isReadOnly && (
                        <div className="absolute right-2 top-2 p-1 rounded bg-bg-hover opacity-0 group-hover/note:opacity-100 transition-opacity">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
