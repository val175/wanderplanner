import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

export const todoCases = {
  ADD_TODO: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: [...trip.todos, {
        id: generateId(),
        status: 'not_started',
        done: false,
        priority: 'normal',
        dueDate: '',
        assigneeId: null,
        comments: [],
        ...payload,
      }],
    }))
  },

  TOGGLE_TODO: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.map(t => {
        if (t.id !== payload) return t
        const currentStatus = t.status || (t.done ? 'done' : 'not_started')
        const nextStatus = currentStatus === 'not_started'
          ? 'in_progress'
          : currentStatus === 'in_progress'
            ? 'done'
            : 'not_started'
        return { ...t, status: nextStatus, done: nextStatus === 'done' }
      }),
    }))
  },

  UPDATE_TODO: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.map(t => t.id === payload.id ? { ...t, ...payload.updates } : t),
    }))
  },

  DELETE_TODO: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.filter(t => t.id !== payload),
    }))
  },

  SET_TODOS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({ ...trip, todos: payload }))
  },

  ADD_TODO_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.map(t => {
        if (t.id !== payload.todoId) return t
        if (!payload.text || !payload.text.trim()) return t
        const nextComment = {
          id: generateId(),
          authorId: payload.actorId || null,
          text: payload.text.trim(),
          mentions: Array.isArray(payload.mentions) ? payload.mentions : [],
          timestamp: new Date().toISOString(),
        }
        const comments = Array.isArray(t.comments) ? t.comments : []
        return { ...t, comments: [...comments, nextComment] }
      }),
    }))
  },

  UPDATE_TODO_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.map(t => {
        if (t.id !== payload.todoId) return t
        const comments = Array.isArray(t.comments) ? t.comments : []
        return {
          ...t,
          comments: comments.map(c =>
            c.id === payload.commentId
              ? { ...c, text: payload.text?.trim() || c.text }
              : c
          ),
        }
      }),
    }))
  },

  DELETE_TODO_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      todos: trip.todos.map(t => {
        if (t.id !== payload.todoId) return t
        const comments = Array.isArray(t.comments) ? t.comments : []
        return { ...t, comments: comments.filter(c => c.id !== payload.commentId) }
      }),
    }))
  },
}
