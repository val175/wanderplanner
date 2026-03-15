import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MONDAY_STATUSES, migrateStatus } from './BookingsTable'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import AvatarCircle from '../shared/AvatarCircle'
import { useProfiles } from '../../context/ProfileContext'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency } from '../../utils/helpers'
import { hapticImpact, hapticSelection } from '../../utils/haptics'

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

export default function BookingDrawer({ booking, currency, onUpdate, onClose, isReadOnly }) {
  const { dispatch } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [mounted, setMounted] = useState(false)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [draftComment, setDraftComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const feedRef = useRef(null)
  const actorId = currentUserProfile?.uid || currentUserProfile?.id

  useEffect(() => {
    setMounted(true)
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  useEffect(() => {
    setNotesDraft(booking?.notes || '')
    setIsEditingNotes(false)
  }, [booking?.id, booking?.notes])

  const comments = useMemo(() => {
    if (!booking?.comments?.length) return []
    return [...booking.comments]
  }, [booking?.comments])

  useEffect(() => {
    if (!feedRef.current) return
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [comments.length])

  const handleSaveNotes = () => {
    onUpdate(booking.id, { notes: notesDraft }, actorId)
    setIsEditingNotes(false)
  }

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    dispatch({ type: ACTIONS.ADD_BOOKING_COMMENT, payload: { bookingId: booking.id, text, actorId } })
    setDraftComment('')
    hapticImpact('medium')
  }

  const handleSaveEdit = (commentId) => {
    const text = editDraft.trim()
    if (!text) return
    dispatch({ type: ACTIONS.UPDATE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId, text } })
    setEditingCommentId(null)
    setEditDraft('')
  }

  const formatTimestamp = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return String(ts)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const viewAttachment = async (file) => {
    try {
      const response = await fetch(file.url)
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank')
    } catch (err) {
      console.error('Failed to view attachment:', err)
      window.open(file.url, '_blank')
    }
  }

  if (!booking || !mounted) return null

  const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]

  return createPortal(
    <div className="relative z-[9999] font-heading">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-bg-primary/50 backdrop-blur-sm transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-xl bg-bg-card border-l border-border shadow-none transform transition-transform duration-300 ease-out flex flex-col ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">

          {/* Status + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</label>
              <select
                value={migrateStatus(booking.status)}
                onChange={e => { hapticSelection(); onUpdate(booking.id, { status: e.target.value }, actorId) }}
                disabled={isReadOnly}
                className="bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-medium text-text-secondary px-2 py-1.5 focus:outline-none focus:border-accent transition-colors w-full"
              >
                {MONDAY_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
              <select
                value={booking.category || BOOKING_CATEGORIES[0].id}
                onChange={e => { hapticSelection(); onUpdate(booking.id, { category: e.target.value }, actorId) }}
                disabled={isReadOnly}
                className="bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-medium text-text-secondary px-2 py-1.5 focus:outline-none focus:border-accent transition-colors w-full"
              >
                {BOOKING_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Date</label>
              <DatePicker
                value={booking.bookByDate || booking.startDate || ''}
                onChange={val => onUpdate(booking.id, { bookByDate: val }, actorId)}
                className={`text-text-primary text-sm block w-full border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1.5 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-accent/50'} transition-colors`}
                placeholder="Add date…"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cost</label>
              <CostInput
                value={booking.amountPaid}
                currency={currency}
                onChange={val => onUpdate(booking.id, { amountPaid: val }, actorId)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Conf # + Link */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Conf #</label>
              <EditableText
                value={booking.confirmationNumber || ''}
                onSave={val => onUpdate(booking.id, { confirmationNumber: val }, actorId)}
                className="text-accent font-mono text-sm block"
                placeholder="Add confirmation…"
                readOnly={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Link</label>
              <EditableText
                value={booking.providerLink || ''}
                onSave={val => onUpdate(booking.id, { providerLink: val }, actorId)}
                className="text-accent text-sm block truncate"
                placeholder="Add URL…"
                readOnly={isReadOnly}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Location</label>
            <EditableText
              value={booking.location || ''}
              onSave={val => onUpdate(booking.id, { location: val }, actorId)}
              className="text-text-primary text-sm block"
              placeholder="e.g. 1-2-3 Shinjuku, Tokyo"
              readOnly={isReadOnly}
            />
          </div>

          <hr className="border-border/30" />

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes & Policies</label>
            {isEditingNotes && !isReadOnly ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={4}
                  placeholder="Add confirmation emails, cancellation policies, or lockbox codes…"
                  className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-heading"
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
                className={`text-sm leading-relaxed border border-border/30 rounded-[var(--radius-md)] px-3 py-2 min-h-[64px] ${isReadOnly ? 'cursor-default' : 'cursor-text'} ${notesDraft ? 'text-text-secondary' : 'text-text-muted italic'}`}
              >
                {notesDraft || 'Click to add notes…'}
              </div>
            )}
          </div>

          <hr className="border-border/30" />

          {/* Attachments */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              Attachments
            </span>
            {booking.attachments?.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {booking.attachments.map((file) => (
                  <div key={file.id} className="group relative flex items-center justify-between p-3 bg-bg-secondary/50 border border-border/50 rounded-[var(--radius-md)] hover:border-accent/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 flex-shrink-0 bg-bg-card border border-border/30 rounded flex items-center justify-center text-xl overflow-hidden">
                        {file.type?.startsWith('image/') ? (
                          <img src={file.url} alt="" className="w-full h-full object-cover" />
                        ) : '📄'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-primary truncate">{file.name}</p>
                        <p className="text-[10px] text-text-muted">{file.type?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.preventDefault(); viewAttachment(file) }}
                        className="p-1.5 text-text-muted hover:text-accent rounded hover:bg-bg-hover"
                        title="View Attachment"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => {
                            const remaining = booking.attachments.filter(a => a.id !== file.id)
                            onUpdate(booking.id, { attachments: remaining }, actorId)
                          }}
                          className="p-1.5 text-text-muted hover:text-danger rounded hover:bg-bg-hover"
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
              <div className="border border-dashed border-border/50 rounded-[var(--radius-md)] p-6 text-center text-text-muted">
                <svg className="mx-auto mb-2 opacity-30" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                <p className="text-xs">No attachments found</p>
              </div>
            )}
          </div>

          <hr className="border-border/30" />

          {/* Updates Feed */}
          <div className="space-y-6 pb-4">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Updates</label>
            {comments.length === 0 ? (
              <div className="min-h-[120px] flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-[var(--radius-md)]">
                No updates yet. Start the conversation.
              </div>
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
                                onClick={() => dispatch({ type: ACTIONS.DELETE_BOOKING_COMMENT, payload: { bookingId: booking.id, commentId: comment.id } })}
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
