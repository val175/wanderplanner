import { useState, useRef } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate } from '../../utils/helpers'
import { ACTIVITY_EMOJIS } from '../../constants/emojis'

// ── Activity type → left-border accent color ───────────────────────────────
// Maps emoji to a CSS left-border color token so each activity type is
// instantly scannable without reading the text.
function getActivityAccent(emoji) {
  const map = {
    '✈️': 'border-l-info',        // flight — blue
    '🛫': 'border-l-info',
    '🛬': 'border-l-info',
    '🏨': 'border-l-success',     // hotel — green
    '🛏️': 'border-l-success',
    '🍜': 'border-l-warning',     // food — gold
    '🍽️': 'border-l-warning',
    '🥘': 'border-l-warning',
    '🍺': 'border-l-warning',
    '☕': 'border-l-warning',
    '🎵': 'border-l-accent',      // concert/music — terra cotta
    '🎸': 'border-l-accent',
    '🎤': 'border-l-accent',
    '🎯': 'border-l-accent',      // experience
    '🏛️': 'border-l-accent',
    '🚕': 'border-l-[var(--color-text-muted)]', // transport — neutral
    '🚂': 'border-l-[var(--color-text-muted)]',
    '⛴️': 'border-l-[var(--color-text-muted)]',
  }
  return map[emoji] || 'border-l-border'
}

// ── Activity Item with drag reorder ────────────────────────────────────────
function ActivityItem({ activity, dayId, index, onUpdate, onDelete, onReorder }) {
  const [dragOver, setDragOver] = useState(false)
  const accentBorder = getActivityAccent(activity.emoji)

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('activityIndex', String(index)) }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false)
        const fromIndex = Number(e.dataTransfer.getData('activityIndex'))
        if (fromIndex !== index) onReorder(fromIndex, index)
      }}
      className={`flex items-start gap-2 group py-2 pl-2 rounded transition-all cursor-default
        border-l-2 ${accentBorder}
        ${dragOver ? 'bg-bg-hover' : ''}`}
    >
      <span className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 mt-1 text-text-muted select-none text-base">⠿</span>
      {/* Monospaced time — tabular-nums for vertical alignment */}
      <div className="flex-shrink-0 w-14 text-right pt-0.5">
        <EditableText
          value={activity.time}
          onSave={val => onUpdate({ time: val })}
          className="text-xs text-text-muted font-mono tabular-nums"
          placeholder="--:--"
        />
      </div>
      <span className="text-lg flex-shrink-0 mt-0.5">{activity.emoji}</span>
      <div className="flex-1 min-w-0">
        {/* Activity title */}
        <EditableText
          value={activity.name}
          onSave={val => onUpdate({ name: val })}
          className="text-text-primary font-medium text-sm leading-snug"
          placeholder="Activity name"
        />
        {/* Notes on its own line, clearly subordinate */}
        {(activity.notes || activity.notes === '') && (
          <EditableText
            value={activity.notes || ''}
            onSave={val => onUpdate({ notes: val })}
            className="text-xs text-text-muted mt-0.5 leading-relaxed"
            placeholder="Add notes…"
            multiline
          />
        )}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-sm transition-opacity p-1 flex-shrink-0"
      >✕</button>
    </div>
  )
}

// ── Add Activity Form ───────────────────────────────────────────────────────
function AddActivityForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [notes, setNotes] = useState('')
  const [showEmojis, setShowEmojis] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), time, emoji, notes: notes.trim() })
    setName(''); setTime(''); setEmoji('📌'); setNotes('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-bg-primary rounded-[var(--radius-md)] border border-border">
      <div className="flex gap-2 items-start">
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          className="w-24 px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary" />
        <div className="relative">
          <button type="button" onClick={() => setShowEmojis(!showEmojis)}
            className="text-xl p-1.5 border border-border rounded-[var(--radius-sm)] hover:bg-bg-hover">{emoji}</button>
          {showEmojis && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-bg-secondary border border-border rounded-[var(--radius-md)] grid grid-cols-4 gap-1 z-10">
              {ACTIVITY_EMOJIS.map(e => (
                <button key={e.emoji} type="button" onClick={() => { setEmoji(e.emoji); setShowEmojis(false) }}
                  className="text-lg p-1 hover:bg-bg-hover rounded" title={e.label}>{e.emoji}</button>
              ))}
            </div>
          )}
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Activity name"
          className="flex-1 px-3 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted" />
      </div>
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
        className="w-full mt-2 px-3 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted" />
      <div className="flex gap-2 mt-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1 text-sm text-text-muted hover:text-text-secondary">Cancel</button>
        <button type="submit" className="px-3 py-1 text-sm bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">Add</button>
      </div>
    </form>
  )
}

