import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import Card from '../shared/Card'
import CelebrationEffect from '../shared/CelebrationEffect'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { TODO_STATUSES } from '../../constants/tabs'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { useTodoFilters } from '../../hooks/useTodoFilters'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import { auth } from '../../firebase/config'
import TabHeader from '../common/TabHeader'
import EmptyState from '../shared/EmptyState'
import TodoDrawer from './TodoDrawer'
import AddTodoModal from './todo/AddTodoModal'
import {
  getTodoStatus, TODO_STATUS_ORDER, snapCursorToTopLeft,
  TodoItem, TodoMobileCard, BoardStatusColumn,
} from './todo/TodoComponents'

export default function TodoTab() {
  const { activeTrip, dispatch, showToast, isReadOnly } = useTripContext()
  const { currentUserProfile, resolveProfile, awardXp } = useProfiles()
  const [celebration, setCelebration] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeTodo, setActiveTodo] = useState(null)
  const [selectedTodoId, setSelectedTodoId] = useState(null)
  const [flashedTodoId, setFlashedTodoId] = useState(null)

  if (!activeTrip) return null
  const trip = activeTrip
  const todos = trip.todos || []
  const travelers = useTripTravelers()
  const tripTravelers = travelers.map(t => t.id)

  const {
    filter, setFilter,
    hideCompleted, setHideCompleted,
    safeTodos, filteredTodos, grouped,
  } = useTodoFilters(todos, currentUserProfile)

  const completedCount = safeTodos.filter(t => getTodoStatus(t) === 'done').length
  const totalCount = safeTodos.length

  const handleStatusChange = useCallback((todoId, next) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return
    const current = getTodoStatus(todo)
    dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todoId, updates: { status: next, done: next === 'done' } } })
    if (current !== 'done' && next === 'done') {
      awardXp('todo_cleared', 5)
      // Flash the completed row
      setFlashedTodoId(todoId)
      setTimeout(() => setFlashedTodoId(null), 600)
      if (completedCount + 1 === totalCount && totalCount > 0) {
        setCelebration(c => c + 1)
        showToast("You're all set! Have an amazing trip 🌟")
      }
    }
  }, [dispatch, todos, completedCount, totalCount, showToast, awardXp])

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
    if (isGenerating) return
    setIsGenerating(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error("No auth token")
      const res = await fetch('https://wanderplan-rust.vercel.app/api/generate-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tripName: trip.name, destinations: trip.destinations, startDate: trip.startDate, endDate: trip.endDate })
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
  )

  const canDrag = viewMode === 'board' && filter === 'all' && !hideCompleted

  const handleDragStart = (event) => {
    const todo = todos.find(t => t.id === event.active.id)
    setActiveTodo(todo || null)
  }

  const handleDragEnd = (event) => {
    setActiveTodo(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const todoId = active.id
    const activeTodoData = active.data.current?.todo
    if (!activeTodoData) return

    const currentStatus = getTodoStatus(activeTodoData)
    const targetStatusId = over.data?.current?.sortable?.containerId || over.id

    if (!TODO_STATUSES.find(s => s.id === targetStatusId)) return

    let newTodos = [...todos]
    const activeIndex = newTodos.findIndex(t => t.id === todoId)
    if (activeIndex < 0) return

    if (currentStatus === targetStatusId) {
      const overIndex = newTodos.findIndex(t => t.id === over.id)
      if (overIndex < 0) return
      const [moved] = newTodos.splice(activeIndex, 1)
      const insertAt = activeIndex < overIndex ? overIndex - 1 : overIndex
      newTodos.splice(insertAt, 0, moved)
    } else {
      const [moved] = newTodos.splice(activeIndex, 1)
      moved.status = targetStatusId
      moved.done = targetStatusId === 'done'
      if (over.data?.current?.sortable) {
        const overIndex = newTodos.findIndex(t => t.id === over.id)
        newTodos.splice(overIndex >= 0 ? overIndex : newTodos.length, 0, moved)
      } else {
        newTodos.push(moved)
      }
    }

    dispatch({ type: ACTIONS.SET_TODOS, payload: newTodos })
    triggerHaptic('light')
  }

  return (
    <div className="space-y-6 animate-tab-enter stagger-1 pb-24 w-full">
      <CelebrationEffect trigger={celebration} />

      <TabHeader
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="w-20 h-1.5 rounded-[var(--radius-pill)] bg-bg-secondary overflow-hidden hidden md:block shrink-0">
              <div
                className="h-full rounded-[var(--radius-pill)] bg-accent transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs font-semibold font-heading text-text-muted tabular-nums">
              {completedCount}/{totalCount} completed
            </span>
          </div>
        }
        rightSlot={
          <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible pb-2 md:pb-0 items-center gap-2 shrink-0">
            <button
              onClick={() => setHideCompleted(prev => !prev)}
              className={`text-xs font-semibold px-2 py-1 rounded-[var(--radius-sm)] border transition-colors flex items-center gap-1.5 shrink-0 ${hideCompleted ? 'bg-bg-card border-border text-text-primary' : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:bg-bg-secondary'}`}
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

            {!isReadOnly && (
              <div className="hidden md:block shrink-0">
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">
                  ✅ New Task
                </Button>
              </div>
            )}
          </div>
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
                onTodoClick={handleTodoClick}
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
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="flex flex-col gap-3 md:hidden">
            {filteredTodos.length === 0 ? (
              <EmptyState
                emoji="✅"
                title="No tasks yet."
                subtitle="Add your first to-do above."
                action={
                  <Button variant="secondary" size="sm" onClick={handleGenerateChecklist} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : '🪄 Generate with Wanda'}
                  </Button>
                }
                compact
              />
            ) : (
              filteredTodos.map(todo => (
                <TodoMobileCard
                  key={todo.id}
                  todo={todo}
                  onClick={() => handleTodoClick(todo.id)}
                  onDelete={() => dispatch({ type: ACTIONS.DELETE_TODO, payload: todo.id })}
                  onUpdate={(updates) => dispatch({ type: ACTIONS.UPDATE_TODO, payload: { id: todo.id, updates } })}
                  resolveProfile={resolveProfile}
                  tripTravelers={tripTravelers}
                  currentUserProfile={currentUserProfile}
                  isReadOnly={isReadOnly}
                />
              ))
            )}
          </div>

          {/* Desktop table view */}
          <Card className="hidden md:block overflow-hidden border border-border">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="flex items-center gap-2 px-0 py-2 border-b border-border/40 bg-bg-secondary/10">
                  <div className="flex-1 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">TASK</div>
                  <div className="w-[140px] shrink-0 text-xs font-semibold uppercase tracking-wider text-text-muted text-left">STATUS</div>
                  <div className="w-[140px] text-left px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">DUE DATE</div>
                  <div className="w-[100px] shrink-0 text-center text-xs font-semibold uppercase tracking-wider text-text-muted">ASSIGNED</div>
                  {!isReadOnly && <div className="w-[60px]"></div>}
                </div>

                <div className="divide-y divide-border/30 h-full flex flex-col">
                  {filteredTodos.length === 0 ? (
                    <EmptyState
                      emoji="✅"
                      title="No tasks yet."
                      subtitle="Add your first to-do above."
                      action={
                        <Button variant="secondary" size="sm" onClick={handleGenerateChecklist} disabled={isGenerating}>
                          {isGenerating ? 'Generating...' : '🪄 Generate with Wanda'}
                        </Button>
                      }
                      compact
                    />
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
                        isFlashing={flashedTodoId === todo.id}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>
        </>
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
