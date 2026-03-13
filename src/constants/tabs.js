import { GLOBAL_CATEGORIES } from './categories'

export const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', emoji: '🗺️' },
  { id: 'wandermap', label: 'Map', emoji: '📍' },
  { id: 'itinerary', label: 'Itinerary', emoji: '📅' },
  { id: 'bookings', label: 'Bookings', emoji: '🎫' },
  { id: 'budget', label: 'Budget', emoji: '💰' },
  { id: 'todo', label: 'To-Do', emoji: '✅' },
  { id: 'voting', label: 'Voting', emoji: '🗳️' },
  { id: 'cities', label: 'Cities', emoji: '🏙️' },
  { id: 'packing', label: 'Packing', emoji: '🧳' },
  { id: 'concert', label: 'Concert', emoji: '🎵', conditional: true },
]

export const BOOKING_CATEGORIES = GLOBAL_CATEGORIES

export const BOOKING_STATUSES = [
  { id: 'not_started', label: 'Not Started', color: 'text-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'warning' },
  { id: 'booked', label: 'Booked ✓', color: 'success' },
]

export const TODO_PHASES = [
  { id: 'planning', label: 'Planning & Booking', subtitle: 'Months before departure', color: 'bg-accent', textClass: 'text-accent' },
  { id: 'logistics', label: 'Logistics & Prep', subtitle: 'Weeks before departure', color: 'bg-accent', textClass: 'text-text-primary' },
  { id: 'last_minute', label: 'Last Minute', subtitle: 'Days before departure', color: 'bg-accent', textClass: 'text-text-primary' },
  { id: 'post_trip', label: 'Post-Trip', subtitle: 'After returning home', color: 'bg-accent', textClass: 'text-text-primary' }
]

export const TODO_STATUSES = [
  { id: 'not_started', label: 'Not Started', colors: 'bg-text-muted/10 text-text-muted border-text-muted/20' },
  { id: 'in_progress', label: 'In Progress', colors: 'bg-warning/10 text-warning border-warning/20' },
  { id: 'done', label: 'Done', colors: 'bg-success/10 text-success border-success/20' },
]

export const PACKING_SECTIONS = ['Documents', 'Clothing', 'Tech', 'Concert Essentials', 'Toiletries', 'Misc']
