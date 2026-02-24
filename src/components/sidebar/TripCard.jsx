import { useState } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateReadiness } from '../../utils/readiness'
import { formatDateRange } from '../../utils/helpers'
import ProgressRing from '../shared/ProgressRing'
import StatusBadge from '../shared/StatusBadge'
import TripContextMenu from './TripContextMenu'

export default function TripCard({ trip, isActive, isMobile }) {
  const { dispatch } = useTripContext()
  const [showMenu, setShowMenu] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const readiness = calculateReadiness(trip)
  const dateRange = formatDateRange(trip.startDate, trip.endDate)

  // Build flag list with +N overflow badge
  const MAX_FLAGS = 3
  const allFlags = trip.destinations && trip.destinations.length > 0
    ? [...new Set(trip.destinations.map(d => d.flag || (d.country ? d.country.slice(0, 2) : '')))]
        .filter(Boolean)
    : []
  const visibleFlags = allFlags.slice(0, MAX_FLAGS)
  const hiddenFlagCount = allFlags.length - MAX_FLAGS

  const handleClick = () => {
    dispatch({ type: ACTIONS.SET_ACTIVE_TRIP, payload: trip.id })
    if (isMobile) {
      dispatch({ type: ACTIONS.SET_SIDEBAR, payload: false })
    }
  }

  const handleMenuToggle = (e) => {
    e.stopPropagation()
    setShowMenu((prev) => !prev)
  }

  return (
    <div
      className={`
        group relative flex items-start gap-3 px-3 py-3.5
        rounded-[var(--radius-md)] cursor-pointer
        transition-all duration-150
        ${isActive
          ? 'bg-accent-muted border border-accent/40'
          : 'border border-transparent hover:bg-bg-hover hover:border-border'
        }
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        if (!showMenu) setShowMenu(false)
      }}
    >
      {/* Trip Emoji */}
      <span className="text-2xl leading-none mt-0.5 shrink-0" role="img" aria-label="trip icon">
        {trip.emoji || '\u2708\ufe0f'}
      </span>

      {/* Trip Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1.5">
          <h3 className={`text-sm font-medium truncate leading-snug ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}>
            {trip.name}
          </h3>

          {/* Context Menu Trigger */}
          <button
            onClick={handleMenuToggle}
            className={`shrink-0 p-0.5 rounded-[var(--radius-sm)]
                        text-text-muted hover:text-text-primary hover:bg-bg-secondary
                        transition-all duration-150
                        ${isHovered || showMenu ? 'opacity-100' : 'opacity-0'}
                      `}
            aria-label="Trip options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="18" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Flag row with +N overflow badge */}
        {allFlags.length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            {visibleFlags.map((flag, i) => (
              <span key={i} className="text-sm leading-none">{flag}</span>
            ))}
            {hiddenFlagCount > 0 && (
              <span className="text-[10px] text-text-muted font-medium px-1 py-0.5
                               bg-bg-secondary rounded-[var(--radius-sm)] leading-none ml-0.5">
                +{hiddenFlagCount}
              </span>
            )}
          </div>
        )}

        {/* Date range + status + readiness row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {dateRange && (
            <span className="text-xs text-text-muted whitespace-nowrap">
              {dateRange}
            </span>
          )}
          {trip.startDate && trip.endDate && (
            <StatusBadge startDate={trip.startDate} endDate={trip.endDate} />
          )}
        </div>
      </div>

      {/* Readiness Ring */}
      <div className="shrink-0 mt-1">
        <ProgressRing
          value={readiness}
          size={36}
          strokeWidth={3}
          showLabel={true}
          labelClassName="!text-[9px]"
        />
      </div>

      {/* Context Menu */}
      {showMenu && (
        <TripContextMenu
          tripId={trip.id}
          tripName={trip.name}
          onClose={() => setShowMenu(false)}
        />
      )}
    </div>
  )
}
