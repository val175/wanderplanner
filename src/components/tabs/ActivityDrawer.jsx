import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import TimePicker from '../shared/TimePicker'
import AvatarCircle from '../shared/AvatarCircle'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import { GLOBAL_CATEGORIES } from '../../constants/categories'

function CategorySelect({ value, onChange, disabled }) {
  const cat = GLOBAL_CATEGORIES.find(c => c.id === value) || GLOBAL_CATEGORIES.find(c => c.id === 'other')
  return (
    <select
      value={value || 'other'}
      onChange={e => { hapticSelection(); onChange(e.target.value) }}
      disabled={disabled}
      className="bg-bg-input border border-border rounded-[var(--radius-sm)] text-xs font-medium text-text-secondary px-2 py-1.5 focus:outline-none focus:border-accent transition-colors"
    >
      {GLOBAL_CATEGORIES.map(c => (
        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
      ))}
    </select>
  )
}

export default function ActivityDrawer({ activity, dayId, onClose }) {
  const { dispatch, isReadOnly } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [mounted, setMounted] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const feedRef = useRef(null)
  const actorId = currentUserProfile?.uid || currentUserProfile?.id

  useEffect(() => {
    setMounted(true)
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
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
    if (!feedRef.current) return
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [comments.length])

  const update = (updates) => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId, activityId: activity.id, updates } })

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    dispatch({ type: ACTIONS.ADD_ACTIVITY_COMMENT, payload: { dayId, activityId: activity.id, text, actorId } })
    setDraftComment('')
    hapticImpact('medium')
  }

  const handleStartEdit = (comment) => {
    if (isReadOnly) return
    setEditingCommentId(comment.id)
    setEditDraft(comment.text || '')
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
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">

          {/* Metadata Row */}
          <div className="grid grid-cols-3 gap-6 items-start">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Start Time</label>
              <TimePicker
                value={activity.time}
                onChange={time => update({ time })}
                className="w-full border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1.5 text-sm font-mono"
                placeholder="--:--"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Duration</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={activity.duration || 60}
                  onChange={e => update({ duration: Math.max(5, parseInt(e.target.value) || 60) })}
                  disabled={isReadOnly}
                  min={5}
                  step={15}
                  className="w-16 bg-bg-input border border-border rounded-[var(--radius-sm)] text-sm font-mono text-text-primary px-2 py-1.5 focus:outline-none focus:border-accent"
                />
                <span className="text-xs text-text-muted">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
              <CategorySelect
                value={activity.category || 'other'}
                onChange={val => update({ category: val })}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Location + Link */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Location</label>
              <p className="text-sm text-text-secondary truncate">
                {activity.location?.placeName || (typeof activity.location === 'string' ? activity.location : '') || '—'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Link</label>
              <EditableText
                value={activity.link || ''}
                onSave={val => update({ link: val })}
                className="text-sm text-accent font-mono block truncate w-full"
                placeholder="Add reservation URL…"
                readOnly={isReadOnly}
              />
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
                          <span className="text-text-muted">•</span>
                          <span>{formatTimestamp(comment.timestamp)}</span>
                          {!isReadOnly && comment.authorId === actorId && (
                            <div className="flex items-center gap-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleStartEdit(comment)} className="text-xs text-text-muted hover:text-text-primary">Edit</button>
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
