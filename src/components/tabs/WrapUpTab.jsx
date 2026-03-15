import { useMemo, useState, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { formatCurrency, formatDate, haversineDistance, geocodeCity } from '../../utils/helpers'
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

const BAR_COLORS = ['#e07b54', '#22c55e', '#f59e0b', '#8b5cf6', '#64748b']

/* ─────────────────────────────────────────────────────────────
   Stat Card
───────────────────────────────────────────────────────────── */
function StatCard({ emoji, label, value, valueSuffix, sub, subColor, color = 'default' }) {
    const wrapperStyles = {
        default: 'border-border bg-bg-card',
        success: 'border-success/30 bg-success/5',
        danger:  'border-danger/30 bg-danger/5',
        accent:  'border-accent/30 bg-accent/5',
    }
    const valueStyles = {
        default: 'text-text-primary',
        success: 'text-success',
        danger:  'text-danger',
        accent:  'text-accent',
    }
    const subColorStyles = {
        success: 'text-success',
        danger:  'text-danger',
        muted:   'text-text-muted',
    }
    return (
        <div className={`rounded-[var(--radius-lg)] border p-4 flex flex-col gap-2 ${wrapperStyles[color] || wrapperStyles.default}`}>
            <span className="text-xl leading-none">{emoji}</span>
            <div>
                <p className={`font-heading text-2xl font-semibold leading-tight ${valueStyles[color] || valueStyles.default}`}>
                    {value}{valueSuffix && <span className="text-sm font-normal text-text-muted ml-1">{valueSuffix}</span>}
                </p>
                {sub && (
                    <p className={`text-xs mt-0.5 ${subColorStyles[subColor] || 'text-text-muted'}`}>{sub}</p>
                )}
            </div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-auto">{label}</p>
        </div>
    )
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
    const { activeTrip, dispatch, showToast, effectiveStatus } = useTripContext()
    const { currentUserProfile } = useProfiles()

    if (!activeTrip) return null
    const trip = activeTrip

    const km = useRouteDistance(trip.destinations)

    // Editable unfinished note — syncs when trip changes
    const [unfinishedNote, setUnfinishedNote] = useState(trip.unfinishedNote || '')
    useEffect(() => { setUnfinishedNote(trip.unfinishedNote || '') }, [trip.id])
    const handleNoteSave = () => {
        if (unfinishedNote !== (trip.unfinishedNote || '')) {
            dispatch({ type: ACTIONS.UPDATE_TRIP, payload: { id: trip.id, updates: { unfinishedNote } } })
        }
    }

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

        let budgetSubColor = 'muted'
        let budgetSub = null
        if (budgetMax > 0) {
            const delta = ((budgetMax - totalSpent) / budgetMax) * 100
            const absDelta = Math.abs(Math.round(delta))
            budgetSub = delta >= 0 ? `${absDelta}% under total budget` : `${absDelta}% over total budget`
            budgetSubColor = delta >= 0 ? 'success' : 'danger'
        }

        // Top spending categories
        const spentCats = budget
            .filter(b => (b.actual || 0) > 0)
            .sort((a, b) => (b.actual || 0) - (a.actual || 0))
            .slice(0, 4)

        // Group's favourite (MVP)
        const ideas = trip.ideas || []
        let favourite = null
        if (ideas.length > 0) {
            const ranked = ideas.map(idea => ({
                ...idea,
                score: Object.values(idea.votes || {}).reduce((s, v) => s + v, 0),
            })).sort((a, b) => b.score - a.score)
            if (ranked[0]?.score > 0) favourite = ranked[0]
        }
        if (!favourite) {
            const resolved = (trip.polls || []).filter(p => p.status === 'resolved')
            if (resolved.length > 0) {
                const poll = resolved[0]
                const winner = (poll.options || []).map(opt => ({
                    ...opt,
                    score: Object.values(poll.votes || {}).reduce((s, uv) => s + ((uv.tokens || {})[opt.id] || 0), 0),
                })).sort((a, b) => b.score - a.score)[0]
                if (winner) favourite = { title: winner.title, emoji: winner.emoji, description: winner.description }
            }
        }

        const countries = [...new Set((trip.destinations || []).map(d => d.flag).filter(Boolean))]

        return {
            totalDays, totalActivities, stopsPerDay,
            costPerDay, budgetSub, budgetSubColor, totalSpent, spentCats,
            favourite, countries,
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

    const handleUnarchive = () => {
        dispatch({ type: ACTIONS.UNARCHIVE_TRIP, payload: trip.id })
        showToast('Trip restored to active', 'success')
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
    const isArchived = effectiveStatus === 'archived'

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            {/* Hero */}
            <div className="text-center py-6">
                <div className="text-5xl mb-4 animate-pulse-warm">{trip.emoji || '🎉'}</div>
                <h1 className="font-heading text-3xl font-semibold text-text-primary">{trip.name}</h1>

                {/* Status badge + dates */}
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isArchived ? 'bg-bg-secondary text-text-muted' : 'bg-success/10 text-success'}`}>
                        {isArchived ? '📁' : '✓'} {isArchived ? 'Archived' : 'Trip Completed'}
                    </span>
                    {trip.startDate && trip.endDate && (
                        <span className="text-sm text-text-muted">
                            • {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
                        </span>
                    )}
                </div>

                {/* Star Rating */}
                <div className="flex items-center justify-center gap-0.5 mt-4">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => handleRating(n)}
                            className="text-2xl leading-none px-1 transition-transform hover:scale-125 active:scale-95"
                        >
                            <span className={n <= (trip.rating || 0) ? 'text-yellow-400' : 'text-text-muted/30'}>★</span>
                        </button>
                    ))}
                </div>
                {!trip.rating && <p className="text-xs text-text-muted mt-1">Rate this trip</p>}

                {/* Hero CTAs */}
                <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                    <Button variant="primary" size="sm" onClick={handleUseAsTemplate}>
                        📋 Clone Itinerary
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleWandaRecap}>
                        🪄 <span className="wanda-serif">Wanda</span> Recap
                    </Button>
                </div>
            </div>

            {/* Stats row — Trip Pace · Daily Average · Distance */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                    emoji="🏃"
                    label="Trip Pace"
                    value={stats.stopsPerDay.toFixed(1)}
                    valueSuffix="stops/day"
                    sub={`"${paceLabel}" — ${stats.totalActivities} total activities`}
                />
                {stats.costPerDay > 0 ? (
                    <StatCard
                        emoji="💰"
                        label="Daily Average"
                        value={formatCurrency(stats.costPerDay, trip.currency)}
                        valueSuffix="/ day"
                        sub={stats.budgetSub}
                        subColor={stats.budgetSubColor}
                    />
                ) : null}
                {km !== null && km > 0 && (
                    <StatCard
                        emoji="✈️"
                        label="Distance"
                        value={`${km.toLocaleString()} km`}
                        sub={relatableKm ? `Equivalent to ${relatableKm}` : 'estimated route'}
                    />
                )}
                {stats.countries.length > 1 && (
                    <StatCard
                        emoji={stats.countries[0]}
                        label="Countries"
                        value={stats.countries.length}
                        sub={stats.countries.join('  ')}
                    />
                )}
            </div>

            {/* MVP + Vibe row */}
            <div className={`grid grid-cols-1 gap-3 ${stats.favourite ? 'sm:grid-cols-2' : ''}`}>
                {/* Trip MVP */}
                {stats.favourite ? (
                    <div className="rounded-[var(--radius-lg)] border border-success/30 bg-success/5 p-4">
                        <p className="text-[10px] font-semibold text-success uppercase tracking-widest mb-3">
                            Trip MVP 🏆
                        </p>
                        <div className="flex items-start gap-3">
                            {stats.favourite.imageUrl ? (
                                <img
                                    src={stats.favourite.imageUrl}
                                    alt={stats.favourite.title}
                                    className="w-16 h-16 rounded-[var(--radius-md)] object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-[var(--radius-md)] bg-bg-secondary flex items-center justify-center text-2xl shrink-0 border border-border">
                                    {stats.favourite.emoji || '🏆'}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-text-primary leading-snug">
                                    {stats.favourite.title || stats.favourite.name}
                                </p>
                                {stats.favourite.description && (
                                    <p className="text-xs text-text-muted mt-1 leading-relaxed italic">
                                        "{stats.favourite.description}"
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* The Vibe */}
                <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4 flex flex-col gap-4">
                    <div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2.5">The Vibe</p>
                        <div className="flex flex-wrap gap-1.5">
                            {VIBE_TAGS.map(({ label, emoji }) => {
                                const active = (trip.vibes || []).includes(label)
                                return (
                                    <button
                                        key={label}
                                        onClick={() => handleVibe(label)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                                            active
                                                ? 'bg-accent text-white border border-transparent'
                                                : 'bg-bg-secondary text-text-secondary border border-border hover:border-accent/40 hover:text-accent'
                                        }`}
                                    >
                                        {emoji} {label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5">Unfinished Business</p>
                        <textarea
                            value={unfinishedNote}
                            onChange={e => setUnfinishedNote(e.target.value)}
                            onBlur={handleNoteSave}
                            placeholder="What did you miss? Save for next time…"
                            rows={3}
                            className="w-full text-xs text-text-secondary bg-transparent border-none outline-none resize-none placeholder:text-text-muted/50 leading-relaxed"
                        />
                    </div>
                </div>
            </div>

            {/* Spend Breakdown */}
            {stats.spentCats.length > 1 && (
                <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-3">💳 Spend Breakdown</p>
                    <div className="flex h-2.5 rounded-full overflow-hidden gap-px mb-3">
                        {stats.spentCats.map((cat, i) => (
                            <div
                                key={cat.name}
                                style={{ flex: cat.actual, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                                className="opacity-80"
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {stats.spentCats.map((cat, i) => (
                            <div key={cat.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                                {cat.emoji ? `${cat.emoji} ` : ''}{cat.name} · {formatCurrency(cat.actual, trip.currency)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Restore Trip (archived only) */}
            {isArchived && (
                <button
                    onClick={handleUnarchive}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-[var(--radius-md)] border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                >
                    Restore Trip
                </button>
            )}
        </div>
    )
}
