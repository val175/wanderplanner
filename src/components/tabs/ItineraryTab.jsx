import { useState, useRef, useMemo } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import TimePicker from '../shared/TimePicker'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import ConfirmDialog from '../shared/ConfirmDialog'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate } from '../../utils/helpers'
import { ACTIVITY_EMOJIS } from '../../constants/emojis'

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

// ── Kanban Add Activity Inline ──────────────────────────────────────────────
function KanbanAddRow({ onAdd, defaultEmoji = '📌' }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [emoji, setEmoji] = useState(defaultEmoji)
  const [showEmojis, setShowEmojis] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), time, emoji })
    setName('')
    setTime('')
    setEmoji(defaultEmoji)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full group">
      <div className="w-[80px] shrink-0">
        <TimePicker
          value={time}
          onChange={setTime}
          className="text-sm border-transparent hover:border-border focus:border-accent bg-transparent"
          placeholder="+time"
        />
      </div>
      <div className="relative shrink-0 w-[40px] flex items-center justify-center">
        <button type="button" onClick={() => setShowEmojis(!showEmojis)}
          className="text-lg p-1 hover:bg-bg-hover rounded transition-colors">{emoji}</button>
        {showEmojis && (
          <div className="absolute bottom-full left-0 mb-1 p-2 bg-bg-card border border-border rounded-[var(--radius-md)] grid grid-cols-4 gap-1 z-[100] shadow-lg">
            {ACTIVITY_EMOJIS.map(e => (
              <button key={e.emoji} type="button" onClick={() => { setEmoji(e.emoji); setShowEmojis(false) }}
                className="text-lg p-1 hover:bg-bg-hover rounded" title={e.label}>{e.emoji}</button>
            ))}
          </div>
        )}
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="+ Add item"
        className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none min-w-0"
      />
      <div className="w-[80px] shrink-0 text-right opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="submit" className="text-xs font-medium bg-bg-secondary hover:bg-border/50 text-text-secondary px-3 py-1.5 rounded-[var(--radius-pill)]" disabled={!name.trim()}>
          Add
        </button>
      </div>
    </form>
  )
}

// ── Table Add Row Inline ──────────────────────────────────────────────
function TableAddRow({ onAdd, defaultEmoji = '📌' }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [emoji, setEmoji] = useState(defaultEmoji)
  const [showEmojis, setShowEmojis] = useState(false)
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), time, emoji })
    setName('')
    setTime('')
    setEmoji(defaultEmoji)
    inputRef.current?.focus()
  }

  return (
    <tr className="border-t border-border/40 bg-accent/[0.02]">
      <td className="px-2 py-2 align-middle"></td>
      <td className="px-2 py-2 align-middle">
        <TimePicker
          value={time}
          onChange={setTime}
          className="text-sm border-transparent hover:border-border focus:border-accent bg-transparent text-text-secondary font-mono w-[80px]"
          placeholder="+time"
        />
      </td>
      <td className="px-2 py-2 align-middle text-center relative">
        <button type="button" onClick={() => setShowEmojis(!showEmojis)}
          className="text-lg p-1 hover:bg-bg-hover rounded transition-colors">{emoji}</button>
        {showEmojis && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-bg-card border border-border rounded-[var(--radius-md)] grid grid-cols-4 gap-1 z-50 shadow-lg">
            {ACTIVITY_EMOJIS.map(e => (
              <button key={e.emoji} type="button" onClick={() => { setEmoji(e.emoji); setShowEmojis(false) }}
                className="text-lg p-1 hover:bg-bg-hover rounded" title={e.label}>{e.emoji}</button>
            ))}
          </div>
        )}
      </td>
      <td className="px-2 py-2 align-middle" colSpan={2}>
        <form onSubmit={handleSubmit} className="flex h-full">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
            placeholder="+ Add item (press Enter)"
            className="w-full px-2 py-1.5 text-[13px] bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </form>
      </td>
      <td className="px-2 py-2 align-middle text-xs text-text-muted italic opacity-60"></td>
    </tr>
  )
}

