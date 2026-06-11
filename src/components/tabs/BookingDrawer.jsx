import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MONDAY_STATUSES, migrateStatus } from './BookingsTable'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Select, { SelectItem } from '../shared/Select'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import AvatarCircle from '../shared/AvatarCircle'
import WanderersPicker from '../shared/WanderersPicker'
import { useProfiles } from '../../context/ProfileContext'
import { useTripContext } from '../../context/TripContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency, generateId } from '../../utils/helpers'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import LocationAutocomplete from '../shared/LocationAutocomplete'
import AirportAutocomplete from '../shared/AirportAutocomplete'
import Label from '../shared/Label'
import MentionTextarea from '../shared/MentionTextarea'
import CommentText from '../shared/CommentText'

// ── Cost Input ──────────────────────────────────────────────────────────────
function CostInput({ value, currency, onChange, disabled }) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value ? String(value) : '')

  useEffect(() => {
    if (!focused) setDraft(value ? String(value) : '')
  }, [value, focused])

  return (
    <input
      type={focused ? 'number' : 'text'}
      value={focused ? draft : (value ? formatCurrency(value, currency) : formatCurrency(0, currency))}
      onFocus={() => { if (!disabled) { setDraft(value ? String(value) : ''); setFocused(true) } }}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setFocused(false); onChange(Number(draft) || 0) }}
      disabled={disabled}
      className={`w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors tabular-nums ${disabled ? 'opacity-80 cursor-default' : ''}`}
      placeholder={formatCurrency(0, currency)}
    />
  )
}

