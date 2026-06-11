import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import EditableText from '../../shared/EditableText'
import TimePicker from '../../shared/TimePicker'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { formatDate } from '../../../utils/helpers'
import { triggerHaptic } from '../../../utils/haptics'
import { CAT_THEME_CLASSES, getCategoryTheme, getLocationDetails } from './itineraryUtils'

export default function KanbanColumn({ day, trip, resolveLocation, isResolving, setActiveSearchActivity, onOpenDrawer, onViewOnMap }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [dragOverCol, setDragOverCol] = useState(false)
  const [highlightedActivityId, setHighlightedActivityId] = useState(null)

  useEffect(() => {
    const handleHighlight = (e) => {
      const { id, tab, dayId } = e.detail
      if (tab === 'itinerary' && dayId === day.id) {
        setTimeout(() => {
          const el = document.getElementById(`kanban-day-${day.id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
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

  const pillClass = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary whitespace-nowrap'

  return (
    <div
      id={`kanban-day-${day.id}`}
      className={`flex flex-col flex-shrink-0 w-72 bg-bg-card border rounded-[var(--radius-lg)] p-2 transition-colors ${dragOverCol && !isReadOnly ? 'border-accent/50 bg-accent/5' : 'border-border'} h-[calc(100vh-250px)]`}
      onDragOver={e => { if (isReadOnly) return; e.preventDefault(); setDragOverCol(true) }}
      onDragLeave={() => setDragOverCol(false)}
      onDrop={handleDrop}
    >
      <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/10">
        <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
          <span>{day.emoji}</span> Day {day.dayNumber}
        </h3>
        <div className="flex items-center gap-1.5">
          {(() => {
            const count = day.activities?.length || 0
            if (count < 5) return <span className={pillClass}>🔋 Chill</span>
            if (count <= 8) return <span className={pillClass}>⚡ Active</span>
            return <span className={pillClass}>🪫 Packed</span>
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
        {day.activities?.map((activity, i) => {
          const location = getLocationDetails(activity.location)
          return (
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
              <div className="flex items-start gap-2">
                {!isReadOnly && (
                  <div className="text-border shrink-0 cursor-grab mt-1" title="Drag to reorder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] shrink-0">{activity.emoji || '📍'}</span>
                    <div className="flex-1 min-w-0">
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
                    <div className="flex items-center shrink-0 -my-1 -mr-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenDrawer({ activityId: activity.id, dayId: day.id }) }}
                        className={`p-1 rounded hover:bg-bg-hover transition-colors ${activity.comments?.length ? 'text-accent' : 'text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                        title={activity.comments?.length ? `${activity.comments.length} update${activity.comments.length > 1 ? 's' : ''}` : 'Open notes & updates'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      </button>
                      {!isReadOnly && onViewOnMap && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewOnMap(day, activity) }}
                          className="p-1 rounded hover:bg-bg-hover transition-colors text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          title="View on Map"
                        >
                          <MapPin size={13} />
                        </button>
                      )}
                      {!isReadOnly && (
                        <button
                          onClick={() => { triggerHaptic('medium'); dispatch({ type: ACTIONS.DELETE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id } }) }}
                          className="p-1 rounded hover:bg-bg-hover transition-colors text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          title="Delete"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-text-muted font-medium truncate uppercase tracking-tight">
                    {location.label || 'Unknown'} • {activity.duration || 60}m
                  </div>
                  {(location.rating != null || location.openingHours || location.isOpenNow != null) && (
                    <div className="text-[10px] text-text-muted/70 font-medium truncate">
                      {location.rating != null && `⭐ ${location.rating}`}
                      {location.reviewCount != null && ` · ${location.reviewCount.toLocaleString()} reviews`}
                      {location.isOpenNow != null && ` · ${location.isOpenNow ? 'Open now' : 'Closed now'}`}
                      {location.openingHours && ` · ${location.openingHours}`}
                    </div>
                  )}

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
              </div>
            </div>
          )
        })}

        {(!day.activities || day.activities.length === 0) && (
          <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
            Drop items here
          </div>
        )}
      </div>
    </div>
  )
}
