import { useState, useMemo } from 'react'
import { TODO_STATUSES } from '../constants/tabs'

const getTodoStatus = (todo) => todo.status || (todo.done ? 'done' : 'not_started')

/**
 * Manages filter state and derived data for TodoTab.
 * Returns normalized todos, filtered list, and kanban column groupings.
 */
export function useTodoFilters(todos, currentUserProfile) {
  const [filter, setFilter] = useState('all')
  const [hideCompleted, setHideCompleted] = useState(false)

  const safeTodos = useMemo(() => todos.map(t => {
    const status = getTodoStatus(t)
    const statusExists = TODO_STATUSES.some(s => s.id === status)
    const normalizedStatus = statusExists ? status : 'not_started'
    return { ...t, status: normalizedStatus, done: normalizedStatus === 'done' }
  }), [todos])

  const filteredTodos = useMemo(() => {
    let result = safeTodos
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

  return {
    filter,
    setFilter,
    hideCompleted,
    setHideCompleted,
    safeTodos,
    filteredTodos,
    grouped,
  }
}