// ── FlightEndpointRow ────────────────────────────────────────────────────────
function FlightEndpointRow({ label, value, isReadOnly, onSave }) {
  const [editing, setEditing] = useState(false)
  const iata = value?.iata || ''
  const placeName = value?.placeName || ''
  const city = value?.city || ''

  return (
    <div className="flex items-start gap-3 px-3">
      <Label className="w-20 shrink-0 pt-[13px]">{label}</Label>
      <div className="flex-1 min-w-0 py-2">
        {editing && !isReadOnly ? (
          <div>
            <AirportAutocomplete
              value={value}
              autoFocus
              onSelect={(data) => { onSave(data); setEditing(false) }}
            />
            <button onClick={() => setEditing(false)} className="mt-1.5 text-xs text-text-muted hover:text-text-primary">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {iata ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded shrink-0">
                  {iata}
                </span>
                <span className="text-sm text-text-secondary truncate">{city || placeName}</span>
              </div>
            ) : (
              <span className="text-sm italic text-text-muted">Not set</span>
            )}
            {!isReadOnly && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] text-text-muted hover:text-accent transition-colors shrink-0"
              >
                {iata ? 'Change' : 'Add'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BookingDrawer({ booking, currency, onUpdate, onClose, isReadOnly }) {
  const { activeTrip, state, dispatch } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const travelers = useTripTravelers()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  
  // Tab control state
  const [activeTab, setActiveTab] = useState('updates')
  
  // Collaborative threaded replies & likes state
  const [expandedComments, setExpandedComments] = useState(new Set())
  const [replyDrafts, setReplyDrafts] = useState({})

  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [draftMentions, setDraftMentions] = useState([])
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const feedRef = useRef(null)
  const actorId = currentUserProfile?.uid || currentUserProfile?.id
  const tripDocuments = state.documentsByTrip?.[activeTrip?.id] || {}
  const tripTravelerIds = useMemo(() => travelers.map(t => t.id).filter(Boolean), [travelers])
  
  const bookingTravelerIds = useMemo(() => {
    if (Array.isArray(booking?.travelerIds) && booking.travelerIds.length > 0) return booking.travelerIds
    return tripTravelerIds
  }, [booking?.travelerIds, tripTravelerIds])
  
  const locationLabel = typeof booking?.location === 'string'
    ? booking.location
    : booking?.location?.placeName || ''
    
  const cityHint = activeTrip?.cities?.length
    ? activeTrip.cities
        .map(c => `${c.city || ''}${c.country ? `, ${c.country}` : ''}`.trim())
        .filter(Boolean)
        .join(' | ')
    : ''

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

  useEffect(() => {
    setNotesDraft(booking?.notes || '')
    setIsEditingNotes(false)
    setEditingLocation(false)
  }, [booking?.id, booking?.notes])

  const comments = useMemo(() => {
    if (!booking?.comments?.length) return []
    return [...booking.comments]
  }, [booking?.comments])

  useEffect(() => {
    if (!feedRef.current) return
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [comments.length, activeTab])

  const handleSaveNotes = () => {
    onUpdate(booking.id, { notes: notesDraft }, actorId)
    setIsEditingNotes(false)
  }

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    dispatch({ type: ACTIONS.ADD_BOOKING_COMMENT, payload: { bookingId: booking.id, text, actorId, mentions: draftMentions } })
    setDraftComment('')
    setDraftMentions([])
    hapticImpact('medium')
  }

  const handleSaveEdit = (commentId) => {
    const text = editDraft.trim()
    if (!text) return
    dispatch({ type: ACTIONS.UPDATE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId, text } })
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleToggleLike = (comment) => {
    if (isReadOnly) return
    const isLiked = (comment.likes || []).includes(actorId)
    const nextLikes = isLiked
      ? (comment.likes || []).filter(id => id !== actorId)
      : [...(comment.likes || []), actorId]
    dispatch({ type: ACTIONS.UPDATE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId: comment.id, likes: nextLikes } })
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
    dispatch({ type: ACTIONS.UPDATE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId, replies: nextReplies } })
    setReplyDrafts(prev => ({ ...prev, [commentId]: '' }))
    hapticImpact('light')
  }

  const handleDeleteReply = (commentId, replyId) => {
    if (isReadOnly) return
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    const nextReplies = (comment.replies || []).filter(r => r.id !== replyId)
    dispatch({ type: ACTIONS.UPDATE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId, replies: nextReplies } })
  }

  const formatTimestamp = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return String(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const viewAttachment = async (file) => {
    try {
      const url = file.downloadUrl || file.previewUrl || file.url
      const response = await fetch(url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank')
    } catch (err) {
      console.error('Failed to view attachment:', err)
      window.open(file.downloadUrl || file.previewUrl || file.url, '_blank')
    }
  }

  if (!booking || !mounted) return null

  const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]
  
  const linkedDocs = (booking.documentIds || [])
    .map(id => tripDocuments?.[id])
    .filter(Boolean)
    
  const attachmentItems = [
    ...(booking.attachments || []),
    ...linkedDocs.map(doc => ({
      id: doc.id,
      documentId: doc.id,
      name: doc.title,
      type: doc.mimeType,
      url: doc.downloadUrl,
      previewUrl: doc.previewUrl,
      downloadUrl: doc.downloadUrl,
      storagePath: doc.storagePath,
    })),
  ].filter((file, index, arr) => arr.findIndex(other => other.id === file.id) === index)

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
            <span className="text-2xl shrink-0">{categoryConfig.emoji}</span>
            <EditableText
              value={booking.name}
              onSave={val => onUpdate(booking.id, { name: val }, actorId)}
              className="font-heading text-xl font-bold text-text-primary block"
              placeholder="Booking name"
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
          <button
            onClick={() => setActiveTab('files')}
            className={`py-3 text-sm font-semibold relative transition-colors ${activeTab === 'files' ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Files
            {attachmentItems.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-bg-secondary text-text-secondary text-[11px] font-bold">
                {attachmentItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Content Viewport - changes based on active tab */}
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
                                onClick={() => dispatch({ type: ACTIONS.DELETE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId: comment.id } })}
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
              {(() => {
                const cat = booking.category || 'other'
                const dateLabel = { flight: 'Departure', lodging: 'Check-in', food: 'Reservation', concert: 'Show Date' }[cat] || 'Date'
                const confLabel = { flight: 'Flight #', concert: 'Ticket #', food: 'Res #', lodging: 'Conf #' }[cat] || 'Conf #'
                const showDate = cat !== 'shopping'
                const showConf = !['shopping'].includes(cat)
                const showLocation = cat !== 'flight'

                return (
                  <div className="space-y-5">
                    {/* Header settings grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Status Card */}
                      <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Status</Label>
                        <div className="w-full">
                          <Select
                            value={migrateStatus(booking.status)}
                            onValueChange={val => { hapticSelection(); onUpdate(booking.id, { status: val }, actorId) }}
                            disabled={isReadOnly}
                            className={`text-left font-semibold text-xs w-full ${(MONDAY_STATUSES.find(s => s.value === migrateStatus(booking.status)) || MONDAY_STATUSES[0]).colors}`}
                          >
                            {MONDAY_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>
                                <span className="inline-flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${s.value === 'confirmed' ? 'bg-success' : s.value === 'cancelled' ? 'bg-danger' : s.value === 'requested' ? 'bg-blue-500' : 'bg-warning'}`} />
                                  {s.label}
                                </span>
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {/* Category Card */}
                      <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Category</Label>
                        <Select
                          value={booking.category || BOOKING_CATEGORIES[0].id}
                          onValueChange={val => { hapticSelection(); onUpdate(booking.id, { category: val }, actorId) }}
                          disabled={isReadOnly}
                          className="text-left font-semibold text-xs w-full"
                        >
                          {BOOKING_CATEGORIES.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Semantic group cards */}
                    {/* Logistics Card */}
                    {(cat === 'flight' || showLocation || showDate) && (
                      <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                          <span className="text-accent text-sm">📍</span>
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Logistics</h4>
                        </div>
                        <div className="space-y-3 divide-y divide-border/10">
                          {cat === 'flight' && (
                            <div className="space-y-2 pt-1 first:pt-0">
                              <FlightEndpointRow
                                label="From"
                                value={booking.origin}
                                isReadOnly={isReadOnly}
                                onSave={val => onUpdate(booking.id, { origin: val }, actorId)}
                              />
                              <FlightEndpointRow
                                label="To"
                                value={booking.destination}
                                isReadOnly={isReadOnly}
                                onSave={val => onUpdate(booking.id, { destination: val }, actorId)}
                              />
                            </div>
                          )}

                          {showLocation && (
                            <div className="flex items-start gap-3 pt-3 first:pt-0">
                              <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted mt-1.5">Location</Label>
                              <div className="flex-1 min-w-0">
                                {editingLocation && !isReadOnly ? (
                                  <div>
                                    <LocationAutocomplete
                                      initialValue={locationLabel}
                                      cityHint={cityHint}
                                      onSelect={(locationData) => {
                                        onUpdate(booking.id, { location: locationData }, actorId)
                                        setEditingLocation(false)
                                        hapticSelection()
                                      }}
                                    />
                                    <button onClick={() => setEditingLocation(false)} className="mt-1.5 text-xs text-text-muted hover:text-text-primary">Cancel</button>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-sm text-text-secondary truncate block">
                                        {locationLabel || <span className="italic text-text-muted text-xs">No location set</span>}
                                      </span>
                                      {booking.location?.rating != null && (
                                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
                                          <span>⭐ {booking.location.rating}</span>
                                          {booking.location.reviewCount != null && <span>({booking.location.reviewCount.toLocaleString()})</span>}
                                          {booking.location.openingHours && <span>· {booking.location.openingHours}</span>}
                                        </span>
                                      )}
                                    </div>
                                    {!isReadOnly && (
                                      <button onClick={() => setEditingLocation(true)} className="text-[11px] text-text-muted hover:text-accent transition-colors shrink-0 mt-0.5">
                                        {locationLabel ? 'Change' : 'Add'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {showDate && (
                            <div className="flex items-center gap-3 pt-3 first:pt-0">
                              <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">{dateLabel}</Label>
                              <div className="flex-1 min-w-0">
                                <DatePicker
                                  value={booking.bookByDate || booking.startDate || ''}
                                  onChange={val => onUpdate(booking.id, { bookByDate: val }, actorId)}
                                  className={`text-text-primary text-sm block w-full border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-accent/50'} transition-colors`}
                                  placeholder="Add date…"
                                  disabled={isReadOnly}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Expenses Card */}
                    <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                        <span className="text-accent text-sm">💸</span>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Expenses & Travelers</h4>
                      </div>
                      <div className="space-y-3 divide-y divide-border/10">
                        <div className="flex items-center gap-3 pt-1 first:pt-0">
                          <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">Cost</Label>
                          <div className="flex-1 min-w-0">
                            <CostInput
                              value={booking.amountPaid}
                              currency={currency}
                              onChange={val => onUpdate(booking.id, { amountPaid: val }, actorId)}
                              disabled={isReadOnly}
                            />
                            {(() => {
                              const pax = Number(booking.paxCount || bookingTravelerIds.length || 0)
                              const cost = Number(booking.amountPaid || 0)
                              if (pax > 1 && cost > 0) {
                                return (
                                  <p className="text-[11px] text-text-muted mt-1 tabular-nums">
                                    {formatCurrency(Math.round(cost / pax), currency)} × {pax} pax
                                  </p>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-3 first:pt-0">
                          <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">Travelers</Label>
                          <div className="flex-1 min-w-0">
                            <WanderersPicker
                              travelers={travelers}
                              selectedIds={booking.travelerIds || []}
                              onChange={next => onUpdate(booking.id, {
                                travelerIds: next,
                                paxCount: next.length > 0 ? next.length : (travelers.length || 1),
                              }, actorId)}
                              disabled={isReadOnly}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Reference Card */}
                    <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                        <span className="text-accent text-sm">🔑</span>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Reference</h4>
                      </div>
                      <div className="space-y-3 divide-y divide-border/10">
                        <div className="flex items-center gap-3 pt-1 first:pt-0">
                          <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">Series</Label>
                          <div className="flex-1 min-w-0">
                            <EditableText
                              value={booking.seriesId || ''}
                              onSave={val => onUpdate(booking.id, { seriesId: val.trim() || null }, actorId)}
                              className="text-accent text-sm block truncate font-mono"
                              inputClassName="w-full"
                              placeholder="Add group ID…"
                              readOnly={isReadOnly}
                            />
                          </div>
                        </div>

                        {showConf && (
                          <div className="flex items-center gap-3 pt-3 first:pt-0">
                            <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">{confLabel}</Label>
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={booking.confirmationNumber || ''}
                                onSave={val => onUpdate(booking.id, { confirmationNumber: val }, actorId)}
                                className="text-accent font-mono text-sm block"
                                inputClassName="w-full"
                                placeholder="Add confirmation…"
                                readOnly={isReadOnly}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3 pt-3 first:pt-0">
                          <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">Link</Label>
                          <div className="flex-1 min-w-0">
                            <EditableText
                              value={booking.providerLink || ''}
                              onSave={val => onUpdate(booking.id, { providerLink: val }, actorId)}
                              className="text-accent text-sm block truncate"
                              inputClassName="w-full"
                              placeholder="Add URL…"
                              readOnly={isReadOnly}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Moleskine serif journal Note block */}
                    <div className="space-y-2 pt-2 border-t border-border/20">
                      <Label className="text-xs uppercase tracking-wider text-text-muted font-bold">Notes & Policies</Label>
                      {isEditingNotes && !isReadOnly ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesDraft}
                            onChange={e => setNotesDraft(e.target.value)}
                            rows={4}
                            placeholder="Add confirmation emails, cancellation policies, or lockbox codes…"
                            className="w-full text-sm bg-bg-note border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-serif"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleSaveNotes}>Save Notes</Button>
                            <Button size="sm" variant="secondary" onClick={() => { setNotesDraft(booking.notes || ''); setIsEditingNotes(false) }}>
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
                            <span className="text-text-muted italic text-xs font-serif">Click to add notes, policies, or reservation codes…</span>
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
                )
              })()}
            </div>
          )}

          {/* FILES TAB */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/20">
                <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted font-bold">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                  Uploaded Attachments ({attachmentItems.length})
                </Label>
              </div>
              
              {attachmentItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {attachmentItems.map((file) => (
                    <div key={file.id} className="group relative flex items-center justify-between p-3 bg-bg-card border border-border/50 hover:border-accent/40 rounded-[var(--radius-md)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all duration-200">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 flex-shrink-0 bg-bg-secondary border border-border/20 rounded-lg flex items-center justify-center text-xl overflow-hidden shadow-inner">
                          {file.type?.startsWith('image/') ? (
                            <img src={file.previewUrl || file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-base">📄</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{file.name}</p>
                          <span className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${
                            file.type?.includes('pdf')
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              : file.type?.startsWith('image/')
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                              : 'bg-accent/10 text-accent border border-accent/20'
                          }`}>
                            {file.type?.split('/')[1]?.toUpperCase() || 'FILE'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.preventDefault(); viewAttachment(file) }}
                          className="p-1.5 text-text-muted hover:text-accent rounded-md hover:bg-bg-hover transition-colors"
                          title="View Attachment"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        {!isReadOnly && (
                          <button
                            onClick={() => {
                              if (file.documentId) {
                                const remainingDocIds = (booking.documentIds || []).filter(id => id !== file.documentId)
                                const remainingAttachments = (booking.attachments || []).filter(a => a.id !== file.documentId)
                                onUpdate(booking.id, { documentIds: remainingDocIds, attachments: remainingAttachments }, actorId)
                              } else {
                                const remaining = (booking.attachments || []).filter(a => a.id !== file.id)
                                onUpdate(booking.id, { attachments: remaining }, actorId)
                              }
                            }}
                            className="p-1.5 text-text-muted hover:text-danger rounded-md hover:bg-bg-hover transition-colors"
                            title="Remove"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-border/50 rounded-[var(--radius-md)] p-10 text-center text-text-muted">
                  <svg className="mx-auto mb-2 opacity-30" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                  <p className="text-xs">No files or attachments linked to this booking yet.</p>
                </div>
              )}
            </div>
          )}
          
        </div>
        
      </div>
    </div>,
    document.body
  )
}
