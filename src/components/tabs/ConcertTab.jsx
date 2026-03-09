import Card from '../shared/Card'
import { useTripContext } from '../../context/TripContext'
import { useCountdown } from '../../hooks/useCountdown'
import { formatDate } from '../../utils/helpers'

const DEFAULT_TIPS = [
  'Arrive early to get a good spot',
  'Charge your phone to 100% before leaving',
  'Wear comfortable shoes — you\'ll be standing',
  'Bring earplugs to protect your hearing',
  'Check the venue\'s bag policy before going',
  'Stay hydrated — bring a sealed water bottle if allowed',
]

function ConcertCountdown({ targetDate }) {
  const countdown = useCountdown(targetDate)

  if (countdown.expired) {
    return (
      <div className="text-center py-4">
        <p className="text-3xl font-heading font-semibold text-red-500">🎸 IT'S SHOWTIME! 🎸</p>
      </div>
    )
  }

  return (
    <div className="text-center py-6">
      <p className="text-xs uppercase tracking-[0.2em] text-red-400 mb-4 font-semibold">Countdown to showtime</p>
      <div className="flex justify-center gap-6">
        {[
          { value: countdown.days, label: 'Days' },
          { value: countdown.hours, label: 'Hours' },
          { value: countdown.minutes, label: 'Min' },
          { value: countdown.seconds, label: 'Sec' },
        ].map((unit, i) => (
          <div key={i} className="text-center">
            <div className={`text-4xl md:text-5xl font-heading font-semibold text-white
              ${unit.label === 'Sec' ? 'animate-pulse' : ''}`}>
              {String(unit.value).padStart(2, '0')}
            </div>
            <div className="text-xs text-red-400/70 uppercase tracking-wider mt-1">{unit.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConcertTab() {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip

  // Find the first booking that matches "concert" or "event" category
  const concertBooking = trip.bookings?.find(b =>
    b.category === 'concert' || b.category === 'event'
  )

  if (!concertBooking) {
    return (
      <Card className="text-center py-12">
        <p className="text-4xl mb-3">🎵</p>
        <p className="text-text-muted">No concert or event bookings found.</p>
        <p className="text-text-muted text-sm mt-1">Add a booking with category "Concert" or "Event" to unlock this tab.</p>
      </Card>
    )
  }

  // Find the concert day in itinerary — match by date if booking has a date field,
  // otherwise fall back to looking for an activity with a matching name or emoji
  const bookingName = concertBooking.name?.toLowerCase() || ''
  const concertDay = trip.itinerary?.find(d => {
    if (concertBooking.date && d.date === concertBooking.date) return true
    return d.activities?.some(a =>
      a.name?.toLowerCase().includes(bookingName.split(' ')[0]) ||
      a.emoji === '🎵' || a.emoji === '🎸' || a.emoji === '🎤'
    )
  })

  // Use venue stored on the booking, or a generic fallback
  const venue = concertBooking.venue || concertBooking.location || 'Check your booking details'

  // Use custom tips if stored on the booking, otherwise use defaults
  const tips = concertBooking.eventTips?.length ? concertBooking.eventTips : DEFAULT_TIPS

  const statusLabel = concertBooking.status === 'booked' || concertBooking.status === 'confirmed'
    ? '✅ Confirmed'
    : `⏳ ${(concertBooking.status || 'pending').replace('_', ' ')}`

  return (
    <div className="concert-theme rounded-[var(--radius-xl)] overflow-hidden animate-fade-in">
      {/* Dark concert-themed container */}
      <div className="bg-[#141413] rounded-[var(--radius-xl)] border border-[#2A2A28]">

        {/* Hero */}
        <div className="relative p-8 md:p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[#141413]" />
          <div className="relative z-10">
            <p className="text-red-500 text-sm uppercase tracking-[0.3em] font-semibold mb-3">
              ★ LIVE EVENT ★
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-semibold text-white mb-2">
              {concertBooking.name}
            </h2>
            {concertDay && (
              <p className="text-text-muted text-sm mt-2">
                {formatDate(concertDay.date, 'full')} · Day {concertDay.dayNumber}
              </p>
            )}
          </div>
        </div>

        {/* Countdown */}
        <div className="px-6 md:px-12">
          <ConcertCountdown targetDate={concertDay?.date || trip.startDate} />
        </div>

        <div className="h-px bg-red-900/50 mx-8" />

        {/* Details grid */}
        <div className="p-6 md:p-12 grid md:grid-cols-2 gap-6">
          {/* Venue & Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-1">Venue</h3>
              <p className="text-white font-medium">{venue}</p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-1">Tickets</h3>
              <p className="text-white font-medium">
                {trip.travelers} pax · {statusLabel}
              </p>
              {concertBooking.confirmationNumber && (
                <p className="text-text-muted text-xs font-mono mt-1">
                  Ref: {concertBooking.confirmationNumber}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-1">Status</h3>
              <div className={`inline-flex px-3 py-1 rounded-[var(--radius-pill)] text-xs font-medium
                ${concertBooking.status === 'booked'
                  ? 'bg-green-900/30 text-green-400 border border-green-800/30'
                  : 'bg-red-900/30 text-red-400 border border-red-800/30'}`}>
                {concertBooking.status === 'booked' ? '✓ Booked' : 'Not yet booked'}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-2">🎤 Event Tips</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500">▸</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Concert day activities */}
        {concertDay && concertDay.activities?.length > 0 && (
          <>
            <div className="h-px bg-red-900/50 mx-8" />
            <div className="p-6 md:p-12">
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-4">
                📅 Day {concertDay.dayNumber} Schedule
              </h3>
              <div className="space-y-3">
                {concertDay.activities.map(activity => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-text-muted w-12">{activity.time || '--:--'}</span>
                    <span className="text-lg">{activity.emoji}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{activity.name}</p>
                      {activity.notes && <p className="text-text-muted text-xs">{activity.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Bottom accent */}
        <div className="h-1 bg-[#141413]" />
      </div>
    </div>
  )
}
