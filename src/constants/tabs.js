import {
  LayoutDashboard, Map, CalendarDays, Ticket, Wallet, ListChecks,
  Vote, Clapperboard, Building2, FileText, Luggage, Music,
} from 'lucide-react'
import { GLOBAL_CATEGORIES } from './categories'

// `icon` (lucide component) is the canonical nav glyph — render at 16–20px,
// strokeWidth 1.75. `emoji` is retained for content surfaces (e.g. search
// result chips) and as a fallback, never for primary nav chrome.
export const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', emoji: '🗺️', icon: LayoutDashboard },
  { id: 'wandermap', label: 'Map', emoji: '📍', icon: Map },
  { id: 'itinerary', label: 'Itinerary', emoji: '📅', icon: CalendarDays },
  { id: 'bookings', label: 'Bookings', emoji: '🎫', icon: Ticket },
  { id: 'budget', label: 'Budget', emoji: '💰', icon: Wallet },
  { id: 'todo', label: 'To-Do', emoji: '✅', icon: ListChecks },
  { id: 'voting', label: 'Voting', emoji: '🗳️', icon: Vote },
  { id: 'videos', label: 'How-To', emoji: '🎬', icon: Clapperboard },
  { id: 'cities', label: 'Cities', emoji: '🏙️', icon: Building2 },
  { id: 'documents', label: 'Documents', emoji: '📄', icon: FileText },
  { id: 'packing', label: 'Packing', emoji: '🧳', icon: Luggage },
  { id: 'concert', label: 'Concert', emoji: '🎵', icon: Music, conditional: true },
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
