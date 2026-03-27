import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import { useTripContext } from '../../context/TripContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { formatDateRange, formatCurrency, daysUntil, geocodeCity } from '../../utils/helpers'
import { getCategory } from '../../constants/categories'
import { callAI } from '../../hooks/useAI'
import AvatarCircle from './AvatarCircle'

/* ─────────────────────────────────────────────────────────────
   Free image / map fetchers
───────────────────────────────────────────────────────────── */

/** Wikipedia REST API — no auth, CORS-safe, resizable thumbnails */
async function fetchCityPhoto(cityName) {
    try {
        const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cityName)}`,
            { headers: { 'Api-User-Agent': 'Wanderplan/1.0 (travel-app)' } }
        )
        if (!res.ok) return null
        const data = await res.json()
        const src = data.thumbnail?.source
        if (!src) return null
        // Wikimedia CDN resizes on demand by swapping the pixel-size prefix in the URL
        return src.replace(/\/\d+px-/, '/1200px-')
    } catch {
        return null
    }
}

/** Mapbox Static Images — uses the existing split token from env */
async function buildMapboxUrl(destinations) {
    const part2 = import.meta.env.VITE_MAPBOX_PART2
    if (!part2 || !destinations?.length) return null
    const token = `pk.eyJ${part2}`

    // Geocode with the existing Open-Meteo geocoder (already cached)
    const geocoded = (
        await Promise.all(
            destinations.map(async d => {
                const coords = await geocodeCity(d.city, d.country || null)
                return coords ? { ...d, lng: coords[0], lat: coords[1] } : null
            })
        )
    ).filter(Boolean)

    if (!geocoded.length) return null

    const pins = geocoded.map(d => `pin-l+D97757(${d.lng},${d.lat})`).join(',')
    const fit  = geocoded.length === 1 ? `${geocoded[0].lng},${geocoded[0].lat},7` : 'auto'

    return `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/${pins}/${fit}/1200x700@2x?padding=120&access_token=${token}`
}

/* ─────────────────────────────────────────────────────────────
   AI caption generation (one call → 5 captions)
───────────────────────────────────────────────────────────── */
async function generateCaptions(trip) {
    const confirmed   = (trip.bookings   || []).filter(b => b.status === 'booked').length
    const totalBooks  = (trip.bookings   || []).length
    const openTodos   = (trip.todos      || []).filter(t => !t.done).length
    const packing     = trip.packingList || []
    const packingPct  = packing.length ? Math.round((packing.filter(p => p.packed).length / packing.length) * 100) : null
    const budgetTotal = (trip.budget || []).reduce((s, b) => s + (b.max || 0), 0)
    const perPerson   = budgetTotal && trip.travelers ? Math.round(budgetTotal / trip.travelers) : 0
    const route       = (trip.destinations || []).map(d => d.city).filter(Boolean).join(' → ')
    const countdown   = daysUntil(trip.startDate)

    const summary = { name: trip.name, emoji: trip.emoji, route, days: (trip.itinerary || []).length,
        travelers: trip.travelers, daysUntil: countdown, confirmed, totalBooks,
        perPerson, currency: trip.currency, openTodos, packingPct }

    const text = await callAI([
        { role: 'system', content: 'You are Wanda, a warm and witty AI travel assistant. Return ONLY a valid JSON object — no markdown, no prose outside the JSON.' },
        { role: 'user',   content:
            `Generate 5 short slide captions for a pre-trip group briefing. Trip data: ${JSON.stringify(summary)}\n\n` +
            `Return exactly:\n{"cover":"6-8 word punchy tagline capturing trip vibe","map":"1 exciting sentence about the route or journey","plan":"1 warm sentence about what the itinerary looks like","status":"1 conversational sentence covering bookings and budget","prep":"1 encouraging sentence about pre-departure readiness"}`
        },
    ], { temperature: 0.5, max_tokens: 400, jsonMode: true })

    // Strip any markdown fencing just in case
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON found in caption response')
    return JSON.parse(match[0])
}

/* ─────────────────────────────────────────────────────────────
   Data helpers
───────────────────────────────────────────────────────────── */
function getCountdownLabel(startDate) {
    const d = daysUntil(startDate)
    if (d === null) return null
    if (d > 1)  return `${d} days to go 🚀`
    if (d === 1) return 'Tomorrow! 🎉'
    if (d === 0) return 'Today! ✈️'
    return 'Trip is underway 🌍'
}

function getBudgetInfo(trip) {
    const total = (trip.budget || []).reduce((s, b) => s + (b.max || 0), 0)
    const trav  = Math.max(trip.travelers || 1, 1)
    return { total, perPerson: total > 0 ? Math.round(total / trav) : 0 }
}

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', PHP: '₱', AUD: 'A$',
    CAD: 'C$', SGD: 'S$', KRW: '₩', THB: '฿', IDR: 'Rp', MYR: 'RM', HKD: 'HK$', VND: '₫', INR: '₹' }

const PRESENTATION_EXPORT = { width: 1920, height: 1080 }

/* ─────────────────────────────────────────────────────────────
   WandaCaption — shared AI insight footer
───────────────────────────────────────────────────────────── */
function WandaCaption({ text, loading, dark = false }) {
    const base = dark
        ? 'bg-white/10 border-white/20'
        : 'bg-accent/6 border-accent/15'
    const dot  = dark ? 'text-white/70'  : 'text-accent'
    const body = dark ? 'text-white/80'  : 'text-text-secondary'

    if (loading) return (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-lg)] border ${base}`}>
            <span className={`text-sm shrink-0 ${dot}`}>✦</span>
            <div className="flex-1 space-y-1.5">
                <div className={`h-2.5 rounded-full animate-pulse-warm ${dark ? 'bg-white/20' : 'bg-text-muted/20'}`} style={{ width: '80%' }} />
                <div className={`h-2.5 rounded-full animate-pulse-warm ${dark ? 'bg-white/15' : 'bg-text-muted/13'}`} style={{ width: '55%' }} />
            </div>
        </div>
    )
    if (!text) return null
    return (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius-lg)] border ${base}`}>
            <span className={`text-sm font-bold shrink-0 pt-0.5 ${dot}`}>✦</span>
            <p className={`text-sm italic leading-relaxed ${body}`}>{text}</p>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide 1 — Cover (photo hero)
───────────────────────────────────────────────────────────── */
function SlideCover({ trip, travelerProfiles, coverPhoto, caption, loadingCaption }) {
    const route     = (trip.destinations || []).map(d => [d.flag, d.city].filter(Boolean).join(' ')).join('  ·  ')
    const countdown = getCountdownLabel(trip.startDate)

    return (
        <div className="relative flex flex-col h-full overflow-hidden">
            {/* Background */}
            {coverPhoto
                ? <img src={coverPhoto} alt="" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover" />
                : <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-bg-secondary to-bg-primary" />
            }

            {/* Gradient overlay — heavier at bottom for legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/82 pointer-events-none" />

            {/* Content — bottom aligned */}
            <div className="relative mt-auto px-8 pb-8 flex flex-col gap-3.5">
                <div className="text-[64px] leading-none drop-shadow-lg">{trip.emoji || '✈️'}</div>
                <h1 className="font-heading text-5xl sm:text-[3.75rem] font-black tracking-tighter text-white leading-tight max-w-lg drop-shadow-md">
                    {trip.name}
                </h1>
                <div className="flex flex-col gap-1">
                    {route    && <p className="text-sm text-white/70 font-medium">{route}</p>}
                    <p className="text-sm text-white/55">
                        {formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}
                        {trip.travelers > 1 && ` · ${trip.travelers} travelers`}
                    </p>
                </div>
                {countdown && (
                    <span className="self-start px-4 py-1.5 rounded-[var(--radius-pill)] bg-accent text-white text-xs font-bold tracking-widest uppercase shadow-sm">
                        {countdown}
                    </span>
                )}
                {travelerProfiles.length > 0 && (
                    <div className="flex items-center -space-x-2">
                        {travelerProfiles.map(p => (
                            <div key={p.id} className="border-2 border-white/40 rounded-full shadow">
                                <AvatarCircle profile={p} size={36} />
                            </div>
                        ))}
                    </div>
                )}
                <div className="max-w-sm mt-1">
                    <WandaCaption text={caption} loading={loadingCaption} dark />
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide 2 — Route Map (Mapbox Static)
───────────────────────────────────────────────────────────── */
function SlideMap({ trip, mapUrl, caption, loadingCaption }) {
    const route = (trip.destinations || []).map(d => [d.flag, d.city].filter(Boolean).join(' ')).join('  →  ')
    const destinations = trip.destinations || []

    return (
        <div className="grid h-full grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] overflow-hidden">
            <div className="relative min-h-[52vh] lg:min-h-0 overflow-hidden bg-bg-secondary">
                {mapUrl ? (
                    <img src={mapUrl} alt="Trip route map" crossOrigin="anonymous" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-secondary gap-3 animate-pulse-warm">
                        <span className="text-5xl opacity-30">🗺️</span>
                        <p className="text-xs text-text-muted">Plotting your route…</p>
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/8 to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />

                <div className="relative h-full p-6 md:p-8 flex flex-col justify-between">
                    <div className="max-w-xl space-y-3">
                        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-white/60">Route</p>
                        <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tighter leading-tight text-white max-w-lg drop-shadow">
                            {route || 'Your route at a glance'}
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-md">
                        <div className="rounded-[var(--radius-lg)] border border-white/15 bg-white/10 backdrop-blur-sm px-4 py-3 text-white">
                            <p className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">Stops</p>
                            <p className="mt-1 text-2xl font-black leading-none">{destinations.length || '—'}</p>
                        </div>
                        <div className="rounded-[var(--radius-lg)] border border-white/15 bg-white/10 backdrop-blur-sm px-4 py-3 text-white">
                            <p className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">Motion</p>
                            <p className="mt-1 text-sm font-semibold leading-snug">
                                From takeoff to touchdown, the route stays easy to scan.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex h-full flex-col gap-5 px-6 py-6 md:px-8 md:py-8 bg-bg-primary border-l border-border overflow-hidden">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-text-muted">At A Glance</p>
                    <div className="space-y-1">
                        <p className="font-heading text-3xl font-black tracking-tighter text-text-primary leading-tight">
                            {trip.name}
                        </p>
                        <p className="text-sm text-text-muted leading-relaxed">
                            {trip.startDate ? formatDateRange(trip.startDate, trip.endDate) : 'Dates TBA'}
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-xs font-bold tracking-wider uppercase text-text-muted">Destinations</p>
                    <div className="space-y-2 overflow-hidden">
                        {destinations.slice(0, 4).map((d, i) => (
                            <div key={`${d.city || i}-${i}`} className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-bg-card px-3 py-2.5">
                                <span className="text-lg leading-none">{d.flag || '📍'}</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary leading-tight">{d.city || 'TBA'}</p>
                                    <p className="text-xs text-text-muted mt-0.5 truncate">{d.country || 'Destination stop'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-auto">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide 3 — The Plan (itinerary + city thumbnails)
───────────────────────────────────────────────────────────── */
function SlideItinerary({ trip, cityPhotos, caption, loadingCaption }) {
    const days = [...(trip.itinerary || [])].sort((a, b) => a.dayNumber - b.dayNumber)
    const cities = (trip.destinations || []).map(d => d.city).filter(Boolean).join(' · ')
    const routeSummary = (trip.destinations || []).map(d => [d.flag, d.city].filter(Boolean).join(' ')).filter(Boolean).join(' → ')

    return (
        <div className="grid h-full grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] overflow-hidden">
            <div className="flex h-full flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-border bg-bg-primary px-6 py-6 md:px-8 md:py-8 overflow-hidden">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-text-muted">The Plan</p>
                        <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tighter text-text-primary leading-tight">
                            {days.length > 0 ? `${days.length} days` : 'Itinerary'}
                        </h2>
                        {routeSummary && <p className="text-sm text-text-muted leading-relaxed max-w-sm">{routeSummary}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-secondary px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Cities</p>
                            <p className="mt-1 text-2xl font-black tracking-tighter text-text-primary">{cities ? cities.split(' · ').length : 0}</p>
                        </div>
                        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-secondary px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">Focus</p>
                            <p className="mt-1 text-sm font-semibold text-text-primary leading-snug">One clear day-by-day plan</p>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-card">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
                    <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-text-muted">Day By Day</p>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
                    {days.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-text-muted text-sm">No itinerary added yet</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {days.slice(0, 8).map((day, i) => {
                                const activities = (day.activities || []).slice(0, 2).map(a => a.name).filter(Boolean)
                                const photo = cityPhotos?.[day.location]
                                return (
                                    <div key={day.id || i} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] border border-border px-3 py-3">
                                        <span className="text-lg md:text-xl font-black text-text-primary/[0.12] tabular-nums leading-none select-none w-10 text-right">
                                            {String(day.dayNumber).padStart(2, '0')}
                                        </span>
                                        <div className="w-10 h-10 rounded-full bg-bg-secondary border border-border shrink-0 overflow-hidden flex items-center justify-center">
                                            {photo
                                                ? <img src={photo} alt={day.location} crossOrigin="anonymous" className="w-full h-full object-cover" />
                                                : <span className="text-base">{day.emoji || '📍'}</span>
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-text-primary truncate leading-tight">{day.location || 'TBA'}</p>
                                            {activities.length > 0 && (
                                                <p className="text-xs text-text-muted truncate mt-0.5">{activities.join(' · ')}</p>
                                            )}
                                        </div>
                                        {day.date && (
                                            <p className="text-xs text-text-muted shrink-0 tabular-nums whitespace-nowrap">
                                                {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                            {days.length > 8 && (
                                <p className="text-xs text-text-muted text-center py-2.5">+ {days.length - 8} more days</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="shrink-0 border-t border-border px-6 py-4 lg:hidden">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide 4 — Budget & Bookings
───────────────────────────────────────────────────────────── */
function SlideStatus({ trip, caption, loadingCaption }) {
    const { total, perPerson } = getBudgetInfo(trip)
    const confirmed  = (trip.bookings || []).filter(b => b.status === 'booked')
    const pending    = (trip.bookings || []).filter(b => b.status !== 'booked')
    const allBooks   = (trip.bookings || [])
    const categories = (trip.budget || []).filter(b => b.max > 0).sort((a, b) => b.max - a.max).slice(0, 5)
    const sym        = CURRENCY_SYMBOLS[trip.currency] || trip.currency || '$'

    return (
        <div className="grid h-full grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] overflow-hidden">
            <div className="flex h-full flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-border bg-bg-primary px-6 py-6 md:px-8 md:py-8 overflow-hidden">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-text-muted">Budget & Bookings</p>
                        <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tighter text-text-primary leading-tight">
                            Status check
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="relative bg-bg-secondary rounded-[var(--radius-lg)] p-4 overflow-hidden">
                            <span className="absolute -bottom-3 -right-1 text-[72px] font-black text-accent/[0.08] leading-none select-none">{sym}</span>
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Per person</p>
                            <p className="font-heading text-4xl font-black tracking-tighter text-text-primary leading-none">
                                {total > 0 ? formatCurrency(perPerson, trip.currency) : '—'}
                            </p>
                            {total > 0 && (
                                <p className="text-xs text-text-muted mt-1.5">{formatCurrency(total, trip.currency)} total</p>
                            )}
                        </div>
                        <div className="bg-bg-secondary rounded-[var(--radius-lg)] p-4">
                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Confirmed</p>
                            <p className="font-heading text-4xl font-black tracking-tighter text-text-primary leading-none">
                                {confirmed.length}
                                <span className="text-xl text-text-muted font-bold">/{allBooks.length}</span>
                            </p>
                            {pending.length > 0
                                ? <p className="text-xs text-text-muted mt-1.5">{pending.length} still to book</p>
                                : allBooks.length > 0 && <p className="text-xs text-success mt-1.5 font-medium">All booked ✓</p>
                            }
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-card">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border flex items-end justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-text-muted">Spend Split</p>
                        <p className="text-sm text-text-muted mt-1">{categories.length > 0 ? 'What is taking the biggest share of the budget' : 'No budget categories yet'}</p>
                    </div>
                    {pending.length > 0 && (
                        <p className="text-xs font-medium text-text-muted whitespace-nowrap">{pending.length} pending</p>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-hide">
                    {categories.length > 0 ? (
                        <div className="space-y-3">
                            {categories.map(cat => {
                                const pct = total > 0 ? Math.round((cat.max / total) * 100) : 0
                                return (
                                    <div key={cat.id} className="rounded-[var(--radius-lg)] border border-border bg-bg-primary px-4 py-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm text-text-secondary font-semibold">{cat.emoji} {cat.name}</span>
                                            <span className="text-sm text-text-muted tabular-nums">{formatCurrency(cat.max, trip.currency)}</span>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-bg-secondary overflow-hidden">
                                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="flex h-full items-center justify-center text-center">
                            <p className="text-sm text-text-muted">Add a few budget categories to turn this into a clear spending story.</p>
                        </div>
                    )}
                </div>

                {confirmed.length > 0 && (
                    <div className="shrink-0 border-t border-border px-6 py-4">
                        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-text-muted mb-3">Booked</p>
                        <div className="flex flex-wrap gap-2">
                            {confirmed.slice(0, 6).map(b => {
                                const cat = getCategory(b.category)
                                return (
                                    <span key={b.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-pill)] bg-success/10 border border-success/20 text-success text-xs font-semibold">
                                        {cat.emoji} {b.name} ✓
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide 5 — Before We Go (packing ring + todos)
───────────────────────────────────────────────────────────── */
function PackingRing({ pct }) {
    const r = 36
    const circ   = 2 * Math.PI * r
    const offset = circ * (1 - (pct ?? 0) / 100)
    return (
        <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
            <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7" className="stroke-border" />
            <circle
                cx="44" cy="44" r={r} fill="none" strokeWidth="7"
                className="stroke-accent" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '44px 44px', transition: 'stroke-dashoffset 1.2s ease' }}
            />
            <text x="44" y="49" textAnchor="middle" fontSize="15" fontWeight="800"
                style={{ fontFamily: 'var(--font-heading)', fill: 'var(--color-text-primary)' }}>
                {pct != null ? `${pct}%` : '—'}
            </text>
        </svg>
    )
}

function SlideBeforeWeGo({ trip, caption, loadingCaption }) {
    const packing     = trip.packingList || []
    const packingPct  = packing.length ? Math.round((packing.filter(p => p.packed).length / packing.length) * 100) : null
    const openTodos   = (trip.todos || []).filter(t => !t.done)
    const sorted      = [...openTodos.filter(t => t.priority), ...openTodos.filter(t => !t.priority)]

    return (
        <div className="grid h-full grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] overflow-hidden">
            <div className="flex h-full flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-border bg-bg-primary px-6 py-6 md:px-8 md:py-8 overflow-hidden">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold tracking-[0.24em] uppercase text-text-muted">Before We Go</p>
                        <h2 className="font-heading text-3xl md:text-4xl font-black tracking-tighter text-text-primary leading-tight">
                            Final readiness
                        </h2>
                    </div>

                    {packing.length > 0 && (
                        <div className="flex items-center gap-5 bg-bg-secondary rounded-[var(--radius-lg)] p-4 shrink-0">
                            <PackingRing pct={packingPct} />
                            <div>
                                <p className="text-sm font-bold text-text-primary">🧳 Packing list</p>
                                <p className="text-xs text-text-muted mt-0.5">
                                    {packing.filter(p => p.packed).length} of {packing.length} items packed
                                </p>
                                {packingPct === 100 && (
                                    <p className="text-xs text-success font-semibold mt-1">All packed! 🎉</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="hidden lg:block">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-bg-card">
                <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border flex items-end justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-text-muted">Remaining tasks</p>
                        <p className="text-sm text-text-muted mt-1">
                            {openTodos.length > 0 ? `${openTodos.length} action${openTodos.length !== 1 ? 's' : ''} before departure` : 'Everything is ready to go'}
                        </p>
                    </div>
                </div>

                {openTodos.length > 0 ? (
                    <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4 space-y-2 min-h-0">
                        {sorted.slice(0, 7).map(todo => (
                            <div key={todo.id} className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-bg-primary border border-border">
                                {todo.priority && <span className="text-warning text-xs shrink-0">⚡</span>}
                                <p className="text-sm text-text-primary truncate flex-1">{todo.text}</p>
                            </div>
                        ))}
                        {openTodos.length > 7 && (
                            <p className="text-xs text-text-muted text-center pt-1">+ {openTodos.length - 7} more tasks</p>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center px-6 text-center">
                        <p className="text-text-muted text-sm">All clear — nothing pending! 🎉</p>
                    </div>
                )}

                <div className="shrink-0 border-t border-border px-6 py-4 lg:hidden">
                    <WandaCaption text={caption} loading={loadingCaption} />
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide meta
───────────────────────────────────────────────────────────── */
const SLIDES = [
    { id: 'cover',  label: 'Cover',            dark: true  },
    { id: 'map',    label: 'Route',             dark: true  },
    { id: 'plan',   label: 'The Plan',          dark: false },
    { id: 'status', label: 'Budget & Bookings', dark: false },
    { id: 'prep',   label: 'Before We Go',      dark: false },
]

/* ─────────────────────────────────────────────────────────────
   Main PresentationMode
───────────────────────────────────────────────────────────── */
export default function PresentationMode({ onClose }) {
    const { activeTrip }   = useTripContext()
    const travelerProfiles = useTripTravelers()

    const [slide,          setSlide]          = useState(0)
    const [direction,      setDirection]      = useState(1)   // +1 forward, -1 back
    const [cityPhotos,     setCityPhotos]     = useState({})
    const [mapUrl,         setMapUrl]         = useState(null)
    const [captions,       setCaptions]       = useState(null)
    const [loadingCaps,    setLoadingCaps]    = useState(true)
    const [isExporting,    setIsExporting]    = useState(false)
    const exportRef = useMemo(() => ({ current: null }), [])

    if (!activeTrip) return null
    const trip = activeTrip

    /* ── Asset loading on mount ── */
    useEffect(() => {
        if (!trip?.id) return
        let cancelled = false

        const destinations = trip.destinations || []
        const cities = [...new Set(destinations.map(d => d.city).filter(Boolean))]

        // Fetch city photos in parallel (Wikipedia, free)
        if (cities.length) {
            Promise.all(cities.map(async city => [city, await fetchCityPhoto(city)]))
                .then(pairs => {
                    if (!cancelled) setCityPhotos(Object.fromEntries(pairs.filter(([, u]) => u)))
                })
        }

        // Build Mapbox route map URL (geocodes cities, then assembles URL)
        buildMapboxUrl(destinations).then(url => { if (!cancelled) setMapUrl(url) })

        // Generate Wanda captions
        generateCaptions(trip)
            .then(c  => { if (!cancelled) setCaptions(c) })
            .catch(e => { console.warn('[PresentationMode] Caption error:', e) })
            .finally(() => { if (!cancelled) setLoadingCaps(false) })

        return () => { cancelled = true }
    }, [trip?.id])

    /* ── Navigation ── */
    const goTo = useCallback((i) => {
        const next = Math.max(0, Math.min(SLIDES.length - 1, i))
        setDirection(next > slide ? 1 : -1)
        setSlide(next)
    }, [slide])

    useEffect(() => {
        const onKey = e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(slide + 1)
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(slide - 1)
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [slide, goTo, onClose])

    /* ── Export ── */
    const handleExport = async () => {
        if (isExporting || !exportRef.current) return
        setIsExporting(true)
        try {
            await new Promise(r => setTimeout(r, 100))
            const canvas = await html2canvas(exportRef.current, {
                scale: 2, useCORS: true, backgroundColor: null, logging: false,
                width: PRESENTATION_EXPORT.width, height: PRESENTATION_EXPORT.height,
            })
            const link = document.createElement('a')
            link.download = `${(trip.name || 'Trip').replace(/\s+/g, '-')}-Brief-16x9.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (e) {
            console.error('[PresentationMode] Export error:', e)
        } finally {
            setIsExporting(false)
        }
    }

    const isDark = SLIDES[slide].dark
    const primaryCity = (trip.destinations || [])[0]?.city
    const coverPhoto  = primaryCity ? cityPhotos[primaryCity] : null

    /* ── Render ── */
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[radial-gradient(circle_at_top,rgba(217,119,87,0.08),transparent_42%),linear-gradient(180deg,var(--color-bg-secondary),var(--color-bg-primary))]">
            <style>{`
                @keyframes pres-fwd { from { opacity:0; transform:translateX(28px) } to { opacity:1; transform:translateX(0) } }
                @keyframes pres-bwd { from { opacity:0; transform:translateX(-28px) } to { opacity:1; transform:translateX(0) } }
            `}</style>

            {/* ── Top bar ── */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary/90 backdrop-blur-sm relative z-20">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-sm font-medium transition-colors min-w-[44px] min-h-[44px] text-text-muted hover:text-text-primary"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    <span className="hidden sm:inline">Close</span>
                </button>

                <span className="text-sm font-semibold transition-colors duration-300 text-text-secondary">
                    {SLIDES[slide].label}
                </span>

                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="text-sm font-semibold transition-colors min-h-[44px] flex items-center disabled:opacity-50 text-accent hover:text-accent/80"
                >
                    {isExporting ? '📸 Saving…' : '📸 Save'}
                </button>
            </div>

            {/* ── Slide area ── */}
            <div className="flex-1 min-h-0 px-4 pb-4 pt-3 md:px-6 md:pb-6">
                <div className="mx-auto flex h-full w-full max-w-[1520px] items-center justify-center">
                    <div
                        key={slide}
                        className="relative w-full overflow-hidden rounded-[28px] border border-border bg-bg-card shadow-none"
                        style={{
                            aspectRatio: '16 / 9',
                            animation: `${direction > 0 ? 'pres-fwd' : 'pres-bwd'} 0.3s cubic-bezier(0.2,0,0,1) both`,
                        }}
                    >
                        {slide === 0 && <SlideCover      trip={trip} travelerProfiles={travelerProfiles} coverPhoto={coverPhoto} caption={captions?.cover} loadingCaption={loadingCaps} />}
                        {slide === 1 && <SlideMap        trip={trip} mapUrl={mapUrl} caption={captions?.map} loadingCaption={loadingCaps} />}
                        {slide === 2 && <SlideItinerary  trip={trip} cityPhotos={cityPhotos} caption={captions?.plan} loadingCaption={loadingCaps} />}
                        {slide === 3 && <SlideStatus     trip={trip} caption={captions?.status} loadingCaption={loadingCaps} />}
                        {slide === 4 && <SlideBeforeWeGo trip={trip} caption={captions?.prep}   loadingCaption={loadingCaps} />}
                    </div>
                </div>

                {/* Side arrows */}
                {slide > 0 && (
                    <button
                        onClick={() => goTo(slide - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 bg-bg-card/95 border border-border text-text-primary hover:bg-bg-hover shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                )}
                {slide < SLIDES.length - 1 && (
                    <button
                        onClick={() => goTo(slide + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 bg-bg-card/95 border border-border text-text-primary hover:bg-bg-hover shadow-sm"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                )}
            </div>

            {/* ── Bottom dot nav ── */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-5 pb-4 pt-1 md:px-6 md:pb-6">
                <div className="flex items-center gap-2.5">
                    {SLIDES.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => goTo(i)}
                            className={`rounded-full transition-all duration-200 ${
                                i === slide ? 'w-7 h-2 bg-accent' : 'w-2 h-2 bg-border hover:bg-text-muted'
                            }`}
                            aria-label={`Go to ${s.label}`}
                        />
                    ))}
                </div>
                <span className="text-xs text-text-muted tabular-nums">{slide + 1} / {SLIDES.length}</span>
            </div>

            {/* ── Hidden export canvas (landscape summary slide) ── */}
            <ExportCanvas
                containerRef={el => exportRef.current = el}
                trip={trip}
                travelerProfiles={travelerProfiles}
                coverPhoto={coverPhoto}
                captions={captions}
                itinerary={[...(trip.itinerary || [])].sort((a, b) => a.dayNumber - b.dayNumber)}
                confirmedBookings={(trip.bookings || []).filter(b => b.status === 'booked')}
                budgetInfo={getBudgetInfo(trip)}
            />
        </div>,
        document.body
    )
}

/* ─────────────────────────────────────────────────────────────
   Export Canvas — 1920×1080, inline styles only
   (html2canvas cannot read CSS custom properties)
───────────────────────────────────────────────────────────── */
function ExportCanvas({ containerRef, trip, coverPhoto, captions, itinerary, confirmedBookings, budgetInfo }) {
    const route        = (trip.destinations || []).map(d => [d.flag, d.city].filter(Boolean).join(' ')).join(' → ')
    const countdownLbl = getCountdownLabel(trip.startDate)
    const { total, perPerson } = budgetInfo
    const packing      = trip.packingList || []
    const packingPct   = packing.length ? Math.round((packing.filter(p => p.packed).length / packing.length) * 100) : null

    const BG   = '#F4F2EF'
    const ACC  = '#D97757'
    const TXT  = '#1A1A18'
    const MUTE = '#9B9A93'

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', left: '-9999px', top: '-9999px',
                width: `${PRESENTATION_EXPORT.width}px`, height: `${PRESENTATION_EXPORT.height}px`,
                backgroundColor: BG, color: TXT,
                fontFamily: '"Anthropic Sans", Arial, sans-serif',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden', boxSizing: 'border-box',
            }}
        >
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '32px', padding: '40px 48px 32px' }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '28px', minHeight: 0 }}>
                    {coverPhoto && (
                        <img src={coverPhoto} crossOrigin="anonymous"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.48) 50%, rgba(0,0,0,0.8) 100%)' }} />

                    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px' }}>
                        <div style={{ maxWidth: '760px' }}>
                            <div style={{ fontSize: '76px', lineHeight: 1 }}>{trip.emoji || '✈️'}</div>
                            <h1 style={{ fontSize: '74px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.98, color: '#FFFFFF', margin: '14px 0 0' }}>
                                {trip.name}
                            </h1>
                            <div style={{ marginTop: '18px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                {route && (
                                    <p style={{ fontSize: '24px', color: 'rgba(255,255,255,0.78)', margin: 0 }}>{route}</p>
                                )}
                                <span style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: 'rgba(255,255,255,0.4)' }} />
                                <p style={{ fontSize: '21px', color: 'rgba(255,255,255,0.58)', margin: 0 }}>
                                    {formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}
                                    {trip.travelers > 1 && ` · ${trip.travelers} travelers`}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                            {countdownLbl && (
                                <div style={{ backgroundColor: ACC, color: '#FFF', fontSize: '20px', fontWeight: 700, padding: '10px 22px', borderRadius: '999px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                    {countdownLbl}
                                </div>
                            )}
                            {captions?.cover && (
                                <div style={{ display: 'flex', gap: '12px', flex: '1 1 360px', minWidth: '320px', padding: '16px 18px', borderRadius: '16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                                    <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: '18px', flexShrink: 0 }}>✦</span>
                                    <p style={{ fontSize: '20px', fontStyle: 'italic', color: 'rgba(255,255,255,0.84)', margin: 0, lineHeight: 1.42 }}>{captions.cover}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minHeight: 0 }}>
                    <div style={{ padding: '28px', background: '#FFFFFF', border: '1px solid #E0DDD6', borderRadius: '20px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTE, margin: 0 }}>At A Glance</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '18px' }}>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: MUTE, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Destinations</p>
                                <p style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.04em', margin: '8px 0 0', color: TXT, lineHeight: 1 }}>
                                    {(trip.destinations || []).length || '—'}
                                </p>
                            </div>
                            <div>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: MUTE, margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Travelers</p>
                                <p style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.04em', margin: '8px 0 0', color: TXT, lineHeight: 1 }}>
                                    {trip.travelers || 1}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: '28px', background: '#FFFFFF', border: '1px solid #E0DDD6', borderRadius: '20px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTE, margin: 0 }}>The Plan</p>
                        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
                            {itinerary.length > 0 ? itinerary.slice(0, 5).map(day => (
                                <div key={day.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '14px', alignItems: 'start', paddingBottom: '12px', borderBottom: '1px solid #E0DDD6' }}>
                                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(26,26,24,0.18)', textAlign: 'right', flexShrink: 0 }}>
                                        {String(day.dayNumber).padStart(2, '0')}
                                    </span>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                            <span style={{ fontSize: '18px', lineHeight: 1 }}>{day.emoji || '📍'}</span>
                                            <span style={{ fontSize: '22px', fontWeight: 700, color: TXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {day.location || 'TBA'}
                                            </span>
                                        </div>
                                        {(day.activities || []).slice(0, 2).map(a => a.name).filter(Boolean).length > 0 && (
                                            <p style={{ fontSize: '16px', color: MUTE, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {(day.activities || []).slice(0, 2).map(a => a.name).filter(Boolean).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <p style={{ fontSize: '18px', color: MUTE, margin: '4px 0 0' }}>No itinerary added yet.</p>
                            )}
                        </div>
                        {itinerary.length > 5 && <p style={{ fontSize: '16px', color: MUTE, margin: '14px 0 0' }}>+ {itinerary.length - 5} more days</p>}
                    </div>

                    <div style={{ padding: '24px 28px', background: '#FFFFFF', border: '1px solid #E0DDD6', borderRadius: '20px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTE, margin: 0 }}>Status</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                            <div>
                                <p style={{ fontSize: '13px', color: MUTE, margin: 0 }}>Budget per person</p>
                                <p style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em', margin: '8px 0 0', lineHeight: 1 }}>
                                    {total > 0 ? formatCurrency(perPerson, trip.currency) : '—'}
                                </p>
                            </div>
                            <div>
                                <p style={{ fontSize: '13px', color: MUTE, margin: 0 }}>Bookings confirmed</p>
                                <p style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.04em', margin: '8px 0 0', lineHeight: 1 }}>
                                    {confirmedBookings.length}<span style={{ fontSize: '20px', color: MUTE }}>/{trip.bookings?.length || 0}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {packingPct !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px 28px', background: '#FFFFFF', border: '1px solid #E0DDD6', borderRadius: '20px' }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: MUTE, margin: 0 }}>Packing</p>
                            <div style={{ flex: 1, height: '10px', borderRadius: '999px', background: '#E0DDD6', overflow: 'hidden' }}>
                                <div style={{ width: `${packingPct}%`, height: '100%', background: ACC, borderRadius: '999px' }} />
                            </div>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: ACC, margin: 0 }}>{packingPct}%</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
