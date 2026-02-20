import { useMemo, useState, useEffect } from 'react'
import Card from '../shared/Card'
import ProgressRing from '../shared/ProgressRing'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatCurrency, daysUntil, daysBetween, formatDate } from '../../utils/helpers'

/* ─────────────────────────────────────────────────────────────
   WMO weather code → emoji + label
───────────────────────────────────────────────────────────── */
function wmoToDescription(code) {
  if (code === 0)  return { emoji: '☀️', label: 'Clear sky' }
  if (code <= 2)   return { emoji: '🌤️', label: 'Partly cloudy' }
  if (code === 3)  return { emoji: '☁️', label: 'Overcast' }
  if (code <= 49)  return { emoji: '🌫️', label: 'Foggy' }
  if (code <= 59)  return { emoji: '🌦️', label: 'Drizzle' }
  if (code <= 69)  return { emoji: '🌧️', label: 'Rain' }
  if (code <= 79)  return { emoji: '🌨️', label: 'Snow' }
  if (code <= 84)  return { emoji: '🌧️', label: 'Showers' }
  if (code <= 99)  return { emoji: '⛈️', label: 'Thunderstorm' }
  return { emoji: '🌡️', label: 'Unknown' }
}

/* ─────────────────────────────────────────────────────────────
   WeatherWidget — live weather for first destination.
   Uses Open-Meteo (free, no API key, CORS-enabled).
───────────────────────────────────────────────────────────── */
function WeatherWidget({ destinations }) {
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('loading')
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
        <div className="w-8 h-8 rounded-full bg-bg-hover shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-2.5 bg-bg-hover rounded w-20" />
          <div className="h-2 bg-bg-hover rounded w-14" />
        </div>
      </div>
    )
  }

  const { emoji, label } = wmoToDescription(weather.wmo)
  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl leading-none shrink-0">{emoji}</span>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-heading font-bold text-xl text-text-primary">{weather.temp}°</span>
          <span className="text-xs text-text-muted">feels {weather.feelsLike}°</span>
        </div>
        <div className="text-xs text-text-muted">
          {label} · {weather.flag} {weather.city}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Priority Action Board — "Needs Attention"
   Borderless row treatment: alignment + negative space only.
───────────────────────────────────────────────────────────── */
const URGENCY_HIGH = 'high'
const URGENCY_MED  = 'med'

function buildAttentionItems(trip) {
  const items = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // High-priority / due-soon todos
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
      tab: 'todo',
    })
  })

  // Unconfirmed / deadline-bound bookings
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
      tab: 'bookings',
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
      tab: 'bookings',
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
      tab: 'bookings',
    })
  }

  // Packing not started, close to trip
  const totalPacking = trip.packingList?.length || 0
  const packedItems  = trip.packingList?.filter(p => p.packed).length || 0
  const daysOut      = daysUntil(trip.startDate)
  if (totalPacking > 0 && packedItems === 0 && daysOut !== null && daysOut <= 30) {
    items.push({
      id: 'packing-notstarted',
      urgency: daysOut <= 7 ? URGENCY_HIGH : URGENCY_MED,
      icon: '🧳',
      title: 'Packing not started',
      subtitle: `${totalPacking} items · ${daysOut} day${daysOut !== 1 ? 's' : ''} to go`,
      tab: 'packing',
    })
  }

  return items
    .sort((a, b) => (a.urgency === URGENCY_HIGH ? -1 : b.urgency === URGENCY_HIGH ? 1 : 0))
    .slice(0, 5)
}

