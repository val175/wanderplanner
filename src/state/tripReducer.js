import { itineraryCases } from './slices/itinerarySlice'
import { bookingCases } from './slices/bookingSlice'
import { budgetCases } from './slices/budgetSlice'
import { todoCases } from './slices/todoSlice'
import { packingCases } from './slices/packingSlice'
import { votingCases } from './slices/votingSlice'
import { citiesCases } from './slices/citiesSlice'
import { tripCrudCases } from './slices/tripCrudSlice'
import { documentCases } from './slices/documentSlice'

// ─── Action Types ────────────────────────────────────────────────────────────
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
  SET_AI_VIEW_MODE: 'SET_AI_VIEW_MODE',
  TOGGLE_AI_SIDEBAR: 'TOGGLE_AI_SIDEBAR',
  SET_AI_OPEN: 'SET_AI_OPEN',

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

  // Booking comments
  ADD_BOOKING_COMMENT: 'ADD_BOOKING_COMMENT',
  UPDATE_BOOKING_COMMENT: 'UPDATE_BOOKING_COMMENT',
  DELETE_BOOKING_COMMENT: 'DELETE_BOOKING_COMMENT',

  // Documents
  SET_DOCUMENTS_FOR_TRIP: 'SET_DOCUMENTS_FOR_TRIP',
  ADD_DOCUMENT: 'ADD_DOCUMENT',
  UPDATE_DOCUMENT: 'UPDATE_DOCUMENT',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',
  LINK_DOCUMENT: 'LINK_DOCUMENT',
  UNLINK_DOCUMENT: 'UNLINK_DOCUMENT',

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
  ADD_TODO_COMMENT: 'ADD_TODO_COMMENT',
  UPDATE_TODO_COMMENT: 'UPDATE_TODO_COMMENT',
  DELETE_TODO_COMMENT: 'DELETE_TODO_COMMENT',
  DELETE_TODO: 'DELETE_TODO',
  SET_TODOS: 'SET_TODOS',

  // Packing
  ADD_PACKING_ITEM: 'ADD_PACKING_ITEM',
  TOGGLE_PACKING_ITEM: 'TOGGLE_PACKING_ITEM',
  UPDATE_PACKING_ITEM: 'UPDATE_PACKING_ITEM',
  DELETE_PACKING_ITEM: 'DELETE_PACKING_ITEM',
  RESET_PACKING: 'RESET_PACKING',
  ADD_PACKING_SECTION: 'ADD_PACKING_SECTION',

  // Wanda conversation + AI alerts
  UPDATE_WANDA_CONVERSATION: 'UPDATE_WANDA_CONVERSATION',
  CLEAR_WANDA_CONVERSATION: 'CLEAR_WANDA_CONVERSATION',
  ADD_WANDA_ALERT: 'ADD_WANDA_ALERT',
  CLEAR_WANDA_ALERTS: 'CLEAR_WANDA_ALERTS',

  // Itinerary — batch add
  BATCH_ADD_ACTIVITIES: 'BATCH_ADD_ACTIVITIES',

  // Activity comments
  ADD_ACTIVITY_COMMENT: 'ADD_ACTIVITY_COMMENT',
  UPDATE_ACTIVITY_COMMENT: 'UPDATE_ACTIVITY_COMMENT',
  DELETE_ACTIVITY_COMMENT: 'DELETE_ACTIVITY_COMMENT',

  // Ideas
  ADD_IDEA: 'ADD_IDEA',
  VOTE_IDEA: 'VOTE_IDEA',
  UPDATE_IDEA: 'UPDATE_IDEA',
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

// ─── UI / Navigation cases (pure state shape, no trip data) ──────────────────
const uiCases = {
  SET_TAB: (state, payload) => ({ ...state, activeTab: payload }),
  TOGGLE_SIDEBAR: (state) => ({ ...state, sidebarOpen: !state.sidebarOpen }),
  SET_SIDEBAR: (state, payload) => ({ ...state, sidebarOpen: payload }),
  SET_AI_VIEW_MODE: (state, payload) =>
    ({ ...state, aiViewMode: payload === 'sidebar' ? 'sidebar' : 'floating' }),
  TOGGLE_AI_SIDEBAR: (state) =>
    ({ ...state, aiViewMode: state.aiViewMode === 'sidebar' ? 'floating' : 'sidebar' }),
  SET_AI_OPEN: (state, payload) => ({ ...state, aiOpen: !!payload }),
  SHOW_TOAST: (state, payload) =>
    ({ ...state, toast: { message: payload.message, type: payload.type || 'success', visible: true } }),
  HIDE_TOAST: (state) => ({ ...state, toast: { ...state.toast, visible: false } }),
  TOGGLE_DARK_MODE: (state) => ({ ...state, darkMode: !state.darkMode }),
}

// ─── Combined case lookup ─────────────────────────────────────────────────────
const allCases = {
  ...uiCases,
  ...tripCrudCases,
  ...itineraryCases,
  ...bookingCases,
  ...budgetCases,
  ...todoCases,
  ...packingCases,
  ...votingCases,
  ...citiesCases,
  ...documentCases,
}

// ─── Root reducer ─────────────────────────────────────────────────────────────
export function tripReducer(state, action) {
  const { type, payload } = action
  const handler = allCases[type]
  if (handler) return handler(state, payload)
  return state
}
