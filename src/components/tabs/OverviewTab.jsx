import { useState, useEffect, useMemo } from 'react'
import ProgressBar from '../shared/ProgressBar'
import { useTripContext } from '../../context/TripContext'
import { auth } from '../../firebase/config'
import { calculateReadiness, getReadinessBreakdown } from '../../utils/readiness'
import { formatCurrency, daysUntil, formatDate, daysBetween } from '../../utils/helpers'
import { getEffectiveStatus } from '../../utils/tripStatus'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { buildTripSystemPrompt } from '../../hooks/useAI'

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

function extractMessageText(message) {
  if (!message) return ''
  if (typeof message.content === 'string' && message.content) return message.content
  if (Array.isArray(message.content)) {
    const textPart = message.content.find(p => p.type === 'text')
    if (textPart?.text) return textPart.text
  }
  if (Array.isArray(message.parts)) {
    const textPart = message.parts.find(p => p.type === 'text')
    if (textPart?.text) return textPart.text
  }
  return ''
}

/* ─────────────────────────────────────────────────────────────
   Today at a Glance — AI summary for the current trip day
───────────────────────────────────────────────────────────── */
function TodayAtAGlance({ trip }) {
  const today = new Date().toISOString().slice(0, 10)
  const currentDayNumber = daysBetween(trip.startDate, today) + 1
  const todayDay = trip.itinerary?.find(d => d.dayNumber === currentDayNumber)

  const cacheKey = `wanda_summary_${trip.id}_${today}`
  const [cachedSummary, setCachedSummary] = useState(() => sessionStorage.getItem(cacheKey) ?? '')

  // Build a transport per trip (memoised so it's stable across renders)
  const transport = useMemo(() => new DefaultChatTransport({
    api: 'https://wanderplan-rust.vercel.app/api/chat',
    body: () => ({ systemPrompt: buildTripSystemPrompt(trip) }),
    fetch: async (url, options) => {
      let token = ''
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken() } catch {}
      }
      const headers = new Headers(options.headers || {})
      headers.set('Content-Type', 'application/json')
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return fetch(url, { ...options, headers, mode: 'cors', credentials: 'omit' })
    }
  }), [trip.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const { messages, sendMessage, status } = useChat({ transport })

  const streamingSummary = extractMessageText(messages.findLast(m => m.role === 'assistant'))

  // Once streaming completes, persist and update local state
  useEffect(() => {
    if (streamingSummary && streamingSummary.trim().length > 0 && status !== 'streaming' && status !== 'submitted') {
      sessionStorage.setItem(cacheKey, streamingSummary)
      setCachedSummary(streamingSummary)
    }
  }, [streamingSummary, status])

  // Sync cachedSummary when the trip or date changes (cacheKey changes on re-render, not remount)
  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey)
    setCachedSummary(cached && cached.trim().length > 0 ? cached : '')
  }, [cacheKey])

  // Fire the prompt once per day / trip — guard read inside effect so it's fresh at fire time
  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey)
    if (!todayDay) return
    if (cached && cached.trim().length > 0) return
    const prompt = `In 1-2 upbeat sentences, summarize today's travel plan for Day ${todayDay.dayNumber} in ${todayDay.location}. Activities: ${(todayDay.activities || []).map(a => a.name).join(', ') || 'free day'}.`
    sendMessage({ text: prompt })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDay?.dayNumber, trip.id])

  if (!todayDay) return null

  const displaySummary = cachedSummary || streamingSummary
  const loading = !cachedSummary && (status === 'streaming' || status === 'submitted')

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-accent">Today at a Glance</Label>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-[var(--radius-pill)] font-heading flex items-center gap-1.5"
            style={{ background: 'rgba(76,175,118,0.10)', color: '#4CAF76', border: '1px solid rgba(76,175,118,0.20)' }}>
            🪄 Wanda Summary
          </span>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="text-2xl bg-bg-secondary border border-border/50 w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
            {todayDay.emoji || '📍'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-semibold text-text-primary leading-tight truncate text-balance">
              Day {todayDay.dayNumber}: {todayDay.location}
            </h3>

            {loading ? (
              <div className="mt-2 space-y-2">
                <div className="h-3 bg-bg-hover rounded w-full animate-pulse" />
                <div className="h-3 bg-bg-hover rounded w-3/4 animate-pulse" />
              </div>
            ) : (
              <p className="mt-1.5 text-sm text-text-secondary leading-relaxed font-heading font-normal text-balance">
                {displaySummary}
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
            <h3 className="font-heading text-lg font-bold text-text-primary mt-1 text-balance">First 48 Hours</h3>

          </div>
          <Button variant="ghost" size="sm" onClick={() => onTabSwitch?.('itinerary')}>
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
                <div className="relative">
                  <div className="space-y-3">
                    {(day.activities || []).slice(0, 3).map((act, aIdx) => {
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
                  {(day.activities?.length || 0) > 3 && (
                    <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-bg-card to-transparent pointer-events-none" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────
   DestinationsCell — Replaces RouteMapCell
───────────────────────────────────────────────────────────── */
function DestinationsCell({ trip, onTabSwitch }) {
  const dests = trip.destinations || []
  const showScroll = dests.length > 4
  const extraCount = dests.length - 4

  return (
    <Card padding="p-0" className="overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <Label>DESTINATIONS</Label>
        <Button variant="ghost" size="sm" onClick={() => onTabSwitch?.('wandermap')}>View Map →</Button>
      </div>
      {dests.length === 0 ? (
        <div className="px-4 pb-4">
          <span className="text-xs text-text-muted">No destinations added yet</span>
        </div>
      ) : (
        <>
          <div className={showScroll ? 'max-h-[232px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent' : ''}>
            {dests.map((dest, i) => (
              <div key={dest.city || i} className="flex items-center gap-3 px-4 py-3 border-t border-border/40">
                <span className="text-xl">{dest.flag || '📍'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary font-heading truncate text-balance">{dest.city}</p>

                  {dest.country && <p className="text-[10px] text-text-muted truncate">{dest.country}</p>}
                </div>
                {dest.nights && (
                  <span className="text-[10px] text-text-muted font-heading shrink-0">{dest.nights}n</span>
                )}
              </div>
            ))}
          </div>
          {showScroll && (
            <div className="border-t border-border/40 bg-gradient-to-t from-bg-card to-transparent text-[10px] text-text-muted font-heading text-center py-1.5">
              +{extraCount} more {extraCount === 1 ? 'destination' : 'destinations'}
            </div>
          )}
        </>
      )}
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

  // Budget overruns — show over-100% first, then 80%+ approaching
  const sym = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', PHP: '₱', AUD: 'A$', CAD: 'C$', SGD: 'S$' }[trip.currency] || trip.currency || '₱'
  ;(trip.budget || []).filter(b => b.max > 0 && (b.actual || 0) > b.max).slice(0, 2).forEach(b => {
    items.push({
      id: `budget-over-${b.name}`, urgency: URGENCY_HIGH,
      icon: b.emoji || '💸',
      title: `${b.name} over budget`,
      subtitle: `${sym}${Math.round(b.actual || 0).toLocaleString()} of ${sym}${Math.round(b.max).toLocaleString()} (${Math.round((b.actual || 0) / b.max * 100)}%)`,
      tab: 'budget',
    })
  })
  ;(trip.budget || []).filter(b => b.max > 0 && (b.actual || 0) >= b.max * 0.8 && (b.actual || 0) <= b.max).slice(0, 1).forEach(b => {
    items.push({
      id: `budget-near-${b.name}`, urgency: URGENCY_MED,
      icon: b.emoji || '⚠️',
      title: `${b.name} at ${Math.round((b.actual || 0) / b.max * 100)}%`,
      subtitle: `${sym}${Math.round(b.max - (b.actual || 0)).toLocaleString()} remaining`,
      tab: 'budget',
    })
  })

  // Wanda AI budget alerts
  ;(trip.wandaAlerts || []).slice(0, 3).forEach(alert => {
    items.push({
      id: `wanda-alert-${alert.id}`,
      urgency: alert.severity === 'danger' ? URGENCY_HIGH : URGENCY_MED,
      icon: alert.emoji || '🪄',
      title: alert.title,
      subtitle: alert.message,
      tab: 'budget',
    })
  })

  return items.sort((a, b) => a.urgency === URGENCY_HIGH ? -1 : b.urgency === URGENCY_HIGH ? 1 : 0).slice(0, 6)
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
            <p className="text-sm font-bold text-text-primary font-heading text-balance">All clear</p>
            <p className="text-xs text-text-muted mt-0.5 text-balance">Nothing urgent right now</p>
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

/* ─────────────────────────────────────────────────────────────
   TripHealthCard — Consolidated Weather + Readiness + Budget
───────────────────────────────────────────────────────────── */
function TripHealthCard({ trip, onTabSwitch }) {
  // === Weather (parallel fetch for all destinations on mount) ===
  const destinations = trip.destinations || []
  const [weatherCache, setWeatherCache] = useState({})
  const [weatherStatus, setWeatherStatus] = useState('loading')
  const [destIndex, setDestIndex] = useState(0)
  const currentDest = destinations[destIndex]
  const weather = currentDest ? (weatherCache[currentDest.city] ?? null) : null
  const effectiveWeatherStatus = weatherStatus === 'loading' ? 'loading' : (weather ? 'ok' : 'error')

  useEffect(() => { setDestIndex(0) }, [destinations])

  useEffect(() => {
    if (!destinations.length) { setWeatherStatus('error'); return }
    let cancelled = false
    setWeatherStatus('loading')

    async function fetchOne(dest) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(dest.city)}&count=1&language=en&format=json`)
      const gd = await g.json()
      if (!gd.results?.length) return null
      const { latitude, longitude } = gd.results[0]
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weathercode&temperature_unit=celsius&timezone=auto`)
      const wd = await w.json()
      const c = wd.current
      return { temp: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature), wmo: c.weathercode, city: dest.city, flag: dest.flag }
    }

    Promise.all(destinations.map(dest => fetchOne(dest).catch(() => null)))
      .then(results => {
        if (cancelled) return
        const cache = {}
        results.forEach((r, i) => { if (r) cache[destinations[i].city] = r })
        setWeatherCache(cache)
        setWeatherStatus(Object.keys(cache).length ? 'ok' : 'error')
      })

    return () => { cancelled = true }
  }, [destinations.map(d => d.city).join(',')])

  // === Readiness ===
  const readiness = calculateReadiness(trip)
  const breakdown = getReadinessBreakdown(trip)

  // === Budget ===
  const budgetMax = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0
  const hasBudget = budgetMax > 0
  const overBudget = totalSpent > budgetMax

  // Readiness pill config
  const readinessPill = (() => {
    if (readiness === 100) return {
      color: 'bg-success/10 text-success border-success/20',
      label: '✅ Complete'
    }
    if (readiness >= 80) return {
      color: 'bg-success/10 text-success border-success/20',
      label: `${readiness}% complete`
    }
    if (readiness >= 33) return {
      color: 'bg-warning/10 text-warning border-warning/20',
      label: `${readiness}% complete`
    }
    return {
      color: 'bg-danger/10 text-danger border-danger/20',
      label: `${readiness}% complete`
    }
  })()

  // Budget pill config
  const budgetPill = (() => {
    if (!hasBudget) return null
    if (totalSpent >= budgetMax) return {
      color: 'bg-danger/10 text-danger border-danger/20',
      label: `⚠️ ₱${Math.round(totalSpent).toLocaleString()} spent`
    }
    if (totalSpent >= budgetMax * 0.5) return {
      color: 'bg-warning/10 text-warning border-warning/20',
      label: `₱${Math.round(totalSpent).toLocaleString()} spent`
    }
    return {
      color: 'bg-success/10 text-success border-success/20',
      label: `₱${Math.round(totalSpent).toLocaleString()} spent`
    }
  })()

  return (
    <Card padding="p-0">
      <div className="flex flex-col divide-y divide-border/40">

        {/* ── Weather ── */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Label>Right Now</Label>
              {currentDest && <span className="text-[10px] text-text-muted font-heading">{currentDest.city}</span>}
            </div>
            {destinations.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDestIndex(i => Math.max(0, i - 1))}
                  disabled={destIndex === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] bg-bg-secondary hover:bg-bg-hover text-text-muted text-xs transition-colors disabled:opacity-40"
                >‹</button>
                <button
                  onClick={() => setDestIndex(i => Math.min(destinations.length - 1, i + 1))}
                  disabled={destIndex === destinations.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-sm)] bg-bg-secondary hover:bg-bg-hover text-text-muted text-xs transition-colors disabled:opacity-40"
                >›</button>
              </div>
            )}
          </div>
          {effectiveWeatherStatus === 'loading' && (
            <div className="flex items-center gap-3 animate-pulse mt-3">
              <div className="w-10 h-10 rounded-full bg-bg-secondary shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-3 bg-bg-secondary rounded w-16" />
                <div className="h-2 bg-bg-secondary rounded w-12" />
              </div>
            </div>
          )}
          {effectiveWeatherStatus === 'ok' && weather && (() => {
            const { emoji, label } = wmoToDescription(weather.wmo)
            return (
              <div className="flex items-center justify-between mt-2">
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
            )
          })()}
          {effectiveWeatherStatus === 'error' && (
            <div className="flex items-center justify-center mt-3">
              <span className="text-xs text-text-muted">Unavailable</span>
            </div>
          )}
        </div>

        {/* ── Readiness ── */}
        <div
          className="px-4 py-4 cursor-pointer hover:bg-bg-hover transition-colors rounded-[var(--radius-md)]"
          onClick={() => onTabSwitch('todo')}
        >
          <div className="flex items-center justify-between">
            <Label>TRIP READINESS</Label>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] font-heading tabular-nums border ${readinessPill.color}`}>
              {readinessPill.label}
            </span>
          </div>

          <div className="space-y-5 mt-4">
            <ProgressBar value={breakdown.bookings.done} max={breakdown.bookings.total}
              label="Bookings" showLabel height="h-1.5" colorClass="bg-info" />
            <ProgressBar value={breakdown.todos.done} max={breakdown.todos.total}
              label="To-Dos" showLabel height="h-1.5" colorClass="bg-success" />
            <ProgressBar value={breakdown.packing.done} max={breakdown.packing.total}
              label="Packing" showLabel height="h-1.5" colorClass="bg-border-strong" />
          </div>
        </div>

        {/* ── Budget ── */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <Label>Budget</Label>
            {hasBudget && budgetPill && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-pill)] font-heading tabular-nums border ${budgetPill.color}`}>
                {budgetPill.label}
              </span>
            )}
          </div>
          {!hasBudget ? (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-text-muted">No budget set</span>
            </div>
          ) : (
            <div className="flex flex-col mt-4 gap-3">
              <ProgressBar value={totalSpent} max={budgetMax}
                colorClass={overBudget ? 'bg-danger' : 'bg-accent'} height="h-1.5" />
              <div className="flex justify-between text-[10px] text-text-muted font-bold uppercase tracking-tighter">
                <span>₱0</span>
                <span>₱{Math.round(budgetMax).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

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
            <p className="text-xs font-bold text-text-primary font-heading uppercase tracking-wide text-balance">{item.title}</p>
            <p className="text-[10px] text-text-muted mt-1 text-balance">{item.desc}</p>
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-tab-enter stagger-1 font-heading pb-24">
      {/* ── Left Column: Action & Itinerary (8-col) ── */}
      <div className="lg:col-span-8 flex flex-col gap-5 animate-tab-enter stagger-2">

        {status === 'ongoing' && <TodayAtAGlance trip={trip} />}
        
        <AttentionCell trip={trip} onTabSwitch={onTabSwitch} />
        
        {(status === 'upcoming' || status === 'ongoing') && (
          <QuickItineraryCell trip={trip} status={status} onTabSwitch={onTabSwitch} />
        )}
        
        {isZeroReadiness && <QuickStartRow onTabSwitch={onTabSwitch} />}
      </div>

      {/* ── Right Column: Status & Context (4-col) ── */}
      <div className="lg:col-span-4 flex flex-col gap-5 animate-tab-enter stagger-3">

        <TripHealthCard trip={trip} onTabSwitch={onTabSwitch} />
        <DestinationsCell trip={trip} onTabSwitch={onTabSwitch} />
      </div>
    </div>
  )
}
