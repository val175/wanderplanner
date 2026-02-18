import { useMemo } from 'react'
import Card from '../shared/Card'
import ProgressRing from '../shared/ProgressRing'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { useCountdown } from '../../hooks/useCountdown'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatDateRange, formatCurrency, daysUntil, daysBetween } from '../../utils/helpers'

function CountdownUnit({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-heading font-bold text-text-primary">{String(value).padStart(2, '0')}</div>
      <div className="text-xs text-text-muted uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

function CountdownDisplay({ targetDate, label }) {
  const countdown = useCountdown(targetDate)

  if (countdown.expired) {
    return (
      <Card className="text-center">
        <p className="text-text-muted text-sm mb-1">{label}</p>
        <p className="text-accent font-heading text-lg font-semibold">It's time! 🎉</p>
      </Card>
    )
  }

  return (
    <Card className="text-center">
      <p className="text-text-muted text-sm mb-3">{label}</p>
      <div className="flex justify-center gap-4">
        <CountdownUnit value={countdown.days} label="days" />
        <span className="text-text-muted text-2xl font-light self-start mt-1">:</span>
        <CountdownUnit value={countdown.hours} label="hrs" />
        <span className="text-text-muted text-2xl font-light self-start mt-1">:</span>
        <CountdownUnit value={countdown.minutes} label="min" />
        <span className="text-text-muted text-2xl font-light self-start mt-1">:</span>
        <CountdownUnit value={countdown.seconds} label="sec" />
      </div>
    </Card>
  )
}

export default function OverviewTab() {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)

  const priorityBooking = useMemo(() =>
    trip.bookings?.find(b => b.priority) || null
  , [trip.bookings])

  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const citiesCount = [...new Set(trip.destinations?.map(d => d.city))].length
  const flightsCount = trip.bookings?.filter(b => b.category === 'flight').length || 0
  const experiencesCount = trip.bookings?.filter(b => ['experience', 'concert'].includes(b.category)).length || 0

  const budgetMin = trip.budget?.reduce((sum, b) => sum + (b.min || 0), 0) || 0
  const budgetMax = trip.budget?.reduce((sum, b) => sum + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((sum, b) => sum + (b.actual || 0), 0) || 0

  const nextAction = useMemo(() => {
    const unfinishedTodos = trip.todos?.filter(t => !t.done).sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (b.priority === 'high' && a.priority !== 'high') return 1
      if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate)
      if (a.dueDate) return -1
      return 1
    })
    if (unfinishedTodos?.length > 0) return { type: 'todo', item: unfinishedTodos[0] }

    const unconfirmedBookings = trip.bookings?.filter(b => b.status !== 'booked').sort((a, b) => {
      if (a.priority && !b.priority) return -1
      if (b.priority && !a.priority) return 1
      return 0
    })
    if (unconfirmedBookings?.length > 0) return { type: 'booking', item: unconfirmedBookings[0] }

    return null
  }, [trip.todos, trip.bookings])

  const readinessMessage = readiness === 100
    ? "You're 100% ready. Go enjoy the world. 🌍"
    : readiness >= 75
    ? "Almost there! Just a few more things."
    : readiness >= 50
    ? "Making good progress. Keep it up!"
    : "Let's get this trip planned! 🗺️"

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Hero Banner */}
      <div className="bg-bg-secondary rounded-[var(--radius-xl)] p-9 relative overflow-hidden border border-border">
        <div className="relative z-10">
          <h2 className="font-heading text-3xl font-bold mb-2 text-text-primary">{trip.emoji} {trip.name}</h2>
          <p className="text-text-muted text-sm">
            {formatDateRange(trip.startDate, trip.endDate)} · {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {trip.destinations?.map((d, i) => (
              <span key={i} className="px-3 py-1 bg-bg-hover rounded-[var(--radius-pill)] text-sm text-text-secondary">
                {d.flag} {d.city}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Days', value: totalDays, emoji: '📅' },
          { label: 'Cities', value: citiesCount, emoji: '🏙️' },
          { label: 'Flights', value: flightsCount, emoji: '✈️' },
          { label: 'Experiences', value: experiencesCount, emoji: '🎯' },
        ].map((stat, i) => (
          <Card key={i} className={`text-center delay-${i + 1} animate-fade-in-up`} padding="py-7 px-6">
            <div className="text-3xl mb-2">{stat.emoji}</div>
            <div className="text-3xl font-heading font-bold text-text-primary">{stat.value}</div>
            <div className="text-xs text-text-muted mt-1.5 uppercase tracking-wider">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Readiness + Countdowns */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Readiness */}
        <Card>
          <div className="flex items-center gap-5">
            <ProgressRing value={readiness} size={96} strokeWidth={7} />
            <div className="flex-1">
              <h3 className="font-heading text-lg text-text-primary mb-1">Trip Readiness</h3>
              <p className="text-sm text-text-muted mb-3">{readinessMessage}</p>
              <div className="space-y-2">
                <ProgressBar
                  value={breakdown.bookings.done}
                  max={breakdown.bookings.total}
                  label="Bookings"
                  showLabel
                  colorClass="bg-info"
                  height="h-1.5"
                />
                <ProgressBar
                  value={breakdown.todos.done}
                  max={breakdown.todos.total}
                  label="To-Dos"
                  showLabel
                  colorClass="bg-accent"
                  height="h-1.5"
                />
                <ProgressBar
                  value={breakdown.packing.done}
                  max={breakdown.packing.total}
                  label="Packing"
                  showLabel
                  colorClass="bg-success"
                  height="h-1.5"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Countdowns */}
        <div className="space-y-3">
          <CountdownDisplay targetDate={trip.startDate} label="⏱ Days to departure" />
        </div>
      </div>

      {/* Next Action + Budget Snapshot */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Next Action */}
        {nextAction && (
          <Card>
            <h3 className="font-heading text-sm text-text-muted uppercase tracking-wider mb-2">Next Thing to Do</h3>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{nextAction.type === 'todo' ? '✅' : '🎫'}</span>
              <div>
                <p className="text-text-primary font-medium">
                  {nextAction.type === 'todo' ? nextAction.item.text : nextAction.item.name}
                </p>
                <p className="text-sm text-text-muted mt-0.5">
                  {nextAction.type === 'todo' ? `Category: ${nextAction.item.category}` : `Status: ${nextAction.item.status.replace('_', ' ')}`}
                  {nextAction.item.dueDate && ` · Due: ${nextAction.item.dueDate}`}
                  {nextAction.item.bookByDate && ` · Book by: ${nextAction.item.bookByDate}`}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Budget Snapshot */}
        {budgetMax > 0 && (
          <Card>
            <h3 className="font-heading text-sm text-text-muted uppercase tracking-wider mb-2">Budget Snapshot</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Estimated range</span>
                <span className="text-text-primary font-medium">
                  {formatCurrency(budgetMin, trip.currency)} – {formatCurrency(budgetMax, trip.currency)}
                </span>
              </div>
              {totalSpent > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Spent so far</span>
                    <span className={`font-medium ${totalSpent > budgetMax ? 'text-danger' : 'text-accent'}`}>
                      {formatCurrency(totalSpent, trip.currency)}
                    </span>
                  </div>
                  <ProgressBar
                    value={totalSpent}
                    max={budgetMax}
                    colorClass={totalSpent > budgetMax ? 'bg-danger' : 'bg-accent'}
                    height="h-2"
                  />
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
