import { useRef } from 'react'
import { useTripContext } from '../../../context/TripContext'
import { DAY_COLORS } from '../../../constants/colors'
import CalendarActivityBlock from './CalendarActivityBlock'

/** Parse time string (24h or 12h AM/PM) to total minutes. */
function timeToMinutes(timeStr) {
  if (!timeStr) return null
  const trimmed = timeStr.trim()
  let hours, mins
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
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null
  return hours * 60 + mins
}

export default function CalendarView({ trip, itinerary, isMobile, activeDayIndex, onOpenDrawer, onDayChange }) {
  const canvasRef = useRef(null)
  const panState = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })
  const { isReadOnly } = useTripContext()

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

  const visibleItinerary = isMobile ? [itinerary[activeDayIndex]].filter(Boolean) : itinerary

  let foundEarliest = 8
  let foundLatest = 22
  let hasActivities = false

  visibleItinerary.forEach(day => {
    day.activities?.forEach(act => {
      const startMins = timeToMinutes(act.time)
      if (startMins !== null) {
        hasActivities = true
        const startH = Math.floor(startMins / 60)
        if (startH < foundEarliest) foundEarliest = startH
        const endMins = startMins + (act.duration || 60)
        const endH = Math.ceil(endMins / 60)
        if (endH > foundLatest) foundLatest = endH
      }
    })
  })

  const earliestHour = hasActivities ? Math.max(0, foundEarliest - 1) : 8
  const latestHour = hasActivities ? Math.min(24, foundLatest + 1) : 22
  const numHours = latestHour - earliestHour + 1
  const hours = Array.from({ length: numHours }, (_, i) => i + earliestHour)
  const startOfDayMinutes = earliestHour * 60
  const hourHeight = 84
  const totalMinHeight = Math.max(600, (numHours + 1) * hourHeight)

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
      {isMobile && itinerary?.length > 1 && (() => {
        const day = itinerary[activeDayIndex]
        return (
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-bg-card sticky top-0 left-0 z-30 w-full">
            <button
              onClick={() => onDayChange(Math.max(0, activeDayIndex - 1))}
              disabled={activeDayIndex === 0}
              className="p-2 text-text-muted hover:text-text-primary disabled:opacity-25 transition-colors rounded-lg hover:bg-bg-hover"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="text-center leading-tight py-1">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-0.5">{day?.emoji} Day {day?.dayNumber}</p>
              <p className="text-sm font-bold text-text-primary font-heading truncate max-w-[200px]">{day?.location || 'Untitled'}</p>
            </div>
            <button
              onClick={() => onDayChange(Math.min(itinerary.length - 1, activeDayIndex + 1))}
              disabled={activeDayIndex === itinerary.length - 1}
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
          {!isMobile && <div className="h-14" />}
          {hours.map(hr => (
            <div key={hr} className="relative" style={{ height: hourHeight }}>
              <span className="absolute -top-2.5 left-3 text-[10px] font-mono text-text-muted font-semibold uppercase tracking-wider">
                {hr % 12 || 12} {hr < 12 ? 'AM' : 'PM'}
              </span>
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="flex-1 flex min-w-0">
          {visibleItinerary.map((day, idx) => {
            const dayColor = DAY_COLORS[idx % DAY_COLORS.length]
            return (
              <div key={day.id} className="flex-1 min-w-[320px] border-r border-border/20 relative transition-colors bg-bg-card">
                {/* Day Header */}
                {!isMobile && (
                  <div className="h-14 border-b border-border/20 flex items-center justify-between sticky top-0 z-10 px-3 transition-all bg-bg-card">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Day {day.dayNumber}</span>
                      <span className="text-sm font-semibold font-heading text-text-primary truncate max-w-full">{day.location || 'Untitled'}</span>
                    </div>
                    {(() => {
                      const count = day.activities?.length || 0
                      if (count < 5) return <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/10 text-success shrink-0">🔋</div>
                      if (count <= 8) return <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info shrink-0">⚡</div>
                      return <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning shrink-0">🪫</div>
                    })()}
                  </div>
                )}

                {/* Grid Lines */}
                <div className={`absolute inset-0 ${isMobile ? 'pt-0' : 'pt-14'} pointer-events-none`}>
                  {hours.map(hr => (
                    <div key={hr} className="border-b border-dashed border-border/20 w-full" style={{ height: hourHeight }} />
                  ))}
                </div>

                {/* Activity Blocks */}
                <div className={`relative ${isMobile ? 'pt-0' : 'pt-14'} h-full px-2`}>
                  {day.activities?.map(activity => {
                    const mins = timeToMinutes(activity.time)
                    if (mins === null || mins < startOfDayMinutes) return null
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
