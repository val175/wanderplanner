import { useMemo, useState, useEffect } from 'react'
import Card from '../shared/Card'
import ProgressRing from '../shared/ProgressRing'
import ProgressBar from '../shared/ProgressBar'
import AvatarCircle from '../shared/AvatarCircle'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { useCountdown } from '../../hooks/useCountdown'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatDateRange, formatCurrency, daysUntil, daysBetween, formatDate } from '../../utils/helpers'

/* ─────────────────────────────────────────────────────────────
   Deterministic gradient from destination city names.
   Each city hashes to a hue → unique gradient per trip,
   no external image API needed, always works offline.
───────────────────────────────────────────────────────────── */
function strToHue(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return Math.abs(h) % 360
}

function buildHeroGradient(destinations = [], darkMode = false) {
  if (!destinations.length) {
    return darkMode
      ? 'linear-gradient(135deg, #2a2017 0%, #1a1510 100%)'
      : 'linear-gradient(135deg, #f5ede0 0%, #ead5c0 100%)'
  }
  const hues = destinations.map(d => strToHue(d.city + d.country))
  const h1 = hues[0]
  const h2 = hues[Math.floor(hues.length / 2)] ?? (h1 + 40) % 360
  const h3 = hues[hues.length - 1] ?? (h1 + 80) % 360
  if (darkMode) {
    return `linear-gradient(135deg,
      hsl(${h1},35%,14%) 0%,
      hsl(${h2},30%,12%) 50%,
      hsl(${h3},25%,10%) 100%)`
  }
  return `linear-gradient(135deg,
    hsl(${h1},55%,88%) 0%,
    hsl(${h2},50%,84%) 50%,
    hsl(${h3},45%,80%) 100%)`
}

/* ─────────────────────────────────────────────────────────────
   WMO weather code → emoji + label
───────────────────────────────────────────────────────────── */
function wmoToDescription(code) {
  if (code === 0) return { emoji: '☀️', label: 'Clear sky' }
  if (code <= 2)  return { emoji: '🌤️', label: 'Partly cloudy' }
  if (code === 3) return { emoji: '☁️', label: 'Overcast' }
  if (code <= 49) return { emoji: '🌫️', label: 'Foggy' }
  if (code <= 59) return { emoji: '🌦️', label: 'Drizzle' }
  if (code <= 69) return { emoji: '🌧️', label: 'Rain' }
  if (code <= 79) return { emoji: '🌨️', label: 'Snow' }
  if (code <= 84) return { emoji: '🌧️', label: 'Showers' }
  if (code <= 99) return { emoji: '⛈️', label: 'Thunderstorm' }
  return { emoji: '🌡️', label: 'Unknown' }
}

