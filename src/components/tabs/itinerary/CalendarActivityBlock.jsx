import { useState, useMemo, useEffect } from 'react'
import { useDrag } from '@use-gesture/react'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { CAT_THEME_CLASSES, getCategoryTheme } from './itineraryUtils'

export default function CalendarActivityBlock({ activity, day, dayActivities, startOfDayMinutes, hourHeight, timeToMinutes, isReadOnly, onOpenDrawer }) {
  const { dispatch } = useTripContext()
  const minutes = timeToMinutes(activity.time)

  const initialTop = (minutes - startOfDayMinutes) * (hourHeight / 60)
  const initialHeight = (activity.duration || 60) * (hourHeight / 60)

  const [localTop, setLocalTop] = useState(initialTop)
  const [localHeight, setLocalHeight] = useState(initialHeight)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isDragging && !isResizing) {
      setLocalTop(initialTop)
      setLocalHeight(initialHeight)
    }
  }, [initialTop, initialHeight, isDragging, isResizing])

  const catColor = activity.category ? getCategoryTheme(activity.category).color : 'border'

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

  const bindDrag = useDrag(({ movement: [, my], first, last, memo = localTop }) => {
    if (isReadOnly) return memo
    if (first) setIsDragging(true)
    let newTop = memo + my
    if (newTop < 0) newTop = 0
    const snappedMins = pixelsToMinutes(newTop)
    const snappedTop = (snappedMins / 60) * hourHeight
    setLocalTop(snappedTop)
    if (last) {
      setIsDragging(false)
      const absMins = startOfDayMinutes + snappedMins
      const newTimeStr = minutesToTimeString(absMins)
      if (newTimeStr !== activity.time) {
        dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { time: newTimeStr } } })
      }
    }
    return memo
  }, { filterTaps: true })

  const bindResize = useDrag(({ movement: [, my], first, last, event, memo = localHeight }) => {
    if (isReadOnly) return memo
    event.stopPropagation()
    if (first) setIsResizing(true)
    let newHeight = memo + my
    if (newHeight < (hourHeight / 4)) newHeight = (hourHeight / 4)
    const snappedMinsDelta = pixelsToMinutes(newHeight)
    const snappedHeight = (snappedMinsDelta / 60) * hourHeight
    setLocalHeight(snappedHeight)
    if (last) {
      setIsResizing(false)
      if (snappedMinsDelta !== (activity.duration || 60)) {
        dispatch({ type: ACTIONS.UPDATE_ACTIVITY, payload: { dayId: day.id, activityId: activity.id, updates: { duration: Math.max(15, snappedMinsDelta) } } })
      }
    }
    return memo
  }, { filterTaps: true })

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
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] shrink-0">{activity.emoji || '📍'}</span>
          <h4 className="text-sm font-semibold font-heading leading-tight text-text-primary transition-colors truncate flex-1">
            {activity.name}
          </h4>
          {hasCalendarConflict && (
            <span className="text-[9px] font-bold text-warning shrink-0" title="Time overlap">⚠️</span>
          )}
        </div>
        <div className="text-[11px] text-text-muted font-medium truncate uppercase tracking-tight">
          {(activity?.location?.placeName || activity?.location || 'Unknown')} • {activity?.duration || 60}m
        </div>
        <div className={`text-[11px] font-mono font-medium transition-colors ${isDragging || isResizing ? 'text-accent' : hasCalendarConflict ? 'text-warning' : 'text-text-secondary'}`}>
          {displayTime} – {displayEndTime}
        </div>
        {localHeight > 100 && <div className="mt-auto" />}
      </div>

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
