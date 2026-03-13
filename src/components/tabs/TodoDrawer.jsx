import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { TODO_STATUSES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import Select, { SelectItem } from '../shared/Select'
import { useProfiles } from '../../context/ProfileContext'
import AvatarCircle from '../shared/AvatarCircle'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import { formatDate } from '../../utils/helpers'

function TodoStatusSelect({ value, onChange, disabled }) {
  const current = TODO_STATUSES.find(s => s.id === value) || TODO_STATUSES[0]

  return (
    <Select
      value={value}
      onValueChange={v => { hapticSelection(); onChange(v) }}
      disabled={disabled}
      className={`text-left font-semibold ${current.colors}`}
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

function AssigneeSelect({ value, onChange, travelers, resolveProfile, disabled }) {
  return (
    <Select
      value={value || 'unassigned'}
      onValueChange={v => { hapticSelection(); onChange(v === 'unassigned' ? null : v) }}
      disabled={disabled}
      className="text-left"
    >
      <SelectItem value="unassigned">Unassigned</SelectItem>
      {travelers.map(tId => {
        const p = resolveProfile(tId)
        if (!p) return null
        return (
          <SelectItem key={tId} value={tId}>
            <div className="flex items-center gap-2">
              <AvatarCircle profile={p} size={16} />
              <span>{p.name}</span>
            </div>
          </SelectItem>
        )
      })}
    </Select>
  )
}

export default function TodoDrawer({ todo, travelers, onUpdate, onAddComment, onClose, resolveProfile, isReadOnly }) {
  const { currentUserProfile } = useProfiles()
  const [mounted, setMounted] = useState(false)
  const [draftComment, setDraftComment] = useState('')
  const actorId = currentUserProfile?.uid || currentUserProfile?.id

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

  const handlePost = () => {
    if (isReadOnly) return
    const text = draftComment.trim()
    if (!text) return
    onAddComment?.(todo.id, text, actorId)
    setDraftComment('')
    hapticImpact('medium')
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
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-bg-card border-l border-border shadow-none transform transition-transform duration-300 ease-out flex flex-col ${mounted ? 'translate-x-0' : 'translate-x-full'}`}
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
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</label>
              <TodoStatusSelect
                value={todo.status || (todo.done ? 'done' : 'not_started')}
                onChange={val => onUpdate(todo.id, { status: val, done: val === 'done' })}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Assignee</label>
              <AssigneeSelect
                value={todo.assigneeId}
                onChange={val => onUpdate(todo.id, { assigneeId: val })}
                travelers={travelers}
                resolveProfile={resolveProfile}
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Due Date</label>
              <DatePicker
                value={todo.dueDate || ''}
                onChange={val => { hapticSelection(); onUpdate(todo.id, { dueDate: val }) }}
                placeholder="Set date"
                disabled={isReadOnly}
                className="w-full"
              />
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Notes Area */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</label>
            <textarea
              value={todo.note || ''}
              onChange={e => onUpdate(todo.id, { note: e.target.value })}
              rows={4}
              placeholder="Add context, links, or instructions here..."
              readOnly={isReadOnly}
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-heading"
            />
          </div>

          <hr className="border-border/30" />

          {/* Updates Feed */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Updates</label>
            {comments.length === 0 ? (
              <div className="min-h-[120px] flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-[var(--radius-md)]">
                No updates yet. Start the conversation.
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                {comments.map(comment => {
                  const author = resolveProfile(comment.authorId)
                  return (
                    <div key={comment.id} className="flex items-start gap-3">
                      <AvatarCircle profile={author} size={28} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span className="font-semibold text-text-primary">
                            {author?.name || 'Unknown'}
                          </span>
                          <span className="text-text-muted">•</span>
                          <span>{comment.timestamp ? formatDate(comment.timestamp, 'short') : ''}</span>
                        </div>
                        <div className="mt-1 bg-bg-secondary border border-border rounded-[var(--radius-md)] px-3 py-2 text-sm text-text-secondary shadow-none">
                          {comment.text}
                        </div>
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
          <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-[var(--radius-md)] px-3 py-2">
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
