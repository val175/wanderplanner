import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Card from '../shared/Card'
import CelebrationEffect from '../shared/CelebrationEffect'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { TODO_PHASES } from '../../constants/tabs'
import AvatarCircle from '../shared/AvatarCircle'

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

function TodoItem({ todo, onToggle, onUpdate, onDelete, onDeepLink, resolveProfile, tripTravelers, currentUserProfile }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)

  const handleSave = () => {
    setEditing(false)
    if (draft.trim() !== todo.text) {
      onUpdate({ text: draft.trim() })
    }
  }

  const deepLink = getDeepLinkTarget(todo.text)

  return (
    <div className={`flex items-center gap-3 py-3 group transition-opacity ${todo.done ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-[18px] h-[18px] rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center
          ${todo.done
            ? 'bg-success border-success text-white animate-check-pop'
            : 'border-border-strong hover:border-accent'
          }`}
      >
        {todo.done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-2">
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
            onClick={() => { setDraft(todo.text); setEditing(true) }}
            className={`text-sm font-medium cursor-pointer hover:border-b hover:border-accent/30 transition-colors
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

      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          className="text-text-muted hover:text-danger text-xs flex-shrink-0"
          title="Delete task"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>

      <div className="flex items-center">
        <AssigneePill
          value={todo.assigneeId}
          onChange={(v) => onUpdate({ assigneeId: v })}
          tripTravelers={tripTravelers}
          resolveProfile={resolveProfile}
          currentUserProfile={currentUserProfile}
        />
      </div>
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
        className="text-[13px] font-medium text-text-muted hover:text-accent transition-colors py-2 flex items-center gap-1.5 w-full text-left"
      >
        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Add task to {phase.label.split(' ')[0]}
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center py-1 mt-2">
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

export default function TodoTab() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [filter, setFilter] = useState('all') // 'all' or 'mine'
  const [celebration, setCelebration] = useState(0)

  if (!activeTrip) return null
  const trip = activeTrip
  const todos = trip.todos || []
  const tripTravelers = trip.travelerIds || []

  // Ensure tasks without matching phase fall into Planning
  const safeTodos = todos.map(t => {
    const p = t.phase || t.category || 'planning'
    const phaseExists = TODO_PHASES.some(phase => phase.id === p)
    return { ...t, phase: phaseExists ? p : 'planning' }
  })

  const filteredTodos = useMemo(() => {
    if (filter === 'mine') {
      return safeTodos.filter(t => t.assigneeId === currentUserProfile?.id)
    }
    return safeTodos
  }, [safeTodos, filter, currentUserProfile])

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

  return (
    <div className="space-y-6 animate-fade-in pb-12 w-full">
      <CelebrationEffect trigger={celebration} />

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">Trip Tasks</h1>
          <p className="text-sm text-text-secondary mt-1">Keep track of what needs to be done, and who is doing it.</p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg bg-bg-secondary p-1 shrink-0 w-full sm:w-auto border border-border">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 sm:px-5 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-bg-card border border-border text-text-primary' : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
          >
            All Tasks
          </button>
          <button
            onClick={() => setFilter('mine')}
            className={`flex-1 sm:px-5 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${filter === 'mine' ? 'bg-bg-card border border-border text-text-primary' : 'text-text-muted hover:text-text-secondary border border-transparent'}`}
          >
            {currentUserProfile && (
              <AvatarCircle profile={currentUserProfile} size={16} />
            )}
            My Tasks
          </button>
        </div>
      </div>

      {/* Phase Boards */}
      <div className="space-y-6">
        {TODO_PHASES.map((phase, index) => {
          const phaseTodos = grouped[phase.id]
          const phaseDone = phaseTodos.filter(t => t.done).length
          const phaseTotal = phaseTodos.length
          const progressPercent = phaseTotal > 0 ? (phaseDone / phaseTotal) * 100 : 0

          return (
            <Card key={phase.id} className="p-0 overflow-hidden border border-border">
              <div className="p-5 sm:p-6">
                {/* Board Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className={`font-heading text-lg font-bold leading-tight flex items-center gap-2 ${phase.textClass}`}>
                      <span>{index + 1}.</span> {phase.label}
                    </h3>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-text-muted mt-1">{phase.subtitle}</p>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex flex-col items-start sm:items-end w-full sm:w-auto min-w-[140px]">
                    <span className="text-[10px] font-bold text-text-muted tracking-wider mb-1.5 uppercase">
                      {phaseDone}/{phaseTotal} Completed
                    </span>
                    <div className="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${phase.color} transition-all duration-500 ease-out`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Task List */}
                <div className="divide-y divide-border/30 mb-2">
                  {phaseTodos.length === 0 ? (
                    <div className="py-6 text-center text-sm font-medium text-text-muted bg-bg-secondary/30 rounded-lg">
                      No tasks in this phase yet.
                    </div>
                  ) : (
                    phaseTodos.map(todo => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={() => handleToggle(todo.id)}
                        onUpdate={(updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
                        onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
                        onDeepLink={handleDeepLink}
                        resolveProfile={resolveProfile}
                        tripTravelers={tripTravelers}
                        currentUserProfile={currentUserProfile}
                      />
                    ))
                  )}
                </div>

                <AddTodoPhaseForm
                  phase={phase}
                  onAdd={data => dispatch({ type: ACTIONS.ADD_TODO, payload: data })}
                />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
