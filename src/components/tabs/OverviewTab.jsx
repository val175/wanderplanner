import { useMemo, useState, useEffect } from 'react'
import ProgressRing from '../shared/ProgressRing'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatCurrency, daysUntil, formatDate } from '../../utils/helpers'

/* ─────────────────────────────────────────────────────────────
   Shared bento card shell — white surface, uniform radius/shadow,
   fills its grid cell completely.
───────────────────────────────────────────────────────────── */
function BentoCard({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-[var(--color-bg-card)] rounded-[var(--radius-lg)]
        border border-[var(--color-border)]
        flex flex-col h-full overflow-hidden
        ${onClick ? 'cursor-pointer hover:border-[var(--color-border-strong)] transition-colors duration-150' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

/* Consistent label style used across all cells */
function Label({ children }) {
  return (
    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.14em]">
      {children}
    </span>
  )
}

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
   Weather bento cell
───────────────────────────────────────────────────────────── */
function WeatherCell({ destinations }) {
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('loading')
  const firstDest = destinations?.[0]

  useEffect(() => {
    if (!firstDest) { setStatus('error'); return }
    let cancelled = false
    setStatus('loading'); setWeather(null)

    async function fetch_() {
      try {
        const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(firstDest.city)}&count=1&language=en&format=json`)
        const gd = await g.json()
        if (!gd.results?.length) throw new Error('not found')
        const { latitude, longitude } = gd.results[0]
        const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weathercode&temperature_unit=celsius&timezone=auto`)
        const wd = await w.json()
        const c = wd.current
        if (!cancelled) { setWeather({ temp: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature), wmo: c.weathercode, city: firstDest.city, flag: firstDest.flag }); setStatus('ok') }
      } catch { if (!cancelled) setStatus('error') }
    }
    fetch_()
    return () => { cancelled = true }
  }, [firstDest?.city])

  return (
    <BentoCard>
      <div className="p-4 flex flex-col h-full">
        <Label>Right Now</Label>
        {status === 'loading' && (
          <div className="flex-1 flex items-center gap-3 animate-pulse mt-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-bg-hover)] shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-[var(--color-bg-hover)] rounded w-16" />
              <div className="h-2 bg-[var(--color-bg-hover)] rounded w-12" />
            </div>
          </div>
        )}
        {status === 'ok' && weather && (() => {
          const { emoji, label } = wmoToDescription(weather.wmo)
          return (
            <div className="flex-1 flex flex-col justify-center mt-3">
              <div className="text-4xl leading-none mb-2">{emoji}</div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading font-bold text-2xl text-[var(--color-text-primary)]">{weather.temp}°</span>
                <span className="text-xs text-[var(--color-text-muted)]">feels {weather.feelsLike}°</span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-2 opacity-50">{weather.flag} {weather.city} · Open-Meteo</div>
            </div>
          )
        })()}
        {status === 'error' && (
          <div className="flex-1 flex items-center justify-center mt-3">
            <span className="text-xs text-[var(--color-text-muted)]">Unavailable</span>
          </div>
        )}
      </div>
    </BentoCard>
  )
}

/* ─────────────────────────────────────────────────────────────
   Route bento cell — horizontal node chain
───────────────────────────────────────────────────────────── */
function guessTransit(from, to) {
  if (!from || !to) return '✈️'
  return from.country !== to.country ? '✈️' : '🚌'
}