// ── Table View: Day Group ───────────────────────────────────────────────────
function DayGroupTable({ day, onReorderDay, trip }) {
  const { dispatch } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [dragOverGroup, setDragOverGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDropActivity = (e, targetIndex) => {
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
    <Card
      className={`p-0 overflow-hidden mb-8 transition-all ${dragOverGroup ? 'ring-2 ring-accent' : ''}`}
      draggable
      onDragStart={e => {
        if (!e.target.closest('.group-drag-handle')) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'day', dayId: day.id }))
      }}
      onDragOver={e => {
        e.preventDefault()
        setDragOverGroup(true)
      }}
      onDragLeave={() => setDragOverGroup(false)}
      onDrop={e => {
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

      {/* Group Header (Bookings Style) */}
      <div className="group relative flex items-center justify-between px-4 py-3 border-b border-border/50 bg-bg-card">
        <div className="flex items-center gap-3">
          <div className="group-drag-handle cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity">⠿</div>
          <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center">
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xl">{day.emoji}</span>
            <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap">Day {day.dayNumber}</span>
            <span className="text-text-muted mx-1">·</span>
            <EditableText
              value={day.date ? formatDate(day.date, 'short') : ''}
              onSave={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { location: val } } })}
              className="text-sm font-normal text-text-muted hover:text-text-secondary transition-colors"
              placeholder="Add Date/Location..."
            />
          </div>
        </div>

        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity text-sm">
          <span className="text-text-muted">{day.activities?.length || 0} items</span>
          <button onClick={() => { (day.activities?.length > 0) ? setConfirmDelete(true) : dispatch({ type: ACTIONS.REMOVE_DAY, payload: day.id }) }} className="text-text-muted hover:text-danger text-lg px-2">✕</button>
        </div>
      </div>

      {/* Group Grid Content */}
      {expanded && (
        <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[30px] overflow-hidden"></th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[90px] overflow-hidden">TIME</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[50px] text-center overflow-hidden"></th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-1/3 overflow-hidden">ITEM</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-1/3 overflow-hidden">NOTES</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[40px] overflow-hidden"></th>
              </tr>
            </thead>
            <tbody>
              {day.activities?.map((activity, index) => (
                <tr
                  key={activity.id}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation()
                    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: index }))
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => handleDropActivity(e, index)}
                  className="group/row hover:bg-bg-hover transition-colors border-t border-border/20 relative cursor-pointer"
                >
                  <td className="px-2 py-3 align-middle">
                    <div className="cursor-grab active:cursor-grabbing text-text-muted opacity-0 group-hover/row:opacity-100 text-center w-full">⠿</div>
                  </td>
                  <td className="px-2 py-3 align-middle font-mono text-[13px] text-text-secondary">
                    <TimePicker
                      value={activity.time}
                      onChange={time => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time } } })}
                      className="border-transparent hover:border-border text-inherit w-full !px-0 bg-transparent text-left max-w-[80px]"
                      placeholder="-:--"
                    />
                  </td>
                  <td className="px-2 py-3 align-middle text-center text-lg">{activity.emoji}</td>
                  <td className="px-2 py-3 align-middle">
                    <EditableText
                      value={activity.name}
                      onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { name: val } } })}
                      className="text-[13px] text-text-primary font-medium w-full block truncate"
                      inputClassName="w-full"
                      placeholder="Activity name"
                    />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <EditableText
                      value={activity.notes || ''}
                      onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { notes: val } } })}
                      className="text-[13px] text-text-muted w-full block"
                      inputClassName="w-full"
                      placeholder="Add a note..."
                      multiline
                    />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <button onClick={() => dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })} className="w-full text-center text-text-muted hover:text-danger opacity-0 group-hover/row:opacity-100 transition-opacity" title="Delete">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              <TableAddRow
                onAdd={act => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: act } })}
                defaultEmoji="📌"
              />
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Kanban View: Day Column ──────────────────────────────────────────────────
function KanbanColumn({ day }) {
  const { dispatch } = useTripContext()
  const [dragOverCol, setDragOverCol] = useState(false)

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
      className={`flex flex-col w-[320px] shrink-0 bg-bg-sidebar border border-border rounded-[var(--radius-md)] max-h-[calc(100vh-200px)] overflow-hidden transition-all ${dragOverCol ? 'border-accent ring-1 ring-accent/30' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOverCol(true) }}
      onDragLeave={() => setDragOverCol(false)}
      onDrop={handleDrop}
    >
      <div className={`p-3 border-t-4 border-b border-border bg-bg-card flex items-center justify-between shadow-sm z-10 ${getActivityAccent(day.emoji).split(' ')[0]}`}>
        <div>
          <h3 className="font-heading font-medium text-text-primary text-sm flex items-center gap-2">
            <span>{day.emoji}</span> Day {day.dayNumber}
          </h3>
          <p className="text-xs text-text-muted mt-0.5 ml-6">{formatDate(day.date, 'short')} {day.location && `· ${day.location}`}</p>
        </div>
        <span className="text-xs font-semibold bg-bg-secondary text-text-secondary px-2 py-0.5 rounded-full">{day.activities?.length || 0}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {day.activities?.map((activity, i) => (
          <div
            key={activity.id}
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: i }))
            }}
            className="group bg-bg-card border border-border rounded-[var(--radius-sm)] p-3 cursor-grab active:cursor-grabbing hover:border-border-strong hover:shadow-sm transition-all relative"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-lg leading-none shrink-0">{activity.emoji}</span>
              <EditableText
                value={activity.name}
                onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { name: val } } })}
                className="text-[13px] font-medium text-text-primary flex-1 min-w-0"
              />
              <button onClick={() => dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-xs p-1">✕</button>
            </div>

            <div className="ml-6 flex items-center gap-2 mt-2">
              <TimePicker
                value={activity.time}
                onChange={time => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time } } })}
                className="text-xs font-mono bg-bg-secondary w-auto max-w-[70px]"
                placeholder="Time"
              />
            </div>

            {(activity.notes || activity.notes === '') && (
              <div className="ml-6 mt-2 pt-2 border-t border-border/50">
                <EditableText
                  value={activity.notes || ''}
                  onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { notes: val } } })}
                  className="text-xs text-text-muted italic"
                  placeholder="Notes..."
                  multiline
                />
              </div>
            )}
          </div>
        ))}

        {(!day.activities || day.activities.length === 0) && (
          <div className="flex items-center justify-center p-4 border-2 border-dashed border-border rounded-lg text-text-muted text-xs">
            Drop items here
          </div>
        )}
      </div>

      <div className="p-2 border-t border-border bg-bg-card">
        <KanbanAddRow
          onAdd={act => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: act } })}
          defaultEmoji="📌"
        />
      </div>
    </div>
  )
}

// ── Main Itinerary Tab ─────────────────────────────────────────────────────
export default function ItineraryTab() {
  const { activeTrip, dispatch } = useTripContext()
  const [viewMode, setViewMode] = useState('table') // 'table' | 'kanban'

  if (!activeTrip) return null
  const trip = activeTrip

  const handleAddDay = () => {
    const lastDay = trip.itinerary?.[trip.itinerary.length - 1]
    let nextDate = ''
    if (lastDay?.date) {
      const d = new Date(lastDay.date + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      nextDate = d.toISOString().slice(0, 10)
    }
    dispatch({ type: ACTIONS.ADD_DAY, payload: { date: nextDate, location: 'New Location', emoji: '📍' } })
  }

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-full min-h-[calc(100vh-120px)]">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl text-text-primary">📅 Itinerary</h2>
          <p className="text-xs text-text-muted mt-0.5">{trip.itinerary?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) || 0} activities across {trip.itinerary?.length || 0} days</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* View Toggle */}
          <div className="flex bg-bg-secondary p-0.5 rounded-lg border border-border shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'table' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              Kanban
            </button>
          </div>

          <Button size="sm" onClick={handleAddDay} className="shrink-0">
            + New Day
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {trip.itinerary && trip.itinerary.length > 0 ? (
        <div className="flex-1 w-full relative">
          {viewMode === 'table' ? (
            <div className="max-w-[1000px] w-full pb-20">
              {trip.itinerary.map((day, dayIndex) => (
                <DayGroupTable
                  key={day.id}
                  day={day}
                  trip={trip}
                  onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                />
              ))}
              <button
                onClick={handleAddDay}
                className="w-full py-3 rounded-lg border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors text-sm font-medium"
              >
                + Add another day group
              </button>
            </div>
          ) : (
            <div className="absolute inset-0 right-[-24px] pr-6 pb-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div className="flex gap-4 min-fit-content h-full">
                {trip.itinerary.map(day => (
                  <KanbanColumn key={day.id} day={day} />
                ))}
                <button
                  onClick={handleAddDay}
                  className="w-[320px] shrink-0 h-[100px] rounded-lg border-2 border-dashed border-border bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover transition-colors text-sm font-medium flex items-center justify-center flex-col gap-2"
                >
                  <span className="text-xl">➕</span>
                  Add Day
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="text-center py-10 px-4 flex flex-col items-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-5 text-3xl">
            🗺️
          </div>
          <h3 className="text-2xl font-heading font-medium text-text-primary mb-2">Build your perfect trip</h3>
          <p className="text-text-muted mb-8 text-sm leading-relaxed">
            Start outlining your days and dragging activities around until your schedule is air-tight.
          </p>
          <Button variant="primary" size="lg" onClick={handleAddDay}>
            <span className="text-xl leading-none mr-2">+</span> Add First Day
          </Button>
        </Card>
      )}
    </div>
  )
}
