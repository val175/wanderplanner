import { useMemo, useState } from 'react'
import Card from '../../shared/Card'
import EditableText from '../../shared/EditableText'
import Select, { SelectItem } from '../../shared/Select'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { formatDate, daysBetween, haversineDistance } from '../../../utils/helpers'
import { triggerHaptic } from '../../../utils/haptics'

const TRANSIT_EMOJIS = ['🚕', '🚶', '🚇', '🚌', '🚆', '🚲', '✈️', '⛴️', '🚗']

// Add `n` days to a plain YYYY-MM-DD string without timezone drift.
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Nights stepper ────────────────────────────────────────────────────────────
function NightsStepper({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center border border-border rounded-[var(--radius-pill)] bg-bg-card">
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

// ── Route mini-map ────────────────────────────────────────────────────────────
// Plots cities with coordinates into a normalized SVG. Honest about missing
// data: needs at least two geocoded stops, otherwise the panel shows a hint.
function RouteMiniMap({ cities, totalKm }) {
  const W = 240, H = 290, pad = 34
  const pts = cities.filter(c => c.lat != null && c.lng != null)

  if (pts.length < 2) {
    return (
      <div className="flex-1 min-w-[200px] bg-bg-secondary/40 border border-border rounded-[var(--radius-md)] flex items-center justify-center p-6 min-h-[200px]">
        <p className="text-xs text-text-muted text-center text-balance">
          Add at least two cities with locations to see the route map.
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
    <div className="flex-1 min-w-[200px] bg-bg-secondary/40 border border-border rounded-[var(--radius-md)] relative overflow-hidden min-h-[200px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" role="img" aria-label="Trip route map">
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="5 4" />
        {projected.map((p, i) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="6" fill="var(--color-accent)" />
            <circle cx={p.x} cy={p.y} r="2.5" fill="var(--color-bg-card)" />
            <text x={p.x + 10} y={p.y + 4} fontSize="11" fontWeight="600" fill="var(--color-text-secondary)">{p.city}</text>
          </g>
        ))}
      </svg>
      {totalKm > 0 && (
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-[var(--radius-pill)] bg-bg-card border border-border text-text-secondary">
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
  const pct = tripNights > 0 ? Math.min(100, (nightsPlanned / tripNights) * 100) : 0

  // Distance per leg + total, only where both endpoints are geocoded.
  const legKm = (a, b) =>
    (a?.lat != null && a?.lng != null && b?.lat != null && b?.lng != null)
      ? haversineDistance(a.lat, a.lng, b.lat, b.lng)
      : null
  const totalKm = cities.reduce((sum, c, i) => {
    const d = i < cities.length - 1 ? legKm(c, cities[i + 1]) : null
    return sum + (d || 0)
  }, 0)

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

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch">
      {/* Destination list */}
      <Card className="flex-[1.6] min-w-0 border border-border p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cities &amp; Route</span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-[var(--radius-pill)] bg-accent/10 border border-accent/20 text-accent tabular-nums">
            {tripNights > 0 ? `${nightsPlanned}/${tripNights} nights planned` : `${nightsPlanned} nights`}
          </span>
        </div>
        {tripNights > 0 && (
          <div className="h-1 bg-bg-secondary rounded-[var(--radius-pill)] mt-2.5 mb-3 overflow-hidden">
            <div className="h-full bg-accent rounded-[var(--radius-pill)] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        )}

        {cities.map((city, i) => {
          const sched = schedule[i]
          const next = cities[i + 1]
          const dist = next ? legKm(city, next) : null
          const isLast = i === cities.length - 1
          return (
            <div key={city.id}>
              {/* Stop row */}
              <div
                draggable={!isReadOnly}
                onDragStart={() => !isReadOnly && setDragId(city.id)}
                onDragOver={e => { if (!isReadOnly && dragId) { e.preventDefault(); setDragOverId(city.id) } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverId(null) }}
                onDrop={() => handleDrop(city.id)}
                className={`flex items-center gap-3 py-2 px-2 -mx-2 rounded-[var(--radius-md)] transition-colors ${dragOverId === city.id ? 'ring-2 ring-inset ring-accent' : 'hover:bg-bg-hover/50'} ${dragId === city.id ? 'opacity-40' : ''}`}
              >
                {!isReadOnly && (
                  <div className="cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity select-none shrink-0" title="Drag to reorder">⠿</div>
                )}
                <div className="w-[22px] h-[22px] rounded-full bg-bg-secondary text-text-secondary text-[11px] font-semibold flex items-center justify-center shrink-0 tabular-nums">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                    <span>{city.flag || '📍'}</span>{city.city}
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
                <span className="text-[11px] text-text-muted shrink-0 hidden sm:inline">nights</span>
                <span
                  className="text-sm shrink-0"
                  title={bookedStayCities.has(city.id) ? 'Stay booked' : 'No stay booked yet'}
                >
                  <span className={bookedStayCities.has(city.id) ? '' : 'opacity-30 grayscale'}>🛏️</span>
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${bookedStayCities.has(city.id) ? 'bg-success' : 'bg-warning'}`}
                  aria-hidden="true"
                />
              </div>

              {/* Transit leg to next stop */}
              {!isLast && (
                <div className="ml-[10px] pl-5 py-1 border-l-2 border-dashed border-border/40">
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted bg-bg-secondary/40 border border-border/50 rounded-[var(--radius-pill)] pl-1.5 pr-2.5 py-0.5 hover:border-text-primary transition-colors">
                    <Select
                      value={city.transitEmoji || '🚆'}
                      onValueChange={v => update(city.id, { transitEmoji: v })}
                      disabled={isReadOnly}
                      bare
                      className="text-xs text-text-muted hover:text-text-primary px-0.5 py-0.5"
                    >
                      {TRANSIT_EMOJIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </Select>
                    <EditableText
                      value={city.transit || ''}
                      onSave={val => update(city.id, { transit: val })}
                      className="min-w-[60px] inline-flex items-center"
                      inputClassName="px-0 py-0 text-xs font-medium w-[120px] bg-transparent"
                      placeholder="Add transit"
                      readOnly={isReadOnly}
                    />
                    {dist != null && (
                      <span className="text-text-muted/70 tabular-nums">· {Math.round(dist).toLocaleString()} km</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!isReadOnly && (
          <button
            onClick={onOpenAdd}
            className="flex items-center gap-2 mt-3 w-full border border-border rounded-[var(--radius-md)] px-3 py-2 text-text-muted text-sm hover:border-border-strong hover:text-text-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            Add new destination…
          </button>
        )}

        {cities.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🗺️</p>
            <p className="text-text-muted text-sm text-balance">No cities yet — add your first destination to start building the route.</p>
          </div>
        )}
      </Card>

      {/* Route map */}
      <RouteMiniMap cities={cities} totalKm={totalKm} />
    </div>
  )
}
