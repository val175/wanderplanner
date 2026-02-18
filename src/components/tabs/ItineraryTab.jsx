import { useState } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate } from '../../utils/helpers'
import { ACTIVITY_EMOJIS } from '../../constants/emojis'

function ActivityItem({ activity, dayId, onUpdate, onDelete }) {
  return (
    <div className="flex items-start gap-3 group py-2">
      <div className="flex-shrink-0 w-14 text-right">
        <EditableText
          value={activity.time}
          onSave={val => onUpdate({ time: val })}
          className="text-sm text-text-muted font-mono"
          placeholder="--:--"
        />
      </div>
      <span className="text-lg flex-shrink-0 mt-0.5">{activity.emoji}</span>
      <div className="flex-1 min-w-0">
        <EditableText
          value={activity.name}
          onSave={val => onUpdate({ name: val })}
          className="text-text-primary font-medium text-sm"
          placeholder="Activity name"
        />
        {activity.notes && (
          <p className="text-xs text-text-muted mt-0.5">{activity.notes}</p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-sm transition-opacity p-1"
        title="Remove activity"
      >
        ✕
      </button>
    </div>
  )
}

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
    setName('')
    setTime('')
    setEmoji('📌')
    setNotes('')
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-bg-primary rounded-[var(--radius-md)] border border-border">
      <div className="flex gap-2 items-start">
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-24 px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className="text-xl p-1.5 border border-border rounded-[var(--radius-sm)] hover:bg-bg-hover"
          >
            {emoji}
          </button>
          {showEmojis && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-bg-secondary border border-border rounded-[var(--radius-md)] grid grid-cols-4 gap-1 z-10">
              {ACTIVITY_EMOJIS.map(e => (
                <button
                  key={e.emoji}
                  type="button"
                  onClick={() => { setEmoji(e.emoji); setShowEmojis(false) }}
                  className="text-lg p-1 hover:bg-bg-hover rounded"
                  title={e.label}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Activity name"
          className="flex-1 px-3 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
        />
      </div>
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="w-full mt-2 px-3 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
      />
      <div className="flex gap-2 mt-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1 text-sm text-text-muted hover:text-text-secondary">
          Cancel
        </button>
        <button type="submit" className="px-3 py-1 text-sm bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">
          Add
        </button>
      </div>
    </form>
  )
}

function DayCard({ day, isConcertDay }) {
  const { dispatch } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [adding, setAdding] = useState(false)

  const cardClasses = isConcertDay
    ? 'border-concert-red/30 bg-concert-dark/5 dark:bg-concert-dark/30'
    : ''

  return (
    <div className="relative animate-fade-in">
      {/* Timeline dot + line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border hidden md:block" />
      <div className={`absolute left-3 top-6 w-5 h-5 rounded-full border-2 hidden md:block z-10
        ${isConcertDay ? 'border-concert-red bg-concert-red/20' : 'border-accent bg-accent/20'}
      `} />

      <Card className={`md:ml-12 ${cardClasses}`}>
        {/* Day Header */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{day.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-heading font-semibold ${isConcertDay ? 'text-concert-red' : 'text-text-primary'}`}>
                  Day {day.dayNumber}
                </span>
                <span className="text-text-muted text-sm">·</span>
                <span className="text-sm text-text-secondary">{formatDate(day.date, 'long')}</span>
              </div>
              <EditableText
                value={day.location}
                onSave={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { location: val } } })}
                className="text-sm text-text-muted"
                placeholder="Location"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{day.activities?.length || 0} activities</span>
            <span className={`text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
          </div>
        </div>

        {/* Activities */}
        {expanded && (
          <div className="mt-3 border-t border-border pt-3">
            {day.activities?.length > 0 ? (
              <div className="divide-y divide-border/50">
                {day.activities.map(activity => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    dayId={day.id}
                    onUpdate={updates => dispatch({
                      type: ACTIONS.UPDATE_ACTIVITY,
                      payload: { dayId: day.id, activityId: activity.id, updates }
                    })}
                    onDelete={() => dispatch({
                      type: ACTIONS.DELETE_ACTIVITY,
                      payload: { dayId: day.id, activityId: activity.id }
                    })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted italic py-2">No activities yet</p>
            )}

            {/* Notes */}
            {day.notes && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-xs text-text-muted italic">📝 {day.notes}</p>
              </div>
            )}

            {/* Add Activity */}
            {adding ? (
              <AddActivityForm
                onAdd={activity => {
                  dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity } })
                  setAdding(false)
                }}
                onCancel={() => setAdding(false)}
              />
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="mt-2 text-sm text-accent hover:text-accent-hover transition-colors"
              >
                + Add activity
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export default function ItineraryTab() {
  const { activeTrip, dispatch } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip
  const concertBooking = trip.bookings?.find(b => b.category === 'concert')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl text-text-primary">
          📅 Itinerary · {trip.itinerary?.length || 0} days
        </h2>
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
        {trip.itinerary?.map(day => {
          const isConcertDay = concertBooking && day.activities?.some(a =>
            a.name?.toLowerCase().includes('mcr') ||
            a.name?.toLowerCase().includes('concert') ||
            a.emoji === '🎵' || a.emoji === '🎸'
          )
          return <DayCard key={day.id} day={day} isConcertDay={isConcertDay} />
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
