import { useState, useRef, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import TabHeader from '../common/TabHeader'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import TimePicker from '../shared/TimePicker'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import ConfirmDialog from '../shared/ConfirmDialog'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate, formatCurrency, addMinutesToTime } from '../../utils/helpers'
import { ACTIVITY_EMOJIS } from '../../constants/emojis'
import { COUNTRY_TIMEZONE, getUTCOffsetHours, applyTimezoneOffset, FLIGHT_ACTIVITY_PATTERNS, FLIGHT_EMOJIS } from '../../utils/timezones'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import { DAY_COLORS } from '../../constants/colors'
import { GLOBAL_CATEGORIES } from '../../constants/categories'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Select, { SelectItem } from '../shared/Select'
import { useDrag } from '@use-gesture/react'
import { useEffect } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useSmartLocation } from '../../hooks/useSmartLocation'
import LocationAutocomplete from '../shared/LocationAutocomplete'
import EmptyState from '../shared/EmptyState'
import ActivityDrawer from './ActivityDrawer'

// ── Utilities ──────────────────────────────────────────────────────────────
function getActivityAccent(emoji) {
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

function getCategoryTheme(categoryId) {
  const cat = GLOBAL_CATEGORIES.find(c => c.id === categoryId) || GLOBAL_CATEGORIES[7]
  return cat
}

const CAT_THEME_CLASSES = {
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
  pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
}

function CategoryPill({ value, onChange, disabled }) {
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
// ── Time Conflict Utilities ────────────────────────────────────────────────
function timeToMins(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return isNaN(h) || isNaN(m) ? null : h * 60 + m
}

/** Returns activities from `list` that overlap with the given time range. */
function getConflicts(list, startTime, endTime, excludeId = null) {
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

function AddActivityModal({ isOpen, onClose, itinerary, onAdd }) {
  const [activityData, setActivityData] = useState({ name: '', time: '', dayId: '', duration: 60, endTime: '' })

  // Sync endTime when time or duration changes
  useEffect(() => {
    if (activityData.time && activityData.duration) {
      const newEndTime = addMinutesToTime(activityData.time, activityData.duration)
      if (newEndTime !== activityData.endTime) {
        setActivityData(prev => ({ ...prev, endTime: newEndTime }))
      }
    }
  }, [activityData.time, activityData.duration, activityData.endTime])

  // Reset/Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivityData({
        name: '',
        time: '',
        dayId: itinerary[0]?.id || '',
        duration: 60,
        endTime: ''
      })
    }
  }, [isOpen, itinerary])

  // Detect time conflicts against the selected day's existing activities
  const conflicts = useMemo(() => {
    if (!activityData.dayId || !activityData.time || !activityData.endTime) return []
    const day = itinerary.find(d => d.id === activityData.dayId)
    return getConflicts(day?.activities || [], activityData.time, activityData.endTime)
  }, [activityData.dayId, activityData.time, activityData.endTime, itinerary])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!activityData.name.trim() || !activityData.dayId) return
    onAdd({
      dayId: activityData.dayId,
      activity: {
        name: activityData.name.trim(),
        time: activityData.time,
        duration: activityData.duration,
        endTime: activityData.endTime,
        category: activityData.category || 'other'
      }
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📅 Add New Activity">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Day</label>
          <Select
            value={activityData.dayId}
            onValueChange={v => setActivityData(prev => ({ ...prev, dayId: v }))}
          >
            {itinerary.map(day => (
              <SelectItem key={day.id} value={day.id}>
                Day {day.dayNumber}: {day.location || 'Untitled Location'} ({day.date ? formatDate(day.date, 'short') : 'No date'})
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Activity Name</label>
          <input
            value={activityData.name}
            onChange={e => setActivityData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Dinner at 7-Eleven"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
          <Select
            value={activityData.category || 'other'}
            onValueChange={val => setActivityData(prev => ({ ...prev, category: val }))}
          >
            {GLOBAL_CATEGORIES.map(c => (
              <SelectItem key={c.id} value={c.id}>
                <span className="flex items-center gap-2">
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </span>
              </SelectItem>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Start Time</label>
            <TimePicker
              variant="input"
              value={activityData.time}
              onChange={time => setActivityData(prev => ({ ...prev, time }))}
              placeholder="Start"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">End Time</label>
            <TimePicker
              variant="input"
              value={activityData.endTime}
              onChange={endTime => setActivityData(prev => ({ ...prev, endTime }))}
              minTime={activityData.time}
              placeholder="End"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Duration (minutes)</label>
          <input
            type="number"
            value={activityData.duration}
            onChange={e => setActivityData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-warning/10 border border-warning/20 text-warning text-xs">
            <span className="mt-0.5">⚠️</span>
            <span>
              <span className="font-semibold">Time overlap</span> with{' '}
              {conflicts.map(c => c.name).join(', ')} — you can still add it.
            </span>
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={!activityData.name.trim() || !activityData.dayId}>
            Add Activity
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function DayGroupTable({ day, onReorderDay, trip, resolveLocation, isResolving, setActiveSearchActivity, onOpenDrawer }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [dragOverGroup, setDragOverGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState(null)

  useEffect(() => {
    const handleHighlight = (e) => {
      const { id, tab } = e.detail
      if (tab === 'itinerary' && day.activities?.some(a => a.id === id)) {
        setHighlightedActivityId(id)
        setExpanded(true)
        setTimeout(() => setHighlightedActivityId(null), 3000)
        
        // Try to scroll to it
        setTimeout(() => {
          const el = document.getElementById(`activity-${id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
    window.addEventListener('highlight-item', handleHighlight)
    return () => window.removeEventListener('highlight-item', handleHighlight)
  }, [day.activities])

  // ── Body Clock: compute offset delta for this day ──
  // homeCountry = first city in trip, destinationCountry = city matching day.location
  const bodyClockOffsetHours = useMemo(() => {
    if (!trip?.cities?.length) return null
    const homeCountry = trip.cities[0]?.country
    if (!homeCountry) return null
    const homeTz = COUNTRY_TIMEZONE[homeCountry]
    if (!homeTz) return null

    // Find the destination city — match day.location against city names
    const destCity = trip.cities.find(c =>
      day.location && c.city && day.location.toLowerCase().includes(c.city.toLowerCase())
    ) || (trip.cities.length > 1 ? trip.cities[trip.cities.length - 1] : null)

    const destCountry = destCity?.country
    if (!destCountry || destCountry === homeCountry) return null
    const destTz = COUNTRY_TIMEZONE[destCountry]
    if (!destTz) return null

    const homeOffset = getUTCOffsetHours(homeTz)
    const destOffset = getUTCOffsetHours(destTz)
    if (homeOffset === null || destOffset === null) return null

    const delta = homeOffset - destOffset // positive = home is ahead
    return Math.abs(delta) >= 2 ? delta : null
  }, [trip, day.location])

  const handleDropActivity = (e, targetIndex) => {
    if (isReadOnly) return
    e.preventDefault()
    e.stopPropagation()
    setDragOverGroup(false)
    const sourceDataStr = e.dataTransfer.getData('application/json')
    if (!sourceDataStr) return
    const { type, sourceDayId, activityId, sourceIndex } = JSON.parse(sourceDataStr)

    if (type === 'activity') {
      if (sourceDayId === day.id) {
        if (sourceIndex !== targetIndex) {
          dispatch({ type: ACTIONS.REORDER_ACTIVITIES, payload: { dayId: day.id, fromIndex: sourceIndex, toIndex: targetIndex } })
        }
      } else {
        dispatch({ type: ACTIONS.MOVE_ACTIVITY_BETWEEN_DAYS, payload: { fromDayId: sourceDayId, toDayId: day.id, activityId, toIndex: targetIndex } })
      }
    }
  }

  return (
    <div
      className={`mb-8 transition-all ${dragOverGroup && !isReadOnly ? 'ring-2 ring-accent rounded-[var(--radius-md)]' : ''}`}
      draggable={!isReadOnly}
      onDragStart={e => {
        if (isReadOnly || !e.target.closest('.group-drag-handle')) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'day', dayId: day.id }))
      }}
      onDragOver={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOverGroup(true)
      }}
      onDragLeave={() => setDragOverGroup(false)}
      onDrop={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOverGroup(false)
        const sourceDataStr = e.dataTransfer.getData('application/json')
        if (!sourceDataStr) return
        const sourceData = JSON.parse(sourceDataStr)
        if (sourceData.type === 'day') {
          const fromIndex = trip.itinerary.findIndex(d => d.id === sourceData.dayId)
          const toIndex = trip.itinerary.findIndex(d => d.id === day.id)
          if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            onReorderDay(fromIndex, toIndex)
          }
        } else if (sourceData.type === 'activity') {
          handleDropActivity(e, day.activities?.length || 0)
        }
      }}
    >
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => dispatch({ type: ACTIONS.REMOVE_DAY, payload: day.id })}
        title={`Remove Day ${day.dayNumber}?`}
        message="This will permanently delete this day and all its activities. Cannot be undone."
        confirmLabel="Remove Day"
        danger
      />

      {/* Group Header (Monday-style smart headers) */}
      <div className="group/day relative flex items-center justify-between py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="group-drag-handle cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity mr-2">⠿</div>
          <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center bg-bg-card border border-border/20 rounded">
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>

          <div className="flex flex-col ml-2">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap text-balance">
                Day {day.dayNumber}:
              </span>
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap text-balance">
                {day.date ? formatDate(day.date, 'weekday') : ''}
              </span>
              <EditableText
                value={day.location || ''}
                onSave={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { location: val } } })}
                className="font-heading font-semibold text-text-primary text-base hover:text-text-secondary transition-colors"
                placeholder="Day Title (e.g. Rio Explorations)"
                readOnly={isReadOnly}
              />
            </div>
            <div className="text-xs font-medium text-text-muted mt-0.5 relative min-w-[150px]">
            <div className={`transition-opacity duration-150 ${!day.date ? 'opacity-0 group-hover/day:opacity-100' : ''}`}>
              <DatePicker
                value={day.date}
                onChange={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { date: val } } })}
                placeholder="Set date"
                className="bg-transparent border-transparent hover:border-border text-xs !px-1 w-auto max-w-[200px]"
                disabled={isReadOnly}
              />
            </div>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-text-muted">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-secondary/30">
            <span className="text-danger">📍</span>
            {day.activities?.length || 0} activities/locations
          </div>
          {(() => {
            const count = day.activities?.length || 0;
            if (count < 5) return (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success">
                <span>🔋</span> Chill
              </div>
            );
            if (count <= 8) return (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-info/10 text-info">
                <span>⚡</span> Active
              </div>
            );
            return (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#E27D60]/10 text-[#E27D60]">
                <span>🪫</span> Packed
              </div>
            );
          })()}
          {!isReadOnly && (
            <div className="flex gap-2">
              <button onClick={() => { (day.activities?.length > 0) ? setConfirmDelete(true) : dispatch({ type: ACTIONS.REMOVE_DAY, payload: day.id }) }} className="text-text-muted hover:text-danger px-2 opacity-0 group-hover/day:opacity-100 transition-opacity" title="Delete Day">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Group Grid Content */}
      {expanded && (
        <Card className="border border-border overflow-hidden shadow-none">
          <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
            <table className="w-full text-left border-collapse table-fixed min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[30px] overflow-hidden"></th>
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[100px] overflow-hidden">TIME</th>
                  <th className="px-0 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[30px] text-center overflow-hidden"></th>
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-auto text-left overflow-hidden">ACTIVITY</th>
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[140px] text-left overflow-hidden">CATEGORY</th>
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[25%] text-left overflow-hidden">LOCATION</th>
                  <th className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[80px] overflow-hidden"></th>
                </tr>
              </thead>
              <tbody>
                {day.activities?.map((activity, index, arr) => {
                  const accentMatch = getActivityAccent(activity.emoji).match(/text-([a-z]+)/)
                  const dotColor = accentMatch ? `bg-${accentMatch[1]}` : 'bg-border-strong'
                  const hasConflict = getConflicts(arr, activity.time, activity.endTime, activity.id).length > 0

                  return (
                    <Fragment key={activity.id}>
                      <tr
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: index }))
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleDropActivity(e, index)}
                        onClick={(e) => {
                          if (!e.target.closest('[data-no-drawer]')) {
                            onOpenDrawer({ activityId: activity.id, dayId: day.id })
                          }
                        }}
                        className="group/row hover:bg-bg-hover/50 transition-colors relative cursor-pointer border-t border-border/20"
                      >
                        {/* Drag Handle */}
                        <td className="px-2 pt-4 pb-2 align-top" data-no-drawer>
                          <div className="cursor-grab active:cursor-grabbing text-text-muted opacity-0 group-hover/row:opacity-100 text-center w-full pt-0.5">⠿</div>
                        </td>

                        {/* Time Column (Stacked) */}
                        <td className="px-2 pt-4 pb-2 align-top w-[100px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-[13px] font-semibold text-text-primary">
                              {activity.time || '—'}
                            </span>
                            <span className="text-[10px] text-text-muted font-mono">
                              {activity.endTime || ''}
                            </span>
                            {hasConflict && (
                              <span className="text-[9px] font-semibold text-warning bg-warning/10 rounded px-1 py-0.5 leading-none" title="Time overlap with another activity">
                                ⚠️ overlap
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Timeline */}
                        <td className="px-0 relative w-[30px] align-top group/timeline" data-no-drawer>
                          <div className={`absolute left-1/2 top-0 bottom-0 -ml-[1px] w-[2px] bg-border z-0 ${index === 0 ? 'top-5' : ''} ${index === arr.length - 1 ? 'bottom-[20%]' : ''}`}></div>
                          <div className={`relative z-10 w-2.5 h-2.5 rounded-full ${dotColor} mx-auto ring-4 ring-bg-card mt-5`}></div>
                          <button
                            data-no-drawer
                            onClick={() => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: {}, index: index } })}
                            className="absolute -top-3 left-1/2 -ml-3 w-6 h-6 rounded-full bg-bg-card border border-border text-lg font-light text-text-muted flex items-center justify-center opacity-0 group-hover/timeline:opacity-100 hover:bg-bg-hover hover:text-accent z-20 transition-all pb-0.5"
                            title="Insert before"
                          >+</button>
                        </td>

                        {/* Activity block */}
                        <td className="px-2 pt-3 pb-2 align-top">
                          <div className="flex-1 min-w-0">
                            <span className="text-[14px] text-text-primary font-semibold block truncate">
                              {activity.name || 'Untitled'}
                            </span>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-[11px] text-text-muted font-medium truncate uppercase tracking-tight">
                                {activity.location?.placeName || (typeof activity.location === 'string' ? activity.location : '') || '—'}
                              </span>
                              <span className="text-[10px] text-text-muted/60 font-medium">
                                {activity.duration || 60} mins
                              </span>
                            </div>
                            {/* Body Clock ghost-text */}
                            {bodyClockOffsetHours !== null && activity.time && (
                              FLIGHT_EMOJIS.has(activity.emoji) || FLIGHT_ACTIVITY_PATTERNS.test(activity.name || '')
                            ) && (() => {
                              const bodyTime = applyTimezoneOffset(activity.time, bodyClockOffsetHours)
                              return bodyTime ? (
                                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-text-muted/60 italic select-none">
                                  (that's {bodyTime} your body time 🧟)
                                </span>
                              ) : null
                            })()}
                            {activity.notes && (
                              <span className="text-[11px] text-text-muted/80 italic block mt-1 truncate">
                                {activity.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Category Column */}
                        <td className="px-2 pt-4 pb-2 align-top">
                          {(() => {
                            const cat = GLOBAL_CATEGORIES.find(c => c.id === (activity.category || 'other')) || GLOBAL_CATEGORIES[GLOBAL_CATEGORIES.length - 1]
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary whitespace-nowrap">
                                {cat.emoji} <span className="hidden sm:inline">{cat.label}</span>
                              </span>
                            )
                          })()}
                        </td>

                        {/* Location Column */}
                        <td className="px-2 pt-4 pb-2 align-top">
                          <span className="text-[12px] text-text-muted truncate block max-w-[160px]">
                            {activity.location?.placeName || (typeof activity.location === 'string' ? activity.location : '') || '—'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-2 pt-4 pb-2 align-top text-right pr-4" data-no-drawer>
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            {activity.comments?.length > 0 && (
                              <span className="text-[10px] font-semibold text-accent px-1">{activity.comments.length}</span>
                            )}
                            {(activity.notes || activity.link) && (
                              <span className="text-accent p-1 inline-flex" title="Has notes/link">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </span>
                            )}
                            {!isReadOnly && (
                              <button
                                data-no-drawer
                                onClick={() => {
                                  triggerHaptic('medium')
                                  dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })
                                }}
                                className="text-text-muted hover:text-danger p-2 inline-flex"
                                title="Delete"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Transit Row between activities */}
                      {index < arr.length - 1 && (
                        <tr className="group/transit hover:bg-bg-hover/50 transition-colors border-t border-border/20">
                          <td></td>
                          <td></td>
                          <td className="relative px-0 w-[30px] group/timeline">
                            <div className="absolute left-1/2 top-0 bottom-0 -ml-[1px] w-[2px] border-l-[2px] border-dashed border-border/30 z-0"></div>
                            {!isReadOnly && (
                              <button
                                onClick={() => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: {}, index: index + 1 } })}
                                className="absolute top-1/2 left-1/2 -mt-3 -ml-3 w-6 h-6 rounded-full bg-bg-card border border-border text-lg font-light text-text-muted flex items-center justify-center opacity-0 group-hover/timeline:opacity-100 hover:bg-bg-hover hover:text-accent z-20 transition-all pb-0.5"
                                title="Insert activity here"
                              >+</button>
                            )}
                          </td>
                          <td colSpan={3} className="py-2 pl-2">
                            <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted bg-bg-secondary/30 border border-border/50 rounded-full px-2.5 py-0.5 hover:border-text-primary transition-all duration-150 relative z-10 ${!activity.transit ? 'opacity-0 group-hover/transit:opacity-100' : ''}`}>
                              <Select
                                value={activity.transitEmoji || '🚕'}
                                onValueChange={v => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { transitEmoji: v } } })}
                                disabled={isReadOnly}
                                className="bg-transparent border-transparent px-0 py-0 text-[11px] font-medium text-text-muted hover:bg-transparent"
                              >
                                <SelectItem value="🚕">🚕</SelectItem>
                                <SelectItem value="🚶">🚶</SelectItem>
                                <SelectItem value="🚇">🚇</SelectItem>
                                <SelectItem value="🚌">🚌</SelectItem>
                                <SelectItem value="🚆">🚆</SelectItem>
                                <SelectItem value="🚲">🚲</SelectItem>
                                <SelectItem value="✈️">✈️</SelectItem>
                                <SelectItem value="⛴️">⛴️</SelectItem>
                                <SelectItem value="🚗">🚗</SelectItem>
                              </Select>
                              <span className="sr-only">Transit type</span>
                              <EditableText
                                value={activity.transit || ''}
                                onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { transit: val } } })}
                                className="min-w-[50px] inline-flex items-center"
                                inputClassName="px-0 py-0 text-[11px] font-medium w-[100px] bg-transparent"
                                placeholder="Add transit"
                                readOnly={isReadOnly}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                      }
                    </Fragment>
                  )
                })}

                {/* Final Anchor Row (So the timeline line has somewhere to land cleanly) */}
                <tr className="h-4">
                  <td></td><td></td>
                  <td className="relative px-0 w-[30px]">
                    {day.activities?.length > 0 && <div className="absolute left-1/2 top-0 h-4 -ml-[1px] w-[2px] bg-border z-0"></div>}
                  </td>
                  <td colSpan={3}></td>
                </tr>

              </tbody>
            </table>
          </div>
        </Card>
      )
      }
    </div >
  )
}

function KanbanColumn({ day, trip, resolveLocation, isResolving, setActiveSearchActivity, onOpenDrawer }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [dragOverCol, setDragOverCol] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState(null)

  useEffect(() => {
    const handleHighlight = (e) => {
      const { id, tab } = e.detail
      if (tab === 'itinerary' && day.activities?.some(a => a.id === id)) {
        setHighlightedActivityId(id)
        setTimeout(() => setHighlightedActivityId(null), 3000)
        
        setTimeout(() => {
          const el = document.getElementById(`kanban-activity-${id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
    window.addEventListener('highlight-item', handleHighlight)
    return () => window.removeEventListener('highlight-item', handleHighlight)
  }, [day.activities])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOverCol(false)
    const dataStr = e.dataTransfer.getData('application/json')
    if (!dataStr) return
    const { type, sourceDayId, activityId, sourceIndex } = JSON.parse(dataStr)
    if (type === 'activity' && sourceDayId !== day.id) {
      dispatch({ type: ACTIONS.MOVE_ACTIVITY_BETWEEN_DAYS, payload: { fromDayId: sourceDayId, toDayId: day.id, activityId, toIndex: day.activities?.length || 0 } })
    }
  }

  return (
    <div
      className={`flex flex-col flex-shrink-0 w-72 bg-bg-card border rounded-[var(--radius-lg)] p-2 transition-colors ${dragOverCol && !isReadOnly ? 'border-accent/50 bg-accent/5' : 'border-border'} h-[calc(100vh-250px)]`}
      onDragOver={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOverCol(true)
      }}
      onDragLeave={() => setDragOverCol(false)}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/10">
        <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <span>{day.emoji}</span> Day {day.dayNumber}
        </h3>
        <div className="flex items-center gap-1.5">
          {(() => {
            const count = day.activities?.length || 0;
            const pillClass = "inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary whitespace-nowrap";
            if (count < 5) return (
              <span className={pillClass}>
                🔋 Chill
              </span>
            );
            if (count <= 8) return (
              <span className={pillClass}>
                ⚡ Active
              </span>
            );
            return (
              <span className={pillClass}>
                🪫 Packed
              </span>
            );
          })()}
          <span className="text-xs font-medium text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-[var(--radius-pill)] border border-border">
            {day.activities?.length || 0}
          </span>
        </div>
      </div>
      <div className="px-3 mb-2">
        <p className="text-[11px] text-text-muted truncate">{formatDate(day.date, 'short')} {day.location && `· ${day.location}`}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] scrollbar-hide px-1">
        {day.activities?.map((activity, i) => (
          <div
            id={`kanban-activity-${activity.id}`}
            key={activity.id}
            draggable={!isReadOnly}
            onDragStart={(e) => {
              if (isReadOnly) return
              e.stopPropagation()
              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: i }))
            }}
            className={`group rounded-[var(--radius-md)] p-3 transition-colors block text-left relative border ${
              highlightedActivityId === activity.id 
                ? 'ring-2 ring-accent border-accent/20'
                : activity.category 
                  ? CAT_THEME_CLASSES[getCategoryTheme(activity.category).color]?.border || 'border-border'
                  : 'border-border'
            } ${
              activity.category 
                ? CAT_THEME_CLASSES[getCategoryTheme(activity.category).color]?.bg || 'bg-bg-card'
                : 'bg-bg-card'
            }`}
          >
            <div className="flex flex-col gap-1">
              {/* Header: Emoji + Name */}
              <div className="flex items-center gap-2">
                <span className="text-[14px] shrink-0">{activity.emoji || '📍'}</span>
                <div className="flex-1 min-w-0 pr-6">
                  <EditableText
                    value={activity.name}
                    onSave={async (val) => {
                      dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { name: val } } })
                      if (val && !activity.location?.verified) {
                        resolveLocation(day.id, activity.id, val, day.location)
                      }
                    }}
                    className="font-semibold text-sm text-text-primary leading-tight truncate w-full"
                    readOnly={isReadOnly}
                  />
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenDrawer({ activityId: activity.id, dayId: day.id }) }}
                  className={`absolute top-3 ${isReadOnly ? 'right-3' : 'right-10'} opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out p-1 rounded hover:bg-bg-hover ${activity.comments?.length ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
                  title={activity.comments?.length ? `${activity.comments.length} update${activity.comments.length > 1 ? 's' : ''}` : 'Open notes & updates'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                </button>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      triggerHaptic('medium')
                      dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out text-text-muted hover:text-danger p-1 rounded hover:bg-bg-hover"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                )}
              </div>

              {/* Sub-header: Location • Duration */}
              <div className="text-[11px] text-text-muted font-medium truncate uppercase tracking-tight">
                {(activity.location?.placeName || activity.location || 'Unknown')} • {activity.duration || 60}m
              </div>

              {/* Time Row: Plain text style */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary mt-0.5">
                <TimePicker
                  value={activity.time}
                  onChange={time => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time } } })}
                  className="bg-transparent border-none p-0 w-auto hover:text-text-primary"
                  placeholder="Start"
                  disabled={isReadOnly}
                />
                <span className="opacity-40">-</span>
                <TimePicker
                  value={activity.endTime}
                  onChange={endTime => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { endTime } } })}
                  className="bg-transparent border-none p-0 w-auto hover:text-text-primary"
                  placeholder="End"
                  disabled={isReadOnly}
                />
              </div>
            </div>

            {(activity.notes || activity.notes === '') && (
              <div className="mt-2 pt-2 border-t border-border/10">
                <EditableText
                  value={activity.notes || ''}
                  onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { notes: val } } })}
                  className="text-xs text-text-muted italic block w-full"
                  placeholder="Notes..."
                  multiline
                  readOnly={isReadOnly}
                />
              </div>
            )}
          </div>
        ))}

        {(!day.activities || day.activities.length === 0) && (
          <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
            Drop items here
          </div>
        )}
      </div>

    </div>
  )
}

