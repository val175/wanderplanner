import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
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
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TodoItem {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  )
}

function TodoItem({ todo, onToggle, onUpdate, onDelete, onDeepLink, resolveProfile, tripTravelers, currentUserProfile, isReadOnly, dragAttributes, dragListeners, canDrag }) {
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

  return (
    <div className={`flex flex-col group transition-opacity ${todo.done ? 'opacity-60' : ''}`}>
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
            <span
              onClick={() => { if (!isReadOnly) { setDraft(todo.text); setEditing(true) } }}
              className={`text-[14px] font-medium transition-colors
                ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:border-b hover:border-accent/30'}
                ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
            >
              {todo.text}
            </span>
          )}

          {!editing && deepLink && !todo.done && (
            <button
              onClick={() => onDeepLink(deepLink)}
              className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-colors group/link"
              title={`Go to ${deepLink} tab`}
            >
              <svg className="w-3 h-3 transform -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          )}
        </div>

        {/* Date */}
        <div className="w-[140px] shrink-0 flex justify-end px-2">
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

        {/* Notes Toggle */}
        <div className="w-[30px] shrink-0 flex justify-center">
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
        Add task to {phase.label.split(' ')[0]}
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

/* ─────────────────────────────────────────────────────────────
   TodoPhaseGroup — Outside header with accordion behavior
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
  currentUserProfile
}) {
  const [expanded, setExpanded] = useState(true)
  const phaseDone = phaseTodos.filter(t => t.done).length
  const phaseTotal = phaseTodos.length
  const progressPercent = phaseTotal > 0 ? (phaseDone / phaseTotal) * 100 : 0

  return (
    <div className="mb-8 animate-fade-in">
      {/* Group Header (matching Itinerary style) */}
      <div className="group/phase relative flex items-center justify-between py-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Drag handle placeholder (if we ever want to reorder phases) */}
          <div className="text-text-muted opacity-0 hover:opacity-100 transition-opacity mr-2 select-none">⠿</div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center shadow-sm bg-bg-card border border-border rounded"
          >
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>

          <div className="flex flex-col ml-2">
            <div className="flex items-center gap-2">
              <h3 className={`font-heading text-lg font-bold leading-tight flex items-center gap-2 ${phase.textClass}`}>
                <span>{index + 1}.</span> {phase.label}
              </h3>
            </div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-0.5">{phase.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Progress Indicator */}
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
      </div>

      {expanded && (
        <Card className="p-0 overflow-hidden border border-border/50 shadow-sm">
          <DropPhaseBoard phase={phase}>
            {/* Table Header (visual only, for alignment) */}
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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const overIsTask = over.data.current?.type === 'Todo';
    const overIsPhase = over.data.current?.type === 'Phase';

    let newPhase = null;
    if (overIsPhase) {
      newPhase = over.data.current.phase.id;
    } else if (overIsTask) {
      newPhase = over.data.current.todo.phase;
    }
    if (!newPhase) return;

    let newTodos = [...todos];
    const oldIndex = newTodos.findIndex(t => t.id === activeId);
    if (oldIndex < 0) return;

    let targetIndex = -1;
    if (overIsTask) {
      targetIndex = newTodos.findIndex(t => t.id === overId);
    }

    const [moved] = newTodos.splice(oldIndex, 1);
    moved.phase = newPhase;

    if (targetIndex >= 0) {
      newTodos.splice(targetIndex, 0, moved);
    } else {
      newTodos.push(moved);
    }

    dispatch({ type: ACTIONS.SET_TODOS, payload: newTodos });
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

        {/* View Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHideCompleted(prev => !prev)}
            className={`text-xs font-medium px-2 py-1 rounded-[var(--radius-sm)] border transition-colors flex items-center gap-1.5 ${hideCompleted ? 'bg-bg-card border-border shadow-sm text-text-primary' : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-secondary'}`}
          >
            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${hideCompleted ? 'bg-accent border-accent text-white' : 'border-text-muted'}`}>
              {hideCompleted && <svg viewBox="0 0 14 14" fill="none" className="w-2.5 h-2.5"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </div>
            Hide Completed
          </button>

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

      {safeTodos.length === 0 && !isReadOnly && filter === 'all' && (
        <div className="bg-bg-card border border-border rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center shadow-sm">
          <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-xl mb-3 border border-accent/20">✨</div>
          <h3 className="font-heading text-lg font-bold text-text-primary mb-2">Start Your Checklist</h3>
          <p className="text-sm text-text-secondary mb-5 max-w-sm mx-auto leading-relaxed">Not sure where to begin? Ask Wanda to generate a smart, personalized checklist for your trip.</p>
          <Button onClick={handleGenerateChecklist} disabled={isGenerating}>
            {isGenerating ? 'Wanda is thinking...' : 'Ask Wanda for a checklist'}
          </Button>
        </div>
      )}

      {/* Phase Groups */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
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
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

