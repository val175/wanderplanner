import { useMemo } from 'react'
import EditableText from '../shared/EditableText'
import ProgressRing from '../shared/ProgressRing'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateReadiness } from '../../utils/readiness'
import { formatDateRange, daysUntil } from '../../utils/helpers'
import { useCountdown } from '../../hooks/useCountdown'

function CountdownBadge({ targetDate, label, emoji }) {
  const countdown = useCountdown(targetDate)

  if (!targetDate) return null

  if (countdown.expired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-muted/40 rounded-[var(--radius-lg)] border border-accent/15">
        <span className="text-base">{emoji}</span>
        <div>
          <p className="text-xs text-text-muted leading-tight">{label}</p>
          <p className="text-sm font-semibold text-accent">Happening now!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary rounded-[var(--radius-lg)] border border-border">
      <span className="text-base">{emoji}</span>
      <div>
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-lg font-heading font-bold text-text-primary leading-none">
            {countdown.days}
          </span>
          <span className="text-xs text-text-muted">
            {countdown.days === 1 ? 'day' : 'days'}
          </span>
          <span className="text-text-muted text-xs mx-0.5">:</span>
          <span className="text-sm font-heading font-semibold text-text-primary leading-none">
            {String(countdown.hours).padStart(2, '0')}
          </span>
          <span className="text-xs text-text-muted">hrs</span>
          <span className="text-text-muted text-xs mx-0.5">:</span>
          <span className="text-sm font-heading font-semibold text-text-primary leading-none">
            {String(countdown.minutes).padStart(2, '0')}
          </span>
          <span className="text-xs text-text-muted">min</span>
        </div>
      </div>
    </div>
  )
}

export default function TripHeader() {
  const { activeTrip, dispatch } = useTripContext()

  const readiness = useMemo(
    () => calculateReadiness(activeTrip),
    [activeTrip]
  )

  const priorityBooking = useMemo(
    () => activeTrip?.bookings?.find(b => b.priority) || null,
    [activeTrip?.bookings]
  )

  if (!activeTrip) return null

  const trip = activeTrip

  const handleRename = (newName) => {
    if (newName) {
      dispatch({
        type: ACTIONS.RENAME_TRIP,
        payload: { id: trip.id, name: newName },
      })
    }
  }

  const departureDate = trip.startDate
  const priorityEventDate = priorityBooking?.bookByDate || priorityBooking?.date || trip.startDate
  const priorityEventLabel = priorityBooking
    ? priorityBooking.name
    : 'Trip starts'

  const destinationChain = trip.destinations || []
  const dateRange = formatDateRange(trip.startDate, trip.endDate)
  const travelerCount = trip.travelers || 1

  return (
    <header className="animate-fade-in border-b border-border">
      <div className="max-w-4xl mx-auto px-8 pt-7 pb-6">
      {/* Top row: emoji + name + readiness ring */}
      <div className="flex items-start justify-between gap-6">
        {/* Left: Trip identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {/* Trip Emoji */}
            <span className="text-[48px] leading-none shrink-0" role="img" aria-label="Trip emoji">
              {trip.emoji}
            </span>

            {/* Trip Name (inline editable) */}
            <div className="min-w-0 flex-1">
              <EditableText
                value={trip.name}
                onSave={handleRename}
                tag="h1"
                className="font-heading text-2xl md:text-3xl font-bold text-text-primary leading-tight truncate"
                inputClassName="text-2xl md:text-3xl font-heading font-bold w-full"
                placeholder="Name your trip..."
              />
            </div>
          </div>

          {/* Destination chain */}
          {destinationChain.length > 0 && (
            <div className="flex items-center flex-wrap gap-x-1 gap-y-1 mb-3">
              {destinationChain.map((dest, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-text-muted mx-1 shrink-0"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                  <span className="inline-flex items-center gap-1 text-sm text-text-secondary whitespace-nowrap">
                    <span>{dest.flag}</span>
                    <span>{dest.city}</span>
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Date range + travelers */}
          <div className="flex items-center flex-wrap gap-3">
            {dateRange && (
              <span className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {dateRange}
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-accent bg-accent-muted/40 rounded-[var(--radius-pill)]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {travelerCount} {travelerCount === 1 ? 'traveler' : 'travelers'}
            </span>
          </div>
        </div>

        {/* Right: Readiness Ring */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <ProgressRing
            value={readiness}
            size={80}
            strokeWidth={6}
            labelClassName="text-base"
          />
          <span className="text-xs text-text-muted font-medium tracking-wide">Readiness</span>
        </div>
      </div>

      {/* Countdown row */}
      <div className="flex flex-wrap gap-3 mt-5">
        <CountdownBadge
          targetDate={departureDate}
          label="Days to departure"
          emoji="✈️"
        />
        {priorityBooking && (
          <CountdownBadge
            targetDate={priorityEventDate}
            label={priorityEventLabel}
            emoji="⭐"
          />
        )}
      </div>
      </div>
    </header>
  )
}
