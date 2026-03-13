import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TODO_STATUSES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import Select, { SelectItem } from '../shared/Select'
import { useProfiles } from '../../context/ProfileContext'
import AvatarCircle from '../shared/AvatarCircle'
import { hapticImpact, hapticSelection } from '../../utils/haptics'

function TodoStatusSelect({ value, onChange, disabled }) {
  const current = TODO_STATUSES.find(s => s.id === value) || TODO_STATUSES[0]

  return (
    <Select
      value={value}
      onValueChange={v => { hapticSelection(); onChange(v) }}
      disabled={disabled}
      className={`text-left font-semibold w-[120px] ${current.colors}`}
    >
      {TODO_STATUSES.map(status => (
        <SelectItem key={status.id} value={status.id}>
          <span className="inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status.id === 'not_started' ? 'bg-text-muted/60' : status.id === 'in_progress' ? 'bg-warning' : 'bg-success'}`} />
            {status.label} {status.id === 'done' ? '✅' : ''}
          </span>
        </SelectItem>
      ))}
    </Select>
  )
}

function AssigneePill({ value, onChange, tripTravelers, resolveProfile, currentUserProfile, disabled }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const allTravelers = useMemo(() => {
    const ids = [...tripTravelers]
    if (currentUserProfile?.id && !ids.includes(currentUserProfile.id)) {
      ids.unshift(currentUserProfile.id)
    }
    return ids
  }, [tripTravelers, currentUserProfile])

  const handleOpen = (e) => {
    if (disabled) return
    e.stopPropagation()
    const rect = buttonRef.current.getBoundingClientRect()
    setCoords({ left: rect.left, top: rect.bottom + window.scrollY + 4 })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !buttonRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', () => setOpen(false), { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', () => setOpen(false))
    }
  }, [open])

  let displayNode = null
  let displayName = ''

  if (value) {
    const p = resolveProfile(value)
    if (p) {
      displayNode = <AvatarCircle profile={p} size={26} />
      displayName = p.name
    } else {
      displayNode = (
        <div className="w-[24px] h-[24px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent hover:bg-bg-hover transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
      )
      displayName = 'Unassigned'
    }
  } else {
    displayNode = (
      <div className="w-[24px] h-[24px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent hover:bg-bg-hover transition-colors">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      </div>
    )
    displayName = 'Unassigned'
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="inline-flex items-center rounded-full transition-all focus:outline-none"
        title={displayName}
        disabled={disabled}
      >
        {displayNode}
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[100] rounded-[var(--radius-md)] border border-border bg-bg-card min-w-[170px] py-1"
          style={{ top: coords.top, left: coords.left - 150 }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
              setOpen(false)
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-bg-hover text-text-secondary ${!value ? 'bg-bg-hover font-medium' : ''}`}
          >
            <div className="w-[16px] h-[16px] rounded-full border border-dashed border-border flex items-center justify-center" />
            <span>Unassigned</span>
          </button>
          {allTravelers.map(tId => {
            const p = resolveProfile(tId)
            if (!p) return null
            const isSelected = value === tId
            return (
              <button
                key={tId}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(tId)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-bg-hover text-text-secondary ${isSelected ? 'bg-bg-hover font-medium' : ''}`}
              >
                <div className="flex-1 flex items-center gap-2">
                  <AvatarCircle profile={p} size={16} />
                  <span className="truncate">{p.name}</span>
                </div>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

export default function TodoDrawer({ todo, travelers, onUpdate, onAddComment, onUpdateComment, onDeleteComment, onClose, resolveProfile, isReadOnly }) {
  const { currentUserProfile } = useProfiles()
  const [mounted, setMounted] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const actorId = currentUserProfile?.uid || currentUserProfile?.id
  const feedRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const comments = useMemo(() => {
    if (!todo?.comments?.length) return []
    return [...todo.comments]
  }, [todo?.comments])

  useEffect(() => {
    setNotesDraft(todo?.note || '')
    setIsEditingNotes(false)
  }, [todo?.id, todo?.note])

  useEffect(() => {
    if (!feedRef.current) return
    feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [comments.length])

  const formatCommentTimestamp = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return String(timestamp)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    onAddComment?.(todo.id, text, actorId)
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
    onUpdateComment?.(todo.id, commentId, text)
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleSaveNotes = () => {
    onUpdate(todo.id, { note: notesDraft })
    setIsEditingNotes(false)
  }

  if (!todo || !mounted) return null

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
          <div className="flex-1 min-w-0 mr-4">
            <EditableText
              value={todo.text}
              onSave={val => onUpdate(todo.id, { text: val })}
              className="font-heading text-2xl font-bold text-text-primary block"
              placeholder="Task Title"
              readOnly={isReadOnly}
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary rounded-full hover:bg-bg-hover transition-colors shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          {/* Metadata Row */}
          <div className="grid grid-cols-[160px_200px_auto] gap-8 items-start">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</label>
              <TodoStatusSelect
                value={todo.status || (todo.done ? 'done' : 'not_started')}
                onChange={val => onUpdate(todo.id, { status: val, done: val === 'done' })}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Due Date</label>
              <div className="mt-0.5">
                <DatePicker
                  value={todo.dueDate || ''}
                  onChange={val => { hapticSelection(); onUpdate(todo.id, { dueDate: val }) }}
                  placeholder="Set date"
                  disabled={isReadOnly}
                  className="transition-colors whitespace-nowrap text-sm"
                />
              </div>
            </div>
            <div className="space-y-2 flex flex-col items-start">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Assignee</label>
              <div className="mt-0.5">
                <AssigneePill
                  value={todo.assigneeId}
                  onChange={val => onUpdate(todo.id, { assigneeId: val })}
                  tripTravelers={travelers}
                  resolveProfile={resolveProfile}
                  currentUserProfile={currentUserProfile}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Notes Area */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</label>
            {isEditingNotes && !isReadOnly ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={4}
                  placeholder="Add context, links, or instructions here..."
                  className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-heading"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveNotes}>
                    Save Notes
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setNotesDraft(todo.note || '')
                      setIsEditingNotes(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  if (isReadOnly) return
                  hapticSelection()
                  setIsEditingNotes(true)
                }}
                className={`text-sm leading-relaxed border border-border/30 rounded-[var(--radius-md)] px-3 py-2 min-h-[64px] ${isReadOnly ? 'cursor-default' : 'cursor-text'} ${notesDraft ? 'text-text-secondary' : 'text-text-muted italic'}`}
              >
                {notesDraft || 'Click to add notes...'}
              </div>
            )}
          </div>

          <hr className="border-border/30" />

          {/* Updates Feed */}
          <div className="space-y-4">
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
                    <div key={comment.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center gap-2">
                        <AvatarCircle profile={author} size={28} />
                        <div className={`w-px flex-1 bg-border/60 ${isLast ? 'opacity-0' : ''}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className="font-semibold text-text-primary">
                            {author?.name || 'Unknown'}
                          </span>
                          <span className="text-text-muted">•</span>
                          <span>{formatCommentTimestamp(comment.timestamp)}</span>
                          {!isReadOnly && comment.authorId === actorId && (
                            <div className="flex items-center gap-2 ml-2">
                              <button
                                onClick={() => handleStartEdit(comment)}
                                className="text-xs text-text-muted hover:text-text-primary"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => onDeleteComment?.(todo.id, comment.id)}
                                className="text-xs text-text-muted hover:text-danger"
                              >
                                Delete
                              </button>
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
                              <Button size="sm" onClick={() => handleSaveEdit(comment.id)}>
                                Save
                              </Button>
                              <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                            {comment.text}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Input */}
        <div className="border-t border-border px-4 py-3 bg-bg-card">
          <div className="flex items-center gap-3">
            <AvatarCircle profile={currentUserProfile} size={28} />
            <input
              value={draftComment}
              onChange={e => setDraftComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handlePost()
                }
              }}
              onFocus={() => hapticSelection()}
              placeholder={isReadOnly ? 'Updates are read-only' : 'Write an update...'}
              disabled={isReadOnly}
              className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted font-heading"
            />
            <Button
              size="sm"
              onClick={handlePost}
              disabled={isReadOnly || !draftComment.trim()}
            >
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