function PriorityActionBoard({ trip, onTabSwitch }) {
  const items    = useMemo(() => buildAttentionItems(trip), [trip])
  const highCount = items.filter(i => i.urgency === URGENCY_HIGH).length

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 py-3">
        <span className="text-xl">🎉</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">Nothing urgent right now</p>
          <p className="text-xs text-text-muted mt-0.5">All key items are on track</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header row — label + count badge, no card frame */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-text-muted uppercase tracking-[0.14em]">
          Needs Attention
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
          ${highCount > 0
            ? 'bg-danger/10 text-danger'
            : 'bg-warning/10 text-warning'}`}>
          {highCount > 0 ? `${highCount} urgent` : `${items.length} items`}
        </span>
      </div>

      {/* Borderless rows — divide only */}
      <div className="divide-y divide-border -mx-5">
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabSwitch?.(item.tab)}
            className="w-full flex items-center gap-3 px-5 py-3 text-left
                       hover:bg-bg-hover transition-colors duration-150 group"
          >
            {/* Urgency stripe — semantic colour only */}
            <div className={`w-0.5 h-7 rounded-full shrink-0
              ${item.urgency === URGENCY_HIGH ? 'bg-danger' : 'bg-warning'}`}
            />
            <span className="text-lg shrink-0 leading-none">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate leading-tight">{item.title}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.subtitle}</p>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-text-muted shrink-0 opacity-0 group-hover:opacity-50 transition-opacity">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Route Tracker — full-width node → connector timeline
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
    <div>
      {/* Section label */}
      <span className="text-xs font-bold text-text-muted uppercase tracking-[0.14em] mb-4 block">
        Route
      </span>

      {/* Scrollable node chain */}
      <div className="overflow-x-auto scrollbar-hide -mx-5 px-5">
        <div className="flex items-start min-w-max pb-1">
          {dests.map((dest, i) => {
            const isLast    = i === dests.length - 1
            const isFirst   = i === 0
            const transit   = isLast ? null : guessTransit(dest, dests[i + 1])
            const date      = destDates[dest.city]

            return (
              <div key={i} className="flex items-start">
                {/* Destination node */}
                <div className="flex flex-col items-center text-center w-[68px]">
                  {/* Date label above */}
                  <div className="text-[10px] text-text-muted font-medium mb-2 h-3 leading-none">
                    {date ? formatDate(date, 'short') : ''}
                  </div>
                  {/* Flag node */}
                  <div className={`
                    w-9 h-9 rounded-full flex items-center justify-center text-base
                    border-2 transition-colors
                    ${isFirst
                      ? 'border-accent bg-accent/10'
                      : isLast
                      ? 'border-success bg-success/10'
                      : 'border-border-strong bg-bg-secondary'
                    }
                  `}>
                    {dest.flag}
                  </div>
                  {/* City name */}
                  <p className="text-[11px] font-semibold text-text-primary mt-1.5 leading-tight">{dest.city}</p>
                  <p className="text-[9px] text-text-muted leading-tight">{dest.country}</p>
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="flex flex-col items-center pt-3 mx-0.5 w-12">
                    <div className="text-xs leading-none mb-1.5">{transit.icon}</div>
                    <div className="w-full h-0.5 border-t-2 border-dashed border-border-strong" />
                    <div className="text-[8px] text-text-muted mt-1 font-medium uppercase tracking-wide">
                      {transit.label}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Stat strip — horizontal, no card border (alignment-only)
───────────────────────────────────────────────────────────── */
function StatStrip({ trip }) {
  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const uniqueCities = (trip.destinations || []).filter((d, i, arr) =>
    arr.findIndex(x => x.city === d.city) === i
  ).length
  const flightsCount   = trip.bookings?.filter(b => b.category === 'flight').length || 0
  const confirmedCount = trip.bookings?.filter(b => b.status === 'booked').length || 0
  const totalBookings  = trip.bookings?.length || 0

  const stats = [
    { value: totalDays,    label: 'Days' },
    { value: uniqueCities, label: 'Cities' },
    { value: flightsCount, label: 'Flights' },
    ...(totalBookings > 0
      ? [{ value: `${confirmedCount}/${totalBookings}`, label: 'Confirmed' }]
      : []),
  ]

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col items-start">
          <span
            className="font-heading text-text-primary leading-none"
            style={{ fontSize: '1.65rem', fontWeight: 200, letterSpacing: '-0.03em' }}
          >
            {s.value}
          </span>
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.16em] mt-0.5">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Readiness card
───────────────────────────────────────────────────────────── */
function ReadinessCard({ trip }) {
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)
  const isZero    = readiness === 0

  const message = readiness === 100 ? "You're 100% ready. Go enjoy the world. 🌍"
    : readiness >= 75 ? "Almost there! Just a few more things."
    : readiness >= 50 ? "Making good progress. Keep it up!"
    : readiness > 0   ? "Let's get this trip planned! 🗺️"
    : "Add bookings, to-dos, and packing items."

  const tooltip = breakdown.bookings.total + breakdown.todos.total + breakdown.packing.total > 0
    ? `${breakdown.bookings.total} bookings · ${breakdown.todos.total} to-dos · ${breakdown.packing.total} packing items`
    : 'Add items to track readiness'

  return (
    <Card>
      <div className="flex items-center gap-5">
        <ProgressRing value={readiness} size={80} strokeWidth={6} pulse={isZero} tooltip={tooltip} />
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-sm font-semibold text-text-primary mb-0.5">Trip Readiness</h3>
          <p className="text-xs text-text-muted mb-3">{message}</p>
          <div className="space-y-1.5">
            <ProgressBar value={breakdown.bookings.done} max={breakdown.bookings.total}
              label="Bookings" showLabel colorClass="bg-info" height="h-1" />
            <ProgressBar value={breakdown.todos.done} max={breakdown.todos.total}
              label="To-Dos" showLabel colorClass="bg-accent" height="h-1" />
            <ProgressBar value={breakdown.packing.done} max={breakdown.packing.total}
              label="Packing" showLabel colorClass="bg-success" height="h-1" />
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Budget snapshot
───────────────────────────────────────────────────────────── */
function BudgetCard({ trip }) {
  const budgetMin  = trip.budget?.reduce((s, b) => s + (b.min    || 0), 0) || 0
  const budgetMax  = trip.budget?.reduce((s, b) => s + (b.max    || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0
  if (budgetMax === 0) return null

  const overBudget = totalSpent > budgetMax
  return (
    <Card>
      <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.14em] mb-3">
        Budget
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
              colorClass={overBudget ? 'bg-danger' : 'bg-accent'} height="h-1.5" />
          </>
        )}
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Quick Start — only shown at 0% readiness
───────────────────────────────────────────────────────────── */
const QUICK_START_ITEMS = [
  { emoji: '🎫', title: 'Add a Booking',   description: 'Log flights, hotels, or activities.', tab: 'bookings', accentClass: 'bg-info/10 border-info/20 text-info' },
  { emoji: '✅', title: 'Create a To-Do',  description: 'Track tasks like visas and vaccines.', tab: 'todo',     accentClass: 'bg-accent/10 border-accent/20 text-accent' },
  { emoji: '🧳', title: 'Start Packing',   description: 'Build your packing checklist.',        tab: 'packing',  accentClass: 'bg-success/10 border-success/20 text-success' },
]

function QuickStartCards({ onTabSwitch }) {
  return (
    <div>
      <span className="text-xs font-bold text-text-muted uppercase tracking-[0.14em] mb-3 block">
        Quick Start
      </span>
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
   Layout order:
     1. Route Tracker (full-width, first — the journey itself)
     2. Stat strip (days / cities / flights / confirmed)
     3. Two-col: Needs Attention | Weather
     4. Quick Start (only at 0%)
     5. Readiness + Budget
───────────────────────────────────────────────────────────── */
export default function OverviewTab({ onTabSwitch }) {
  const { activeTrip } = useTripContext()

  if (!activeTrip) return null
  const trip = activeTrip
  const readiness = calculateReadiness(trip)
  const isZeroReadiness = readiness === 0

  const hasWeather = (trip.destinations?.length || 0) > 0

  return (
    <div className="space-y-7 animate-fade-in">

      {/* 1 ─ Route — first thing the eye lands on */}
      <Card>
        <RouteTracker trip={trip} />
      </Card>

      {/* 2 ─ Stat strip — ultra-light typographic numbers, no card border */}
      <StatStrip trip={trip} />

      {/* 3 ─ Main 2-col: action board + weather */}
      <div className="grid md:grid-cols-[1fr_240px] gap-7 items-start">

        {/* Needs Attention — borderless list inside a card frame */}
        <Card>
          <PriorityActionBoard trip={trip} onTabSwitch={onTabSwitch} />
        </Card>

        {/* Right column: weather */}
        {hasWeather && (
          <Card>
            <span className="text-xs font-bold text-text-muted uppercase tracking-[0.14em] mb-3 block">
              Right Now
            </span>
            <WeatherWidget destinations={trip.destinations} />
            <p className="text-[9px] text-text-muted mt-3 opacity-40">
              Open-Meteo · live
            </p>
          </Card>
        )}
      </div>

      {/* 4 ─ Quick start (0% readiness only) */}
      {isZeroReadiness && <QuickStartCards onTabSwitch={onTabSwitch} />}

      {/* 5 ─ Readiness + Budget */}
      <div className="grid md:grid-cols-2 gap-5">
        <ReadinessCard trip={trip} />
        <BudgetCard trip={trip} />
      </div>

    </div>
  )
}
