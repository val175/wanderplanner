import { useState, useMemo, useEffect, Fragment } from 'react'
import Card from '../../shared/Card'
import EditableText from '../../shared/EditableText'
import DatePicker from '../../shared/DatePicker'
import ConfirmDialog from '../../shared/ConfirmDialog'
import Select, { SelectItem } from '../../shared/Select'
import { MapPin } from 'lucide-react'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { formatDate } from '../../../utils/helpers'
import { COUNTRY_TIMEZONE, getUTCOffsetHours, applyTimezoneOffset, FLIGHT_ACTIVITY_PATTERNS, FLIGHT_EMOJIS } from '../../../utils/timezones'
import { triggerHaptic } from '../../../utils/haptics'
import { GLOBAL_CATEGORIES } from '../../../constants/categories'
import { calculateTransitConflict } from '../../../utils/tripGeo'
import { CAT_THEME_CLASSES, getActivityAccent, getLocationDetails, getConflicts } from './itineraryUtils'

export default function DayGroupTable({ day, itinerary, onReorderDay, trip, resolveLocation, isResolving, setActiveSearchActivity, onOpenDrawer, onViewOnMap }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [expanded, setExpanded] = useState(true)
  const [dragOverGroup, setDragOverGroup] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState(null)

  useEffect(() => {
    const handleHighlight = (e) => {
      const { id, tab, dayId } = e.detail
      if (tab === 'itinerary' && dayId === day.id) {
        setExpanded(true)
        setTimeout(() => {
          const el = document.getElementById(`day-group-${day.id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
      if (tab === 'itinerary' && day.activities?.some(a => a.id === id)) {
        setHighlightedActivityId(id)
        setExpanded(true)
        setTimeout(() => setHighlightedActivityId(null), 3000)
        setTimeout(() => {
          const el = document.getElementById(`activity-${id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
    window.addEventListener('highlight-item', handleHighlight)
    return () => window.removeEventListener('highlight-item', handleHighlight)
  }, [day.activities])

  const bodyClockOffsetHours = useMemo(() => {
    if (!trip?.cities?.length) return null
    const homeCountry = trip.cities[0]?.country
    if (!homeCountry) return null
    const homeTz = COUNTRY_TIMEZONE[homeCountry]
    if (!homeTz) return null
    const destCity = trip.cities.find(c =>
      day.location && c.city && day.location.toLowerCase().includes(c.city.toLowerCase())
    ) || (trip.cities.length > 1 ? trip.cities[trip.cities.length - 1] : null)
    const destCountry = destCity?.country
    if (!destCountry || destCountry === homeCountry) return null
    const destTz = COUNTRY_TIMEZONE[destCountry]
    if (!destTz) return null
    const homeOffset = getUTCOffsetHours(homeTz)
    const destOffset = getUTCOffsetHours(destTz)
    if (!Number.isFinite(homeOffset) || !Number.isFinite(destOffset)) return null
    const delta = homeOffset - destOffset
    return Number.isFinite(delta) && Math.abs(delta) >= 2 ? delta : null
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
      id={`day-group-${day.id}`}
      className={`mb-8 transition-all ${dragOverGroup && !isReadOnly ? 'ring-2 ring-accent rounded-[var(--radius-md)]' : ''}`}
      draggable={!isReadOnly}
      onDragStart={e => {
        if (isReadOnly || !e.target.closest('.group-drag-handle')) { e.preventDefault(); return }
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'day', dayId: day.id }))
      }}
      onDragOver={e => { if (isReadOnly) return; e.preventDefault(); setDragOverGroup(true) }}
      onDragLeave={() => setDragOverGroup(false)}
      onDrop={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOverGroup(false)
        const sourceDataStr = e.dataTransfer.getData('application/json')
        if (!sourceDataStr) return
        const sourceData = JSON.parse(sourceDataStr)
        if (sourceData.type === 'day') {
          const fromIndex = itinerary.findIndex(d => d.id === sourceData.dayId)
          const toIndex = itinerary.findIndex(d => d.id === day.id)
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

      {/* Group Header */}
      <div className="group/day relative flex items-center justify-between py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="group-drag-handle cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity mr-2">⠿</div>
          <button onClick={() => setExpanded(!expanded)} className="text-text-muted hover:text-text-primary transition-colors text-lg w-5 flex justify-center bg-bg-card border border-border/20 rounded">
            <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
          </button>
          <div className="flex flex-col ml-2">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap text-balance">Day {day.dayNumber}:</span>
              <span className="font-heading font-semibold text-text-primary text-base whitespace-nowrap text-balance">{day.date ? formatDate(day.date, 'weekday') : ''}</span>
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

        <div className="flex items-center gap-4 text-xs font-medium text-text-muted">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-bg-secondary/30">
            <span className="text-danger">📍</span>
            {day.activities?.length || 0} activities/locations
          </div>
          {(() => {
            const count = day.activities?.length || 0
            if (count < 5) return <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-success/10 text-success"><span>🔋</span> Chill</div>
            if (count <= 8) return <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-info/10 text-info"><span>⚡</span> Active</div>
            return <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-warning/10 text-warning"><span>🪫</span> Packed</div>
          })()}
          {!isReadOnly && (
            <div className="flex gap-2">
              <button
                onClick={() => { (day.activities?.length > 0) ? setConfirmDelete(true) : dispatch({ type: ACTIONS.REMOVE_DAY, payload: day.id }) }}
                className="text-text-muted hover:text-danger px-2 opacity-0 group-hover/day:opacity-100 transition-opacity"
                title="Delete Day"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Content */}
      {expanded && (
        <Card className="border border-border overflow-hidden shadow-none">
          <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
            <table className="w-full text-left border-collapse table-fixed min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[30px] overflow-hidden"></th>
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[100px] overflow-hidden">TIME</th>
                  <th className="px-0 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[30px] text-center overflow-hidden"></th>
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-auto text-left overflow-hidden">ACTIVITY</th>
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[140px] text-left overflow-hidden">CATEGORY</th>
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[25%] text-left overflow-hidden">LOCATION</th>
                  <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted w-[80px] overflow-hidden"></th>
                </tr>
              </thead>
              <tbody>
                {day.activities?.map((activity, index, arr) => {
                  const accentMatch = getActivityAccent(activity.emoji).match(/text-([a-z]+)/)
                  const dotColor = accentMatch ? `bg-${accentMatch[1]}` : 'bg-border-strong'
                  const hasConflict = getConflicts(arr, activity.time, activity.endTime, activity.id).length > 0
                  const location = getLocationDetails(activity.location)

                  return (
                    <Fragment key={activity.id}>
                      <tr
                        id={`activity-${activity.id}`}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'activity', sourceDayId: day.id, activityId: activity.id, sourceIndex: index }))
                        }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleDropActivity(e, index)}
                        onClick={(e) => { if (!e.target.closest('[data-no-drawer]')) { onOpenDrawer({ activityId: activity.id, dayId: day.id }) } }}
                        className="group/row hover:bg-bg-hover/50 transition-colors relative cursor-pointer border-t border-border/20"
                      >
                        {/* Drag Handle */}
                        <td className="px-2 pt-4 pb-2 align-top" data-no-drawer>
                          <div className="cursor-grab active:cursor-grabbing text-text-muted opacity-0 group-hover/row:opacity-100 text-center w-full pt-0.5">⠿</div>
                        </td>

                        {/* Time Column */}
                        <td className="px-2 pt-4 pb-2 align-top w-[100px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm font-semibold text-text-primary">{activity.time || '—'}</span>
                            <span className="text-xs text-text-muted font-mono">{activity.endTime || ''}</span>
                            {hasConflict && (
                              <span className="text-xs font-semibold text-warning bg-warning/10 rounded px-1 py-0.5 leading-none" title="Time overlap with another activity">
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
                            <span className="text-sm text-text-primary font-semibold block truncate">{activity.name || 'Untitled'}</span>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              <span className="text-xs text-text-muted font-medium truncate uppercase tracking-tight">{location.label || '—'}</span>
                              <span className="text-xs text-text-muted/60 font-medium">{activity.duration || 60} mins</span>
                              {(location.rating != null || location.openingHours || location.isOpenNow != null) && (
                                <span className="text-xs text-text-muted/70 font-medium truncate">
                                  {location.rating != null && `⭐ ${location.rating}`}
                                  {location.reviewCount != null && ` · ${location.reviewCount.toLocaleString()} reviews`}
                                  {location.isOpenNow != null && ` · ${location.isOpenNow ? 'Open now' : 'Closed now'}`}
                                  {location.openingHours && ` · ${location.openingHours}`}
                                </span>
                              )}
                            </div>
                            {/* Body Clock ghost-text */}
                            {bodyClockOffsetHours !== null && activity.time && (
                              FLIGHT_EMOJIS.has(activity.emoji) || FLIGHT_ACTIVITY_PATTERNS.test(activity.name || '')
                            ) && (() => {
                              const bodyTime = applyTimezoneOffset(activity.time, bodyClockOffsetHours)
                              return bodyTime ? (
                                <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-text-muted/60 italic select-none">
                                  (that's {bodyTime} your body time 🧟)
                                </span>
                              ) : null
                            })()}
                            {activity.notes && (
                              <span className="text-xs text-text-muted/80 italic block mt-1 truncate">{activity.notes}</span>
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
                          <span className="text-xs text-text-muted truncate block max-w-[160px]">{location.label || '—'}</span>
                        </td>

                        {/* Actions */}
                        <td className="px-2 pt-4 pb-2 align-top text-right pr-4" data-no-drawer>
                          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            {onViewOnMap && (
                              <button onClick={(e) => { e.stopPropagation(); onViewOnMap(day, activity) }} className="text-text-muted hover:text-accent p-1 inline-flex" title="View on Map">
                                <MapPin size={12} />
                              </button>
                            )}
                            {activity.comments?.length > 0 && (
                              <span className="text-xs font-semibold text-accent px-1">{activity.comments.length}</span>
                            )}
                            {(activity.notes || activity.link) && (
                              <span className="text-accent p-1 inline-flex" title="Has notes/link">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              </span>
                            )}
                            {!isReadOnly && (
                              <button
                                data-no-drawer
                                onClick={() => { triggerHaptic('medium'); dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } }) }}
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
                      {index < arr.length - 1 && (() => {
                        const nextActivity = arr[index + 1]
                        const conflictResult = calculateTransitConflict(activity, nextActivity)
                        return (
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
                            <td colSpan={3} className="py-1 pl-2">
                              <div className="flex items-center gap-3">
                                <div className={`inline-flex items-center gap-1 text-xs font-medium text-text-muted bg-bg-secondary/30 border border-border/50 rounded-full px-2 py-0 hover:border-text-primary transition-all duration-150 relative z-10 ${!activity.transit ? 'opacity-0 group-hover/transit:opacity-100' : ''}`}>
                                  <Select
                                    value={activity.transitEmoji || '🚕'}
                                    onValueChange={v => dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { transitEmoji: v } } })}
                                    disabled={isReadOnly}
                                    size="sm"
                                    className="bg-transparent border-transparent !px-0 !py-0 text-xs font-medium text-text-muted hover:bg-transparent leading-none"
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
                                    inputClassName="px-0 py-0 text-xs font-medium w-[100px] bg-transparent"
                                    placeholder="Add transit"
                                    readOnly={isReadOnly}
                                  />
                                </div>
                                {conflictResult.hasConflict && (
                                  <div className="text-warning text-[10px] font-semibold bg-warning/10 px-2 py-0.5 rounded-full">⚠️ {conflictResult.requiredTransitMins}m transit needed</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })()}
                    </Fragment>
                  )
                })}

                {/* Final Anchor Row */}
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
      )}
    </div>
  )
}
