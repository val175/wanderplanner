import { useState, useRef, useMemo, Fragment } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import TimePicker from '../shared/TimePicker'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import ConfirmDialog from '../shared/ConfirmDialog'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate, formatCurrency } from '../../utils/helpers'
import { ACTIVITY_EMOJIS } from '../../constants/emojis'
import { COUNTRY_TIMEZONE, getUTCOffsetHours, applyTimezoneOffset, FLIGHT_ACTIVITY_PATTERNS, FLIGHT_EMOJIS } from '../../utils/timezones'
import { triggerHaptic } from '../../utils/haptics'
import { useDrag } from '@use-gesture/react'
import { useEffect } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

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
function KanbanAddRow({ onAdd }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), time })
    setName('')
    setTime('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full group">
      <div className="w-[100px] shrink-0">
        <TimePicker
          value={time}
          onChange={setTime}
          className="text-sm border-transparent hover:border-border focus:border-accent bg-transparent w-full"
          placeholder="+time"
        />
      </div>
      <div className="relative shrink-0 w-[4px] flex items-center justify-center">
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
function TableAddRow({ onAdd }) {
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const inputRef = useRef(null)

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), time })
    setName('')
    setTime('')
    inputRef.current?.focus()
  }

  return (
    <tr className="border-t border-border/40 bg-accent/[0.02]">
      <td className="px-2 py-2 align-middle"></td>
      <td className="px-2 py-2 align-middle">
        <div className="flex justify-end pr-2">
          <TimePicker
            value={time}
            onChange={setTime}
            className="text-sm border-transparent hover:border-border focus:border-accent bg-transparent text-text-secondary font-mono w-[100px] text-right"
            placeholder="+time"
          />
        </div>
      </td>
      <td className="px-2 py-2 align-middle" colSpan={3}>
        <form onSubmit={handleSubmit} className="flex h-full w-full">
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
      <td className="px-2 py-2 align-middle"></td>
    </tr>
  )
}

