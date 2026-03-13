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
import { TODO_STATUSES } from '../../constants/tabs'
import AvatarCircle from '../shared/AvatarCircle'
import DatePicker from '../shared/DatePicker'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import { formatDate } from '../../utils/helpers'
import { auth } from '../../firebase/config'
import TabHeader from '../common/TabHeader'
import Modal from '../shared/Modal'
import Select, { SelectItem } from '../shared/Select'
import TodoDrawer from './TodoDrawer'

function AddTodoModal({ isOpen, onClose, onAdd, travelers, statuses }) {
  const [todoData, setTodoData] = useState({
    text: '',
    assigneeId: 'unassigned',
    dueDate: '',
    status: statuses[0]?.id || 'not_started'
  })

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setTodoData({
        text: '',
        assigneeId: 'unassigned',
        dueDate: '',
        status: statuses[0]?.id || 'not_started'
      })
    }
  }, [isOpen, statuses])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!todoData.text.trim()) return
    onAdd({
      text: todoData.text.trim(),
      assigneeId: todoData.assigneeId === 'unassigned' ? null : todoData.assigneeId,
      dueDate: todoData.dueDate || '',
      status: todoData.status,
      done: todoData.status === 'done'
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✅ Create New Task">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Task Description</label>
          <input
            value={todoData.text}
            onChange={e => setTodoData(prev => ({ ...prev, text: e.target.value }))}
            placeholder="e.g. Apply for Schengen Visa"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Assignee</label>
            <Select value={todoData.assigneeId} onValueChange={v => setTodoData(prev => ({ ...prev, assigneeId: v }))}>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {travelers.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Status</label>
            <Select value={todoData.status} onValueChange={v => setTodoData(prev => ({ ...prev, status: v }))}>
              <SelectItem value="not_started">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-text-muted/60" />
                  Not Started
                </span>
              </SelectItem>
              <SelectItem value="in_progress">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="done">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  Done ✅
                </span>
              </SelectItem>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Due Date (Optional)</label>
          <DatePicker
            value={todoData.dueDate}
            onChange={v => setTodoData(prev => ({ ...prev, dueDate: v }))}
            placeholder="Set date"
          />
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!todoData.text.trim()}>
            Create Task
          </Button>
        </div>
      </div>
    </Modal>
  )
}

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

const TODO_STATUS_ORDER = ['not_started', 'in_progress', 'done']
const getTodoStatus = (todo) => todo.status || (todo.done ? 'done' : 'not_started')

function TodoStatusSelect({ value, onChange, disabled }) {
  const current = TODO_STATUSES.find(s => s.id === value) || TODO_STATUSES[0]

  return (
    <Select
      value={value}
      onValueChange={v => { triggerHaptic('light'); onChange(v) }}
      disabled={disabled}
      className={`text-left min-h-[44px] sm:min-h-0 text-[14px] sm:text-xs font-semibold ${current.colors}`}
    >
      <SelectItem value="not_started">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-text-muted/60" />
          Not Started
        </span>
      </SelectItem>
      <SelectItem value="in_progress">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-warning" />
          In Progress
        </span>
      </SelectItem>
      <SelectItem value="done">
        <span className="inline-flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success" />
          Done ✅
        </span>
      </SelectItem>
    </Select>
  )
}

