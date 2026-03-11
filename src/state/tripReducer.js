import { generateId, cloneDeep } from '../utils/helpers'

// Action Types
export const ACTIONS = {
  // Trip CRUD
  SET_ACTIVE_TRIP: 'SET_ACTIVE_TRIP',
  ADD_TRIP: 'ADD_TRIP',
  UPDATE_TRIP: 'UPDATE_TRIP',
  DELETE_TRIP: 'DELETE_TRIP',
  DUPLICATE_TRIP: 'DUPLICATE_TRIP',
  REFRESH_TRAVELER_SNAPSHOT: 'REFRESH_TRAVELER_SNAPSHOT',
  RENAME_TRIP: 'RENAME_TRIP',

  // Navigation
  SET_TAB: 'SET_TAB',
  TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  SET_SIDEBAR: 'SET_SIDEBAR',

  // Toast
  SHOW_TOAST: 'SHOW_TOAST',
  HIDE_TOAST: 'HIDE_TOAST',

  // Dark mode
  TOGGLE_DARK_MODE: 'TOGGLE_DARK_MODE',

  // Itinerary
  ADD_DAY: 'ADD_DAY',
  REMOVE_DAY: 'REMOVE_DAY',
  UPDATE_DAY: 'UPDATE_DAY',
  REORDER_DAYS: 'REORDER_DAYS',
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  REORDER_ACTIVITIES: 'REORDER_ACTIVITIES',
  MOVE_ACTIVITY_BETWEEN_DAYS: 'MOVE_ACTIVITY_BETWEEN_DAYS',

  // Bookings
  ADD_BOOKING: 'ADD_BOOKING',
  UPDATE_BOOKING: 'UPDATE_BOOKING',
  DELETE_BOOKING: 'DELETE_BOOKING',
  CYCLE_BOOKING_STATUS: 'CYCLE_BOOKING_STATUS',
  SET_BOOKING_STATUS: 'SET_BOOKING_STATUS',

  // Budget
  UPDATE_BUDGET_CATEGORY: 'UPDATE_BUDGET_CATEGORY',
  ADD_BUDGET_CATEGORY: 'ADD_BUDGET_CATEGORY',
  DELETE_BUDGET_CATEGORY: 'DELETE_BUDGET_CATEGORY',
  ADD_SPENDING: 'ADD_SPENDING',
  DELETE_SPENDING: 'DELETE_SPENDING',
  UPDATE_SPENDING: 'UPDATE_SPENDING',

  // Todos
  ADD_TODO: 'ADD_TODO',
  TOGGLE_TODO: 'TOGGLE_TODO',
  UPDATE_TODO: 'UPDATE_TODO',
  DELETE_TODO: 'DELETE_TODO',
  SET_TODOS: 'SET_TODOS',

  // Packing
  ADD_PACKING_ITEM: 'ADD_PACKING_ITEM',
  TOGGLE_PACKING_ITEM: 'TOGGLE_PACKING_ITEM',
  UPDATE_PACKING_ITEM: 'UPDATE_PACKING_ITEM',
  DELETE_PACKING_ITEM: 'DELETE_PACKING_ITEM',
  RESET_PACKING: 'RESET_PACKING',
  ADD_PACKING_SECTION: 'ADD_PACKING_SECTION',

  // Ideas
  ADD_IDEA: 'ADD_IDEA',
  VOTE_IDEA: 'VOTE_IDEA',
  UPDATE_IDEA_STATUS: 'UPDATE_IDEA_STATUS',
  DELETE_IDEA: 'DELETE_IDEA',

  // Polls
  CREATE_POLL: 'CREATE_POLL',
  VOTE_POLL: 'VOTE_POLL',
  RESOLVE_POLL: 'RESOLVE_POLL',
  DELETE_POLL: 'DELETE_POLL',
  CANCEL_POLL: 'CANCEL_POLL',

  // Cities
  UPDATE_CITY: 'UPDATE_CITY',
  ADD_CITY: 'ADD_CITY',
  DELETE_CITY: 'DELETE_CITY',
  REORDER_CITIES: 'REORDER_CITIES',

  // Notes
  UPDATE_NOTES: 'UPDATE_NOTES',

  // Activity Log
  LOG_ACTIVITY: 'LOG_ACTIVITY',

  // Share
  GENERATE_SHARE_LINK: 'GENERATE_SHARE_LINK',
  REVOKE_SHARE_LINK: 'REVOKE_SHARE_LINK',

  // Post-Trip
  ARCHIVE_TRIP: 'ARCHIVE_TRIP',
  UNARCHIVE_TRIP: 'UNARCHIVE_TRIP',
  DUPLICATE_AS_TEMPLATE: 'DUPLICATE_AS_TEMPLATE',

  // Firestore sync — replaces entire trips map from remote snapshot
  SET_TRIPS_FROM_FIRESTORE: 'SET_TRIPS_FROM_FIRESTORE',
}