// ── Table View: Day Group ───────────────────────────────────────────────────
function DayGroupTable({ day, onReorderDay, trip }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [dragOverGroup, setDragOverGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
          <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center bg-bg-card border border-border rounded">
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>

          <div className="flex flex-col ml-2">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap">
                Day {day.dayNumber}:
              </span>
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap">
                {day.date ? new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : 'Day'}
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
              <DatePicker
                value={day.date}
                onChange={val => dispatch({ type: ACTIONS.UPDATE_DAY, payload: { dayId: day.id, updates: { date: val } } })}
                placeholder="Add date…"
                className="bg-transparent border-transparent hover:border-border text-xs !px-1 w-auto max-w-[200px]"
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-text-muted">
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
        <Card className="border border-border/50 p-0 overflow-hidden">
          <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
            <table className="w-full text-left border-collapse table-fixed min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-bg-secondary/10">
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[30px] overflow-hidden"></th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[100px] overflow-hidden">TIME</th>
                  <th className="px-0 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[30px] text-center overflow-hidden"></th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-auto text-left overflow-hidden">ACTIVITY</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[25%] text-left overflow-hidden">LOCATION</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[40px] overflow-hidden"></th>
                </tr>
              </thead>
              <tbody>
                {day.activities?.map((activity, index, arr) => {
                  const accentMatch = getActivityAccent(activity.emoji).match(/text-([a-z]+)/)
                  const dotColor = accentMatch ? `bg-${accentMatch[1]}` : 'bg-border-strong'

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
                        className="group/row hover:bg-bg-hover transition-colors relative cursor-pointer"
                      >
                        {/* Drag Handle */}
                        <td className="px-2 pt-4 pb-2 align-top">
                          <div className="cursor-grab active:cursor-grabbing text-text-muted opacity-0 group-hover/row:opacity-100 text-center w-full pt-0.5">⠿</div>
                        </td>

                        {/* Time */}
                        <td className="px-2 pt-4 pb-2 align-top font-mono text-[13px] text-text-primary font-semibold">
                          <TimePicker
                            value={activity.time}
                            onChange={time => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time } } })}
                            className="border-transparent hover:border-border text-inherit w-full !px-1 bg-transparent text-left"
                            placeholder="-:-"
                            disabled={isReadOnly}
                          />
                        </td>

                        {/* Timeline */}
                        <td className="px-0 relative w-[30px] align-top group/timeline">
                          <div className={`absolute left-1/2 top-0 bottom-0 -ml-[1px] w-[2px] bg-border z-0 ${index === 0 ? 'top-5' : ''} ${index === arr.length - 1 ? 'bottom-[20%]' : ''}`}></div>
                          <div className={`relative z-10 w-2.5 h-2.5 rounded-full ${dotColor} mx-auto ring-4 ring-bg-card mt-5`}></div>
                          <button
                            onClick={() => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: {}, index: index } })}
                            className="absolute -top-3 left-1/2 -ml-3 w-6 h-6 rounded-full bg-bg-card border border-border text-lg font-light text-text-muted flex items-center justify-center opacity-0 group-hover/timeline:opacity-100 hover:bg-bg-hover hover:text-accent z-20 transition-all pb-0.5"
                            title="Insert before"
                          >+</button>
                        </td>

                        {/* Activity block */}
                        <td className="px-2 pt-3 pb-2 align-top group/activity">
                          <div className="flex items-start gap-3 w-full">
                            <div className="flex-1 min-w-0">
                              <EditableText
                                value={activity.name}
                                onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { name: val } } })}
                                className="text-[14px] text-text-primary font-semibold w-full block truncate"
                                inputClassName="w-full font-semibold px-0 py-0 h-auto min-h-0"
                                placeholder="Activity name"
                                readOnly={isReadOnly}
                              />
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
                              {(activity.notes !== undefined) && (
                                <EditableText
                                  value={activity.notes || ''}
                                  onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { notes: val } } })}
                                  className="text-[12px] text-text-muted block mt-1 hover:text-text-secondary w-full"
                                  inputClassName="w-full text-[12px] px-0 py-0"
                                  placeholder="+ Add note"
                                  multiline
                                  readOnly={isReadOnly}
                                />
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="px-2 pt-4 pb-2 align-top">
                          <div className="flex items-start gap-1.5 text-[13px] text-text-secondary">
                            <span className="text-danger flex-shrink-0 opacity-80 mt-0.5 text-xs">📍</span>
                            <EditableText
                              value={activity.location || ''}
                              onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { location: val } } })}
                              className="truncate hover:text-text-primary w-full leading-snug"
                              inputClassName="w-full px-0 py-0 leading-snug"
                              placeholder="+ Location"
                              multiline
                              readOnly={isReadOnly}
                            />
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-2 pt-4 pb-2 align-top text-right pr-4">
                          {!isReadOnly && (
                            <button onClick={() => {
                              triggerHaptic('medium')
                              dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })
                            }} className="text-text-muted hover:text-danger opacity-0 group-hover/row:opacity-100 transition-opacity mt-0.5 p-2 inline-flex" title="Delete">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Transit Row between activities */}
                      {index < arr.length - 1 && (
                        <tr className="group/transit hover:bg-bg-hover/50 transition-colors">
                          <td></td>
                          <td></td>
                          <td className="relative px-0 w-[30px] group/timeline">
                            <div className="absolute left-1/2 top-0 bottom-0 -ml-[1px] w-[2px] border-l-[2px] border-dashed border-border z-0"></div>
                            {!isReadOnly && (
                              <button
                                onClick={() => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: {}, index: index + 1 } })}
                                className="absolute top-1/2 left-1/2 -mt-3 -ml-3 w-6 h-6 rounded-full bg-bg-card border border-border text-lg font-light text-text-muted flex items-center justify-center opacity-0 group-hover/timeline:opacity-100 hover:bg-bg-hover hover:text-accent z-20 transition-all pb-0.5"
                                title="Insert activity here"
                              >+</button>
                            )}
                          </td>
                          <td colSpan={3} className="py-2 pl-2">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted bg-bg-secondary/30 border border-border/50 rounded-full px-2.5 py-0.5 hover:border-text-primary transition-colors relative z-10 cursor-pointer">
                              <span className="opacity-70 relative">
                                {activity.transitEmoji || '🚕'}
                                <select
                                  className={`absolute inset-0 opacity-0 w-full h-full ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                  value={activity.transitEmoji || '🚕'}
                                  onChange={e => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { transitEmoji: e.target.value } } })}
                                  title="Change transit type"
                                  disabled={isReadOnly}
                                >
                                  <option value="🚕">🚕 Taxi / Rideshare</option>
                                  <option value="🚶">🚶 Walking</option>
                                  <option value="🚇">🚇 Subway / Metro</option>
                                  <option value="🚌">🚌 Bus</option>
                                  <option value="🚆">🚆 Train</option>
                                  <option value="🚲">🚲 Bicycle</option>
                                  <option value="✈️">✈️ Flight</option>
                                  <option value="⛴️">⛴️ Ferry / Boat</option>
                                  <option value="🚗">🚗 Rental Car</option>
                                </select>
                              </span>
                              <EditableText
                                value={activity.transit || ''}
                                onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { transit: val } } })}
                                className="min-w-[50px] inline-flex items-center"
                                inputClassName="px-0 py-0 text-[11px] font-medium w-[100px] bg-transparent"
                                placeholder="Add transit..."
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

                {!isReadOnly && (
                  <TableAddRow
                    onAdd={act => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: act } })}
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )
      }
    </div >
  )
}

// ── Kanban View: Day Column ──────────────────────────────────────────────────
function KanbanColumn({ day }) {
  const { dispatch, isReadOnly } = useTripContext()
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
      className={`flex flex-col flex-shrink-0 w-72 bg-bg-secondary/20 border rounded-[var(--radius-lg)] p-2 transition-colors ${dragOverCol && !isReadOnly ? 'border-accent/50 bg-accent/5' : 'border-border/50'}`}
      onDragOver={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOverCol(true)
      }}
      onDragLeave={() => setDragOverCol(false)}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/30">
        <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <span>{day.emoji}</span> Day {day.dayNumber}
        </h3>
        <div className="flex items-center gap-1.5">
          {(() => {
            const count = day.activities?.length || 0;
            if (count < 5) return (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10 text-success whitespace-nowrap">
                🔋 Chill
              </span>
            );
            if (count <= 8) return (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-info/10 text-info whitespace-nowrap">
                ⚡ Active
              </span>
            );
            return (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#E27D60]/10 text-[#E27D60] whitespace-nowrap">
                🪫 Packed
              </span>
            );
          })()}
          <span className="text-xs font-medium text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border/50">
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
            key={activity.id}
            draggable={!isReadOnly}
            onDragStart={(e) => {
              if (isReadOnly) return
              e.stopPropagation()
              e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: i }))
            }}
            className={`group bg-bg-card border rounded-[var(--radius-md)] p-3 transition-colors block text-left ${isReadOnly ? 'border-border/50' : 'cursor-grab active:cursor-grabbing border-border/50 hover:border-accent/40 active:border-accent'} relative`}
          >
            <div className="flex items-start gap-2 mb-2 w-full">
              <div className="flex-1 min-w-0 pr-6">
                <EditableText
                  value={activity.name}
                  onSave={val => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { name: val } } })}
                  className="font-semibold text-sm text-text-primary leading-tight truncate w-full"
                  inputClassName="w-full text-sm font-semibold p-0 h-auto"
                  readOnly={isReadOnly}
                />
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    triggerHaptic('medium')
                    dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } })
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger p-1 rounded hover:bg-bg-hover transition-colors"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              )}
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-2">
              <TimePicker
                value={activity.time}
                onChange={time => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time } } })}
                className="text-xs font-mono font-medium text-text-secondary bg-bg-hover rounded-full px-2 py-0.5 w-full border-none"
                placeholder="Time"
                disabled={isReadOnly}
              />
            </div>
            {(activity.notes || activity.notes === '') && (
              <div className="mt-2 pt-2 border-t border-border/30">
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

      {!isReadOnly && (
        <div className="mt-2 text-center text-text-muted opacity-60 hover:opacity-100 transition-opacity">
          <KanbanAddRow
            onAdd={act => dispatch({ type: ACTIONS.ADD_ACTIVITY, payload: { dayId: day.id, activity: act } })}
            defaultEmoji="📌"
          />
        </div>
      )}
    </div>
  )
}

// ── Main Itinerary Tab ─────────────────────────────────────────────────────
export default function ItineraryTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'kanban'
  const [activeDayIndex, setActiveDayIndex] = useState(0) // For mobile swipe view context

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
    <div className="space-y-6 animate-fade-in flex flex-col h-full min-h-[calc(100vh-120px)]">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl text-text-primary">📅 Itinerary</h2>
          <p className="text-xs text-text-muted mt-0.5">{trip.itinerary?.reduce((acc, d) => acc + (d.activities?.length || 0), 0) || 0} activities across {trip.itinerary?.length || 0} days</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {/* View Toggle */}
          <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-bg-card text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
              Board
            </button>
          </div>

          {!isReadOnly && (
            <Button size="sm" onClick={handleAddDay} className="shrink-0">
              + New Day
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {trip.itinerary && trip.itinerary.length > 0 ? (
        <div className="flex-1 w-full relative">
          {viewMode === 'table' ? (
            <div className="w-full pb-20 overflow-hidden">
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
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
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
                      onReorderDay={(from, to) => dispatch({ type: ACTIONS.REORDER_DAYS, payload: { fromIndex: from, toIndex: to } })}
                    />
                  ))}
                  {!isReadOnly && (
                    <button
                      onClick={handleAddDay}
                      className="w-full py-3 rounded-lg border border-dashed border-border text-text-muted hover:text-text-secondary hover:border-border-strong transition-colors text-sm font-medium"
                    >
                      + Add another day group
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 right-[-24px] pr-6 pb-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
              <div className="flex gap-4 min-fit-content h-full items-start">
                {trip.itinerary.map(day => (
                  <KanbanColumn key={day.id} day={day} />
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