/* ─────────────────────────────────────────────────────────────
   WeatherWidget — live weather for first destination.
   Uses Open-Meteo (free, no API key, CORS-enabled).
───────────────────────────────────────────────────────────── */
function WeatherWidget({ destinations }) {
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'error'
  const firstDest = destinations?.[0]

  useEffect(() => {
    if (!firstDest) { setStatus('error'); return }
    let cancelled = false
    setStatus('loading')
    setWeather(null)

    async function fetchWeather() {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstDest.city)}&count=1&language=en&format=json`
        )
        const geoData = await geoRes.json()
        if (!geoData.results?.length) throw new Error('City not found')
        const { latitude, longitude } = geoData.results[0]

        const wxRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
          `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weathercode` +
          `&temperature_unit=celsius&timezone=auto`
        )
        const wxData = await wxRes.json()
        const cur = wxData.current
        if (!cancelled) {
          setWeather({
            temp: Math.round(cur.temperature_2m),
            feelsLike: Math.round(cur.apparent_temperature),
            humidity: cur.relative_humidity_2m,
            wmo: cur.weathercode,
            city: firstDest.city,
            flag: firstDest.flag,
          })
          setStatus('ok')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    fetchWeather()
    return () => { cancelled = true }
  }, [firstDest?.city])

  if (status === 'error' || !firstDest) return null

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-full bg-bg-hover shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-3 bg-bg-hover rounded w-24" />
          <div className="h-2 bg-bg-hover rounded w-16" />
        </div>
      </div>
    )
  }

  const { emoji, label } = wmoToDescription(weather.wmo)
  return (
    <div className="flex items-center gap-3">
      <div className="text-4xl leading-none shrink-0">{emoji}</div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-heading font-bold text-text-primary">{weather.temp}°C</span>
          <span className="text-sm text-text-muted">feels {weather.feelsLike}°</span>
        </div>
        <div className="text-xs text-text-muted mt-0.5">
          {label} · {weather.humidity}% humidity · {weather.flag} {weather.city}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Compact countdown chip (weeks + days)
───────────────────────────────────────────────────────────── */
function CountdownChip({ targetDate }) {
  const countdown = useCountdown(targetDate)
  if (!targetDate || countdown.expired) return null
  const weeks = Math.floor(countdown.days / 7)
  const days = countdown.days % 7
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {weeks > 0 && (
        <span className="text-sm text-text-secondary">
          <strong className="font-heading font-bold text-xl text-text-primary">{weeks}</strong>
          {' '}{weeks === 1 ? 'wk' : 'wks'}
        </span>
      )}
      {(days > 0 || weeks === 0) && (
        <span className="text-sm text-text-secondary">
          <strong className="font-heading font-bold text-xl text-text-primary">{days}</strong>
          {' '}{days === 1 ? 'day' : 'days'}
        </span>
      )}
      <span className="text-sm text-text-muted">to departure ✈️</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Immersive Hero Header
   Dynamic gradient · traveler avatars · countdown
───────────────────────────────────────────────────────────── */
function HeroHeader({ trip, travelerProfiles }) {
  const darkMode = document.documentElement.classList.contains('dark')
  const gradient = useMemo(
    () => buildHeroGradient(trip.destinations, darkMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip.destinations, darkMode]
  )
  const dateRange = formatDateRange(trip.startDate, trip.endDate)

  // Deduplicated destinations for pills
  const uniqueDests = (trip.destinations || []).filter((d, i, arr) =>
    arr.findIndex(x => x.city === d.city && x.country === d.country) === i
  )

  return (
    <div
      className="relative rounded-[var(--radius-xl)] overflow-hidden border border-border"
      style={{ background: gradient }}
    >
      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative z-10 px-6 pt-6 pb-5 sm:px-8 sm:pt-7 sm:pb-6">

        {/* Top row: emoji + name */}
        <div className="flex items-start gap-4 min-w-0">
          <span className="text-5xl leading-none shrink-0 mt-0.5 select-none">{trip.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-2xl sm:text-[28px] font-bold text-text-primary leading-tight">
              {trip.name}
            </h2>
            {dateRange && (
              <p className="text-sm text-text-secondary mt-1 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="shrink-0 opacity-50">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {dateRange}
              </p>
            )}
          </div>
        </div>

        {/* Traveler avatars row */}
        {travelerProfiles.length > 0 && (
          <div className="mt-5 flex items-center gap-3">
            <div className="flex" style={{ '--overlap': '-10px' }}>
              {travelerProfiles.map((p, i) => (
                <div
                  key={p.id}
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: travelerProfiles.length - i }}
                  className="relative"
                >
                  <AvatarCircle profile={p} size={40} ring className="shadow-sm" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {travelerProfiles.map(p => p.name.split(' ')[0]).join(' & ')}
              </p>
              <p className="text-xs text-text-muted">Shared trip · {travelerProfiles.length} {travelerProfiles.length === 1 ? 'traveler' : 'travelers'}</p>
            </div>
          </div>
        )}

        {/* Bottom: destination pills + countdown */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {uniqueDests.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1
                           rounded-full text-sm font-medium text-text-primary
                           bg-white/25 border border-white/20 backdrop-blur-sm"
              >
                {d.flag} {d.city}
              </span>
            ))}
          </div>
          {trip.startDate && (
            <CountdownChip targetDate={trip.startDate} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Trip Brief — horizontal stat strip
───────────────────────────────────────────────────────────── */
function TripBrief({ trip }) {
  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const uniqueCities = (trip.destinations || []).filter((d, i, arr) =>
    arr.findIndex(x => x.city === d.city) === i
  ).length
  const flightsCount = trip.bookings?.filter(b => b.category === 'flight').length || 0
  const confirmedCount = trip.bookings?.filter(b => b.status === 'booked').length || 0
  const totalBookings = trip.bookings?.length || 0
  const experiencesCount = trip.bookings?.filter(b =>
    ['experience', 'concert'].includes(b.category)
  ).length || 0

  const stats = [
    { icon: '📅', value: totalDays, label: 'Days' },
    { icon: '🏙️', value: uniqueCities, label: 'Cities' },
    { icon: '✈️', value: flightsCount, label: 'Flights' },
    { icon: '🎯', value: experiencesCount, label: 'Experiences' },
    ...(totalBookings > 0
      ? [{ icon: '✅', value: `${confirmedCount}/${totalBookings}`, label: 'Confirmed' }]
      : []),
  ]

  return (
    <Card padding="py-4 px-5">
      <div className="flex items-center flex-wrap gap-5">
        {stats.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xl leading-none">{s.icon}</span>
            <div>
              <div className="font-heading font-bold text-lg leading-none text-text-primary">{s.value}</div>
              <div className="text-[11px] text-text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
            {i < stats.length - 1 && (
              <div className="w-px h-7 bg-border ml-2 shrink-0 hidden sm:block" />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Priority Action Board — "Needs Attention"
   Surfaces urgent todos, upcoming book-by deadlines,
   missing key bookings, and overdue packing.
───────────────────────────────────────────────────────────── */
const URGENCY_HIGH = 'high'
const URGENCY_MED = 'med'

function buildAttentionItems(trip) {
  const items = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // High-priority + due-soon todos
  const urgentTodos = (trip.todos || []).filter(t => {
    if (t.done) return false
    if (t.priority === 'high') return true
    if (t.dueDate) {
      const diff = Math.ceil((new Date(t.dueDate + 'T00:00:00') - today) / 86400000)
      return diff <= 14
    }
    return false
  }).slice(0, 3)

  urgentTodos.forEach(t => {
    const dueD = t.dueDate ? Math.ceil((new Date(t.dueDate + 'T00:00:00') - today) / 86400000) : null
    const overdue = dueD !== null && dueD < 0
    items.push({
      id: `todo-${t.id}`,
      urgency: (t.priority === 'high' || overdue) ? URGENCY_HIGH : URGENCY_MED,
      icon: overdue ? '🚨' : t.priority === 'high' ? '⚡' : '📋',
      title: t.text,
      subtitle: overdue
        ? `Overdue by ${Math.abs(dueD)} day${Math.abs(dueD) !== 1 ? 's' : ''}`
        : dueD !== null
        ? `Due in ${dueD} day${dueD !== 1 ? 's' : ''}`
        : t.category,
      tab: 'To-Do',
    })
  })

  // Unconfirmed priority or deadline-bound bookings
  const urgentBookings = (trip.bookings || []).filter(b => {
    if (b.status === 'booked') return false
    if (b.priority) return true
    if (b.bookByDate) {
      const diff = Math.ceil((new Date(b.bookByDate + 'T00:00:00') - today) / 86400000)
      return diff <= 21
    }
    return false
  }).slice(0, 3)

  urgentBookings.forEach(b => {
    const dueD = b.bookByDate
      ? Math.ceil((new Date(b.bookByDate + 'T00:00:00') - today) / 86400000)
      : null
    const overdue = dueD !== null && dueD < 0
    const catIcon = { flight: '✈️', hotel: '🏨', concert: '🎸', experience: '🎯' }[b.category] || '🎫'
    items.push({
      id: `booking-${b.id}`,
      urgency: (b.priority || overdue) ? URGENCY_HIGH : URGENCY_MED,
      icon: catIcon,
      title: b.name,
      subtitle: b.status === 'researching' ? 'Not yet booked'
        : b.status === 'pending' ? 'Pending confirmation'
        : overdue ? `Book-by passed ${Math.abs(dueD)}d ago`
        : dueD !== null ? `Book by: ${formatDate(b.bookByDate, 'short')}`
        : 'Unconfirmed',
      tab: 'Bookings',
    })
  })

  // Missing flights
  const hasFlights = (trip.bookings || []).some(b => b.category === 'flight')
  if (!hasFlights && (trip.destinations?.length || 0) > 1) {
    items.push({
      id: 'missing-flights',
      urgency: URGENCY_MED,
      icon: '✈️',
      title: 'No flights added yet',
      subtitle: `${(trip.destinations?.length || 0) - 1} route${(trip.destinations?.length || 0) > 2 ? 's' : ''} to book`,
      tab: 'Bookings',
    })
  }

  // Missing accommodation
  const hasHotel = (trip.bookings || []).some(b => b.category === 'hotel')
  if (!hasHotel && (trip.destinations?.length || 0) > 0) {
    items.push({
      id: 'missing-hotels',
      urgency: URGENCY_MED,
      icon: '🏨',
      title: 'No accommodation added',
      subtitle: 'Add hotels or rentals',
      tab: 'Bookings',
    })
  }

  // Packing not started close to trip
  const totalPacking = trip.packingList?.length || 0
  const packedItems = trip.packingList?.filter(p => p.packed).length || 0
  const daysOut = daysUntil(trip.startDate)
  if (totalPacking > 0 && packedItems === 0 && daysOut !== null && daysOut <= 30) {
    items.push({
      id: 'packing-notstarted',
      urgency: daysOut <= 7 ? URGENCY_HIGH : URGENCY_MED,
      icon: '🧳',
      title: 'Packing not started',
      subtitle: `${totalPacking} items · ${daysOut} day${daysOut !== 1 ? 's' : ''} to go`,
      tab: 'Packing',
    })
  }

  // Sort high urgency first, limit to 5
  return items
    .sort((a, b) => (a.urgency === URGENCY_HIGH ? -1 : b.urgency === URGENCY_HIGH ? 1 : 0))
    .slice(0, 5)
}

function PriorityActionBoard({ trip, onTabSwitch }) {
  const items = useMemo(() => buildAttentionItems(trip), [trip])
  const highCount = items.filter(i => i.urgency === URGENCY_HIGH).length

  if (items.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-semibold text-text-primary text-sm">Nothing urgent right now</p>
            <p className="text-xs text-text-muted mt-0.5">All key items are on track!</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-border flex items-center gap-2">
        <span className="text-base">🎯</span>
        <h3 className="font-heading font-semibold text-text-primary text-sm uppercase tracking-wider">
          Needs Attention
        </h3>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full
          ${highCount > 0
            ? 'bg-danger/10 text-danger'
            : 'bg-warning/10 text-warning'}`}>
          {highCount > 0 ? `${highCount} urgent` : `${items.length} items`}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-border">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabSwitch?.(item.tab)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left
                       hover:bg-bg-hover transition-colors duration-150 group"
          >
            {/* Urgency stripe */}
            <div className={`w-1 h-8 rounded-full shrink-0
              ${item.urgency === URGENCY_HIGH ? 'bg-danger' : 'bg-warning'}`}
            />
            <span className="text-xl shrink-0 leading-none">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.subtitle}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-text-muted shrink-0 opacity-0 group-hover:opacity-60 transition-opacity">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Visual Route Tracker
   Node → dashed connector → node timeline.
   Nodes show flag emoji; connectors show transit mode.
