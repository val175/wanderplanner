import { generateId } from '../../utils/helpers'
import { updateTrip, STATUS_CYCLE } from '../reducerUtils'

/**
 * Unifies booking-budget synchronization logic.
 * Handles adding/removing expenses based on booking status transitions.
 * Modifies nextBooking (if needed) and returns updated trip fields.
 */
export function syncBookingBudget(trip, prev, next, actorId = null) {
  let spendingLog = trip.spendingLog || []
  let budget = trip.budget || []

  const wasConfirmed = prev?.status === 'confirmed'
  const isConfirmed = next.status === 'confirmed'
  const prevExpenseId = prev?._expenseId

  // Remove stale auto-expense when un-confirming
  if (wasConfirmed && !isConfirmed && prevExpenseId) {
    const old = spendingLog.find(s => s.id === prevExpenseId)
    spendingLog = spendingLog.filter(s => s.id !== prevExpenseId)
    if (old) {
      budget = budget.map(b =>
        b.name === old.category
          ? { ...b, actual: Math.max(0, (b.actual || 0) - old.amount) }
          : b
      )
    }
    delete next._expenseId
  }

  // Add expense when newly confirmed and has cost
  const cost = Number(next.cost || next.amountPaid || 0)
  if (!wasConfirmed && isConfirmed && cost > 0) {
    const catName = budget.find(b =>
      b.name?.toLowerCase() === (next.category || '').toLowerCase() ||
      b.id === next.category
    )?.name || next.category || 'Other'

    const expId = `booking-${next.id}`
    const entry = {
      id: expId,
      description: next.name || 'Booking',
      amount: cost,
      category: catName,
      paidBy: actorId || trip.travelerIds?.[0] || '',
      splitBetween: trip.travelerIds || [],
      splits: {},
      splitMode: 'equal',
      date: new Date().toISOString().slice(0, 10),
      source: 'booking',
    }
    spendingLog = [...spendingLog, entry]
    budget = budget.map(b =>
      b.name === catName
        ? { ...b, actual: (b.actual || 0) + cost }
        : b
    )
    next._expenseId = expId
  }

  return { spendingLog, budget }
}

export const bookingCases = {
  ADD_BOOKING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const next = {
        id: generateId(),
        status: 'not_started',
        priority: false,
        amountPaid: 0,
        confirmationNumber: '',
        currency: trip.currency,
        ...payload,
      }
      const { spendingLog, budget } = syncBookingBudget(trip, null, next, payload.actorId)
      return { ...trip, bookings: [next, ...trip.bookings], spendingLog, budget }
    })
  },

  UPDATE_BOOKING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const prev = trip.bookings.find(b => b.id === payload.id)
      if (!prev) return trip
      const next = { ...prev, ...payload.updates }
      const { spendingLog, budget } = syncBookingBudget(trip, prev, next, payload.actorId)
      const bookings = trip.bookings.map(b => b.id === payload.id ? next : b)
      return { ...trip, bookings, spendingLog, budget }
    })
  },

  DELETE_BOOKING: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      bookings: trip.bookings.filter(b => b.id !== payload),
    }))
  },

  CYCLE_BOOKING_STATUS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const prev = trip.bookings.find(b => b.id === payload.id)
      if (!prev) return trip
      const currentIndex = STATUS_CYCLE.indexOf(prev.status)
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
      const next = { ...prev, status: nextStatus }
      const { spendingLog, budget } = syncBookingBudget(trip, prev, next, payload.actorId)
      const bookings = trip.bookings.map(b => b.id === payload.id ? next : b)
      return { ...trip, bookings, spendingLog, budget }
    })
  },

  SET_BOOKING_STATUS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const prev = trip.bookings.find(b => b.id === payload.id)
      if (!prev) return trip
      const next = { ...prev, status: payload.status }
      const { spendingLog, budget } = syncBookingBudget(trip, prev, next, payload.actorId)
      const bookings = trip.bookings.map(b => b.id === payload.id ? next : b)
      return { ...trip, bookings, spendingLog, budget }
    })
  },

  ADD_BOOKING_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      bookings: trip.bookings.map(b => {
        if (b.id !== payload.bookingId) return b
        if (!payload.text?.trim()) return b
        const comment = {
          id: generateId(),
          authorId: payload.actorId || null,
          text: payload.text.trim(),
          timestamp: new Date().toISOString(),
        }
        return { ...b, comments: [...(b.comments || []), comment] }
      }),
    }))
  },

  UPDATE_BOOKING_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      bookings: trip.bookings.map(b =>
        b.id !== payload.bookingId ? b : {
          ...b,
          comments: (b.comments || []).map(c =>
            c.id === payload.commentId ? { ...c, text: payload.text?.trim() || c.text } : c
          ),
        }
      ),
    }))
  },

  DELETE_BOOKING_COMMENT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      bookings: trip.bookings.map(b =>
        b.id !== payload.bookingId ? b : {
          ...b,
          comments: (b.comments || []).filter(c => c.id !== payload.commentId),
        }
      ),
    }))
  },
}
