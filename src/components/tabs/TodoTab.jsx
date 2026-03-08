import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Card from '../shared/Card'
import CelebrationEffect from '../shared/CelebrationEffect'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { TODO_PHASES } from '../../constants/tabs'
import AvatarCircle from '../shared/AvatarCircle'
import DatePicker from '../shared/DatePicker'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { triggerHaptic } from '../../utils/haptics'
import { auth } from '../../firebase/config'

// Anchors the DragOverlay to the cursor — matches BookingsKanban behaviour
const snapCursorToTopLeft = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const offsetX = activatorEvent.clientX - draggingNodeRect.left
    const offsetY = activatorEvent.clientY - draggingNodeRect.top
    return {
      ...transform,
      x: transform.x + offsetX - draggingNodeRect.width / 2,
      y: transform.y + offsetY - 20,
    }
  }
  return transform
}

function isPastDue(isoDateStr) {
  if (!isoDateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = isoDateStr.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  return due < today;
}

// Helper for Assignee Pill
function AssigneePill({ value, onChange, tripTravelers, resolveProfile, currentUserProfile }) {
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
      displayNode = <AvatarCircle profile={p} size={22} />
      displayName = p.name
    } else {
      displayNode = (
        <div className="w-[22px] h-[22px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent hover:bg-bg-hover transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
      )
      displayName = 'Unassigned'
    }
  } else {
    displayNode = (
      <div className="w-[22px] h-[22px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent hover:bg-bg-hover transition-colors">
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
        className="inline-flex items-center rounded-full border border-transparent hover:ring-[2px] transition-all ring-accent/30 focus:outline-none"
        title={displayName}
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

function getDeepLinkTarget(text) {
  const lower = text.toLowerCase()
  if (lower.includes('flight') || lower.includes('hotel') || lower.includes('book')) return 'bookings'
  if (lower.includes('budget') || lower.includes('split') || lower.includes('owe')) return 'budget'
  return null
}

function SortableTodoItem(props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.todo.id,
    data: {
      type: 'Todo',
      todo: props.todo
    },
    disabled: props.isReadOnly || !props.canDrag
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'cursor-grabbing' : ''}>
      <TodoItem {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  )
}

// Task 4: Progressive disclosure — date/notes/deeplink hide until hover when no value
function TodoItem({ todo, onToggle, onUpdate, onDelete, onDeepLink, resolveProfile, tripTravelers, currentUserProfile, isReadOnly, dragAttributes, dragListeners, canDrag, isBoard }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)
  const [expanded, setExpanded] = useState(false)
  const [draftNote, setDraftNote] = useState(todo.note || '')

  const handleSave = () => {
    setEditing(false)
    if (draft.trim() !== todo.text) {
      onUpdate({ text: draft.trim() })
    }
  }

  const handleSaveNote = () => {
    if (draftNote.trim() !== (todo.note || '')) {
      onUpdate({ note: draftNote.trim() })
    }
  }

  const deepLink = getDeepLinkTarget(todo.text)
  const pastDue = !todo.done && isPastDue(todo.dueDate);

  // ── Board (card) layout — mirrors BookingsKanban's BookingCardContent ──
  if (isBoard) {
    return (
      <div className={`relative group bg-bg-card border border-border/50 rounded-[var(--radius-md)] p-3 transition-all duration-200 hover:border-accent/40 ${todo.done ? 'opacity-60' : ''} ${isReadOnly ? '' : 'cursor-default'}`}>
        <div className="flex items-start gap-2">
          {/* Drag handle — left side to avoid overlapping absolute top-right delete button */}
          {canDrag && !isReadOnly && (
            <div
              {...dragAttributes}
              {...dragListeners}
              className="cursor-grab hover:text-accent text-border transition-colors shrink-0 mt-0.5"
              title="Drag to reorder"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
                <circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
              </svg>
            </div>
          )}

          {/* Checkbox */}
          <button
            onClick={() => !isReadOnly && onToggle()}
            className={`flex-shrink-0 w-[16px] h-[16px] mt-0.5 rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center
              ${todo.done ? 'bg-success border-success text-white animate-check-pop' : 'border-border-strong hover:border-accent'}
              ${isReadOnly ? 'cursor-default opacity-80' : ''}`}
          >
            {todo.done && (
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Task text */}
          <span className={`text-[13px] font-medium leading-snug flex-1 transition-all duration-200
            ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
            {todo.text}
          </span>
        </div>

        {/* Footer: only rendered when there's something to show */}
        {(todo.dueDate || todo.assigneeId) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            {todo.dueDate ? (
              <span className={`text-[11px] ${pastDue ? 'text-danger font-medium' : 'text-text-muted'}`}>
                {todo.dueDate}
              </span>
            ) : <span />}
            {todo.assigneeId && (
              <AssigneePill
                value={todo.assigneeId}
                onChange={(v) => onUpdate({ assigneeId: v })}
                tripTravelers={tripTravelers}
                resolveProfile={resolveProfile}
                currentUserProfile={currentUserProfile}
                disabled={isReadOnly}
              />
            )}
          </div>
        )}

        {/* Delete — hover only */}
        {!isReadOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onDelete() }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-danger rounded-[var(--radius-sm)]"
            title="Delete task"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        )}
      </div>
    )
  }

  return (
    // Task 6: duration-200 for smoother fade on completion
    <div className={`flex flex-col group transition-opacity duration-200 ${todo.done ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 py-3">
        {/* Drag Handle */}
        <div className="w-[30px] flex justify-center shrink-0">
          {canDrag && !isReadOnly && !editing && (
            <div
              {...dragAttributes}
              {...dragListeners}
              className="cursor-grab hover:text-accent text-border transition-colors flex pt-0.5"
              title="Drag to reorder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle>
                <circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle>
              </svg>
            </div>
          )}
        </div>

        {/* Checkbox */}
        <div className="w-[30px] flex justify-center shrink-0 pt-0.5">
          <button
            onClick={() => !isReadOnly && onToggle()}
            className={`flex-shrink-0 w-[18px] h-[18px] rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center
              ${todo.done
                ? 'bg-success border-success text-white animate-check-pop'
                : 'border-border-strong hover:border-accent'
              } ${isReadOnly ? 'cursor-default opacity-80' : ''}`}
          >
            {todo.done && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {/* Task Text */}
        <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
          {editing ? (
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(todo.text); setEditing(false) } }}
              className="w-full px-2 py-0.5 text-sm font-medium bg-bg-input border border-accent/30 rounded-[var(--radius-sm)] text-text-primary outline-none focus:border-accent"
              autoFocus
            />
          ) : (
            // Task 6: transition-all for smoother line-through + color change
            <span
              onClick={() => { if (!isReadOnly) { setDraft(todo.text); setEditing(true) } }}
              className={`text-[14px] font-medium transition-all duration-200
                ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-b hover:border-accent/30'}
                ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
            >
              {todo.text}
            </span>
          )}

          {/* Task 4: deep-link always hover-only (auto-inferred, so never "explicitly set") */}
          {!editing && deepLink && !todo.done && (
            <button
              onClick={() => onDeepLink(deepLink)}
              className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all opacity-0 group-hover:opacity-100"
              title={`Go to ${deepLink} tab`}
            >
              <svg className="w-3 h-3 transform -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          )}
        </div>

        {/* Task 4: Date — hide when no value, show on hover */}
        <div className={`w-[140px] shrink-0 flex justify-end px-2 transition-opacity duration-150
          ${!todo.dueDate ? 'opacity-0 group-hover:opacity-100' : ''}`}>
          <DatePicker
            value={todo.dueDate}
            onChange={v => onUpdate({ dueDate: v })}
            disabled={isReadOnly}
            placeholder="Set date"
            className={`transition-colors whitespace-nowrap text-sm ${pastDue ? '!text-danger font-medium' : ''}`}
          />
        </div>

        {/* Assignee */}
        <div className="w-[40px] shrink-0 flex justify-center">
          <AssigneePill
            value={todo.assigneeId}
            onChange={(v) => onUpdate({ assigneeId: v })}
            tripTravelers={tripTravelers}
            resolveProfile={resolveProfile}
            currentUserProfile={currentUserProfile}
            disabled={isReadOnly}
          />
        </div>

        {/* Task 4: Notes chevron — hide when no note and not expanded */}
        <div className={`w-[30px] shrink-0 flex justify-center transition-opacity duration-150
          ${!todo.note && !expanded ? 'opacity-0 group-hover:opacity-100' : ''}`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1 text-text-muted hover:text-text-primary transition-colors rounded-[var(--radius-sm)] ${expanded ? 'bg-bg-hover' : ''}`}
            title="Toggle notes"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Actions (Delete) */}
        {!isReadOnly && (
          <div className="w-[40px] shrink-0 flex justify-end pr-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('medium')
                onDelete()
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-danger rounded-[var(--radius-sm)] shrink-0"
              title="Delete task"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="pl-[68px] pr-[40px] pb-4" onClick={e => e.stopPropagation()}>
          {isReadOnly ? (
            <div className="bg-bg-secondary p-3 rounded-[var(--radius-sm)]">
              <p className="text-xs text-text-secondary whitespace-pre-wrap">{todo.note || 'No notes added.'}</p>
            </div>
          ) : (
            <textarea
              value={draftNote}
              onChange={e => setDraftNote(e.target.value)}
              onBlur={handleSaveNote}
              placeholder="Add context, links, or booking details..."
              className="w-full text-xs bg-bg-secondary p-3 rounded-[var(--radius-sm)] border border-transparent focus:border-accent/30 outline-none text-text-primary placeholder:text-text-muted min-h-[70px] resize-y transition-colors"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  )
}

function AddTodoPhaseForm({ phase, onAdd }) {
  const [text, setText] = useState('')
  const [expanded, setExpanded] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd({ text: text.trim(), phase: phase.id })
    setText('')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-[13px] font-medium text-text-muted hover:text-accent transition-colors py-3 flex items-center gap-1.5 w-full text-left px-5"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Add task to {phase.label.split(' & ')[0]}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center py-2 px-5">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="What needs to be done?"
        className="flex-1 px-3 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted outline-none focus:border-accent"
        autoFocus
      />
      <Button type="submit" size="sm">
        Add
      </Button>
      <button type="button" onClick={() => setExpanded(false)} className="text-xs text-text-muted hover:text-text-primary p-2">✕</button>
    </form>
  )
}

function DropPhaseBoard({ phase, children }) {
  const { setNodeRef } = useDroppable({
    id: phase.id,
    data: { type: 'Phase', phase }
  })
  return <div ref={setNodeRef} className="flex-1 w-full">{children}</div>
}

// Board-mode column — mirrors BookingsKanban's KanbanColumn exactly
function BoardPhaseColumn({ phase, index, phaseTodos, canDrag, isReadOnly, dispatch, handleToggle, handleDeepLink, resolveProfile, tripTravelers, currentUserProfile }) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.id, data: { type: 'Phase', phase } })
  const phaseDone = phaseTodos.filter(t => t.done).length
  const phaseTotal = phaseTodos.length

  return (
    <div ref={setNodeRef} className={`flex flex-col flex-shrink-0 w-72 bg-bg-secondary/20 border rounded-[var(--radius-lg)] p-2 transition-colors ${isOver ? 'border-accent/50 bg-accent/5' : 'border-border/50'}`}>
      {/* Column header — identical structure to BookingsKanban KanbanColumn */}
      <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/30">
        <h3 className="font-semibold text-sm text-text-primary">
          {phase.label.split(' & ')[0]}
        </h3>
        <span className="text-xs font-medium text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border/50">
          {phaseDone}/{phaseTotal}
        </span>
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] scrollbar-hide">
        <SortableContext id={phase.id} items={phaseTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {phaseTodos.map(todo => (
            <SortableTodoItem
              key={todo.id}
              todo={todo}
              isBoard={true}
              onToggle={() => handleToggle(todo.id)}
              onUpdate={(updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
              onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
              onDeepLink={handleDeepLink}
              resolveProfile={resolveProfile}
              tripTravelers={tripTravelers}
              currentUserProfile={currentUserProfile}
              isReadOnly={isReadOnly}
              canDrag={canDrag}
            />
          ))}
        </SortableContext>
        {phaseTodos.length === 0 && (
          <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// Task 3: Global Quick Add bar — persistent, always above phase groups
function QuickAddBar({ dispatch, isReadOnly }) {
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('planning')

  const handleAdd = () => {
    if (!text.trim()) return
    dispatch({ type: ACTIONS.ADD_TODO, payload: { text: text.trim(), phase } })
    setText('')
    triggerHaptic('light')
  }

  if (isReadOnly) return null

  return (
    <div className="flex items-center gap-3 bg-bg-card border border-border rounded-[var(--radius-md)] px-4 py-2.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
        <path d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder="Quick add a task... (e.g. 'Book flights to Rio')"
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none min-w-0"
      />
      <select
        value={phase}
        onChange={e => setPhase(e.target.value)}
        className="text-xs bg-bg-secondary border border-border rounded-[var(--radius-sm)] px-2 py-1 text-text-secondary outline-none focus:border-accent shrink-0 cursor-pointer"
      >
        {TODO_PHASES.map((p, i) => (
          <option key={p.id} value={p.id}>{i + 1}. {p.label.split(' ')[0]}</option>
        ))}
      </select>
      <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>Add</Button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   TodoPhaseGroup — Task 2: accepts viewMode for board layout
───────────────────────────────────────────────────────────── */
function TodoPhaseGroup({
  phase,
  index,
  phaseTodos,
  canDrag,
  isReadOnly,
  dispatch,
  handleToggle,
  handleDeepLink,
  resolveProfile,
  tripTravelers,
  currentUserProfile,
  viewMode,
}) {
  const [expanded, setExpanded] = useState(true)
  const phaseDone = phaseTodos.filter(t => t.done).length
  const phaseTotal = phaseTodos.length
  const progressPercent = phaseTotal > 0 ? (phaseDone / phaseTotal) * 100 : 0
  const isBoard = viewMode === 'board'

  // Board mode: delegate entirely to BoardPhaseColumn
  if (isBoard) {
    return (
      <BoardPhaseColumn
        phase={phase}
        index={index}
        phaseTodos={phaseTodos}
        canDrag={canDrag}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
        handleToggle={handleToggle}
        handleDeepLink={handleDeepLink}
        resolveProfile={resolveProfile}
        tripTravelers={tripTravelers}
        currentUserProfile={currentUserProfile}
      />
    )
  }

  // List mode: original table layout
  return (
    <div className="mb-8 animate-fade-in">
      {/* Group Header */}
      <div className="group/phase relative flex items-center justify-between py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="text-text-muted opacity-0 hover:opacity-100 transition-opacity mr-2 select-none">⠿</div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center bg-bg-card border border-border rounded"
          >
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>
          <div className="flex flex-col ml-2">
            <h3 className={`font-heading text-lg font-bold leading-tight flex items-center gap-2 ${phase.textClass}`}>
              <span>{index + 1}.</span> {phase.label}
            </h3>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-0.5">{phase.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-col items-end min-w-[140px]">
          <span className="text-[10px] font-bold text-text-muted tracking-wider mb-1.5 uppercase">
            {phaseDone}/{phaseTotal} Completed
          </span>
          <div className="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden border border-border/30">
            <div
              className={`h-full ${phase.color} transition-all duration-500 ease-out`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <Card className="p-0 overflow-hidden border border-border/50">
          <DropPhaseBoard phase={phase}>
            <div className="flex items-center gap-2 px-0 py-2 border-b border-border/40 bg-bg-secondary/10">
              <div className="w-[30px] shrink-0"></div>
              <div className="w-[30px] shrink-0"></div>
              <div className="flex-1 px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">TASK</div>
              <div className="w-[140px] text-right px-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">DUE DATE</div>
              <div className="w-[40px] text-center text-[10px] font-bold uppercase tracking-widest text-text-muted">WHO</div>
              <div className="w-[30px]"></div>
              {!isReadOnly && <div className="w-[40px]"></div>}
            </div>

            <SortableContext items={phaseTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-border/30 h-full flex flex-col">
                {phaseTodos.length === 0 ? (
                  <div className="py-8 text-center text-sm font-medium text-text-muted bg-bg-secondary/20 italic">
                    No tasks in this phase yet.
                  </div>
                ) : (
                  phaseTodos.map(todo => (
                    <SortableTodoItem
                      key={todo.id}
                      todo={todo}
                      onToggle={() => handleToggle(todo.id)}
                      onUpdate={(updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
                      onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
                      onDeepLink={handleDeepLink}
                      resolveProfile={resolveProfile}
                      tripTravelers={tripTravelers}
                      currentUserProfile={currentUserProfile}
                      isReadOnly={isReadOnly}
                      canDrag={canDrag}
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DropPhaseBoard>

          {!isReadOnly && (
            <div className="border-t border-border/30 bg-accent/[0.02]">
              <AddTodoPhaseForm
                phase={phase}
                onAdd={data => dispatch({ type: ACTIONS.ADD_TODO, payload: data })}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default function TodoTab() {
  const { activeTrip, dispatch, showToast, isReadOnly } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [filter, setFilter] = useState('all') // 'all' or 'mine'
  const [hideCompleted, setHideCompleted] = useState(false)
  const [celebration, setCelebration] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  // Task 1: view mode state
  const [viewMode, setViewMode] = useState('list') // 'list' | 'board'
  // Active drag item for DragOverlay — must be declared before early return
  const [activeTodo, setActiveTodo] = useState(null)

  if (!activeTrip) return null
  const trip = activeTrip
  const todos = trip.todos || []
  const travelers = useTripTravelers()
  const tripTravelers = travelers.map(t => t.id)

  // Ensure tasks without matching phase fall into Planning
  const safeTodos = todos.map(t => {
    const p = t.phase || t.category || 'planning'
    const phaseExists = TODO_PHASES.some(phase => phase.id === p)
    return { ...t, phase: phaseExists ? p : 'planning' }
  })

  const filteredTodos = useMemo(() => {
    let result = safeTodos;
    if (filter === 'mine') {
      result = result.filter(t => t.assigneeId === currentUserProfile?.id)
    }
    if (hideCompleted) {
      result = result.filter(t => !t.done)
    }
    return result
  }, [safeTodos, filter, hideCompleted, currentUserProfile])

  const grouped = useMemo(() => {
    const groups = {}
    TODO_PHASES.forEach(p => { groups[p.id] = [] })
    filteredTodos.forEach(todo => {
      groups[todo.phase].push(todo)
    })
    return groups
  }, [filteredTodos])

  const completedCount = safeTodos.filter(t => t.done).length
  const totalCount = safeTodos.length

  const handleToggle = useCallback((todoId) => {
    triggerHaptic('light')
    dispatch({ type: ACTIONS.TOGGLE_TODO, payload: todoId })
    const todo = todos.find(t => t.id === todoId)
    if (todo && !todo.done) {
      if (completedCount + 1 === totalCount && totalCount > 0) {
        setCelebration(c => c + 1)
        showToast("You're all set! Have an amazing trip 🌟")
      }
    }
  }, [dispatch, todos, completedCount, totalCount, showToast])

  const handleDeepLink = (targetTab) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: targetTab })
  }

  const handleGenerateChecklist = async () => {
    if (isGenerating) return;
    setIsGenerating(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("No auth token")

      const res = await fetch('/api/generate-checklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tripName: trip.name,
          destinations: trip.destinations,
          startDate: trip.startDate,
          endDate: trip.endDate
        })
      })
      if (!res.ok) throw new Error('API failed')

      const data = await res.json()
      if (data.todos) {
        data.todos.forEach(t => {
          dispatch({ type: ACTIONS.ADD_TODO, payload: { text: t.text, phase: t.category || 'planning', note: t.note } })
        })
        showToast('Checklist generated successfully! ✨')
      }
    } catch (err) {
      console.error(err)
      showToast('Wanda failed to generate checklist.')
    } finally {
      setIsGenerating(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const canDrag = filter === 'all' && !hideCompleted;

  const handleDragStart = (event) => {
    const todo = todos.find(t => t.id === event.active.id)
    setActiveTodo(todo || null)
  }

  const handleDragEnd = (event) => {
    setActiveTodo(null)
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const todoId = active.id;
    const activeTodoData = active.data.current?.todo;
    if (!activeTodoData) return;

    const currentPhase = activeTodoData.phase;

    // Use sortable.containerId when dropping on a card (item inside SortableContext),
    // fall back to over.id when dropping directly on the column droppable.
    // This mirrors BookingsKanban's exact pattern.
    const targetPhaseId = over.data?.current?.sortable?.containerId || over.id;

    // Guard: target must be a valid phase
    if (!TODO_PHASES.find(p => p.id === targetPhaseId)) return;

    let newTodos = [...todos];
    const activeIndex = newTodos.findIndex(t => t.id === todoId);
    if (activeIndex < 0) return;

    if (currentPhase === targetPhaseId) {
      // Same column — reorder within phase
      const overIndex = newTodos.findIndex(t => t.id === over.id);
      if (overIndex < 0) return;
      const [moved] = newTodos.splice(activeIndex, 1);
      // Adjust for the splice shifting indices
      const insertAt = activeIndex < overIndex ? overIndex - 1 : overIndex;
      newTodos.splice(insertAt, 0, moved);
    } else {
      // Cross-column — change phase, insert before target item or append
      const [moved] = newTodos.splice(activeIndex, 1);
      moved.phase = targetPhaseId;
      if (over.data?.current?.sortable) {
        const overIndex = newTodos.findIndex(t => t.id === over.id);
        newTodos.splice(overIndex >= 0 ? overIndex : newTodos.length, 0, moved);
      } else {
        newTodos.push(moved);
      }
    }

    dispatch({ type: ACTIONS.SET_TODOS, payload: newTodos });
    triggerHaptic('light');
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 w-full">
      <CelebrationEffect trigger={celebration} />

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">✅ Trip Tasks</h1>
          <p className="text-sm text-text-secondary mt-1">Keep track of what needs to be done, and who is doing it.</p>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3">
          {/* Task 1: List / Board view toggle — DS pill pattern */}
          <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5
                ${viewMode === 'list' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5
                ${viewMode === 'board' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
              </svg>
              Board
            </button>
          </div>

          {/* Hide Completed toggle */}
          <button
            onClick={() => setHideCompleted(prev => !prev)}
            className={`text-xs font-medium px-2 py-1 rounded-[var(--radius-sm)] border transition-colors flex items-center gap-1.5 ${hideCompleted ? 'bg-bg-card border-border text-text-primary' : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-secondary'}`}
          >
            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${hideCompleted ? 'bg-accent border-accent text-white' : 'border-text-muted'}`}>
              {hideCompleted && <svg viewBox="0 0 14 14" fill="none" className="w-2.5 h-2.5"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            Hide Completed
          </button>

          {/* All Tasks / My Tasks toggle */}
          <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${filter === 'all' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all flex items-center justify-center gap-1.5 ${filter === 'mine' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            >
              {currentUserProfile && (
                <AvatarCircle profile={currentUserProfile} size={14} />
              )}
              My Tasks
            </button>
          </div>
        </div>
      </div>

      {/* Task 3: Global Quick Add Bar — always visible */}
      <QuickAddBar dispatch={dispatch} isReadOnly={isReadOnly} />

      {/* Task 5: Slim Wanda banner — replaces the full-screen empty-state card.
          Phases are always visible below so users see the structure immediately. */}
      {safeTodos.length === 0 && !isReadOnly && filter === 'all' && (
        <div className="flex items-center gap-4 bg-bg-card border border-border rounded-[var(--radius-md)] px-5 py-3.5">
          <div className="w-9 h-9 bg-accent/10 rounded-full flex items-center justify-center text-base border border-accent/20 shrink-0">✨</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary leading-snug">Don't know where to start?</p>
            <p className="text-xs text-text-secondary leading-snug">Let Wanda generate a smart, personalized checklist based on your destination.</p>
          </div>
          <Button onClick={handleGenerateChecklist} disabled={isGenerating} size="sm" className="shrink-0">
            {isGenerating ? 'Thinking...' : 'Generate with Wanda'}
          </Button>
        </div>
      )}

      {/* Phase Groups — Task 2: horizontal scroll container in board mode */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        modifiers={[snapCursorToTopLeft]}
        onDragStart={canDrag && !isReadOnly ? handleDragStart : undefined}
        onDragEnd={handleDragEnd}
      >
        <div className={viewMode === 'board'
          ? 'flex gap-4 overflow-x-auto pb-4 scrollbar-thin items-start h-[calc(100vh-320px)] min-h-[400px]'
          : 'space-y-4'
        }>
          {TODO_PHASES.map((phase, index) => (
            <TodoPhaseGroup
              key={phase.id}
              phase={phase}
              index={index}
              phaseTodos={grouped[phase.id]}
              canDrag={canDrag}
              isReadOnly={isReadOnly}
              dispatch={dispatch}
              handleToggle={handleToggle}
              handleDeepLink={handleDeepLink}
              resolveProfile={resolveProfile}
              tripTravelers={tripTravelers}
              currentUserProfile={currentUserProfile}
              viewMode={viewMode}
            />
          ))}
        </div>

        {/* Drag overlay — board mode only; omitting it in list mode lets dnd-kit
            apply live pointer transforms to the dragging item itself */}
        {viewMode === 'board' && <DragOverlay>
          {activeTodo ? (
            <div className="w-72 rotate-1 opacity-95">
              <TodoItem
                todo={activeTodo}
                isBoard={true}
                onToggle={() => {}}
                onUpdate={() => {}}
                onDelete={() => {}}
                onDeepLink={() => {}}
                resolveProfile={resolveProfile}
                tripTravelers={tripTravelers}
                currentUserProfile={currentUserProfile}
                isReadOnly={true}
                canDrag={false}
              />
            </div>
          ) : null}
        </DragOverlay>}
      </DndContext>
    </div>
  )
}
