import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

export const budgetCases = {
  UPDATE_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: trip.budget.map(b => b.id === payload.id ? { ...b, ...payload.updates } : b),
    }))
  },

  ADD_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: [...trip.budget, {
        id: generateId(),
        name: payload.name || 'New Category',
        emoji: payload.emoji || '📌',
        min: 0,
        max: payload.max || 0,
        actual: 0,
      }],
    }))
  },

  DELETE_BUDGET_CATEGORY: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      budget: trip.budget.filter(b => b.id !== payload),
    }))
  },

  // Log entry AND update the matching budget category's actual spend
  ADD_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const entry = { id: payload.id || generateId(), date: new Date().toISOString().slice(0, 10), ...payload }
      const budget = trip.budget.map(b =>
        b.name === payload.category
          ? { ...b, actual: (b.actual || 0) + (payload.amount || 0) }
          : b
      )
      return { ...trip, spendingLog: [...trip.spendingLog, entry], budget }
    })
  },

  // Edit an existing log entry in place
  UPDATE_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const old = trip.spendingLog.find(s => s.id === payload.id)
      if (!old) return trip
      const updated = { ...old, ...payload.updates }
      const spendingLog = trip.spendingLog.map(s => s.id === payload.id ? updated : s)
      const budget = trip.budget.map(b => {
        let actual = b.actual || 0
        if (b.name === old.category) actual = Math.max(0, actual - old.amount)
        if (b.name === updated.category) actual += updated.amount
        return b.name === old.category || b.name === updated.category ? { ...b, actual } : b
      })
      return { ...trip, spendingLog, budget }
    })
  },

  DELETE_SPENDING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const entry = trip.spendingLog.find(s => s.id === payload)
      if (!entry) return { ...trip, spendingLog: trip.spendingLog.filter(s => s.id !== payload) }
      const budget = trip.budget.map(b =>
        b.name === entry.category
          ? { ...b, actual: Math.max(0, (b.actual || 0) - (entry.amount || 0)) }
          : b
      )
      return { ...trip, spendingLog: trip.spendingLog.filter(s => s.id !== payload), budget }
    })
  },
}
