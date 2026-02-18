import { useState, useMemo, useCallback } from 'react'
import Card from '../shared/Card'
import CelebrationEffect from '../shared/CelebrationEffect'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TODO_CATEGORIES } from '../../constants/tabs'

function TodoItem({ todo, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(todo.text)

  const handleSave = () => {
    setEditing(false)
    if (draft.trim() !== todo.text) {
      onUpdate({ text: draft.trim() })
    }
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 group transition-opacity ${todo.done ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-5 h-5 rounded-[var(--radius-sm)] border-2 transition-all flex items-center justify-center
          ${todo.done
            ? 'bg-success border-success text-white animate-check-pop'
            : 'border-border-strong hover:border-accent'
          }`}
      >
        {todo.done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setDraft(todo.text); setEditing(false) } }}
            className="w-full px-2 py-0.5 text-sm bg-bg-input border border-accent/30 rounded-[var(--radius-sm)] text-text-primary outline-none focus:border-accent"
            autoFocus
          />
        ) : (
          <span
            onClick={() => { setDraft(todo.text); setEditing(true) }}
            className={`text-sm cursor-pointer hover:border-b hover:border-accent/30 transition-colors
              ${todo.done ? 'line-through text-text-muted' : 'text-text-primary'}`}
          >
            {todo.text}
          </span>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {todo.dueDate && (
            <span className="text-xs text-text-muted">{todo.dueDate}</span>
          )}
        </div>
      </div>

      {todo.priority === 'high' && (
        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-danger" title="High priority" />
      )}

      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-xs transition-opacity flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

function AddTodoForm({ category, onAdd }) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('normal')
  const [expanded, setExpanded] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    onAdd({ text: text.trim(), category, dueDate, priority })
    setText('')
    setDueDate('')
    setPriority('normal')
    setExpanded(false)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-accent hover:text-accent-hover transition-colors py-1"
      >
        + Add task
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center py-1">
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="New task..."
        className="flex-1 px-2 py-1 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
        autoFocus
      />
      <input
        type="date"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        className="px-2 py-1 text-xs bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary"
      />
      <button
        type="button"
        onClick={() => setPriority(p => p === 'high' ? 'normal' : 'high')}
        className={`text-xs px-2 py-1 rounded-[var(--radius-sm)] border transition-colors
          ${priority === 'high' ? 'border-danger text-danger bg-danger/10' : 'border-border text-text-muted'}`}
        title="Toggle high priority"
      >
        !!
      </button>
      <button type="submit" className="px-2 py-1 text-xs bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">
        Add
      </button>
      <button type="button" onClick={() => setExpanded(false)} className="text-xs text-text-muted">✕</button>
    </form>
  )
}

export default function TodoTab() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const [filter, setFilter] = useState('all')
  const [celebration, setCelebration] = useState(0)

  if (!activeTrip) return null
  const trip = activeTrip
  const todos = trip.todos || []

  const categories = useMemo(() => {
    const cats = [...new Set(todos.map(t => t.category))]
    TODO_CATEGORIES.forEach(c => { if (!cats.includes(c)) cats.push(c) })
    return cats
  }, [todos])

  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'high': return todos.filter(t => t.priority === 'high')
      case 'incomplete': return todos.filter(t => !t.done)
      case 'complete': return todos.filter(t => t.done)
      default: return todos
    }
  }, [todos, filter])

  const grouped = useMemo(() => {
    const groups = {}
    categories.forEach(cat => { groups[cat] = [] })
    filteredTodos.forEach(todo => {
      const cat = todo.category || 'Misc'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(todo)
    })
    return groups
  }, [filteredTodos, categories])

  const completedCount = todos.filter(t => t.done).length
  const totalCount = todos.length

  const handleToggle = useCallback((todoId) => {
    dispatch({ type: ACTIONS.TOGGLE_TODO, payload: todoId })
    const todo = todos.find(t => t.id === todoId)
    if (todo && !todo.done) {
      // Will be done after toggle
      const newCompleted = completedCount + 1
      if (newCompleted === totalCount) {
        setCelebration(c => c + 1)
        showToast("You're all set! Have an amazing trip 🌟")
      }
    }
  }, [dispatch, todos, completedCount, totalCount, showToast])

  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const filters = [
    { id: 'all', label: `All (${totalCount})` },
    { id: 'high', label: 'High Priority' },
    { id: 'incomplete', label: `Incomplete (${totalCount - completedCount})` },
    { id: 'complete', label: `Complete (${completedCount})` },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <CelebrationEffect trigger={celebration} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-text-primary">
          ✅ To-Do · {completedCount}/{totalCount} done
        </h2>
      </div>

      {/* Filters */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-pill)] whitespace-nowrap transition-colors
              ${filter === f.id
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-muted hover:text-text-secondary border border-border'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grouped todos */}
      {Object.entries(grouped).map(([category, categoryTodos]) => {
        const catDone = categoryTodos.filter(t => t.done).length
        const catTotal = categoryTodos.length

        return (
          <Card key={category}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm font-semibold text-text-primary">{category}</h3>
              <span className="text-xs text-text-muted">{catDone}/{catTotal}</span>
            </div>

            <div className="divide-y divide-border/30">
              {categoryTodos.map(todo => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={() => handleToggle(todo.id)}
                  onUpdate={updates => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
                  onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
                />
              ))}
            </div>

            <AddTodoForm
              category={category}
              onAdd={data => dispatch({ type: ACTIONS.ADD_TODO, payload: data })}
            />
          </Card>
        )
      })}

      {/* Add category */}
      {addingCategory ? (
        <div className="flex gap-2">
          <input
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                dispatch({ type: ACTIONS.ADD_TODO, payload: { text: 'New task', category: newCategoryName.trim() } })
                setNewCategoryName('')
                setAddingCategory(false)
              }
            }}
          />
          <button
            onClick={() => setAddingCategory(false)}
            className="text-sm text-text-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingCategory(true)}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
        >
          + Add category
        </button>
      )}
    </div>
  )
}