function TodoStatusBadge({ value }) {
  const current = TODO_STATUSES.find(s => s.id === value) || TODO_STATUSES[0]
  const label = value === 'done' ? `${current.label} ✅` : current.label
  return (
    <span className={`inline-flex items-center text-xs font-semibold rounded-[var(--radius-sm)] border px-2 py-1 ${current.colors}`}>
      {label}
    </span>
  )
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
      displayNode = (
        <div className="flex items-center gap-1.5">
          <AvatarCircle profile={p} size={22} />
          <span className="text-[12px] text-text-secondary truncate max-w-[65px]">{p.name?.split(' ')[0]}</span>
        </div>
      )
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
        className="inline-flex items-center rounded-full transition-all focus:outline-none"
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
function TodoItem({ todo, onToggle, onUpdate, onDelete, onDeepLink, resolveProfile, tripTravelers, currentUserProfile, isReadOnly, dragAttributes, dragListeners, canDrag, isBoard, onStatusChange, onClick }) {
  const deepLink = getDeepLinkTarget(todo.text)
  const status = getTodoStatus(todo)
  const pastDue = status !== 'done' && isPastDue(todo.dueDate);

  if (isBoard) {
    return (
      <div 
        onClick={onClick}
        className={`relative group bg-bg-card border border-border rounded-[var(--radius-md)] p-3 transition-all duration-200 hover:border-accent/40 ${status === 'done' ? 'opacity-60' : ''} cursor-pointer`}
      >
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          {canDrag && !isReadOnly && (
            <div
              {...dragAttributes}
              {...dragListeners}
              onClick={e => e.stopPropagation()}
              className="cursor-grab hover:text-accent text-border transition-colors shrink-0 mt-0.5"
              title="Drag to reorder"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="5" r="1.5" /><circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>
          )}

          {/* Status badge */}
          <TodoStatusBadge value={status} />

          {/* Task text */}
          <span className={`text-[13px] font-medium leading-snug flex-1 transition-all duration-200
            ${status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}>
            {todo.text}
          </span>
        </div>

        {/* Footer */}
        {(todo.dueDate || todo.assigneeId) && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            {todo.dueDate ? (
              <span className={`text-[11px] ${pastDue ? 'text-danger font-medium' : 'text-text-muted'}`}>
                {formatDate(todo.dueDate)}
              </span>
            ) : <span />}
            {todo.assigneeId && (
              <div onClick={e => e.stopPropagation()}>
                <AssigneePill
                  value={todo.assigneeId}
                  onChange={(v) => onUpdate({ assigneeId: v })}
                  tripTravelers={tripTravelers}
                  resolveProfile={resolveProfile}
                  currentUserProfile={currentUserProfile}
                  disabled={isReadOnly}
                />
              </div>
            )}
          </div>
        )}

        {/* Delete — hover only */}
        {!isReadOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onDelete() }}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out p-1 text-text-muted hover:text-danger rounded-[var(--radius-sm)]"
            title="Delete task"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          </button>
        )}
      </div>
    )
  }

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col group transition-opacity duration-200 ${status === 'done' ? 'opacity-60' : ''} cursor-pointer hover:bg-bg-hover/50`}
    >
      <div className="flex items-center gap-2 py-3">
        {/* Task */}
        <div className="flex-1 min-w-0 flex items-center gap-2 px-2">
          {canDrag && !isReadOnly && (
            <div
              {...dragAttributes}
              {...dragListeners}
              onClick={e => e.stopPropagation()}
              className="cursor-grab hover:text-accent text-border transition-colors flex pt-0.5"
              title="Drag to reorder"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="12" r="1.5"></circle><circle cx="9" cy="5" r="1.5"></circle><circle cx="9" cy="19" r="1.5"></circle>
                <circle cx="15" cy="12" r="1.5"></circle><circle cx="15" cy="5" r="1.5"></circle><circle cx="15" cy="19" r="1.5"></circle>
              </svg>
            </div>
          )}
          <span
            className={`text-[14px] font-medium transition-all duration-200
              ${status === 'done' ? 'line-through text-text-muted' : 'text-text-primary'}`}
          >
            {todo.text}
          </span>

          {!isReadOnly && deepLink && status !== 'done' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeepLink(deepLink) }}
              className="hidden sm:flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white transition-all scale-90 group-hover:scale-100 blur-sm group-hover:blur-none opacity-0 group-hover:opacity-100 duration-150 ease-out"
              title={`Go to ${deepLink} tab`}
            >
              <svg className="w-3 h-3 transform -rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          )}
        </div>

        {/* Status */}
        <div className="w-[140px] flex justify-start shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
          <TodoStatusSelect
            value={status}
            onChange={next => (onStatusChange ? onStatusChange(next) : onUpdate({ status: next, done: next === 'done' }))}
            disabled={isReadOnly}
          />
        </div>

        {/* Date */}
        <div className={`w-[140px] shrink-0 flex justify-start px-2 transition-opacity duration-150
          ${!todo.dueDate ? 'opacity-0 group-hover:opacity-100' : ''}`} onClick={e => e.stopPropagation()}>
          <DatePicker
            value={todo.dueDate}
            onChange={v => onUpdate({ dueDate: v })}
            disabled={isReadOnly}
            placeholder="Set date"
            className={`transition-colors whitespace-nowrap text-sm ${pastDue ? '!text-danger font-medium' : ''}`}
          />
        </div>

        {/* Assignee */}
        <div className="w-[100px] shrink-0 flex justify-center" onClick={e => e.stopPropagation()}>
          <AssigneePill
            value={todo.assigneeId}
            onChange={(v) => onUpdate({ assigneeId: v })}
            tripTravelers={tripTravelers}
            resolveProfile={resolveProfile}
            currentUserProfile={currentUserProfile}
            disabled={isReadOnly}
          />
        </div>

        {/* No chevron needed anymore */}
        <div className="w-[30px] shrink-0"></div>

        {/* Actions (Delete) */}
        {!isReadOnly && (
          <div className="w-[40px] shrink-0 flex justify-end pr-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic('medium')
                onDelete()
              }}
              className="opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out p-1 text-text-muted hover:text-danger rounded-[var(--radius-sm)] shrink-0"
              title="Delete task"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


// Board-mode column — mirrors BookingsKanban's KanbanColumn exactly
function BoardStatusColumn({ status, index, statusTodos, canDrag, isReadOnly, dispatch, handleToggle, handleStatusChange, handleDeepLink, resolveProfile, tripTravelers, currentUserProfile }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id, data: { type: 'Status', status } })

  return (
    <div ref={setNodeRef} className={`flex flex-col flex-shrink-0 w-72 bg-bg-secondary/20 border rounded-[var(--radius-lg)] p-2 transition-colors ${isOver ? 'border-accent/50 bg-accent/5' : 'border-border'}`}>
      {/* Column header — identical structure to BookingsKanban KanbanColumn */}
      <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/30">
        <h3 className="font-semibold text-sm text-text-primary">
          {status.label}
        </h3>
        <span className="text-xs text-text-muted">{statusTodos.length}</span>
      </div>

      {/* Scrollable card area */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] scrollbar-hide">
        <SortableContext id={status.id} items={statusTodos.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {statusTodos.map(todo => (
            <SortableTodoItem
              key={todo.id}
              todo={todo}
              isBoard={true}
              onClick={() => handleTodoClick(todo.id)}
              onToggle={() => handleToggle(todo.id)}
              onStatusChange={(next) => handleStatusChange(todo.id, next)}
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
        {statusTodos.length === 0 && (
          <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
            Drop here
          </div>
        )}
      </div>
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
  const [viewMode, setViewMode] = useState('list') // 'list' | 'board'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeTodo, setActiveTodo] = useState(null)
  const [selectedTodoId, setSelectedTodoId] = useState(null)

  if (!activeTrip) return null
  const trip = activeTrip
  const todos = trip.todos || []
  const travelers = useTripTravelers()
  const tripTravelers = travelers.map(t => t.id)

  // Normalize status for legacy todos
  const safeTodos = todos.map(t => {
    const status = getTodoStatus(t)
    const statusExists = TODO_STATUSES.some(s => s.id === status)
    const normalizedStatus = statusExists ? status : 'not_started'
    return { ...t, status: normalizedStatus, done: normalizedStatus === 'done' }
  })

  const filteredTodos = useMemo(() => {
    let result = safeTodos;
    if (filter === 'mine') {
      result = result.filter(t => t.assigneeId === currentUserProfile?.id)
    }
    if (hideCompleted) {
      result = result.filter(t => getTodoStatus(t) !== 'done')
    }
    return result
  }, [safeTodos, filter, hideCompleted, currentUserProfile])

  const grouped = useMemo(() => {
    const groups = {}
    TODO_STATUSES.forEach(s => { groups[s.id] = [] })
    filteredTodos.forEach(todo => {
      const status = getTodoStatus(todo)
      if (!groups[status]) groups[status] = []
      groups[status].push(todo)
    })
    return groups
  }, [filteredTodos])

  const completedCount = safeTodos.filter(t => getTodoStatus(t) === 'done').length
  const totalCount = safeTodos.length

  const handleStatusChange = useCallback((todoId, next) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return
    const current = getTodoStatus(todo)
    dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todoId, updates: { status: next, done: next === 'done' } } })
    if (current !== 'done' && next === 'done') {
      if (completedCount + 1 === totalCount && totalCount > 0) {
        setCelebration(c => c + 1)
        showToast("You're all set! Have an amazing trip 🌟")
      }
    }
  }, [dispatch, todos, completedCount, totalCount, showToast])

  const handleToggle = useCallback((todoId) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return
    const current = getTodoStatus(todo)
    const idx = TODO_STATUS_ORDER.indexOf(current)
    const next = TODO_STATUS_ORDER[(idx + 1) % TODO_STATUS_ORDER.length]
    triggerHaptic('light')
    handleStatusChange(todoId, next)
  }, [todos, handleStatusChange])

  const handleDeepLink = (targetTab) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: targetTab })
  }

  const handleTodoClick = useCallback((todoId) => {
    hapticImpact('medium')
    setSelectedTodoId(todoId)
  }, [])

  const handleGenerateChecklist = async () => {
    if (isGenerating) return;
    setIsGenerating(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("No auth token")

      const res = await fetch('https://wanderplan-rust.vercel.app/api/generate-checklist', {
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
          dispatch({ type: ACTIONS.ADD_TODO, payload: { text: t.text, status: 'not_started', note: t.note } })
        })
        showToast('Checklist generated successfully! 🪄')
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

  const canDrag = viewMode === 'board' && filter === 'all' && !hideCompleted;

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

    const currentStatus = getTodoStatus(activeTodoData)

    // Use sortable.containerId when dropping on a card (item inside SortableContext),
    // fall back to over.id when dropping directly on the column droppable.
    // This mirrors BookingsKanban's exact pattern.
    const targetStatusId = over.data?.current?.sortable?.containerId || over.id;

    // Guard: target must be a valid status
    if (!TODO_STATUSES.find(s => s.id === targetStatusId)) return;

    let newTodos = [...todos];
    const activeIndex = newTodos.findIndex(t => t.id === todoId);
    if (activeIndex < 0) return;

    if (currentStatus === targetStatusId) {
      // Same column — reorder within status
      const overIndex = newTodos.findIndex(t => t.id === over.id);
      if (overIndex < 0) return;
      const [moved] = newTodos.splice(activeIndex, 1);
      // Adjust for the splice shifting indices
      const insertAt = activeIndex < overIndex ? overIndex - 1 : overIndex;
      newTodos.splice(insertAt, 0, moved);
    } else {
      // Cross-column — change status, insert before target item or append
      const [moved] = newTodos.splice(activeIndex, 1);
      moved.status = targetStatusId;
      moved.done = targetStatusId === 'done';
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
    <div className="space-y-6 animate-tab-enter stagger-1 pb-12 w-full">

      <CelebrationEffect trigger={celebration} />

      {/* ── Layer 1: Header ── */}
      <TabHeader
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="w-20 h-1.5 rounded-[var(--radius-pill)] bg-bg-secondary overflow-hidden hidden md:block shrink-0">
              <div
                className="h-full rounded-[var(--radius-pill)] bg-accent transition-all duration-300"
                style={{ width: `${safeTodos.length > 0 ? (safeTodos.filter(t => getTodoStatus(t) === 'done').length / safeTodos.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold font-heading text-text-muted tabular-nums">
              {safeTodos.filter(t => getTodoStatus(t) === 'done').length}/{safeTodos.length} completed
            </span>
          </div>
        }
        rightSlot={
          <>
            <div className="flex-1">
              {/* No category filters for Todo */}
            </div>

            <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
              <button
                onClick={() => setHideCompleted(prev => !prev)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-[var(--radius-sm)] border transition-colors flex items-center gap-1.5 shrink-0 ${hideCompleted ? 'bg-bg-card border-border text-text-primary' : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-secondary'}`}
              >
                <div className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors ${hideCompleted ? 'bg-accent border-accent text-white' : 'border-text-muted'}`}>
                  {hideCompleted && <svg viewBox="0 0 14 14" fill="none" className="w-2 h-2"><path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                Hide Done
              </button>

              <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${filter === 'all' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  Everyone
                </button>
                <button
                  onClick={() => setFilter('mine')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${filter === 'mine' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  Just Me
                </button>
              </div>

              <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'list' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                  List
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'board' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
                  Board
                </button>
              </div>

              <div className="hidden md:block shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGenerateChecklist}
                  disabled={isGenerating}
                  className="shrink-0"
                >
                  {isGenerating ? 'Generating...' : '🪄 Generate with Wanda'}
                </Button>
              </div>

              {!isReadOnly && (
                <div className="hidden md:block shrink-0">
                  <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">
                    ✅ New Task
                  </Button>
                </div>
              )}
            </div>
          </>
        }
      />

      {/* FAB — mobile only */}
      {!isReadOnly && createPortal(
        <button
          onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
          className="fixed bottom-24 right-4 z-40 block md:hidden bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          To Do
        </button>,
        document.body
      )}

      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          modifiers={[snapCursorToTopLeft]}
          onDragStart={canDrag && !isReadOnly ? handleDragStart : undefined}
          onDragEnd={handleDragEnd}
        >
          <div className="animate-tab-enter stagger-2 flex gap-4 overflow-x-auto pb-4 scrollbar-thin items-start h-[calc(100vh-320px)] min-h-[400px]">
            {TODO_STATUSES.map((status, index) => (
              <BoardStatusColumn
                key={status.id}
                status={status}
                index={index}
                statusTodos={grouped[status.id]}
                canDrag={canDrag}
                isReadOnly={isReadOnly}
                dispatch={dispatch}
                handleToggle={handleToggle}
                handleStatusChange={handleStatusChange}
                handleDeepLink={handleDeepLink}
                resolveProfile={resolveProfile}
                tripTravelers={tripTravelers}
                currentUserProfile={currentUserProfile}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTodo ? (
              <div className="w-72 rotate-1 opacity-95">
                <TodoItem
                  todo={activeTodo}
                  isBoard={true}
                  onToggle={() => { }}
                  onUpdate={() => { }}
                  onDelete={() => { }}
                  onDeepLink={() => { }}
                  resolveProfile={resolveProfile}
                  tripTravelers={tripTravelers}
                  currentUserProfile={currentUserProfile}
                  isReadOnly={true}
                  canDrag={false}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card className="overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="flex items-center gap-2 px-0 py-2 border-b border-border/40 bg-bg-secondary/10">
                <div className="flex-1 px-2 text-xs font-bold uppercase tracking-wider text-text-muted">TASK</div>
                <div className="w-[140px] shrink-0 text-xs font-bold uppercase tracking-wider text-text-muted text-left">STATUS</div>
                <div className="w-[140px] text-left px-2 text-xs font-bold uppercase tracking-wider text-text-muted">DUE DATE</div>
                <div className="w-[100px] shrink-0 text-center text-xs font-bold uppercase tracking-wider text-text-muted">ASSIGNED</div>
                <div className="w-[30px]"></div>
                {!isReadOnly && <div className="w-[40px]"></div>}
              </div>

              <div className="divide-y divide-border/30 h-full flex flex-col">
                {filteredTodos.length === 0 ? (
                  <div className="py-10 text-center text-sm font-medium text-text-muted bg-bg-secondary/20 italic">
                    No tasks yet.
                  </div>
                ) : (
                  filteredTodos.map(todo => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onClick={() => handleTodoClick(todo.id)}
                      onToggle={() => handleToggle(todo.id)}
                      onStatusChange={(next) => handleStatusChange(todo.id, next)}
                      onUpdate={(updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
                      onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
                      onDeepLink={handleDeepLink}
                      resolveProfile={resolveProfile}
                      tripTravelers={tripTravelers}
                      currentUserProfile={currentUserProfile}
                      isReadOnly={isReadOnly}
                      canDrag={false}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <AddTodoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={data => dispatch({ type: ACTIONS.ADD_TODO, payload: data })}
        travelers={travelers}
        statuses={TODO_STATUSES}
      />

      {selectedTodoId && (
        <TodoDrawer
          todo={todos.find(t => t.id === selectedTodoId)}
          travelers={tripTravelers}
          onUpdate={(id, updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id, updates } })}
          onAddComment={(todoId, text, actorId) => dispatch({ type: ACTIONS.ADD_TODO_COMMENT, payload: { todoId, text, actorId } })}
          onUpdateComment={(todoId, commentId, text) => dispatch({ type: ACTIONS.UPDATE_TODO_COMMENT, payload: { todoId, commentId, text } })}
          onDeleteComment={(todoId, commentId) => dispatch({ type: ACTIONS.DELETE_TODO_COMMENT, payload: { todoId, commentId } })}
          onClose={() => setSelectedTodoId(null)}
          resolveProfile={resolveProfile}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  )
}