───────────────────────────────────────────────────────────── */
function guessTransit(from, to) {
  if (!from || !to) return { icon: '✈️', label: 'Flight' }
  return from.country !== to.country
    ? { icon: '✈️', label: 'Flight' }
    : { icon: '🚌', label: 'Ground' }
}

function RouteTracker({ trip }) {
  const dests = trip.destinations || []
  if (dests.length < 2) return null

  // Map city → first itinerary date for that city
  const destDates = useMemo(() => {
    const map = {}
    ;(trip.itinerary || []).forEach(day => {
      const loc = (day.location || '').toLowerCase()
      dests.forEach(d => {
        if (!map[d.city] && loc.includes(d.city.toLowerCase())) {
          map[d.city] = day.date
        }
      })
    })
    return map
  }, [trip.itinerary, dests])

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-border flex items-center gap-2">
        <span className="text-base">🗺️</span>
        <h3 className="font-heading font-semibold text-text-primary text-sm uppercase tracking-wider">
          Route
        </h3>
      </div>
      <div className="px-5 py-5 overflow-x-auto scrollbar-hide">
        <div className="flex items-start min-w-max">
          {dests.map((dest, i) => {
            const isLast = i === dests.length - 1
            const isFirst = i === 0
            const transit = isLast ? null : guessTransit(dest, dests[i + 1])
            const date = destDates[dest.city]

            return (
              <div key={i} className="flex items-start">
                {/* Destination node + labels */}
                <div className="flex flex-col items-center text-center w-[72px]">
                  {/* Date above */}
                  <div className="text-[10px] text-text-muted font-medium mb-2 h-3.5 leading-none">
                    {date ? formatDate(date, 'short') : ''}
                  </div>
                  {/* Flag node */}
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-lg
                    border-2 shadow-sm
                    ${isFirst
                      ? 'border-accent bg-accent/10'
                      : isLast
                      ? 'border-success bg-success/10'
                      : 'border-border-strong bg-bg-secondary'}
                  `}>
                    {dest.flag}
                  </div>
                  {/* City + country below */}
                  <p className="text-xs font-semibold text-text-primary mt-2 leading-tight">{dest.city}</p>
                  <p className="text-[10px] text-text-muted leading-tight">{dest.country}</p>
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="flex flex-col items-center pt-3.5 mx-1 w-14">
                    {/* Transit icon */}
                    <div className="text-sm leading-none mb-2">{transit.icon}</div>
                    {/* Dashed line */}
                    <div className="w-full h-0.5 border-t-2 border-dashed border-border-strong" />
                    {/* Label */}
                    <div className="text-[9px] text-text-muted mt-1 font-medium uppercase tracking-wide">
                      {transit.label}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Readiness card
───────────────────────────────────────────────────────────── */
function ReadinessCard({ trip }) {
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)
  const isZero = readiness === 0

  const message = readiness === 100 ? "You're 100% ready. Go enjoy the world. 🌍"
    : readiness >= 75 ? "Almost there! Just a few more things."
    : readiness >= 50 ? "Making good progress. Keep it up!"
    : readiness > 0 ? "Let's get this trip planned! 🗺️"
    : "Add bookings, to-dos, and packing items."

  const tooltip = breakdown.bookings.total + breakdown.todos.total + breakdown.packing.total > 0
    ? `${breakdown.bookings.total} bookings · ${breakdown.todos.total} to-dos · ${breakdown.packing.total} packing items`
    : 'Add items to track readiness'

  return (
    <Card>
      <div className="flex items-center gap-5">
        <ProgressRing value={readiness} size={88} strokeWidth={7} pulse={isZero} tooltip={tooltip} />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-base text-text-primary mb-0.5">Trip Readiness</h3>
          <p className="text-xs text-text-muted mb-3">{message}</p>
          <div className="space-y-1.5">
            <ProgressBar value={breakdown.bookings.done} max={breakdown.bookings.total}
              label="Bookings" showLabel colorClass="bg-info" height="h-1.5" />
            <ProgressBar value={breakdown.todos.done} max={breakdown.todos.total}
              label="To-Dos" showLabel colorClass="bg-accent" height="h-1.5" />
            <ProgressBar value={breakdown.packing.done} max={breakdown.packing.total}
              label="Packing" showLabel colorClass="bg-success" height="h-1.5" />
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Budget snapshot card
───────────────────────────────────────────────────────────── */
function BudgetCard({ trip }) {
  const budgetMin = trip.budget?.reduce((s, b) => s + (b.min || 0), 0) || 0
  const budgetMax = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0
  if (budgetMax === 0) return null

  const overBudget = totalSpent > budgetMax
  return (
    <Card>
      <h3 className="font-heading text-sm text-text-muted uppercase tracking-wider mb-3">
        💰 Budget
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-text-secondary">Estimated</span>
          <span className="text-text-primary font-medium">
            {formatCurrency(budgetMin, trip.currency)} – {formatCurrency(budgetMax, trip.currency)}
          </span>
        </div>
        {totalSpent > 0 && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Spent so far</span>
              <span className={`font-semibold ${overBudget ? 'text-danger' : 'text-success'}`}>
                {formatCurrency(totalSpent, trip.currency)}
                {overBudget && ' ⚠️'}
              </span>
            </div>
            <ProgressBar value={totalSpent} max={budgetMax}
              colorClass={overBudget ? 'bg-danger' : 'bg-accent'} height="h-2" />
          </>
        )}
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Quick Start cards — only shown when readiness is 0%
───────────────────────────────────────────────────────────── */
const QUICK_START_ITEMS = [
  { emoji: '🎫', title: 'Add a Booking', description: 'Log flights, hotels, or activities.', tab: 'Bookings', accentClass: 'bg-info/10 border-info/20 text-info' },
  { emoji: '✅', title: 'Create a To-Do', description: 'Track tasks like visas and vaccines.', tab: 'To-Do', accentClass: 'bg-accent/10 border-accent/20 text-accent' },
  { emoji: '🧳', title: 'Start Packing', description: 'Build your packing checklist.', tab: 'Packing', accentClass: 'bg-success/10 border-success/20 text-success' },
]

function QuickStartCards({ onTabSwitch }) {
  return (
    <div>
      <h3 className="font-heading text-sm text-text-muted uppercase tracking-wider mb-3">
        Quick Start — get your trip ready
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {QUICK_START_ITEMS.map(item => (
          <button key={item.tab} type="button" onClick={() => onTabSwitch?.(item.tab)}
            className={`group text-left p-4 rounded-[var(--radius-lg)] border
              ${item.accentClass} hover:scale-[1.02] active:scale-[0.99] transition-all duration-150`}>
            <div className="text-2xl mb-2">{item.emoji}</div>
            <div className="font-semibold text-sm text-text-primary mb-0.5">{item.title}</div>
            <div className="text-xs text-text-muted">{item.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main OverviewTab
───────────────────────────────────────────────────────────── */
export default function OverviewTab({ onTabSwitch }) {
  const { activeTrip } = useTripContext()
  const { profiles } = useProfiles()

  if (!activeTrip) return null
  const trip = activeTrip
  const readiness = calculateReadiness(trip)
  const isZeroReadiness = readiness === 0

  // Resolve traveler profile objects from IDs
  const travelerProfiles = (trip.travelerIds || [])
    .map(id => profiles.find(p => p.id === id))
    .filter(Boolean)

  return (
    <div className="space-y-5 animate-fade-in">

      {/* 1 ─ Immersive hero with gradient, avatars, countdown */}
      <HeroHeader trip={trip} travelerProfiles={travelerProfiles} />

      {/* 2 ─ Consolidated trip brief strip */}
      <TripBrief trip={trip} />

      {/* 3 ─ Main 2-col grid: action board + route/weather */}
      <div className="grid md:grid-cols-2 gap-5">
        <PriorityActionBoard trip={trip} onTabSwitch={onTabSwitch} />

        <div className="space-y-5">
          <RouteTracker trip={trip} />

          {/* Live weather for first destination */}
          {(trip.destinations?.length || 0) > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <span>🌤️</span>
                <h3 className="font-heading text-sm text-text-muted uppercase tracking-wider">
                  Current Weather
                </h3>
              </div>
              <WeatherWidget destinations={trip.destinations} />
              <p className="text-[10px] text-text-muted mt-3 opacity-50">
                Live at first destination · Open-Meteo
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* 4 ─ Quick start (only at 0% readiness) */}
      {isZeroReadiness && <QuickStartCards onTabSwitch={onTabSwitch} />}

      {/* 5 ─ Readiness ring + budget snapshot */}
      <div className="grid md:grid-cols-2 gap-5">
        <ReadinessCard trip={trip} />
        <BudgetCard trip={trip} />
      </div>

    </div>
  )
}
