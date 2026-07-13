import { useMemo, useState } from 'react'
import Card from '../../shared/Card'
import Label from '../../shared/Label'
import EditableText from '../../shared/EditableText'
import Select, { SelectItem } from '../../shared/Select'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { formatDate, daysBetween, haversineDistance } from '../../../utils/helpers'
import { triggerHaptic } from '../../../utils/haptics'

const TRANSIT_EMOJIS = ['🚕', '🚶', '🚇', '🚌', '🚆', '🚲', '✈️', '⛴️', '🚗']

// Per-city accent so the allocation bar, the map markers, and the stop rows all
// read as the same city. Mirrors the Budget tab's stacked-bar language.
const CITY_COLORS = [
  'var(--color-accent)',
  'var(--color-info)',
  'var(--color-success)',
  'var(--color-warning)',
  'var(--color-accent-hover)',
  'var(--color-text-muted)',
]
const cityColor = (i) => CITY_COLORS[i % CITY_COLORS.length]

// Add `n` days to a plain YYYY-MM-DD string without timezone drift.
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  // Format in LOCAL time — toISOString() converts to UTC, which shifts the
  // date back a day in any UTC+ timezone (e.g. PHT) and compounds per stop.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Nights stepper ────────────────────────────────────────────────────────────
function NightsStepper({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center border border-border rounded-[var(--radius-pill)] bg-bg-card shrink-0">
      <button
        onClick={() => !disabled && onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="px-2.5 py-0.5 text-text-muted hover:text-text-primary text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
        aria-label="Fewer nights"
      >−</button>
      <span className="text-sm font-semibold min-w-[18px] text-center tabular-nums">{value}</span>
      <button
        onClick={() => !disabled && onChange(value + 1)}
        disabled={disabled}
        className="px-2.5 py-0.5 text-text-muted hover:text-text-primary text-sm transition-colors disabled:opacity-40 disabled:cursor-default"
        aria-label="More nights"
      >+</button>
    </div>
  )
}

// ── Nights allocation bar ─────────────────────────────────────────────────────
// The signature element: total trip nights as a pool, each city a proportional
// segment, with a "free" remainder or an "over" warning.
function AllocationBar({ cities, schedule, nightsPlanned, tripNights }) {
  const remaining = tripNights - nightsPlanned
  const denom = tripNights > 0 ? Math.max(tripNights, nightsPlanned) : (nightsPlanned || 1)

  const status = (() => {
    if (tripNights <= 0) return { text: `${nightsPlanned} nights`, cls: 'text-text-muted' }
    if (remaining > 0) return { text: `${nightsPlanned}/${tripNights} planned · ${remaining} free`, cls: 'text-text-muted' }
    if (remaining < 0) return { text: `${nightsPlanned}/${tripNights} planned · ${-remaining} over`, cls: 'text-danger' }
    return { text: `${nightsPlanned}/${tripNights} planned · balanced`, cls: 'text-success' }
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Nights allocation</Label>
        <span className={`text-xs font-semibold tabular-nums ${status.cls}`}>{status.text}</span>
      </div>

      <div className="flex h-3 w-full rounded-[var(--radius-pill)] overflow-hidden bg-bg-secondary border border-border/40">
        {cities.map((c, i) => {
          const n = Number(c.nights) || 0
          if (n <= 0) return null
          return (
            <div
              key={c.id}
              className="h-full border-r border-bg-card/60 last:border-r-0"
              style={{ width: `${(n / denom) * 100}%`, backgroundColor: cityColor(i) }}
              title={`${c.city}: ${n} ${n === 1 ? 'night' : 'nights'}`}
            />
          )
        })}
      </div>

      {nightsPlanned === 0 && (
        <p className="text-[11px] text-text-muted mt-2">Add nights to each city to plan your stays.</p>
      )}
    </div>
  )
}

// ── Route map (hero) ──────────────────────────────────────────────────────────
function RouteMiniMap({ cities, totalKm }) {
  const W = 320, H = 360, pad = 40
  const pts = cities.map((c, i) => ({ ...c, _i: i })).filter(c => c.lat != null && c.lng != null)

  if (pts.length < 2) {
    return (
      <div className="h-full bg-bg-secondary/40 border border-border rounded-[var(--radius-lg)] flex items-center justify-center p-8 min-h-[260px]">
        <p className="text-sm text-text-muted text-center text-balance max-w-[220px]">
          Add at least two cities with locations to see your route on the map.
        </p>
      </div>
    )
  }

  const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const spanLat = maxLat - minLat || 1
  const spanLng = maxLng - minLng || 1

  const project = (p) => ({
    x: ((p.lng - minLng) / spanLng) * (W - 2 * pad) + pad,
    y: (1 - (p.lat - minLat) / spanLat) * (H - 2 * pad) + pad,
  })
  const projected = pts.map(p => ({ ...p, ...project(p) }))
  const path = projected.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <div className="h-full bg-bg-secondary/40 border border-border rounded-[var(--radius-lg)] relative overflow-hidden min-h-[260px]">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full block" role="img" aria-label="Trip route map">
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeDasharray="6 5" strokeLinejoin="round" strokeLinecap="round" />
        {projected.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="9" fill={cityColor(p._i)} opacity="0.18" />
            <circle cx={p.x} cy={p.y} r="6" fill={cityColor(p._i)} />
            <circle cx={p.x} cy={p.y} r="2.5" fill="var(--color-bg-card)" />
            <text x={p.x + 11} y={p.y + 4} fontSize="12" fontWeight="600" fill="var(--color-text-secondary)">{p.city}</text>
          </g>
        ))}
      </svg>
      {totalKm > 0 && (
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-pill)] bg-bg-card border border-border text-text-secondary">
          🧭 {Math.round(totalKm).toLocaleString()} km total
        </span>
      )}
    </div>
  )
}