function RouteCell({ trip }) {
  const dests = trip.destinations || []

  const destDates = useMemo(() => {
    const map = {}
    ;(trip.itinerary || []).forEach(day => {
      const loc = (day.location || '').toLowerCase()
      dests.forEach(d => {
        if (!map[d.city] && loc.includes(d.city.toLowerCase())) map[d.city] = day.date
      })
    })
    return map
  }, [trip.itinerary, dests])

  return (
    <BentoCard>
      <div className="p-4 flex flex-col h-full">
        <Label>Route</Label>
        {dests.length < 2 ? (
          <div className="flex-1 flex items-center">
            <span className="text-xs text-[var(--color-text-muted)]">Add destinations to see your route</span>
          </div>
        ) : (
          <div className="relative flex-1 flex items-center mt-4 -mx-1 px-1 overflow-hidden">
            {/* Right scroll blur cue — only shown when cities overflow */}
            {dests.length > 6 && (
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[var(--color-bg-card)] to-transparent z-10 pointer-events-none" />
            )}

            <div className="w-full overflow-x-auto scrollbar-hide pb-2">
              <div className="flex items-center w-full min-w-max">
                {dests.map((dest, i) => {
                  const isLast  = i === dests.length - 1
                  const isFirst = i === 0
                  const date    = destDates[dest.city]
                  return (
                    <div key={i} className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1 min-w-[5rem]'}`}>
                      {/* Node — fixed width so cities don't squish */}
                      <div className="flex flex-col items-center text-center w-14 shrink-0">
                        <div className="text-[9px] text-[var(--color-text-muted)] mb-1.5 h-3 leading-none font-medium">
                          {date ? formatDate(date, 'short') : ''}
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2
                          ${isFirst ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                            : isLast ? 'border-[var(--color-success)] bg-[var(--color-success)]/10'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)]'}`}>
                          {dest.flag}
                        </div>
                        <p className="text-[10px] font-semibold text-[var(--color-text-primary)] mt-1 leading-tight">{dest.city}</p>
                      </div>
                      {/* Connector — expands to fill remaining space in its flex-1 item */}
                      {!isLast && (
                        <div className="flex flex-col items-center flex-1 px-2 w-full">
                          <div className="text-[10px] mb-1">{guessTransit(dest, dests[i + 1])}</div>
                          <div className="w-full border-t-2 border-dashed border-[var(--color-border-strong)]" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </BentoCard>
  )
}

/* ─────────────────────────────────────────────────────────────
   Stat cells — each number lives in its own bento box
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   Needs Attention bento cell
───────────────────────────────────────────────────────────── */
const URGENCY_HIGH = 'high'
const URGENCY_MED  = 'med'

function buildAttentionItems(trip) {
  const items = []
  const today = new Date(); today.setHours(0, 0, 0, 0)

  ;(trip.todos || []).filter(t => {
    if (t.done) return false
    if (t.priority === 'high') return true
    if (t.dueDate) return Math.ceil((new Date(t.dueDate + 'T00:00:00') - today) / 86400000) <= 14
    return false
  }).slice(0, 3).forEach(t => {
    const dueD = t.dueDate ? Math.ceil((new Date(t.dueDate + 'T00:00:00') - today) / 86400000) : null
    const overdue = dueD !== null && dueD < 0
    items.push({
      id: `todo-${t.id}`, urgency: (t.priority === 'high' || overdue) ? URGENCY_HIGH : URGENCY_MED,
      icon: overdue ? '🚨' : t.priority === 'high' ? '⚡' : '📋',
      title: t.text,
      subtitle: overdue ? `Overdue ${Math.abs(dueD)}d` : dueD !== null ? `Due in ${dueD}d` : t.category,
      tab: 'todo',
    })
  })

  ;(trip.bookings || []).filter(b => {
    if (b.status === 'booked') return false
    if (b.priority) return true
    if (b.bookByDate) return Math.ceil((new Date(b.bookByDate + 'T00:00:00') - today) / 86400000) <= 21
    return false
  }).slice(0, 3).forEach(b => {
    const dueD = b.bookByDate ? Math.ceil((new Date(b.bookByDate + 'T00:00:00') - today) / 86400000) : null
    const overdue = dueD !== null && dueD < 0
    const catIcon = { flight: '✈️', hotel: '🏨', concert: '🎸', experience: '🎯' }[b.category] || '🎫'
    items.push({
      id: `booking-${b.id}`, urgency: (b.priority || overdue) ? URGENCY_HIGH : URGENCY_MED,
      icon: catIcon, title: b.name,
      subtitle: overdue ? `Book-by passed ${Math.abs(dueD)}d ago` : dueD !== null ? `Book by ${formatDate(b.bookByDate, 'short')}` : 'Unconfirmed',
      tab: 'bookings',
    })
  })

  const hasFlights = (trip.bookings || []).some(b => b.category === 'flight')
  if (!hasFlights && (trip.destinations?.length || 0) > 1) {
    items.push({ id: 'missing-flights', urgency: URGENCY_MED, icon: '✈️', title: 'No flights added yet', subtitle: 'Add to Bookings', tab: 'bookings' })
  }
  const hasHotel = (trip.bookings || []).some(b => b.category === 'hotel')
  if (!hasHotel) {
    items.push({ id: 'missing-hotels', urgency: URGENCY_MED, icon: '🏨', title: 'No accommodation yet', subtitle: 'Add to Bookings', tab: 'bookings' })
  }
  const totalPacking = trip.packingList?.length || 0
  const packedItems  = trip.packingList?.filter(p => p.packed).length || 0
  const daysOut = daysUntil(trip.startDate)
  if (totalPacking > 0 && packedItems === 0 && daysOut !== null && daysOut <= 30) {
    items.push({ id: 'packing', urgency: daysOut <= 7 ? URGENCY_HIGH : URGENCY_MED, icon: '🧳', title: 'Packing not started', subtitle: `${daysOut}d to go`, tab: 'packing' })
  }

  return items.sort((a, b) => a.urgency === URGENCY_HIGH ? -1 : b.urgency === URGENCY_HIGH ? 1 : 0).slice(0, 5)
}

function AttentionCell({ trip, onTabSwitch }) {
  const items     = useMemo(() => buildAttentionItems(trip), [trip])
  const highCount = items.filter(i => i.urgency === URGENCY_HIGH).length

  return (
    <BentoCard>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0">
        <Label>Needs Attention</Label>
        {items.length > 0 && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full
            ${highCount > 0 ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                           : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'}`}>
            {highCount > 0 ? `${highCount} urgent` : `${items.length} items`}
          </span>
        )}
      </div>

      {/* Rows — bleed to card edges */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]">
        {items.length === 0 ? (
          <div className="px-4 py-5 flex items-center gap-3">
            <span className="text-xl">🎉</span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">All clear</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Nothing urgent right now</p>
            </div>
          </div>
        ) : items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabSwitch?.(item.tab)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left
                       hover:bg-[var(--color-bg-hover)] transition-colors duration-100 group"
          >
            <div className={`w-0.5 h-6 rounded-full shrink-0
              ${item.urgency === URGENCY_HIGH ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-warning)]'}`} />
            <span className="text-base leading-none shrink-0">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{item.title}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{item.subtitle}</p>
            </div>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              className="text-[var(--color-text-muted)] shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </BentoCard>
  )
}

/* ─────────────────────────────────────────────────────────────
   Readiness bento cell
───────────────────────────────────────────────────────────── */
function ReadinessCell({ trip }) {
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)
  const isZero    = readiness === 0

  const msg = readiness === 100 ? "100% ready 🌍"
    : readiness >= 75 ? "Almost there!"
    : readiness >= 50 ? "Good progress"
    : readiness > 0   ? "Just getting started"
    : "Add items to track"

  return (
    <BentoCard>
      <div className="p-4 flex flex-col h-full">
        <Label>Readiness</Label>
        <div className="flex-1 flex flex-col justify-between mt-3">
          <div className="flex items-center gap-4">
            <ProgressRing value={readiness} size={72} strokeWidth={5} pulse={isZero} labelClassName="text-xs" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">{msg}</p>
              <div className="mt-2 space-y-1.5">
                <ProgressBar value={breakdown.bookings.done} max={breakdown.bookings.total}
                  label="Bookings" showLabel colorClass="bg-info" height="h-1" />
                <ProgressBar value={breakdown.todos.done} max={breakdown.todos.total}
                  label="To-Dos" showLabel colorClass="bg-accent" height="h-1" />
                <ProgressBar value={breakdown.packing.done} max={breakdown.packing.total}
                  label="Packing" showLabel colorClass="bg-success" height="h-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  )
}

/* ─────────────────────────────────────────────────────────────
   Budget bento cell
───────────────────────────────────────────────────────────── */
function BudgetCell({ trip }) {
  const budgetMin  = trip.budget?.reduce((s, b) => s + (b.min    || 0), 0) || 0
  const budgetMax  = trip.budget?.reduce((s, b) => s + (b.max    || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0
  const hasBudget  = budgetMax > 0
  const overBudget = totalSpent > budgetMax

  return (
    <BentoCard>
      <div className="p-4 flex flex-col h-full">
        <Label>Budget</Label>
        {!hasBudget ? (
          <div className="flex-1 flex items-center">
            <span className="text-xs text-[var(--color-text-muted)]">No budget set</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between mt-3">
            <div>
              <p className="text-[10px] text-[var(--color-text-muted)]">Estimated</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                {formatCurrency(budgetMin, trip.currency)} – {formatCurrency(budgetMax, trip.currency)}
              </p>
            </div>
            {totalSpent > 0 && (
              <div className="mt-3">
                <div className="flex justify-between items-baseline mb-1.5">
                  <p className="text-[10px] text-[var(--color-text-muted)]">Spent</p>
                  <p className={`text-sm font-bold ${overBudget ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                    {formatCurrency(totalSpent, trip.currency)}{overBudget ? ' ⚠️' : ''}
                  </p>
                </div>
                <ProgressBar value={totalSpent} max={budgetMax}
                  colorClass={overBudget ? 'bg-danger' : 'bg-accent'} height="h-1.5" />
              </div>
            )}
          </div>
        )}
      </div>
    </BentoCard>
  )
}

/* ─────────────────────────────────────────────────────────────
   Quick Start — 0% readiness only, 3 bento cells in a row
───────────────────────────────────────────────────────────── */
const QUICK_START = [
  { emoji: '🎫', title: 'Add a Booking',  desc: 'Flights, hotels, activities', tab: 'bookings' },
  { emoji: '✅', title: 'Create To-Dos',  desc: 'Visas, vaccines, admin',      tab: 'todo' },
  { emoji: '🧳', title: 'Start Packing',  desc: 'Build your checklist',         tab: 'packing' },
]

function QuickStartRow({ onTabSwitch }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {QUICK_START.map(item => (
        <BentoCard key={item.tab} onClick={() => onTabSwitch?.(item.tab)}>
          <div className="p-4 flex flex-col h-full">
            <div className="text-2xl mb-3">{item.emoji}</div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">{item.title}</p>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{item.desc}</p>
          </div>
        </BentoCard>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main OverviewTab — bento grid layout

   Desktop grid (3 cols):
   ┌────────────────────────────┬──────┬──────┐
   │  Route (span 3)            │      │      │
   ├────────────┬───────────────┴──────┴──────┤  ← row 2
   │  Days      │                             │
   ├────────────┤  Needs Attention            │
   │  Cities    │                             │
   ├────────────┤                             │
   │  Confirmed ├──────┬──────────────────────┤
   ├────────────┤      │                      │
   │  Weather   │ Ready│  Budget              │
   └────────────┴──────┴──────────────────────┘

   Implemented with two sections:
   1. Top: route full-width
   2. Middle: 3-col grid [stat column | attention | weather col]
   3. Bottom: 3-col grid [readiness | budget | -]
───────────────────────────────────────────────────────────── */
export default function OverviewTab({ onTabSwitch }) {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip
  const readiness       = calculateReadiness(trip)
  const isZeroReadiness = readiness === 0

  const hasWeather = (trip.destinations?.length || 0) > 0

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Row 1: Route — full width ── */}
      <div style={{ minHeight: '120px' }}>
        <RouteCell trip={trip} />
      </div>

      {/* ── Row 2: attention (2/3) | weather (1/3) ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <AttentionCell trip={trip} onTabSwitch={onTabSwitch} />
        </div>
        {hasWeather
          ? <WeatherCell destinations={trip.destinations} />
          : <div />
        }
      </div>

      {/* ── Quick Start (0% only) ── */}
      {isZeroReadiness && <QuickStartRow onTabSwitch={onTabSwitch} />}

      {/* ── Row 3: Readiness | Budget ── */}
      <div className="grid grid-cols-2 gap-3">
        <ReadinessCell trip={trip} />
        <BudgetCell    trip={trip} />
      </div>

    </div>
  )
}
