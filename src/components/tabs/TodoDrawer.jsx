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
import Label from '../shared/Label'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import MentionTextarea from '../shared/MentionTextarea'
import CommentText from '../shared/CommentText'
import { generateId } from '../../utils/helpers'

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
          className="absolute z-[10000] rounded-[var(--radius-md)] border border-border bg-bg-card min-w-[170px] py-1"
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
  const [visible, setVisible] = useState(false)
  
  // Tab control state
  const [activeTab, setActiveTab] = useState('updates')
  
  // Collaborative threaded replies & likes state
  const [expandedComments, setExpandedComments] = useState(new Set())
  const [replyDrafts, setReplyDrafts] = useState({})

  const [draftComment, setDraftComment] = useState('')
  const [draftMentions, setDraftMentions] = useState([])
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const actorId = currentUserProfile?.uid || currentUserProfile?.id
  const feedRef = useRef(null)

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
  }, [comments.length, activeTab])

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
    onAddComment?.(todo.id, text, actorId, draftMentions)
    setDraftComment('')
    setDraftMentions([])
    hapticImpact('medium')
  }

  const handleSaveEdit = (commentId) => {
    const text = editDraft.trim()
    if (!text) return
    onUpdateComment?.(todo.id, commentId, text)
    setEditingCommentId(null)
    setEditDraft('')
  }

  const handleToggleLike = (comment) => {
    if (isReadOnly) return
    const isLiked = (comment.likes || []).includes(actorId)
    const nextLikes = isLiked
      ? (comment.likes || []).filter(id => id !== actorId)
      : [...(comment.likes || []), actorId]
    onUpdateComment?.(todo.id, comment.id, undefined, nextLikes, undefined)
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
    onUpdateComment?.(todo.id, commentId, undefined, undefined, nextReplies)
    setReplyDrafts(prev => ({ ...prev, [commentId]: '' }))
    hapticImpact('light')
  }

  const handleDeleteReply = (commentId, replyId) => {
    if (isReadOnly) return
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    const nextReplies = (comment.replies || []).filter(r => r.id !== replyId)
    onUpdateComment?.(todo.id, commentId, undefined, undefined, nextReplies)
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
          <div className="flex-1 min-w-0 mr-4">
            <EditableText
              value={todo.text}
              onSave={val => onUpdate(todo.id, { text: val })}
              className="font-heading text-xl font-bold text-text-primary block"
              placeholder="Task Title"
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
                              <span className="text-[10px] text-text-muted block mt-0.5">{formatCommentTimestamp(comment.timestamp)}</span>
                            </div>
                          </div>
                          {!isReadOnly && comment.authorId === actorId && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingCommentId(comment.id); setEditDraft(comment.text || '') }} className="text-[11px] text-text-muted hover:text-accent font-medium">Edit</button>
                              <button
                                onClick={() => onDeleteComment?.(todo.id, comment.id)}
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
                                      <span className="text-[9px] text-text-muted">{formatCommentTimestamp(reply.timestamp)}</span>
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
                const assigneeProfile = todo.assigneeId ? resolveProfile(todo.assigneeId) : null
                const assigneeName = assigneeProfile ? assigneeProfile.name : 'Unassigned'
                
                return (
                  <div className="space-y-5">
                    {/* Side-by-Side Settings Header Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Status Card */}
                      <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5">
                        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Status</Label>
                        <div className="w-full">
                          <TodoStatusSelect
                            value={todo.status || (todo.done ? 'done' : 'not_started')}
                            onChange={val => onUpdate(todo.id, { status: val, done: val === 'done' })}
                            disabled={isReadOnly}
                          />
                        </div>
                      </div>

                      {/* Assignee Card */}
                      <div className="bg-bg-secondary/40 border border-border/40 rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5 justify-between">
                        <Label className="text-[10px] uppercase tracking-wider text-text-muted font-bold">Assignee</Label>
                        <div className="flex items-center gap-2">
                          <AssigneePill
                            value={todo.assigneeId}
                            onChange={val => onUpdate(todo.id, { assigneeId: val })}
                            tripTravelers={travelers}
                            resolveProfile={resolveProfile}
                            currentUserProfile={currentUserProfile}
                            disabled={isReadOnly}
                          />
                          <span className="text-xs font-semibold text-text-secondary truncate" title={assigneeName}>
                            {assigneeName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline & Planning Card */}
                    <div className="bg-bg-card border border-border/40 rounded-[var(--radius-md)] p-4 space-y-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center gap-2 pb-1.5 border-b border-border/20">
                        <span className="text-accent text-sm">📅</span>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Timeline & Planning</h4>
                      </div>
                      <div className="flex items-center gap-3 pt-1 first:pt-0">
                        <Label className="w-24 shrink-0 text-xs font-semibold text-text-muted">Due Date</Label>
                        <div className="flex-1 min-w-0">
                          <DatePicker
                            value={todo.dueDate || ''}
                            onChange={val => { hapticSelection(); onUpdate(todo.id, { dueDate: val }) }}
                            placeholder="Set date"
                            disabled={isReadOnly}
                            className="text-text-primary text-sm block w-full border border-border bg-bg-input rounded-[var(--radius-sm)] px-2 py-1 transition-colors whitespace-nowrap"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Moleskine Serif Notes Block */}
                    <div className="space-y-2 pt-2 border-t border-border/20">
                      <Label className="text-xs uppercase tracking-wider text-text-muted font-bold">Notes</Label>
                      {isEditingNotes && !isReadOnly ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesDraft}
                            onChange={e => setNotesDraft(e.target.value)}
                            rows={4}
                            placeholder="Add context, links, or instructions here..."
                            className="w-full text-sm bg-bg-note border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors resize-none leading-relaxed font-serif"
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
                          className={`text-sm leading-relaxed border-l-2 border-accent/50 border-y border-r border-border-note bg-bg-note rounded-r-[var(--radius-md)] rounded-l-[4px] px-4 py-3 min-h-[72px] shadow-[0_1px_2px_rgba(0,0,0,0.01)] relative group/note ${isReadOnly ? 'cursor-default' : 'cursor-text hover:border-accent/30'} transition-all`}
                        >
                          {notesDraft ? (
                            <div className="text-text-secondary whitespace-pre-wrap font-serif leading-relaxed">
                              {notesDraft}
                            </div>
                          ) : (
                            <span className="text-text-muted italic text-xs font-serif">Click to add notes, context, or instructions…</span>
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

        </div>
      </div>
    </div>,
    document.body
  )
}
