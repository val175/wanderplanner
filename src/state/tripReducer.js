import { generateId, cloneDeep } from '../utils/helpers'

// Action Types
export const ACTIONS = {
  // Trip CRUD
  SET_ACTIVE_TRIP: 'SET_ACTIVE_TRIP',
  ADD_TRIP: 'ADD_TRIP',
  UPDATE_TRIP: 'UPDATE_TRIP',
  DELETE_TRIP: 'DELETE_TRIP',
  DUPLICATE_TRIP: 'DUPLICATE_TRIP',
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
  ADD_ACTIVITY: 'ADD_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',

  // Bookings
  ADD_BOOKING: 'ADD_BOOKING',
  UPDATE_BOOKING: 'UPDATE_BOOKING',
  DELETE_BOOKING: 'DELETE_BOOKING',
  CYCLE_BOOKING_STATUS: 'CYCLE_BOOKING_STATUS',

  // Budget
  UPDATE_BUDGET_CATEGORY: 'UPDATE_BUDGET_CATEGORY',
  ADD_BUDGET_CATEGORY: 'ADD_BUDGET_CATEGORY',
  DELETE_BUDGET_CATEGORY: 'DELETE_BUDGET_CATEGORY',
  ADD_SPENDING: 'ADD_SPENDING',
  DELETE_SPENDING: 'DELETE_SPENDING',

  // Todos
  ADD_TODO: 'ADD_TODO',
  TOGGLE_TODO: 'TOGGLE_TODO',
  UPDATE_TODO: 'UPDATE_TODO',
  DELETE_TODO: 'DELETE_TODO',

  // Packing
  ADD_PACKING_ITEM: 'ADD_PACKING_ITEM',
  TOGGLE_PACKING_ITEM: 'TOGGLE_PACKING_ITEM',
  DELETE_PACKING_ITEM: 'DELETE_PACKING_ITEM',
  RESET_PACKING: 'RESET_PACKING',
  ADD_PACKING_SECTION: 'ADD_PACKING_SECTION',

  // Cities
  UPDATE_CITY: 'UPDATE_CITY',

  // Notes
  UPDATE_NOTES: 'UPDATE_NOTES',

  // Activity Log
  LOG_ACTIVITY: 'LOG_ACTIVITY',
}

const STATUS_CYCLE = ['not_started', 'in_progress', 'booked']

function updateTrip(state, tripId, updater) {
  const trips = { ...state.trips }
  const trip = trips[tripId]
  if (!trip) return state
  trips[tripId] = typeof updater === 'function' ? updater(trip) : { ...trip, ...updater }
  return { ...state, trips }
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

    // ─── Itinerary ───
    case ACTIONS.ADD_DAY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: [...trip.itinerary, {
          id: generateId(),
          date: payload.date || '',
          dayNumber: trip.itinerary.length + 1,
          location: payload.location || '',
          emoji: payload.emoji || '📍',
          activities: [],
          notes: '',
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

    case ACTIONS.ADD_ACTIVITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        itinerary: trip.itinerary.map(d =>
          d.id === payload.dayId
            ? { ...d, activities: [...d.activities, { id: generateId(), time: '', name: '', emoji: '📌', notes: '', ...payload.activity }] }
            : d
        ),
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

    // ─── Bookings ───
    case ACTIONS.ADD_BOOKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        bookings: [...trip.bookings, { id: generateId(), status: 'not_started', priority: false, amountPaid: 0, confirmationNumber: '', currency: trip.currency, ...payload }],
      }))

    case ACTIONS.UPDATE_BOOKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        bookings: trip.bookings.map(b => b.id === payload.id ? { ...b, ...payload.updates } : b),
      }))

    case ACTIONS.DELETE_BOOKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        bookings: trip.bookings.filter(b => b.id !== payload),
      }))

    case ACTIONS.CYCLE_BOOKING_STATUS:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        bookings: trip.bookings.map(b => {
          if (b.id !== payload) return b
          const currentIndex = STATUS_CYCLE.indexOf(b.status)
          const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
          return { ...b, status: nextStatus }
        }),
      }))

    // ─── Budget ───
    case ACTIONS.UPDATE_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: trip.budget.map(b => b.id === payload.id ? { ...b, ...payload.updates } : b),
      }))

    case ACTIONS.ADD_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: [...trip.budget, { id: generateId(), name: payload.name || 'New Category', emoji: payload.emoji || '📌', min: 0, max: 0, actual: 0 }],
      }))

    case ACTIONS.DELETE_BUDGET_CATEGORY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        budget: trip.budget.filter(b => b.id !== payload),
      }))

    case ACTIONS.ADD_SPENDING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        spendingLog: [...trip.spendingLog, { id: generateId(), date: new Date().toISOString().slice(0, 10), ...payload }],
      }))

    case ACTIONS.DELETE_SPENDING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        spendingLog: trip.spendingLog.filter(s => s.id !== payload),
      }))

    // ─── Todos ───
    case ACTIONS.ADD_TODO:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        todos: [...trip.todos, { id: generateId(), done: false, priority: 'normal', dueDate: '', category: 'Misc', ...payload }],
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

    // ─── Packing ───
    case ACTIONS.ADD_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: [...trip.packingList, { id: generateId(), packed: false, section: 'Misc', ...payload }],
      }))

    case ACTIONS.TOGGLE_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.map(p => p.id === payload ? { ...p, packed: !p.packed } : p),
      }))

    case ACTIONS.DELETE_PACKING_ITEM:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.filter(p => p.id !== payload),
      }))

    case ACTIONS.RESET_PACKING:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        packingList: trip.packingList.map(p => ({ ...p, packed: false })),
      }))

    // ─── Cities ───
    case ACTIONS.UPDATE_CITY:
      return updateTrip(state, activeTripId, trip => ({
        ...trip,
        cities: trip.cities.map(c => c.id === payload.id ? { ...c, ...payload.updates } : c),
      }))

    // ─── Notes ───
    case ACTIONS.UPDATE_NOTES:
      return updateTrip(state, activeTripId, { notes: payload })

    default:
      return state
  }
}
