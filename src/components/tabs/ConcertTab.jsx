import Card from '../shared/Card'
import { useTripContext } from '../../context/TripContext'
import { useCountdown } from '../../hooks/useCountdown'
import { formatDate, daysUntil } from '../../utils/helpers'

function ConcertCountdown({ targetDate }) {
  const countdown = useCountdown(targetDate)

  if (countdown.expired) {
    return (
      <div className="text-center py-4">
        <p className="text-3xl font-heading font-bold text-red-500">🎸 IT'S SHOWTIME! 🎸</p>
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
            <div className={`text-4xl md:text-5xl font-heading font-bold text-white
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
  const concertBooking = trip.bookings?.find(b => b.category === 'concert')

  if (!concertBooking) {
    return (
      <Card className="text-center py-12">
        <p className="text-4xl mb-3">🎵</p>
        <p className="text-text-muted">No concert or event bookings found.</p>
        <p className="text-text-muted text-sm mt-1">Add a booking with category "Concert" to unlock this tab.</p>
      </Card>
    )
  }

  // Find the concert day in itinerary
  const concertDay = trip.itinerary?.find(d =>
    d.activities?.some(a =>
      a.name?.toLowerCase().includes('concert') ||
      a.name?.toLowerCase().includes('mcr') ||
      a.emoji === '🎵' || a.emoji === '🎸'
    )
  )

  const isMCR = concertBooking.name?.toLowerCase().includes('mcr') ||
                concertBooking.name?.toLowerCase().includes('my chemical romance') ||
                concertBooking.name?.toLowerCase().includes('chemical')

  return (
    <div className="concert-theme rounded-[var(--radius-xl)] overflow-hidden animate-fade-in">
      {/* Dark concert-themed container */}
      <div className="bg-[#141413] rounded-[var(--radius-xl)] border border-[#2A2A28]">

        {/* Hero */}
        <div className="relative p-8 md:p-12 text-center overflow-hidden">
          {/* Background overlay */}
          <div className="absolute inset-0 bg-[#141413]" />

          <div className="relative z-10">
            <p className="text-red-500 text-sm uppercase tracking-[0.3em] font-semibold mb-3">
              {isMCR ? '★ THE BLACK PARADE ★' : '★ LIVE EVENT ★'}
            </p>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-2">
              {concertBooking.name}
            </h2>
            {concertDay && (
              <p className="text-gray-400 text-sm mt-2">
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
              <p className="text-white font-medium">
                {isMCR ? 'Stadium Merdeka, Kuala Lumpur' : 'Check your booking details'}
              </p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-1">Tickets</h3>
              <p className="text-white font-medium">
                {trip.travelers} pax · {concertBooking.status === 'booked' ? '✅ Confirmed' : '⏳ ' + concertBooking.status.replace('_', ' ')}
              </p>
              {concertBooking.confirmationNumber && (
                <p className="text-gray-500 text-xs font-mono mt-1">
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
              <h3 className="text-xs uppercase tracking-wider text-red-400/70 font-semibold mb-2">🎤 Concert Tips</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Arrive early to get a good spot
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Charge your phone to 100% before leaving
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Wear comfortable shoes — you'll be standing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Bring earplugs to protect your hearing
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Check the venue's bag policy before going
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500">▸</span>
                  Stay hydrated — bring a sealed water bottle if allowed
                </li>
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
                    <span className="text-sm font-mono text-gray-500 w-12">{activity.time || '--:--'}</span>
                    <span className="text-lg">{activity.emoji}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{activity.name}</p>
                      {activity.notes && <p className="text-gray-500 text-xs">{activity.notes}</p>}
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
