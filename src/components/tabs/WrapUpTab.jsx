import { useMemo, useState, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { formatCurrency, haversineDistance, geocodeCity } from '../../utils/helpers'
import { ACTIONS } from '../../state/tripReducer'
import { useProfiles } from '../../context/ProfileContext'
import Button from '../shared/Button'

const VIBE_TAGS = [
    { label: 'Surf & Chill', emoji: '🏄' },
    { label: 'Foodie', emoji: '🍜' },
    { label: 'Café Hopping', emoji: '☕' },
    { label: 'Adventure', emoji: '🧗' },
    { label: 'Cultural', emoji: '🏛️' },
    { label: 'Roadtrip', emoji: '🚗' },
    { label: 'Budget', emoji: '💸' },
    { label: 'Luxury', emoji: '✨' },
    { label: 'Nature', emoji: '🌿' },
    { label: 'Party', emoji: '🎉' },
]

// Reference flight routes for relatable KM context
const REFERENCE_ROUTES = [
    { km: 110,  label: 'CEB → ILO' },
    { km: 300,  label: 'MNL → TAC' },
    { km: 570,  label: 'MNL → CEB' },
    { km: 950,  label: 'MNL → KIX' },
    { km: 1150, label: 'MNL → HKG' },
    { km: 1550, label: 'MNL → NRT' },
    { km: 2400, label: 'MNL → SGP' },
    { km: 3000, label: 'SGP → BKK' },
    { km: 5000, label: 'SGP → DXB' },
]

function getRelatableRoute(km) {
    if (!km || km < 50) return null
    const closest = REFERENCE_ROUTES.reduce((best, r) =>
        Math.abs(r.km - km) < Math.abs(best.km - km) ? r : best
    )
    return `≈ ${closest.label}`
}

function getPaceLabel(stopsPerDay) {
    if (stopsPerDay >= 6) return 'Marathon'
    if (stopsPerDay >= 4) return 'High Energy'
    if (stopsPerDay >= 2) return 'Well-Balanced'
    return 'Easy Pace'
}

/* ─────────────────────────────────────────────────────────────
   Distance Hook
───────────────────────────────────────────────────────────── */
function useRouteDistance(destinations) {
    const [km, setKm] = useState(null)
    useEffect(() => {
        let active = true
        if (!destinations || destinations.length < 2) { setKm(0); return }
        const uniq = [...new Map(destinations.map(d => [d.city, d])).values()]
        ;(async () => {
            const coords = await Promise.all(uniq.map(d => geocodeCity(d.city, d.country || null)))
            if (!active) return
            let dist = 0
            for (let i = 0; i < coords.length - 1; i++) {
                if (coords[i] && coords[i + 1])
                    dist += haversineDistance(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
            }
            setKm(Math.round(dist))
        })()
        return () => { active = false }
    }, [destinations])
    return km
}

/* ─────────────────────────────────────────────────────────────
   Main WrapUpTab
───────────────────────────────────────────────────────────── */
export default function WrapUpTab() {
    const { activeTrip, dispatch, showToast } = useTripContext()
    const { currentUserProfile } = useProfiles()

    if (!activeTrip) return null
    const trip = activeTrip

    const km = useRouteDistance(trip.destinations)

    const stats = useMemo(() => {
        const itinerary = trip.itinerary || []
        const totalDays = itinerary.length
        const totalActivities = itinerary.flatMap(d => d.activities || []).length
        const safeDays = totalDays || 1
        const stopsPerDay = totalActivities / safeDays

        const budget = trip.budget || []
        const budgetMax = budget.reduce((s, b) => s + (b.max || 0), 0)
        const totalSpent = budget.reduce((s, b) => s + (b.actual || 0), 0)
        const costPerDay = totalSpent > 0 ? Math.round(totalSpent / safeDays) : 0

        let budgetSub = 'no budget set'
        if (budgetMax > 0) {
            const delta = ((budgetMax - totalSpent) / budgetMax) * 100
            const absDelta = Math.abs(Math.round(delta))
            budgetSub = delta >= 0 ? `${absDelta}% under budget` : `${absDelta}% over budget`
        }

        return {
            totalDays, totalActivities, stopsPerDay,
            costPerDay, budgetSub, totalSpent,
        }
    }, [trip])

    const handleRating = (r) => {
        dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { rating: trip.rating === r ? 0 : r } } })
    }

    const handleVibe = (label) => {
        const vibes = trip.vibes || []
        const next = vibes.includes(label) ? vibes.filter(v => v !== label) : [...vibes, label]
        dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { vibes: next } } })
    }

    const handleUseAsTemplate = () => {
        dispatch({
            type: ACTIONS.DUPLICATE_AS_TEMPLATE,
            payload: { tripId: trip.id, profileId: currentUserProfile?.id, uid: currentUserProfile?.uid }
        })
        showToast('✈️ Template created — dates & expenses stripped', 'success')
    }

    const handleWandaRecap = () => {
        const cities = trip.destinations?.map(d => d.city).join(', ') || trip.name
        window.dispatchEvent(new CustomEvent('wanda-prefill', {
            detail: {
                text: `Write a short travel recap for my ${trip.name} trip to ${cities} — highlight the best moments, what I spent, and what I'd do differently. Make it feel like a travel journal entry.`
            }
        }))
    }

    const relatableKm = getRelatableRoute(km)
    const paceLabel = getPaceLabel(stats.stopsPerDay)

    return (
        <div className="flex flex-col items-center text-center p-6 space-y-12 animate-fade-in pb-24 max-w-4xl mx-auto">
            
            {/* 1. Hero Section */}
            <div className="space-y-4">
                <div className="text-8xl animate-fade-in">{trip.emoji || '🎉'}</div>
                <h1 className="font-heading text-5xl font-bold tracking-tighter text-text-primary uppercase leading-tight">
                    {trip.name}
                </h1>

                {/* Star Rating */}
                <div className="flex items-center justify-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => handleRating(n)}
                            className="text-3xl transition-transform hover:scale-110 active:scale-95"
                        >
                            <span className={n <= (trip.rating || 0) ? 'text-yellow-400' : 'text-text-muted/20'}>★</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. Vibes Section (Simple pills, no header) */}
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl px-4">
                {VIBE_TAGS.map(({ label, emoji }) => {
                    const active = (trip.vibes || []).includes(label)
                    return (
                        <button
                            key={label}
                            onClick={() => handleVibe(label)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-pill)] text-xs font-semibold transition-all ${
                                active
                                    ? 'bg-accent text-white border border-transparent'
                                    : 'bg-bg-secondary text-text-secondary border border-border hover:border-accent/40 hover:text-accent'
                            }`}
                        >
                            <span>{emoji}</span> {label}
                        </button>
                    )
                })}
            </div>

            {/* 3. The "Word Cloud" Summary (Paragraph style) */}
            <div className="text-2xl sm:text-4xl font-semibold leading-relaxed tracking-tight max-w-3xl text-text-primary">
                🏃 {stats.stopsPerDay.toFixed(1)} stops/day that's {paceLabel} — {stats.totalActivities} total activities. 
                {" "}💰 {formatCurrency(stats.costPerDay, trip.currency)}/day — {stats.budgetSub}.
                {km !== null && km > 0 && (
                  <>
                    {" "}✈️ {km.toLocaleString()} km traveled, equivalent to {relatableKm}.
                  </>
                )}
            </div>

            {/* 4. The CTAs */}
            <div className="flex items-center justify-center gap-4 pt-6 w-full">
                <Button 
                    variant="secondary"
                    size="sm"
                    onClick={handleUseAsTemplate}
                    className="font-bold uppercase tracking-tight"
                >
                    📋 Clone Itinerary
                </Button>
                <Button 
                    variant="primary"
                    size="sm"
                    onClick={handleWandaRecap}
                    className="font-bold uppercase tracking-tight"
                >
                    🪄 Wanda Recap
                </Button>
            </div>

        </div>
    )
}