const STATUS_CYCLE = ['not_started', 'in_progress', 'booked']

function updateTrip(state, tripId, updater) {
  const trips = { ...state.trips }
  const trip = trips[tripId]
  if (!trip) return state
  trips[tripId] = typeof updater === 'function' ? updater(trip) : { ...trip, ...updater }
  return { ...state, trips }
}

/**
 * Unifies booking-budget synchronization logic.
 * Handles adding/removing expenses based on booking status transitions.
 * Modifies nextBooking (if needed) and returns updated trip fields.
 */
function syncBookingBudget(trip, prev, next, actorId = null) {
  let spendingLog = trip.spendingLog || []
  let budget = trip.budget || []

  const wasConfirmed = prev?.status === 'confirmed'
  const isConfirmed = next.status === 'confirmed'
  const prevExpenseId = prev?._expenseId

  // 1. Remove stale auto-expense when un-confirming
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
    // Clear the expense ID from the booking record
    delete next._expenseId
  }

  // 2. Add expense when newly confirmed and has cost
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
    
    // Stamp the booking with the expense ID for future removal
    next._expenseId = expId
  }

  return { spendingLog, budget }
}

export function tripReducer(state, action) {
  const { type, payload } = action
  const activeTripId = state.activeTripId

  switch (type) {
    // ─── Trip CRUD ───
    case ACTIONS.SET_ACTIVE_TRIP:
      return { ...state, activeTripId: payload, activeTab: 'overview' }

    case ACTIONS.ADD_TRIP: {
      const trips = { ...state.trips, [payload.id]: payload }
      return { ...state, trips, activeTripId: payload.id, activeTab: 'overview' }
    }

    case ACTIONS.UPDATE_TRIP:
      return updateTrip(state, payload.id, payload.updates)

    case ACTIONS.DELETE_TRIP: {
      const trips = { ...state.trips }
      delete trips[payload]
      const remaining = Object.keys(trips)
      return {
        ...state,
        trips,
        activeTripId: remaining.length > 0 ? remaining[0] : null,
        activeTab: 'overview',
      }
    }

    case ACTIONS.DUPLICATE_TRIP: {
      const original = state.trips[payload]
      if (!original) return state
      const newId = generateId()
      const clone = cloneDeep(original)
      clone.id = newId
      clone.name = original.name + ' (Copy)'
      clone.createdAt = new Date().toISOString()
      return { ...state, trips: { ...state.trips, [newId]: clone }, activeTripId: newId }
    }

    case ACTIONS.RENAME_TRIP:
      return updateTrip(state, payload.id, { name: payload.name })

    case ACTIONS.REFRESH_TRAVELER_SNAPSHOT:
      return updateTrip(state, state.activeTripId, trip => {
        const { travelerId, name, photo } = payload
        const snapshot = trip.travelersSnapshot || []
        const exists = snapshot.some(s => s.id === travelerId)
        
        const newEntry = { id: travelerId, name, photo }
        
        let nextSnapshot
        if (exists) {
          nextSnapshot = snapshot.map(s => s.id === travelerId ? { ...s, ...newEntry } : s)
        } else {
          nextSnapshot = [...snapshot, newEntry]
        }
        
        return { ...trip, travelersSnapshot: nextSnapshot }
      })

    // ─── Navigation ───
    case ACTIONS.SET_TAB:
      return { ...state, activeTab: payload }

    case ACTIONS.TOGGLE_SIDEBAR:
      return { ...state, sidebarOpen: !state.sidebarOpen }

    case ACTIONS.SET_SIDEBAR:
      return { ...state, sidebarOpen: payload }

    // ─── Toast ───
    case ACTIONS.SHOW_TOAST:
      return { ...state, toast: { message: payload.message, type: payload.type || 'success', visible: true } }

    case ACTIONS.HIDE_TOAST:
      return { ...state, toast: { ...state.toast, visible: false } }

    // ─── Dark mode ───
    case ACTIONS.TOGGLE_DARK_MODE:
      return { ...state, darkMode: !state.darkMode }

    case ACTIONS.ADD_DAY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: [...trip.itinerary, {
          id: generateId(),
          date: payload.date || '',
          dayNumber: trip.itinerary.length + 1,
          location: payload.location || '',
          emoji: payload.emoji || '📍',
          activities: payload.activities || [],
          notes: payload.notes || '',
        }],
      }))

    case ACTIONS.REMOVE_DAY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.filter(d => d.id !== payload).map((d, i) => ({ ...d, dayNumber: i + 1 })),
      }))

    case ACTIONS.UPDATE_DAY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d => d.id === payload.dayId ? { ...d, ...payload.updates } : d),
      }))

    // payload: { fromIndex, toIndex }
    case ACTIONS.REORDER_DAYS:
      return updateTrip(state, activeTripId, trip => {
        const itinerary = [...trip.itinerary]
        const [moved] = itinerary.splice(payload.fromIndex, 1)
        itinerary.splice(payload.toIndex, 0, moved)
        return { ...trip, itinerary: itinerary.map((d, i) => ({ ...d, dayNumber: i + 1 })) }
      })

    case ACTIONS.ADD_ACTIVITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d => {
          if (d.id !== payload.dayId) return d
          const newActivity = {
            id: generateId(),
            time: '',
            name: '',
            notes: '',
            location: '',
            estCost: '',
            transit: '',
            transitEmoji: '🚕',
            ...payload.activity
          }
          const newActivities = [...(d.activities || [])]
          if (typeof payload.index === 'number') {
            newActivities.splice(payload.index, 0, newActivity)
          } else {
            newActivities.push(newActivity)
          }
          return { ...d, activities: newActivities }
        }),
      }))

    case ACTIONS.UPDATE_ACTIVITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d =>
          d.id === payload.dayId
            ? { ...d, activities: d.activities.map(a => a.id === payload.activityId ? { ...a, ...payload.updates } : a) }
            : d
        ),
      }))

    case ACTIONS.DELETE_ACTIVITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d =>
          d.id === payload.dayId
            ? { ...d, activities: d.activities.filter(a => a.id !== payload.activityId) }
            : d
        ),
      }))

    // payload: { dayId, fromIndex, toIndex }
    case ACTIONS.REORDER_ACTIVITIES:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d => {
          if (d.id !== payload.dayId) return d
          const activities = [...d.activities]
          const [moved] = activities.splice(payload.fromIndex, 1)
          activities.splice(payload.toIndex, 0, moved)
          return { ...d, activities }
        }),
      }))

    // payload: { fromDayId, toDayId, activityId, toIndex }
    case ACTIONS.MOVE_ACTIVITY_BETWEEN_DAYS:
      return updateTrip(state, activeTripId, trip => {
        let movedActivity = null

        // Remove from source day
        const srcItin = trip.itinerary.map(d => {
          if (d.id === payload.fromDayId) {
            movedActivity = d.activities.find(a => a.id === payload.activityId)
            return { ...d, activities: d.activities.filter(a => a.id !== payload.activityId) }
          }
          return d
        })

        if (!movedActivity) return trip // Guard

        // Add to dest day
        const finalItin = srcItin.map(d => {
          if (d.id === payload.toDayId) {
            const nextActivities = [...d.activities]
            if (payload.toIndex !== undefined) {
              nextActivities.splice(payload.toIndex, 0, movedActivity)
            } else {
              nextActivities.push(movedActivity)
            }
            return { ...d, activities: nextActivities }
          }
          return d
        })

        return {
          ...trip,
          itinerary: finalItin,
          destinations: (trip.destinations || []).map((d, i) => {
            if (i === payload.index) {
              return {
                ...d,
                city: payload.city,
                country: payload.country,
                flag: payload.flag,
                lat: payload.lat,
                lng: payload.lng
              }
            }
            return d
          }),
        }
      })

    // ─── Bookings ───
    case ACTIONS.ADD_BOOKING:
      return updateTrip(state, activeTripId, trip => {
        const next = {
          id: generateId(),
          status: 'not_started',
          priority: false,
          amountPaid: 0,
          confirmationNumber: '',
          currency: trip.currency,
          ...payload
        }
        const { spendingLog, budget } = syncBookingBudget(trip, null, next, payload.actorId)
        return {
          ...trip,
          bookings: [next, ...trip.bookings],
          spendingLog,
          budget
        }
      })

    case ACTIONS.UPDATE_BOOKING: {
      return updateTrip(state, activeTripId, trip => {
        const prev = trip.bookings.find(b => b.id === payload.id)
        if (!prev) return trip
        const next = { ...prev, ...payload.updates }
        const { spendingLog, budget } = syncBookingBudget(trip, prev, next, payload.actorId)
        const bookings = trip.bookings.map(b => b.id === payload.id ? next : b)
        return { ...trip, bookings, spendingLog, budget }
      })
    }

    case ACTIONS.DELETE_BOOKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        bookings: trip.bookings.filter(b => b.id !== payload),
      }))

    case ACTIONS.CYCLE_BOOKING_STATUS:
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

    case ACTIONS.SET_BOOKING_STATUS:
      return updateTrip(state, activeTripId, trip => {
        const prev = trip.bookings.find(b => b.id === payload.id)
        if (!prev) return trip
        const next = { ...prev, status: payload.status }
        const { spendingLog, budget } = syncBookingBudget(trip, prev, next, payload.actorId)
        const bookings = trip.bookings.map(b => b.id === payload.id ? next : b)
        return { ...trip, bookings, spendingLog, budget }
      })

    // ─── Budget ───
    case ACTIONS.UPDATE_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: trip.budget.map(b => b.id === payload.id ? { ...b, ...payload.updates } : b),
      }))

    case ACTIONS.ADD_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: [...trip.budget, { id: generateId(), name: payload.name || 'New Category', emoji: payload.emoji || '📌', min: 0, max: payload.max || 0, actual: 0 }],
      }))

    case ACTIONS.DELETE_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: trip.budget.filter(b => b.id !== payload),
      }))

    // ADD_SPENDING: log entry AND update the matching budget category's actual spend
    case ACTIONS.ADD_SPENDING:
      return updateTrip(state, activeTripId, trip => {
        const entry = { id: generateId(), date: new Date().toISOString().slice(0, 10), ...payload }
        // Update matching category's actual by adding the amount
        const budget = trip.budget.map(b =>
          b.name === payload.category
            ? { ...b, actual: (b.actual || 0) + (payload.amount || 0) }
            : b
        )
        return { ...trip, spendingLog: [...trip.spendingLog, entry], budget }
      })
    // UPDATE_SPENDING: edit an existing log entry in place
    case ACTIONS.UPDATE_SPENDING:
      return updateTrip(state, activeTripId, trip => {
        const old = trip.spendingLog.find(s => s.id === payload.id);
        if (!old) return trip;
        const updated = { ...old, ...payload.updates };
        const spendingLog = trip.spendingLog.map(s => s.id === payload.id ? updated : s);
        // Recalculate budget actuals: subtract old, add new
        const budget = trip.budget.map(b => {
          let actual = b.actual || 0;
          if (b.name === old.category) actual = Math.max(0, actual - old.amount);
          if (b.name === updated.category) actual += updated.amount;
          return b.name === old.category || b.name === updated.category ? { ...b, actual } : b;
        });
        return { ...trip, spendingLog, budget };
      })

    case ACTIONS.DELETE_SPENDING:
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

    // ─── Todos ───
    case ACTIONS.ADD_TODO:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: [...trip.todos, { id: generateId(), done: false, priority: 'normal', dueDate: '', phase: 'planning', assigneeId: null, ...payload }],
      }))

    case ACTIONS.TOGGLE_TODO:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: trip.todos.map(t => t.id === payload ? { ...t, done: !t.done } : t),
      }))

    case ACTIONS.UPDATE_TODO:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: trip.todos.map(t => t.id === payload.id ? { ...t, ...payload.updates } : t),
      }))

    case ACTIONS.DELETE_TODO:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: trip.todos.filter(t => t.id !== payload),
      }))

    case ACTIONS.SET_TODOS:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: payload,
      }))

    // ─── Packing ───
    case ACTIONS.ADD_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: [...trip.packingList, { id: generateId(), packed: false, section: 'Misc', ...payload }],
      }))

    case ACTIONS.TOGGLE_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.map(p => {
          if (p.id !== payload.itemId) return p
          const nextPacked = !p.packed
          return { ...p, packed: nextPacked, packedBy: nextPacked ? payload.userId : null }
        }),
      }))

    case ACTIONS.UPDATE_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.map(p => p.id === payload.id ? { ...p, ...payload.updates } : p),
      }))

    case ACTIONS.DELETE_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.filter(p => p.id !== payload),
      }))

    case ACTIONS.RESET_PACKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.map(p => ({ ...p, packed: false, packedBy: null })),
      }))

    // ─── Ideas (Voting Room) ───
    case ACTIONS.ADD_IDEA:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        ideas: [{
          id: generateId(),
          status: 'pending', // pending, consensus, rejected
          votes: {}, // { userId: 1 | -1 }
          createdAt: new Date().toISOString(),
          ...payload
        }, ...(trip.ideas || [])],
      }))

    case ACTIONS.VOTE_IDEA:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        ideas: (trip.ideas || []).map(idea => {
          if (idea.id !== payload.ideaId) return idea
          const currentVote = idea.votes[payload.userId]
          const newVotes = { ...idea.votes }

          if (currentVote === payload.voteType) {
            // Toggle off if clicking the same vote again
            delete newVotes[payload.userId]
          } else {
            // Apply new vote
            newVotes[payload.userId] = payload.voteType
          }
          return { ...idea, votes: newVotes }
        }),
      }))

    case ACTIONS.UPDATE_IDEA_STATUS:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        ideas: (trip.ideas || []).map(idea => idea.id === payload.ideaId ? { ...idea, status: payload.status } : idea),
      }))

    case ACTIONS.DELETE_IDEA:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        ideas: (trip.ideas || []).filter(idea => idea.id !== payload),
      }))

    // ─── Polls (Voting Room Pipeline) ───
    case ACTIONS.CREATE_POLL:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        polls: [{
          id: generateId(),
          title: payload.title || 'New Poll',
          status: 'active',
          createdAt: new Date().toISOString(),
          deadline: payload.deadline || null,
          proposerId: payload.proposerId,
          options: payload.options || [],
          votes: {} // { userId: { tokens: { optionId: count }, veto: optionId | null } }
        }, ...(trip.polls || [])],
        // Optionally remove the ideas that were converted from the board
        ideas: payload.removeIdeas ? (trip.ideas || []).filter(i => !payload.options.some(o => o.id === i.id)) : trip.ideas
      }))

    case ACTIONS.VOTE_POLL:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        polls: (trip.polls || []).map(poll => {
          if (poll.id !== payload.pollId) return poll

          const userVotes = poll.votes[payload.userId] || { tokens: {}, veto: null }
          const newUserVotes = { ...userVotes, tokens: { ...userVotes.tokens } }

          if (payload.type === 'token') {
            const currentObj = newUserVotes.tokens[payload.optionId] || 0
            if (payload.action === 'add') {
              newUserVotes.tokens[payload.optionId] = currentObj + 1
            } else if (payload.action === 'remove' && currentObj > 0) {
              newUserVotes.tokens[payload.optionId] = currentObj - 1
            }
          } else if (payload.type === 'veto') {
            if (newUserVotes.veto === payload.optionId) {
              newUserVotes.veto = null // toggle off
            } else {
              newUserVotes.veto = payload.optionId // toggle on
            }
          }

          return { ...poll, votes: { ...poll.votes, [payload.userId]: newUserVotes } }
        }),
      }))

    case ACTIONS.RESOLVE_POLL:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        polls: (trip.polls || []).map(poll => poll.id === payload.pollId ? { ...poll, status: 'resolved' } : poll),
      }))

    case ACTIONS.DELETE_POLL:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        polls: (trip.polls || []).filter(poll => poll.id !== payload),
      }))

    case ACTIONS.CANCEL_POLL:
      return updateTrip(state, activeTripId, trip => {
        const pollToCancel = (trip.polls || []).find(p => p.id === payload)
        if (!pollToCancel) return trip
        return {
          ...trip,
          polls: trip.polls.filter(p => p.id !== payload),
          // Put the poll's ideas back onto the board
          ideas: [...(trip.ideas || []), ...pollToCancel.options]
        }
      })

    // ─── Cities ───
    // payload: { fromIndex, toIndex }
    // payload: { fromIndex, toIndex }
    case ACTIONS.REORDER_CITIES: {
      return updateTrip(state, activeTripId, trip => {
        const cities = [...(trip.cities || [])]
        if (cities.length === 0 || payload.fromIndex === payload.toIndex) return trip

        const [moved] = cities.splice(payload.fromIndex, 1)
        cities.splice(payload.toIndex, 0, moved)

        // Sync destinations: re-sort only the waypoints whose city appears in
        // the cities guide. Waypoints outside the guide (e.g. origin/return legs)
        // stay at their original positions.
        const cityOrder = Object.fromEntries(cities.map((c, i) => [c.city, i]))
        const destinations = [...(trip.destinations || [])]

        const inCityIndices = destinations
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => cityOrder[d.city] !== undefined)
          .map(({ i }) => i)

        const inCityDests = inCityIndices
          .map(i => destinations[i])
          .sort((a, b) => cityOrder[a.city] - cityOrder[b.city])

        inCityIndices.forEach((destIdx, j) => {
          destinations[destIdx] = inCityDests[j]
        })

        return { ...trip, cities, destinations }
      })
    }

    case ACTIONS.UPDATE_CITY: {
      // Read current trip from state (not yet inside updateTrip callback)
      const currentTrip = state.trips[activeTripId]
      const oldCity = (currentTrip?.cities || []).find(c => c.id === payload.id)
      const oldName = oldCity?.city
      const { city: newName, country: newCountry, flag: newFlag, lat: newLat, lng: newLng } = payload.updates
      const identityChanged = newName !== undefined || newCountry !== undefined || newFlag !== undefined || newLat !== undefined || newLng !== undefined
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        cities: trip.cities.map(c => c.id === payload.id ? { ...c, ...payload.updates } : c),
        // Sync name / country / flag changes into route waypoints
        destinations: (identityChanged && oldName)
          ? (trip.destinations || []).map(d =>
            d.city === oldName
              ? {
                ...d,
                ...(newName !== undefined && { city: newName }),
                ...(newCountry !== undefined && { country: newCountry }),
                ...(newFlag !== undefined && { flag: newFlag }),
                ...(newLat !== undefined && { lat: newLat }),
                ...(newLng !== undefined && { lng: newLng }),
              }
              : d
          )
          : trip.destinations,
      }))
    }

    // payload: { city, country, flag }
    case ACTIONS.ADD_CITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        cities: [...(trip.cities || []), {
          id: generateId(),
          city: payload.city || 'New City',
          country: payload.country || '',
          flag: payload.flag || '🌍',
          lat: payload.lat,
          lng: payload.lng,
          highlights: '',
          mustDo: '',
          weather: '',
          currencyTip: '',
          notes: '',
          savedPins: [],
        }],
        // Keep destinations in sync — append new waypoint to route
        destinations: [...(trip.destinations || []), {
          city: payload.city || 'New City',
          country: payload.country || '',
          flag: payload.flag || '🌍',
          lat: payload.lat,
          lng: payload.lng,
        }],
      }))

    case ACTIONS.DELETE_CITY: {
      // Read current trip from state to find deleted city name before mutating
      const currentTripForDelete = state.trips[activeTripId]
      const deletedCity = (currentTripForDelete?.cities || []).find(c => c.id === payload)
      const deletedName = deletedCity?.city
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        cities: trip.cities.filter(c => c.id !== payload),
        // Remove all route waypoints with that city name
        destinations: deletedName
          ? (trip.destinations || []).filter(d => d.city !== deletedName)
          : trip.destinations,
      }))
    }

    // ─── Notes ───
    case ACTIONS.UPDATE_NOTES:
      return updateTrip(state, activeTripId, { notes: payload })

    // ─── Share ───
    // payload: shareId string
    case ACTIONS.GENERATE_SHARE_LINK:
      return updateTrip(state, payload.tripId, { shareId: payload.shareId })

    case ACTIONS.REVOKE_SHARE_LINK:
      return updateTrip(state, payload, { shareId: null })

    // ─── Post-Trip ───
    case ACTIONS.ARCHIVE_TRIP:
      return updateTrip(state, payload, { archivedAt: new Date().toISOString() })

    case ACTIONS.UNARCHIVE_TRIP:
      return updateTrip(state, payload, { archivedAt: null })

    case ACTIONS.DUPLICATE_AS_TEMPLATE: {
      const { tripId, profileId, uid } = payload
      const original = state.trips[tripId]
      if (!original) return state
      const newId = generateId()
      const clone = cloneDeep(original)
      // Strip personal / trip-specific data
      clone.id = newId
      clone.name = original.name + ' (Template)'
      clone.createdAt = new Date().toISOString()
      clone.startDate = ''
      clone.endDate = ''
      clone.shareId = null
      clone.archivedAt = null
      clone.spendingLog = []
      // Strip booking confirmation numbers, paid amounts, and reset status
      clone.bookings = (clone.bookings || []).map(b => ({
        ...b,
        confirmationNumber: '',
        amountPaid: 0,
        status: 'not_started',
      }))
      // Strip activity dates from itinerary days (keep dayNumber, location, activities)
      clone.itinerary = (clone.itinerary || []).map(d => ({
        ...d,
        id: generateId(),
        date: '',
      }))
      // Reset packing
      clone.packingList = (clone.packingList || []).map(p => ({ ...p, packed: false, packedBy: null }))
      // Clear member-specific data
      clone.memberIds = uid ? [uid] : []
      clone.travelerIds = profileId ? [profileId] : []
      return { ...state, trips: { ...state.trips, [newId]: clone }, activeTripId: newId }
    }

    // ─── Firestore sync ───
    // Replaces the entire trips map with data from a Firestore snapshot.
    // Preserves activeTripId if the active trip still exists in the new map.
    case ACTIONS.SET_TRIPS_FROM_FIRESTORE: {
      // payload can be `{ trips: {...}, deletedIds: [...] }` or just `{...}` for backward compatibility
      const { trips: newTrips, deletedIds = [] } = payload.trips ? payload : { trips: payload, deletedIds: [] }

      const mergedTrips = { ...state.trips }
      // Apply all trips from Firestore (these are authoritative)
      Object.assign(mergedTrips, newTrips)

      // Remove trips that were deleted remotely to avoid resurrection
      deletedIds.forEach(id => {
        delete mergedTrips[id]
      })

      const ids = Object.keys(mergedTrips)
      const currentActiveId = state.activeTripId
      const newActiveId =
        currentActiveId && mergedTrips[currentActiveId]
          ? currentActiveId
          : ids.length > 0
            ? ids[0]
            : null
      return { ...state, trips: mergedTrips, activeTripId: newActiveId }
    }

    default:
      return state
  }
}
