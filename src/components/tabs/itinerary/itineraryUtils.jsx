/**
 * Shared utilities for ItineraryTab sub-components.
 * Avoids prop-drilling utility functions across DayGroupTable, KanbanColumn, etc.
 */
import { normalizeTimeString } from '../../../utils/helpers'
import { GLOBAL_CATEGORIES } from '../../../constants/categories'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

export const CAT_THEME_CLASSES = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
}

export function getActivityAccent(emoji) {
  const map = {
    '✈️': 'border-l-info text-info', '🛫': 'border-l-info text-info', '🛬': 'border-l-info text-info',
    '🏨': 'border-l-success text-success', '🛏️': 'border-l-success text-success',
    '🍜': 'border-l-warning text-warning', '🍽️': 'border-l-warning text-warning', '🥘': 'border-l-warning text-warning', '🍺': 'border-l-warning text-warning', '☕': 'border-l-warning text-warning',
    '🎵': 'border-l-accent text-accent', '🎸': 'border-l-accent text-accent', '🎤': 'border-l-accent text-accent',
    '🎯': 'border-l-accent text-accent', '🏛️': 'border-l-accent text-accent',
    '🚕': 'border-l-[var(--color-text-muted)] text-text-muted', '🚂': 'border-l-[var(--color-text-muted)] text-text-muted', '⛴️': 'border-l-[var(--color-text-muted)] text-text-muted',
  }
  return map[emoji] || 'border-l-border text-border-strong'
}

export function getCategoryTheme(categoryId) {
  return GLOBAL_CATEGORIES.find(c => c.id === categoryId) || GLOBAL_CATEGORIES[7]
}

export function getLocationDetails(location) {
  if (!location) {
    return { label: '', rating: null, reviewCount: null, openingHours: '', isOpenNow: null }
  }
  if (typeof location === 'string') {
    return { label: location, rating: null, reviewCount: null, openingHours: '', isOpenNow: null }
  }
  return {
    label: location.placeName || '',
    rating: location.rating ?? null,
    reviewCount: location.reviewCount ?? null,
    openingHours: location.openingHours || '',
    isOpenNow: typeof location.isOpenNow === 'boolean' ? location.isOpenNow : null,
  }
}

/** Parse a time string to total minutes; returns null if unparseable. */
export function timeToMins(t) {
  const normalized = normalizeTimeString(t)
  if (!normalized) return null
  const [h, m] = normalized.split(':').map(Number)
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m
}

/** Returns activities from `list` that overlap with the given time range. */
export function getConflicts(list, startTime, endTime, excludeId = null) {
  const s = timeToMins(startTime)
  const e = timeToMins(endTime)
  if (s === null || e === null || s >= e) return []
  return list.filter(a => {
    if (a.id === excludeId) return false
    const as = timeToMins(a.time)
    const ae = timeToMins(a.endTime)
    if (as === null || ae === null || as >= ae) return false
    return s < ae && e > as
  })
}

export function CategoryPill({ value, onChange, disabled }) {
  const cat = GLOBAL_CATEGORIES.find(c => c.id === value) || GLOBAL_CATEGORIES[7]
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          className={`inline-flex items-center justify-center gap-1 min-h-[44px] sm:min-h-0 px-3 sm:px-2 py-1 sm:py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary transition-colors ${disabled ? 'cursor-default' : 'hover:bg-bg-hover'}`}
        >
          <span className="text-lg sm:text-base">{cat.emoji}</span>
          <span className="hidden sm:inline">{cat.label}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[9999] rounded-[var(--radius-md)] border border-border bg-bg-card min-w-[140px] py-1 animate-scale-in focus:outline-none"
        >
          {GLOBAL_CATEGORIES.map(c => (
            <DropdownMenu.Item
              key={c.id}
              onSelect={() => onChange(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none outline-none transition-colors
                ${c.id === value
                  ? 'text-accent font-semibold data-[highlighted]:bg-accent/15'
                  : 'text-text-secondary data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary'
                }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full border ${CAT_THEME_CLASSES[c.color]?.bg || 'bg-bg-card'} ${CAT_THEME_CLASSES[c.color]?.border || 'border-border'}`} />
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