// ── Route Planner ─────────────────────────────────────────────────────────────
export default function RoutePlanner({ cities, trip, onOpenAdd }) {
  const { dispatch, isReadOnly } = useTripContext()
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const update = (id, updates) => dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id, updates } })

  // Booked-stay heuristic: a lodging booking whose name/location names this city.
  const bookedStayCities = useMemo(() => {
    const set = new Set()
    const lodging = (trip.bookings || []).filter(b =>
      b.category === 'lodging' && (b.status === 'confirmed' || b.status === 'booked')
    )
    cities.forEach(c => {
      const name = (c.city || '').toLowerCase()
      if (!name) return
      const hit = lodging.some(b =>
        `${b.name || ''} ${b.location || ''} ${b.destination || ''}`.toLowerCase().includes(name)
      )
      if (hit) set.add(c.id)
    })
    return set
  }, [cities, trip.bookings])

  // Cascade date ranges from the trip start through each stop's nights.
  const schedule = useMemo(() => {
    let cursor = trip.startDate || null
    return cities.map(city => {
      const nights = Number(city.nights) || 0
      const start = cursor
      const end = cursor && nights > 0 ? addDays(cursor, nights) : cursor
      cursor = end
      return { id: city.id, start, end, nights }
    })
  }, [cities, trip.startDate])

  const nightsPlanned = schedule.reduce((s, d) => s + d.nights, 0)
  const tripNights = trip.startDate && trip.endDate
    ? Math.max(0, daysBetween(trip.startDate, trip.endDate) - 1)
    : 0

  const legKm = (a, b) =>
    (a?.lat != null && a?.lng != null && b?.lat != null && b?.lng != null)
      ? haversineDistance(a.lat, a.lng, b.lat, b.lng)
      : null
  const totalKm = cities.reduce((sum, c, i) => sum + (i < cities.length - 1 ? (legKm(c, cities[i + 1]) || 0) : 0), 0)

  const handleDrop = (targetId) => {
    setDragOverId(null)
    if (isReadOnly || !dragId || dragId === targetId) { setDragId(null); return }
    const fromIndex = cities.findIndex(c => c.id === dragId)
    const toIndex = cities.findIndex(c => c.id === targetId)
    setDragId(null)
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      triggerHaptic('light')
      dispatch({ type: ACTIONS.REORDER_CITIES, payload: { fromIndex, toIndex } })
    }
  }

  if (cities.length === 0) {
    return (
      <Card className="border border-border p-10 text-center">
        <p className="text-3xl mb-2">🗺️</p>
        <p className="text-text-muted text-sm text-balance mb-4">No cities yet — add your first destination to start shaping the route.</p>
        {!isReadOnly && (
          <button onClick={onOpenAdd} className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors">
            + Add destination
          </button>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Allocation pool — the signature framing */}
      <Card className="border border-border p-4">
        <AllocationBar cities={cities} schedule={schedule} nightsPlanned={nightsPlanned} tripNights={tripNights} />
      </Card>

      {/* Map-first body: map is the hero, stops are the sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 lg:h-[460px]">
        <div className="lg:flex-[1.7] min-h-[280px] lg:min-h-0">
          <RouteMiniMap cities={cities} totalKm={totalKm} />
        </div>

        <Card className="lg:flex-1 border border-border p-3 overflow-y-auto scrollbar-thin">
          {cities.map((city, i) => {
            const sched = schedule[i]
            const next = cities[i + 1]
            const dist = next ? legKm(city, next) : null
            const isLast = i === cities.length - 1
            const booked = bookedStayCities.has(city.id)
            return (
              <div key={city.id}>
                <div
                  draggable={!isReadOnly}
                  onDragStart={() => !isReadOnly && setDragId(city.id)}
                  onDragOver={e => { if (!isReadOnly && dragId) { e.preventDefault(); setDragOverId(city.id) } }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null) }}
                  onDrop={() => handleDrop(city.id)}
                  className={`flex items-center gap-2.5 py-2 px-2 -mx-0 rounded-[var(--radius-md)] transition-colors ${dragOverId === city.id ? 'ring-2 ring-inset ring-accent' : 'hover:bg-bg-hover/50'} ${dragId === city.id ? 'opacity-40' : ''}`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cityColor(i) }} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                      <span>{city.flag || '📍'}</span>{city.city}
                      {booked && <span className="text-[10px]" title="Stay booked">🛏️</span>}
                    </div>
                    {sched.start && (
                      <div className="text-[11px] text-text-muted tabular-nums">
                        {formatDate(sched.start, 'short')}
                        {sched.nights > 0 && sched.end ? ` – ${formatDate(sched.end, 'short')}` : ''}
                      </div>
                    )}
                  </div>
                  <NightsStepper
                    value={Number(city.nights) || 0}
                    onChange={n => update(city.id, { nights: n })}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Inter-city leg — borderless connector, deliberately unlike the
                    itinerary's bordered transit pill on a dashed timeline. */}
                {!isLast && (
                  <div className="flex items-center gap-1.5 pl-4 py-0.5 text-[11px] text-text-muted/80">
                    <Select
                      value={city.transitEmoji || '🚆'}
                      onValueChange={v => update(city.id, { transitEmoji: v })}
                      disabled={isReadOnly}
                      bare
                      className="text-[11px] text-text-muted hover:text-text-primary"
                    >
                      {TRANSIT_EMOJIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </Select>
                    <EditableText
                      value={city.transit || ''}
                      onSave={val => update(city.id, { transit: val })}
                      className="inline-flex items-center"
                      inputClassName="px-0 py-0 text-[11px] w-[110px] bg-transparent"
                      placeholder="add leg"
                      readOnly={isReadOnly}
                    />
                    {dist != null && <span className="tabular-nums">· {Math.round(dist).toLocaleString()} km</span>}
                  </div>
                )}
              </div>
            )
          })}

          {!isReadOnly && (
            <button
              onClick={onOpenAdd}
              className="flex items-center gap-2 mt-2 w-full border border-border rounded-[var(--radius-md)] px-3 py-2 text-text-muted text-sm hover:border-border-strong hover:text-text-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              Add destination…
            </button>
          )}
        </Card>
      </div>
    </div>
  )
}