function CalendarActivityBlock({ activity, day, dayActivities, startOfDayMinutes, hourHeight, timeToMinutes, isReadOnly, onOpenDrawer }) {
  const { dispatch } = useTripContext()
  const minutes = timeToMinutes(activity.time)

  const initialTop = (minutes - startOfDayMinutes) * (hourHeight / 60)
  const initialHeight = (activity.duration || 60) * (hourHeight / 60)

  const [localTop, setLocalTop] = useState(initialTop)
  const [localHeight, setLocalHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  // Keep synced with external state changes (if not dragging)
  useEffect(() => {
    if (!isDragging && !isResizing) {
      setLocalTop(initialTop)
      setLocalHeight(initialHeight)
    }
  }, [initialTop, initialHeight, isDragging, isResizing])

  const catColor = activity.category ? getCategoryTheme(activity.category).color : 'border'

  // Helper to convert pixels to 15-minute snapped minutes
  const pixelsToMinutes = (px) => {
    const rawMins = (px / hourHeight) * 60
    return Math.round(rawMins / 15) * 15
  }

  const minutesToTimeString = (totalMins) => {
    let h = Math.floor(totalMins / 60) % 24
    const m = Math.round(totalMins % 60)
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12
    return `${h}:${m.toString().padStart(2, '0')} ${ampm}`
  }

  // Live conflict detection — compares current pixel position against siblings
  const hasCalendarConflict = useMemo(() => {
    const curStart = startOfDayMinutes + pixelsToMinutes(localTop)
    const curEnd = curStart + Math.max(15, pixelsToMinutes(localHeight))
    return (dayActivities || []).some(a => {
      if (a.id === activity.id) return false
      const aStart = timeToMinutes(a.time)
      if (aStart === null) return false
      const aEnd = aStart + (a.duration || 60)
      return curStart < aEnd && curEnd > aStart
    })
  }, [localTop, localHeight, dayActivities, activity.id, startOfDayMinutes, timeToMinutes])

  // Bind drag for moving the whole block
  const bindDrag = useDrag(({ movement: [, my], first, last, memo = localTop }) => {
    if (isReadOnly) return memo
    if (first) setIsDragging(true)
    
    let newTop = memo + my
    if (newTop < 0) newTop = 0 // Don't drag above the calendar start

    // Snap physically
    const snappedMins = pixelsToMinutes(newTop)
    const snappedTop = (snappedMins / 60) * hourHeight
    setLocalTop(snappedTop)

    if (last) {
      setIsDragging(false)
      const absMins = startOfDayMinutes + snappedMins
      const newTimeStr = minutesToTimeString(absMins)
      if (newTimeStr !== activity.time) {
        dispatch({
          type: ACTIONS.UPDATE_ACTIVITY,
          payload: { dayId: day.id, activityId: activity.id, updates: { time: newTimeStr } }
        })
      }
    }
    return memo
  }, { filterTaps: true })

  // Bind drag for resizing the bottom edge
  const bindResize = useDrag(({ movement: [, my], first, last, event, memo = localHeight }) => {
    if (isReadOnly) return memo
    event.stopPropagation() // Don't trigger block drag
    if (first) setIsResizing(true)

    let newHeight = memo + my
    if (newHeight < (hourHeight / 4)) newHeight = (hourHeight / 4) // minimum 15 mins

    // Snap physically
    const snappedMinsDelta = pixelsToMinutes(newHeight)
    const snappedHeight = (snappedMinsDelta / 60) * hourHeight
    setLocalHeight(snappedHeight)

    if (last) {
      setIsResizing(false)
      if (snappedMinsDelta !== (activity.duration || 60)) {
        dispatch({
          type: ACTIONS.UPDATE_ACTIVITY,
          payload: { dayId: day.id, activityId: activity.id, updates: { duration: Math.max(15, snappedMinsDelta) } }
        })
      }
    }
    return memo
  }, { filterTaps: true })

  const theme = getCategoryTheme(activity.category)
  
  const currentStartMins = startOfDayMinutes + pixelsToMinutes(localTop)
  const currentDurationMins = pixelsToMinutes(localHeight)
  
  const displayTime = minutesToTimeString(currentStartMins)
  const displayEndTime = minutesToTimeString(currentStartMins + currentDurationMins)

  return (
    <div
      {...bindDrag()}
      className={`absolute left-2 right-2 rounded-[var(--radius-md)] transition-[background,border,opacity] z-0 hover:z-50 flex flex-col group overflow-hidden border ${
        hasCalendarConflict
          ? 'bg-warning/10 border-warning/50 ring-1 ring-warning/30'
          : activity.category
            ? `${CAT_THEME_CLASSES[catColor]?.bg || 'bg-bg-card'} ${CAT_THEME_CLASSES[catColor]?.border || 'border-border'}`
            : 'bg-bg-card border-border'
      } ${isDragging || isResizing ? 'opacity-80 scale-[0.98] ring-2 ring-accent/30' : ''} ${!isReadOnly ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      style={{ top: localTop + 4, height: localHeight - 8, touchAction: 'none' }}
    >
      <div className="flex flex-col h-full relative z-10 p-2.5 pointer-events-none gap-0.5">
        {/* Header: Emoji + Name + optional conflict badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] shrink-0">{activity.emoji || '📍'}</span>
          <h4 className="text-sm font-semibold font-heading leading-tight text-text-primary transition-colors truncate flex-1">
            {activity.name}
          </h4>
          {hasCalendarConflict && (
            <span className="text-[9px] font-bold text-warning shrink-0" title="Time overlap">⚠️</span>
          )}
        </div>

        {/* Sub-header: Location • Duration */}
        <div className="text-[11px] text-text-muted font-medium truncate uppercase tracking-tight">
          {(activity.location?.placeName || activity.location || 'Unknown')} • {activity.duration || 60}m
        </div>

        {/* Time Row: Start - End */}
        <div className={`text-[11px] font-mono font-medium transition-colors ${isDragging || isResizing ? 'text-accent' : hasCalendarConflict ? 'text-warning' : 'text-text-secondary'}`}>
          {displayTime} – {displayEndTime}
        </div>

        {localHeight > 100 && <div className="mt-auto" />}
      </div>

      {/* Notes button — pointer-events-auto to intercept before drag */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenDrawer({ activityId: activity.id, dayId: day.id }) }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 pointer-events-auto p-1 rounded-md bg-bg-card/80 border border-border/50 transition-all ${activity.comments?.length ? 'text-accent' : 'text-text-muted hover:text-text-primary'}`}
        title={activity.comments?.length ? `${activity.comments.length} update${activity.comments.length > 1 ? 's' : ''}` : 'Open notes & updates'}
        style={{ touchAction: 'none' }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </button>
      {!isReadOnly && (
        <div
          {...bindResize()}
          className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-end justify-center pb-1 opacity-0 group-hover:opacity-100 hover:bg-bg-hover transition-colors z-20"
          style={{ touchAction: 'none' }}
        >
          <div className="w-8 h-1 rounded-full bg-border opacity-60 pointer-events-none" />
        </div>
      )}
    </div>
  )
}

function CalendarView({ trip, isMobile, activeDayIndex, onOpenDrawer, onDayChange }) {
  const canvasRef = useRef(null)
  const panState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  const handleCanvasPointerDown = (e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, input, select, [role="button"]')) return
    panState.current = { active: true, startX: e.clientX, startY: e.clientY, scrollLeft: canvasRef.current?.scrollLeft || 0, scrollTop: canvasRef.current?.scrollTop || 0 }
  }
  const handleCanvasPointerMove = (e) => {
    if (!panState.current.active || !canvasRef.current) return
    canvasRef.current.scrollLeft = panState.current.scrollLeft - (e.clientX - panState.current.startX)
    canvasRef.current.scrollTop = panState.current.scrollTop - (e.clientY - panState.current.startY)
  }
  const handleCanvasPointerUp = () => { panState.current.active = false }

  const timeToMinutes = (timeStr) => {
    if (!timeStr) return null
    let hours, mins
    const trimmed = timeStr.trim()
    if (trimmed.toUpperCase().includes('AM') || trimmed.toUpperCase().includes('PM')) {
      const parts = trimmed.split(' ')
      const timePart = parts[0]
      const modifier = parts[1]
      let [h, m] = timePart.split(':').map(Number)
      if (modifier?.toUpperCase() === 'PM' && h < 12) h += 12
      if (modifier?.toUpperCase() === 'AM' && h === 12) h = 0
      hours = h
      mins = m
    } else {
      const [h, m] = trimmed.split(':').map(Number)
      hours = h
      mins = m
    }
    return hours * 60 + mins
  }

  const { isReadOnly } = useTripContext()

  const itinerary = isMobile 
    ? [trip.itinerary[activeDayIndex]].filter(Boolean)
    : (trip.itinerary || [])

  let earliestHour = 8;
  let latestHour = 22;

  itinerary.forEach(day => {
    day.activities?.forEach(act => {
      const startMins = timeToMinutes(act.time);
      if (startMins !== null) {
        const startH = Math.floor(startMins / 60);
        if (startH < earliestHour && startH >= 0) earliestHour = startH;
        
        const endMins = startMins + (act.duration || 60);
        const endH = Math.ceil(endMins / 60);
        if (endH > latestHour && endH <= 24) latestHour = endH;
      }
    });
  });

  const numHours = latestHour - earliestHour + 1;
  const hours = Array.from({ length: numHours }, (_, i) => i + earliestHour);
  const startOfDayMinutes = earliestHour * 60;
  const hourHeight = 84;
  const totalMinHeight = Math.max(600, (numHours + 1) * hourHeight);

  return (
    <div
      ref={canvasRef}
      className="flex-1 overflow-x-auto overflow-y-auto bg-bg-card rounded-[var(--radius-lg)] border border-border relative custom-scrollbar h-[calc(100dvh-250px)] cursor-grab active:cursor-grabbing select-none"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerLeave={handleCanvasPointerUp}
    >
      {/* Mobile day navigator */}
      {isMobile && trip.itinerary?.length > 1 && (() => {
        const day = trip.itinerary[activeDayIndex]
        return (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-bg-card sticky top-0 left-0 z-30 w-full">
            <button
              onClick={() => onDayChange(Math.max(0, activeDayIndex - 1))}
              disabled={activeDayIndex === 0}
              className="p-2 text-text-muted hover:text-text-primary disabled:opacity-25 transition-colors rounded-lg hover:bg-bg-hover"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="text-center leading-tight">
              <p className="text-sm font-semibold text-text-primary font-heading">
                {day?.emoji} Day {day?.dayNumber}{day?.location ? ` · ${day.location}` : ''}
              </p>
              {day?.date && <p className="text-[11px] text-text-muted mt-0.5">{day.date}</p>}
            </div>
            <button
              onClick={() => onDayChange(Math.min(trip.itinerary.length - 1, activeDayIndex + 1))}
              disabled={activeDayIndex === trip.itinerary.length - 1}
              className="p-2 text-text-muted hover:text-text-primary disabled:opacity-25 transition-colors rounded-lg hover:bg-bg-hover"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )
      })()}
      <div className="flex min-w-fit relative" style={{ minHeight: totalMinHeight }}>
        {/* Time Axis */}
        <div className="w-16 sticky left-0 z-20 bg-bg-card/95 border-r border-border/20 shrink-0">
          <div className="h-14" /> {/* Header spacer */}
          {hours.map(hr => (
            <div key={hr} className="relative" style={{ height: hourHeight }}>
              <span className="absolute -top-2.5 left-3 text-[10px] font-mono text-text-muted font-semibold uppercase tracking-widest">
                {hr % 12 || 12} {hr < 12 ? 'AM' : 'PM'}
              </span>
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="flex-1 flex min-w-0">
          {itinerary.map((day, idx) => {
            const dayColor = DAY_COLORS[idx % DAY_COLORS.length]
            return (
              <div 
                key={day.id} 
                className="flex-1 min-w-[320px] border-r border-border/20 relative transition-colors bg-bg-card"
              >
                {/* Day Header */}
                <div 
                  className="h-14 border-b border-border/20 flex flex-col items-center justify-center sticky top-0 z-10 px-4 transition-all bg-bg-card"
                >
                  <span className="text-[10px] font-semibold font-heading uppercase tracking-widest text-text-muted">
                    Day {day.dayNumber}
                  </span>
                  <span className="text-sm font-semibold font-heading text-text-primary truncate max-w-full">
                    {day.location || 'Untitled'}
                  </span>
                </div>
                
                {/* Grid Lines */}
                <div className="absolute inset-0 pt-14 pointer-events-none">
                  {hours.map(hr => (
                    <div key={hr} className="border-b border-dashed border-border/20 w-full" style={{ height: hourHeight }} />
                  ))}
                </div>

                {/* Activity Blocks */}
                <div className="relative pt-14 h-full px-2">
                  {day.activities?.map(activity => {
                    const minutes = timeToMinutes(activity.time)
                    if (minutes === null || minutes < startOfDayMinutes) return null
                    
                    return (
                      <CalendarActivityBlock
                        key={activity.id}
                        activity={activity}
                        day={day}
                        dayActivities={day.activities}
                        startOfDayMinutes={startOfDayMinutes}
                        hourHeight={hourHeight}
                        timeToMinutes={timeToMinutes}
                        isReadOnly={isReadOnly}
                        onOpenDrawer={onOpenDrawer}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Itinerary Tab ─────────────────────────────────────────────────────
export default function ItineraryTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'kanban' | 'calendar'
  const [activeDayIndex, setActiveDayIndex] = useState(0) // For mobile swipe view context
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [activeSearchActivity, setActiveSearchActivity] = useState(null) // { dayId, activityId, initialValue }
  const [selectedActivity, setSelectedActivity] = useState(null) // { activityId, dayId }
  const { resolveLocation, isResolving } = useSmartLocation()

  if (!activeTrip) return null
  const trip = activeTrip

  // Horizontal swipe gesture for mobile
  const bind = useDrag(({ swipe: [swipeX], active }) => {
    if (!active && swipeX !== 0) {
      if (swipeX === -1 && activeDayIndex < (trip.itinerary?.length || 0) - 1) {
        setActiveDayIndex(prev => prev + 1)
        triggerHaptic('light')
      } else if (swipeX === 1 && activeDayIndex > 0) {
        setActiveDayIndex(prev => prev - 1)
        triggerHaptic('light')
      }
    }
  }, { axis: 'x', filterTaps: true })

  const handleAddDay = () => {
    const lastDay = trip.itinerary?.[trip.itinerary.length - 1]
    let nextDate = ''
    if (lastDay?.date) {
      // Parse YYYY-MM-DD safely to avoid JS timezone offset bugs
      const [year, month, day] = lastDay.date.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      d.setDate(d.getDate() + 1)

      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      nextDate = `${y}-${m}-${dd}`
    }
    dispatch({ type: ACTIONS.ADD_DAY, payload: { date: nextDate, location: 'New Location', emoji: '📍' } })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 flex flex-col h-full min-h-[calc(100vh-120px)]">

      <TabHeader
        leftSlot={
          <span className="text-[11px] font-semibold font-heading text-text-muted tabular-nums">
            {trip.itinerary?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) || 0} activities · {trip.itinerary?.length || 0} days
          </span>
        }
        rightSlot={
          <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center justify-end gap-2">
            <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                Table
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" /></svg>
                Board
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Calendar
              </button>
            </div>

            {!isReadOnly && (
              <div className="hidden md:flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">
                  📍 New Activity
                </Button>
                <Button size="sm" onClick={handleAddDay} className="shrink-0">
                  ✨ New Day
                </Button>
              </div>
            )}
          </div>
        }
      />

      <AddActivityModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        itinerary={trip.itinerary || []}
        onAdd={async ({ dayId, activity }) => {
          const action = dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId, activity } })
          // The ADD_ACTIVITY dispatch returns the lucky winner's ID if we generate it there... 
          // but our reducer generates it. We'll need to find it relative to the city hint.
          if (activity.name) {
            // Find the day to get its location/city hint
            const day = trip.itinerary.find(d => d.id === dayId)
            // Wait a tick for the state to settle or just fire and forget since the hook uses dispatch
            // We don't have the new activity ID yet because dispatch doesn't return it in this pattern.
            // Let's refine useSmartLocation to return the data if needed or just handle it post-update.
          }
        }}
      />

      <Modal
        isOpen={!!activeSearchActivity}
        onClose={() => setActiveSearchActivity(null)}
        title="📍 Update Location"
      >
        <div className="p-6 min-h-[380px]">
          <p className="text-sm text-text-secondary mb-4">
            Search for a specific place to get accurate map data and photos.
          </p>
          {(() => {
            const currentDay = trip.itinerary.find(d => d.id === activeSearchActivity?.dayId)
            const cityContext = currentDay ? trip.cities.find(c =>
              currentDay.location && c.city && currentDay.location.toLowerCase().includes(c.city.toLowerCase())
            ) || (trip.cities?.length > 0 ? trip.cities[0] : null) : null

            const proximity = cityContext?.lat && cityContext?.lng ? `${cityContext.lng},${cityContext.lat}` : ''

            return (
              <LocationAutocomplete
                initialValue={activeSearchActivity?.initialValue || ''}
                proximity={proximity}
                onSelect={(locationData) => {
                  dispatch({
                    type: ACTIONS.UPDATE_ACTIVITY,
                    payload: {
                      dayId: activeSearchActivity.dayId,
                      activityId: activeSearchActivity.activityId,
                      updates: { location: locationData }
                    }
                  })
                  setActiveSearchActivity(null)
                  triggerHaptic('medium')
                }}
              />
            )
          })()}
        </div>
      </Modal>


      {/* FABs — mobile only, 2 CTAs grouped */}
      {!isReadOnly && createPortal(
        <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 md:hidden">
          <button
            onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
            className="bg-bg-card border border-border text-text-primary rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Activity
          </button>
          <div className="animate-tab-enter stagger-2">
            <button
              onClick={() => { hapticImpact('medium'); handleAddDay() }}
              className="bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2 text-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              New Day
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Activity Drawer */}
      {selectedActivity && (() => {
        const liveActivity = trip.itinerary
          .find(d => d.id === selectedActivity.dayId)
          ?.activities?.find(a => a.id === selectedActivity.activityId)
        return liveActivity ? (
          <ActivityDrawer
            activity={liveActivity}
            dayId={selectedActivity.dayId}
            onClose={() => setSelectedActivity(null)}
          />
        ) : null
      })()}

      {/* Content Area */}
      {trip.itinerary && trip.itinerary.length > 0 ? (
        <div className="flex-1 w-full relative animate-tab-enter stagger-3">

          {viewMode === 'table' ? (
            <div className="w-full pb-20">
              {isMobile ? (
                <div
                  {...bind()}
                  className="touch-none select-none"
                >
                  {trip.itinerary[activeDayIndex] && (
                    <DayGroupTable
                      key={trip.itinerary[activeDayIndex].id}
                      day={trip.itinerary[activeDayIndex]}
                      trip={trip}
                      resolveLocation={resolveLocation}
                      isResolving={isResolving}
                      setActiveSearchActivity={setActiveSearchActivity}
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                      onOpenDrawer={setSelectedActivity}
                    />
                  )}

                  {/* Progress dots indicator */}
                  <div className="flex justify-center gap-1.5 mt-4">
                    {trip.itinerary.map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeDayIndex ? 'bg-accent w-4' : 'bg-border'}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {trip.itinerary.map((day, dayIndex) => (
                    <DayGroupTable
                      key={day.id}
                      day={day}
                      trip={trip}
                      resolveLocation={resolveLocation}
                      isResolving={isResolving}
                      setActiveSearchActivity={setActiveSearchActivity}
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                      onOpenDrawer={setSelectedActivity}
                    />
                  ))}
                  {!isReadOnly && (
                    <button
                      onClick={handleAddDay}
                      className="w-full py-3 rounded-[var(--radius-md)] border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors text-sm font-medium"
                    >
                      + Add another day group
                    </button>
                  )}
                </>
              )}
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="absolute inset-0 right-[-24px] pr-6 pb-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div className="flex gap-4 min-fit-content h-full items-start">
                {trip.itinerary.map(day => (
                  <KanbanColumn
                    key={day.id}
                    day={day}
                    trip={trip}
                    resolveLocation={resolveLocation}
                    isResolving={isResolving}
                    setActiveSearchActivity={setActiveSearchActivity}
                    onOpenDrawer={setSelectedActivity}
                  />
                ))}
                {!isReadOnly && (
                  <button
                    onClick={handleAddDay}
                    className="w-72 shrink-0 h-[100px] rounded-[var(--radius-lg)] border-2 border-dashed border-border/40 bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors text-sm font-medium flex items-center justify-center flex-col gap-2"
                  >
                    <span className="text-xl">➕</span>
                    Add Day
                  </button>
                )}
              </div>
            </div>
          ) : (
            <CalendarView
              trip={trip}
              isMobile={isMobile}
              activeDayIndex={activeDayIndex}
              onOpenDrawer={setSelectedActivity}
              onDayChange={setActiveDayIndex}
            />
          )}
        </div>
      ) : (
        <EmptyState
          emoji="🗺️"
          title="Build your perfect trip"
          subtitle="Start outlining your days and dragging activities around until your schedule is air-tight."
          wandaPrompt={`Plan Day 1 of my trip to ${trip.cities?.map(c => c.city).join(', ') || 'my destinations'} — use the generate_day_itinerary tool to create a schedule I can add.`}
          action={
            !isReadOnly && (
              <Button variant="primary" size="sm" onClick={handleAddDay}>
                + Add First Day
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