// ── Day Card with drag reorder ──────────────────────────────────────────────
function DayCard({ day, dayIndex, isConcertDay, onReorderDay }) {
  const { dispatch } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(day.notes || '')
  const [dragOver, setDragOver] = useState(false)

  const cardClasses = isConcertDay ? 'border-concert-red/30 bg-concert-dark/5 dark:bg-concert-dark/30' : ''

  // Google Maps search URL built from location text
  const mapsUrl = day.location
    ? `https://www.google.com/maps/search/${encodeURIComponent(day.location)}`
    : null

  const saveNotes = () => {
    dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { notes: notesValue } } })
    setEditingNotes(false)
  }

  return (
    <div
      className={`relative animate-fade-in transition-all ${dragOver ? 'border-t-2 border-accent' : ''}`}
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('dayIndex', String(dayIndex)) }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false)
        const fromIndex = Number(e.dataTransfer.getData('dayIndex'))
        if (fromIndex !== dayIndex) onReorderDay(fromIndex, dayIndex)
      }}
    >
      {/* Timeline */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border hidden md:block" />
      <div className={`absolute left-3 top-6 w-5 h-5 rounded-full border-2 hidden md:block z-10
        ${isConcertDay ? 'border-concert-red bg-concert-red/20' : 'border-accent bg-accent/20'}`} />

      <Card className={`md:ml-12 ${cardClasses}`}>
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="hidden md:block cursor-grab active:cursor-grabbing text-text-muted opacity-30 hover:opacity-60 select-none" title="Drag to reorder">⠿</span>
          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            <span className="text-2xl">{day.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-heading font-semibold ${isConcertDay ? 'text-concert-red' : 'text-text-primary'}`}>
                  Day {day.dayNumber}
                </span>
                <span className="text-text-muted text-sm">·</span>
                <span className="text-sm text-text-secondary">{formatDate(day.date, 'long')}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <EditableText
                  value={day.location}
                  onSave={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { location: val } } })}
                  className="text-sm text-text-muted"
                  placeholder="Location"
                />
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-sm hover:opacity-70 transition-opacity flex-shrink-0"
                    title="View on Google Maps"
                  >
                    🗺️
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-text-muted">{day.activities?.length || 0}</span>
            <button
              onClick={e => { e.stopPropagation(); dispatch({ type: ACTIONS.REMOVE_DAY, payload: day.id }) }}
              className="text-xs text-text-muted hover:text-danger transition-colors px-1"
            >✕</button>
            <span className={`text-text-muted cursor-pointer transition-transform ${expanded ? 'rotate-180' : ''}`}
              onClick={() => setExpanded(!expanded)}>▾</span>
          </div>
        </div>

        {/* Body */}
        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            {day.activities?.length > 0 ? (
              <div className="divide-y divide-border/50">
                {day.activities.map((activity, actIndex) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    dayId={day.id}
                    index={actIndex}
                    onUpdate={updates => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates } })}
                    onDelete={() => dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })}
                    onReorder={(fromIndex, toIndex) => dispatch({ type: ACTIONS.REORDER_ACTIVITIES, payload: { dayId: day.id, fromIndex, toIndex } })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted italic py-2">No activities yet</p>
            )}

            {/* Day Notes */}
            <div className="mt-3 pt-2 border-t border-border/50">
              {editingNotes ? (
                <div>
                  <textarea
                    value={notesValue}
                    onChange={e => setNotesValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') { setNotesValue(day.notes || ''); setEditingNotes(false) } }}
                    placeholder="Day notes…"
                    rows={2}
                    autoFocus
                    className="w-full px-3 py-2 text-xs bg-bg-input border border-accent rounded-[var(--radius-sm)] text-text-primary resize-none focus:outline-none"
                  />
                  <div className="flex gap-2 mt-1 justify-end">
                    <button onClick={() => { setNotesValue(day.notes || ''); setEditingNotes(false) }} className="text-xs text-text-muted">Cancel</button>
                    <button onClick={saveNotes} className="text-xs text-accent font-medium">Save</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setNotesValue(day.notes || ''); setEditingNotes(true) }}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors text-left w-full"
                >
                  {day.notes
                    ? <span>📝 <span className="italic">{day.notes}</span></span>
                    : <span className="opacity-50">+ Add day notes…</span>
                  }
                </button>
              )}
            </div>

            {/* Add Activity */}
            {adding ? (
              <AddActivityForm
                onAdd={activity => { dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity } }); setAdding(false) }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button onClick={() => setAdding(true)} className="mt-2 text-sm text-accent hover:text-accent-hover transition-colors">
                + Add activity
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function ItineraryTab() {
  const { activeTrip, dispatch } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip
  const concertBooking = trip.bookings?.find(b => b.category === 'concert')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl text-text-primary">📅 Itinerary · {trip.itinerary?.length || 0} days</h2>
          {(trip.itinerary?.length || 0) > 1 && (
            <p className="text-xs text-text-muted mt-0.5">Drag ⠿ to reorder days or activities</p>
          )}
        </div>
        <button
          onClick={() => {
            const lastDay = trip.itinerary?.[trip.itinerary.length - 1]
            let nextDate = ''
            if (lastDay?.date) {
              const d = new Date(lastDay.date + 'T00:00:00')
              d.setDate(d.getDate() + 1)
              nextDate = d.toISOString().slice(0, 10)
            }
            dispatch({ type: ACTIONS.ADD_DAY, payload: { date: nextDate, location: '', emoji: '📍' } })
          }}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover transition-colors"
        >
          + Add Day
        </button>
      </div>

      <div className="relative space-y-5">
        {trip.itinerary?.map((day, dayIndex) => {
          const isConcertDay = concertBooking && day.activities?.some(a =>
            a.name?.toLowerCase().includes('mcr') ||
            a.name?.toLowerCase().includes('concert') ||
            a.emoji === '🎵' || a.emoji === '🎸'
          )
          return (
            <DayCard
              key={day.id}
              day={day}
              dayIndex={dayIndex}
              isConcertDay={isConcertDay}
              onReorderDay={(fromIndex, toIndex) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex, toIndex } })}
            />
          )
        })}
      </div>

      {(!trip.itinerary || trip.itinerary.length === 0) && (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-text-muted">No itinerary yet. Add your first day!</p>
        </Card>
      )}
    </div>
  )
}
