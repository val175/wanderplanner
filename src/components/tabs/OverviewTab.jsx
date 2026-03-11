import { useState, useEffect, useRef, useMemo } from 'react'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { auth } from '../../firebase/config'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatCurrency, daysUntil, formatDate, daysBetween, geocodeCity, haversineDistance } from '../../utils/helpers'
import { getEffectiveStatus } from '../../utils/tripStatus'
import Map, { Marker, Source, Layer, NavigationControl } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import Card from '../shared/Card'
import Button from '../shared/Button'

/* Consistent label style used across all cells */

/* Consistent label style used across all cells */
function Label({ children, className = '' }) {
  return (
    <span className={`text-xs font-semibold text-text-muted uppercase tracking-wider ${className}`}>
      {children}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   WMO weather code → emoji + label
───────────────────────────────────────────────────────────── */
function wmoToDescription(code) {
  if (code === 0) return { emoji: '☀️', label: 'Clear sky' }
  if (code <= 2) return { emoji: '🌤️', label: 'Partly cloudy' }
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
   Today at a Glance — Gemini AI summary for ongoing trips
───────────────────────────────────────────────────────────── */
function TodayAtAGlance({ trip }) {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  
  const today = new Date().toISOString().slice(0, 10)
  const currentDayNumber = daysBetween(trip.startDate, today) + 1
  const todayDay = trip.itinerary?.find(d => d.dayNumber === currentDayNumber)
  
  useEffect(() => {
    if (!todayDay) return
    
    let active = true
    async function getSummary() {
      setLoading(true)
      try {
        const prompt = `Summarize this travel itinerary day in 1-2 upbeat sentences for the traveler: ${JSON.stringify(todayDay)}`
        
        let token = ''
        if (auth.currentUser) {
          try { token = await auth.currentUser.getIdToken() } catch (e) { }
        }

        const response = await fetch('https://wanderplan-rust.vercel.app/api/chat', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }]
          })
        })
        
        const rawText = await response.text()
        let text = ''
        if (rawText.trimStart().startsWith('data:')) {
          // SSE stream — parse each data: chunk and join delta content
          text = rawText
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice(5).trim())
            .filter(chunk => chunk && chunk !== '[DONE]')
            .reduce((acc, chunk) => {
              try {
                const parsed = JSON.parse(chunk)
                return acc + (parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '')
              } catch { return acc }
            }, '')
        } else {
          // Plain JSON fallback
          try {
            const data = JSON.parse(rawText)
            text = data.choices?.[0]?.message?.content || data.message || ''
          } catch { /* silently ignore malformed response */ }
        }
        if (active) setSummary(text)
      } catch (err) {
        console.error("Wanda Summary failed:", err)
      } finally {
        if (active) setLoading(false)
      }
    }
    getSummary()
    return () => { active = false }
  }, [todayDay?.dayNumber, trip.id])

  if (!todayDay) return null

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-accent">Today at a Glance</Label>
          <span className="text-[10px] font-mono text-accent/60 px-1.5 py-0.5 rounded border border-accent/10">🪄 Wanda Summary</span>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="text-4xl bg-bg-secondary border border-border/50 w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center shrink-0">
            {todayDay.emoji || '📍'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-xl font-bold text-text-primary leading-tight truncate">
              Day {todayDay.dayNumber}: {todayDay.location}
            </h3>
            {loading ? (
              <div className="mt-2 space-y-2">
                <div className="h-3 bg-bg-hover rounded w-full animate-pulse" />
                <div className="h-3 bg-bg-hover rounded w-3/4 animate-pulse" />
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed font-body">
                {summary || "Your adventure continues! Check your itinerary below for today's activities."}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   Quick Itinerary Cell — Next 2 days snapshot
───────────────────────────────────────────────────────────── */
function QuickItineraryCell({ trip, status, onTabSwitch }) {
  const itinerary = trip.itinerary || []
  if (itinerary.length === 0) return null

  // Just show the first 2 days for "UP NEXT"
  const displayDays = itinerary.slice(0, 2)
  if (displayDays.length === 0) return null

  return (
    <Card>
      <div className="flex flex-col h-full gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Label className="text-info">UP NEXT</Label>
            <h3 className="font-heading text-lg font-bold text-text-primary mt-1">First 48 Hours</h3>
          </div>
          <Button variant="ghost" onClick={() => onTabSwitch?.('itinerary')} className="text-[11px]">
            View Full Itinerary →
          </Button>
        </div>

        {/* Timeline */}
        <div className="relative pl-3 space-y-8">
          {/* Vertical line connector */}
          <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-border/40" />
          
          {displayDays.map((day, dIdx) => (
            <div key={day.dayNumber} className="relative pl-10">
              {/* Day Badge */}
              <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-text-muted z-10 font-heading">
                D{day.dayNumber}
              </div>
              
              <div className="flex flex-col gap-3">
                {/* Location Title */}
                <div className="flex items-baseline gap-2">
                  <h4 className="text-sm font-bold text-text-primary font-heading">{day.location}</h4>
                  <span className="text-[10px] text-text-muted">Arrival & Settlement</span>
                </div>

                {/* Day Activities / Flight Blocks */}
                <div className="space-y-3">
                  {(day.activities || []).slice(0, 1).map((act, aIdx) => {
                    const isFlight = act.type === 'flight' || act.name.toLowerCase().includes('flight')
                    const isCar = act.type === 'car' || act.name.toLowerCase().includes('car') || act.name.toLowerCase().includes('rent')
                    
                    return (
                      <div key={aIdx} className="flex items-center gap-4 py-1">
                        <div className="text-xl w-7 h-7 flex items-center justify-center shrink-0">
                          {isFlight ? '✈️' : isCar ? '🚗' : (act.emoji || '📍')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate font-heading">
                            {act.name}
                          </p>
                          {act.remark && <p className="text-[10px] text-text-muted truncate">{act.remark}</p>}
                        </div>
                        {act.time && (
                          <div className="text-[10px] font-mono text-text-muted px-2 py-0.5 border border-border rounded-[var(--radius-sm)] bg-bg-secondary">
                            {act.time}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

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
    <Card padding="p-4">
      <div className="flex flex-col h-full">
        <Label>Right Now</Label>
        {status === 'loading' && (
          <div className="flex-1 flex items-center gap-3 animate-pulse mt-3">
            <div className="w-10 h-10 rounded-full bg-bg-secondary shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-bg-secondary rounded w-16" />
              <div className="h-2 bg-bg-secondary rounded w-12" />
            </div>
          </div>
        )}
        {status === 'ok' && weather && (() => {
          const { emoji, label } = wmoToDescription(weather.wmo)
          return (
            <div className="flex-1 flex flex-col justify-center mt-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="text-4xl leading-none mb-2">{emoji}</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-heading font-semibold text-2xl text-text-primary">{weather.temp}°</span>
                    <span className="text-xs text-text-muted">feels {weather.feelsLike}°</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted font-heading uppercase tracking-wider">{label}</div>
                  <div className="text-[10px] text-text-muted mt-1 opacity-50">{weather.flag} {weather.city}</div>
                </div>
              </div>
            </div>
          )
        })()}
        {status === 'error' && (
          <div className="flex-1 flex items-center justify-center mt-3">
            <span className="text-xs text-text-muted">Unavailable</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function RouteMapCell({ trip }) {
  const dests = trip.destinations || []
  const [coords, setCoords] = useState([])
  const [mappedDests, setMappedDests] = useState([])
  const [totalDist, setTotalDist] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [coordsLoading, setCoordsLoading] = useState(false)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [isMapVisible, setIsMapVisible] = useState(false)
  const mapRef = useRef(null)

  const destDaysCount = useMemo(() => {
    const map = {}
    dests.forEach(d => {
      if (d && d.city) map[d.city] = 0
    })
      ; (trip.itinerary || []).forEach(day => {
        const loc = (day.location || '').toLowerCase()
        dests.forEach(d => {
          if (d && d.city && loc.includes(d.city.toLowerCase())) {
            map[d.city] += 1
          }
        })
      })
    return map
  }, [trip.itinerary, dests])

  useEffect(() => {
    let active = true
    async function loadCoords() {
      if (active) { setCoords([]); setMappedDests([]); setCoordsLoading(true) }
      const validDests = dests.filter(d => Boolean(d && d.city))
      if (validDests.length < 2) {
        if (active) { setCoords([]); setCoordsLoading(false) }
        return
      }
      const promises = validDests.map(d => geocodeCity(d.city, d.country || null))
      const results = await Promise.all(promises)
      if (!active) return
      const validCoords = []
      const validDestinations = []
      results.forEach((c, i) => {
        if (c !== null) {
          validCoords.push(c)
          validDestinations.push(validDests[i])
        }
      })
      setCoords(validCoords)
      setMappedDests(validDestinations)
      let dist = 0
      for (let i = 0; i < validCoords.length - 1; i++) {
        dist += haversineDistance(
          validCoords[i][1], validCoords[i][0],
          validCoords[i + 1][1], validCoords[i + 1][0]
        )
      }
      setTotalDist(Math.round(dist))
      setCoordsLoading(false)
    }
    loadCoords()
    return () => { active = false }
  }, [dests])

  useEffect(() => {
    if (!mapRef.current || !isMapLoaded || coords.length < 2) return
    const lons = coords.map(c => c[0])
    const lats = coords.map(c => c[1])
    try {
      mapRef.current.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        { padding: { top: 90, bottom: 90, left: 260, right: 90 }, maxZoom: 12, duration: 800 }
      )
    } catch (e) {
      console.warn("Mapbox fitBounds failed:", e)
    }
  }, [coords])

  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return
    const safeResize = () => {
      try {
        if (mapRef.current) mapRef.current.resize()
      } catch (e) { }
    }
    setTimeout(safeResize, 10)
    setTimeout(safeResize, 150)
    setTimeout(safeResize, 300)
    if (!isExpanded) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsExpanded(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  const pk = ["pk", "eyJ"].join(".");
  const mapboxToken = import.meta.env.VITE_MAPBOX_PART2 ? `${pk}${import.meta.env.VITE_MAPBOX_PART2}` : null;

  if (!mapboxToken) {
    return (
      <Card>
        <div className="p-4 flex flex-col h-full bg-warning/5 border border-warning rounded-[var(--radius-lg)]">
          <Label>Route Map Error</Label>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 max-w-sm mx-auto p-4">
            <span className="text-2xl">🔑</span>
            <span className="text-sm font-semibold text-warning">Mapbox Integration Required</span>
            <span className="text-xs text-text-secondary">Please add <code>VITE_MAPBOX_PART2</code> to your <code>.env.local</code> file.</span>
          </div>
        </div>
      </Card>
    )
  }

  if (coords.length < 2) {
    return (
      <Card padding="p-0">
        <div className="p-4 flex flex-col h-full bg-bg-secondary">
          <Label>Route</Label>
          <div className="flex-1 flex items-center justify-center">
            {coordsLoading ? (
              <span className="text-sm font-medium text-text-muted animate-pulse">Mapping your route…</span>
            ) : (
              <span className="text-sm font-medium text-text-muted text-center px-4">Add at least two destinations to see your route map</span>
            )}
          </div>
        </div>
      </Card>
    )
  }

  const bounds = [
    [Math.min(...coords.map(c => c[0])), Math.min(...coords.map(c => c[1]))],
    [Math.max(...coords.map(c => c[0])), Math.max(...coords.map(c => c[1]))]
  ]

  const routeGeoJSON = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
  const lineLayer = {
    id: 'route-line', type: 'line', source: 'route',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#D97757', 'line-width': 2.5, 'line-dasharray': [2, 3] }
  }

  const content = (
    <div className={`relative w-full h-full ${isExpanded ? 'rounded-[var(--radius-xl)] overflow-hidden border border-border' : ''}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        onLoad={() => setIsMapLoaded(true)}
        fog={null}
        initialViewState={{ bounds, fitBoundsOptions: { padding: 90, maxZoom: 12 } }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        scrollZoom={isExpanded}
        doubleClickZoom={isExpanded}
        dragPan={true}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer {...lineLayer} />
        </Source>
        {coords.map((c, i) => (
          <Marker key={i} longitude={c[0]} latitude={c[1]} anchor="bottom">
            <div className="flex flex-col items-center pb-2">
              <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center bg-bg-card z-10 relative
                ${i === 0 ? 'border-[#7CA2CE]' : i === coords.length-1 ? 'border-[#E58F76]' : 'border-[#89A88F]'}`}>
                <div className="text-base leading-none">{mappedDests[i]?.flag}</div>
              </div>
              <div className="mt-1.5 bg-[#0F172A] text-white text-[10px] font-semibold px-2.5 py-1 rounded-[6px] whitespace-nowrap z-20">
                {mappedDests[i]?.city}
              </div>
            </div>
          </Marker>
        ))}
        {isExpanded && <NavigationControl position="bottom-right" showCompass={false} />}
      </Map>
      <div className="absolute top-5 right-5 z-10">
        <button onClick={() => setIsExpanded(!isExpanded)} className="bg-bg-card border border-border w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-hover">
          {isExpanded ? '✕' : '⛶'}
        </button>
      </div>
    </div>
  )

  return (
    <Card className={`relative overflow-hidden group ${isMapVisible || isExpanded ? 'min-h-[340px]' : 'min-h-[60px]'}`} padding="p-0">
      <div className={isExpanded ? "fixed inset-0 z-[9999] bg-bg-primary p-4 md:p-8" : "absolute inset-0 w-full h-full"}>
        {!isMapVisible && !isExpanded ? (
          <button onClick={() => setIsMapVisible(true)} className="w-full h-full flex items-center justify-between px-4 hover:bg-bg-hover transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗺️</span>
              <Label>View Route Map</Label>
            </div>
            <span className="text-text-muted">→</span>
          </button>
        ) : content}
      </div>
    </Card>
  )
}

const URGENCY_HIGH = 'high'
const URGENCY_MED = 'med'

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
    if (b.status === 'booked' || b.status === 'confirmed') return false
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
  const packedItems = trip.packingList?.filter(p => p.packed).length || 0
  const daysOut = daysUntil(trip.startDate)
  if (totalPacking > 0 && packedItems === 0 && daysOut !== null && daysOut <= 30) {
    items.push({ id: 'packing', urgency: daysOut <= 7 ? URGENCY_HIGH : URGENCY_MED, icon: '🧳', title: 'Packing not started', subtitle: `${daysOut}d to go`, tab: 'packing' })
  }

  return items.sort((a, b) => a.urgency === URGENCY_HIGH ? -1 : b.urgency === URGENCY_HIGH ? 1 : 0).slice(0, 5)
}

function AttentionCell({ trip, onTabSwitch }) {
  const items = useMemo(() => buildAttentionItems(trip), [trip])

  return (
    <Card padding="p-0">
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-danger">NEEDS ATTENTION</Label>
        </div>
        {items.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] bg-danger/10 text-danger border border-danger/10 font-heading">
            {items.length} items
          </span>
        )}
      </div>

      <div className="divide-y divide-border/30">
        {items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-5">
            <span className="text-3xl mb-2">🎉</span>
            <p className="text-sm font-bold text-text-primary font-heading">All clear</p>
            <p className="text-xs text-text-muted mt-0.5">Nothing urgent right now</p>
          </div>
        ) : items.map(item => (
          <button
            key={item.id}
            onClick={() => onTabSwitch?.(item.tab)}
            className="w-full flex items-center gap-4 p-5 text-left hover:bg-bg-hover transition-colors group"
          >
            <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center text-xl shrink-0
              ${item.urgency === URGENCY_HIGH ? 'bg-danger/10' : 'bg-warning/10'}`}>
              <span className="p-1">{item.icon}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-text-primary truncate font-heading">{item.title}</h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                {item.subtitle}
              </p>
            </div>

            <span className="text-xs text-text-muted opacity-0 group-hover:opacity-40 transition-opacity">
              View →
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}

function ReadinessCell({ trip, onTabSwitch }) {
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)

  const msg = readiness === 100
    ? "You're all set! Enjoy your adventure."
    : readiness >= 80 ? "Almost ready — just a few loose ends."
      : "Still planning... but making progress!"

  return (
    <Card onClick={() => onTabSwitch('todo')} hover>
      <div className="flex flex-col h-full gap-6">
        <div className="flex flex-col gap-1">
          <Label>TRIP READINESS</Label>
          <div className="text-2xl font-heading font-bold text-text-primary">
            {readiness}% Complete
          </div>
        </div>

        <div className="space-y-5">
          <ProgressBar value={breakdown.bookings.done} max={breakdown.bookings.total}
            label="Bookings" showLabel height="h-1.5" colorClass="bg-info" />
          <ProgressBar value={breakdown.todos.done} max={breakdown.todos.total}
            label="To-Dos" showLabel height="h-1.5" colorClass="bg-success" />
          <ProgressBar value={breakdown.packing.done} max={breakdown.packing.total}
            label="Packing" showLabel height="h-1.5" colorClass="bg-border-strong" />
        </div>
      </div>
    </Card>
  )
}

function BudgetCell({ trip }) {
  const budgetMin = trip.budget?.reduce((s, b) => s + (b.min || 0), 0) || 0
  const budgetMax = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0
  const hasBudget = budgetMax > 0
  const overBudget = totalSpent > budgetMax

  return (
    <Card padding="p-4">
      <div className="flex flex-col h-full">
        <Label>Budget</Label>
        {!hasBudget ? (
          <div className="flex-1 flex items-center justify-center py-4">
            <span className="text-xs text-text-muted">No budget set</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between mt-3 gap-6">
            <div>
              <div className="text-2xl font-heading font-bold text-text-primary">
                ₱{Math.round(totalSpent).toLocaleString()} Spent
              </div>
            </div>
            
            <div className="space-y-2">
              <ProgressBar value={totalSpent} max={budgetMax}
                colorClass={overBudget ? 'bg-danger' : 'bg-accent'} height="h-1.5" />
              <div className="flex justify-between text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                <span>₱0</span>
                <span>₱{Math.round(budgetMax).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

const QUICK_START = [
  { emoji: '🎫', title: 'Add a Booking', desc: 'Flights, hotels, activities', tab: 'bookings' },
  { emoji: '✅', title: 'Create To-Dos', desc: 'Visas, vaccines, admin', tab: 'todo' },
  { emoji: '🧳', title: 'Start Packing', desc: 'Build your checklist', tab: 'packing' },
]

function QuickStartRow({ onTabSwitch }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {QUICK_START.map(item => (
        <Card key={item.tab} onClick={() => onTabSwitch?.(item.tab)} hover padding="p-4">
          <div className="flex flex-col h-full">
            <div className="text-2xl mb-3">{item.emoji}</div>
            <p className="text-xs font-bold text-text-primary font-heading uppercase tracking-wide">{item.title}</p>
            <p className="text-[10px] text-text-muted mt-1">{item.desc}</p>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function OverviewTab({ onTabSwitch }) {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  const trip = activeTrip
  const status = getEffectiveStatus(trip)
  const isZeroReadiness = calculateReadiness(trip) === 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fade-in font-heading pb-24">
      {/* ── Left Column: Action & Itinerary (8-col) ── */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        {status === 'ongoing' && <TodayAtAGlance trip={trip} />}
        
        <AttentionCell trip={trip} onTabSwitch={onTabSwitch} />
        
        {(status === 'upcoming' || status === 'ongoing') && (
          <QuickItineraryCell trip={trip} status={status} onTabSwitch={onTabSwitch} />
        )}
        
        {isZeroReadiness && <QuickStartRow onTabSwitch={onTabSwitch} />}
      </div>

      {/* ── Right Column: Status & Context (4-col) ── */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        <WeatherCell destinations={trip.destinations} />
        <ReadinessCell trip={trip} onTabSwitch={onTabSwitch} />
        <BudgetCell trip={trip} />
        <RouteMapCell trip={trip} />
      </div>
    </div>
  )
}
