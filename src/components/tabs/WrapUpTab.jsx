import { useMemo, useState, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { formatCurrency, formatDate, haversineDistance, geocodeCity } from '../../utils/helpers'
import { ACTIONS } from '../../state/tripReducer'
import { useProfiles } from '../../context/ProfileContext'

const VIBE_TAGS = [
    { label: 'Relaxing', emoji: '🌊' },
    { label: 'Foodie', emoji: '🍜' },
    { label: 'Adventure', emoji: '🧗' },
    { label: 'Cultural', emoji: '🏛️' },
    { label: 'Budget', emoji: '💸' },
    { label: 'Luxury', emoji: '✨' },
    { label: 'Weekend', emoji: '📅' },
    { label: 'High Energy', emoji: '⚡' },
]

const BAR_COLORS = ['#e07b54', '#22c55e', '#f59e0b', '#8b5cf6', '#64748b']

/* ─────────────────────────────────────────────────────────────
   Stat Card — one bento tile
───────────────────────────────────────────────────────────── */
function StatCard({ emoji, label, value, sub, color = 'default' }) {
    const wrapperStyles = {
        default: 'border-border bg-bg-card',
        success: 'border-success/30 bg-success/5',
        danger: 'border-danger/30 bg-danger/5',
        accent: 'border-accent/30 bg-accent/5',
    }
    const valueStyles = {
        default: 'text-text-primary',
        success: 'text-success',
        danger: 'text-danger',
        accent: 'text-accent',
    }
    return (
        <div className={`rounded-[var(--radius-lg)] border p-4 flex flex-col gap-2 ${wrapperStyles[color] || wrapperStyles.default}`}>
            <span className="text-2xl leading-none">{emoji}</span>
            <div>
                <p className={`font-heading text-2xl font-semibold leading-tight ${valueStyles[color] || valueStyles.default}`}>
                    {value}
                </p>
                {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
            </div>
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mt-auto">{label}</p>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Distance Hook — async haversine from geocoded cities
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

    const stats = useMemo(() => {
        const itinerary = trip.itinerary || []
        const totalDays = itinerary.length
        const totalActivities = itinerary.flatMap(d => d.activities || []).length

        const todos = trip.todos || []
        const doneTodos = todos.filter(t => t.done).length
        const unfinishedTodos = todos.filter(t => !t.done).slice(0, 3)
        const totalUnfinished = todos.filter(t => !t.done).length
        const todoPct = todos.length > 0 ? Math.round((doneTodos / todos.length) * 100) : 100

        const budget = trip.budget || []
        const budgetMax = budget.reduce((s, b) => s + (b.max || 0), 0)
        const totalSpent = budget.reduce((s, b) => s + (b.actual || 0), 0)
        const safeDays = totalDays || 1
        const costPerDay = totalSpent > 0 ? formatCurrency(Math.round(totalSpent / safeDays), trip.currency) : null

        let budgetColor = 'default'
        let budgetLabel = null
        if (budgetMax > 0) {
            const delta = ((budgetMax - totalSpent) / budgetMax) * 100
            const absDelta = Math.abs(Math.round(delta))
            budgetLabel = delta >= 0 ? `${absDelta}% under budget` : `${absDelta}% over budget 😬`
            budgetColor = delta >= 0 ? 'success' : 'danger'
        }

        // Top spending categories for breakdown bar
        const spentCats = budget
            .filter(b => (b.actual || 0) > 0)
            .sort((a, b) => (b.actual || 0) - (a.actual || 0))
            .slice(0, 4)

        // Group's favourite
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
                if (winner) favourite = { title: winner.title, emoji: winner.emoji }
            }
        }

        const countries = [...new Set((trip.destinations || []).map(d => d.flag).filter(Boolean))]

        return {
            totalDays, totalActivities,
            todoPct, doneTodos, todos: todos.length, unfinishedTodos, totalUnfinished,
            budgetLabel, budgetColor, totalSpent, costPerDay, spentCats,
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

    const firstCity = trip.destinations?.[0]?.city
    const lastCity = trip.destinations?.[trip.destinations?.length - 1]?.city
    const kmSub = firstCity && lastCity && firstCity !== lastCity
        ? `${firstCity} → ${lastCity}`
        : 'estimated route'

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            {/* Hero */}
            <div className="text-center py-6">
                <div className="text-5xl mb-4 animate-pulse-warm">🎉</div>
                <h1 className="font-heading text-3xl font-semibold text-text-primary">{trip.name}</h1>
                <p className="text-sm text-text-muted mt-2">
                    {effectiveStatus === 'archived' ? '📁 Archived memory' : '📖 Completed trip'}
                </p>

                {/* Star Rating */}
                <div className="flex items-center justify-center gap-0.5 mt-4">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => handleRating(n)}
                            className="text-2xl leading-none px-1 transition-transform hover:scale-125 active:scale-95"
                        >
                            <span className={n <= (trip.rating || 0) ? 'text-yellow-400' : 'text-text-muted/40'}>★</span>
                        </button>
                    ))}
                </div>
                {!trip.rating && (
                    <p className="text-xs text-text-muted mt-1">Rate this trip</p>
                )}

                {/* Vibe Tags */}
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {VIBE_TAGS.map(({ label, emoji }) => {
                        const active = (trip.vibes || []).includes(label)
                        return (
                            <button
                                key={label}
                                onClick={() => handleVibe(label)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
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

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                    emoji="🗓️" label="Days" value={stats.totalDays}
                    sub={trip.startDate && trip.endDate ? `${formatDate(trip.startDate)} → ${formatDate(trip.endDate)}` : null}
                />
                <StatCard emoji="📍" label="Activities" value={stats.totalActivities} sub={`across ${stats.totalDays} days`} />
                {stats.countries.length > 0 && (
                    <StatCard emoji={stats.countries[0]} label="Countries" value={stats.countries.length} sub={stats.countries.join('  ')} />
                )}
                {stats.todoPct === 100 && stats.todos > 0 && (
                    <StatCard emoji="✅" label="Tasks" value="100%" sub="All done!" color="success" />
                )}
                {stats.budgetLabel && (
                    <StatCard
                        emoji="💰" label="Budget"
                        value={formatCurrency(stats.totalSpent, trip.currency)}
                        sub={`${stats.budgetLabel}${stats.costPerDay ? ` · ${stats.costPerDay}/day` : ''}`}
                        color={stats.budgetColor}
                    />
                )}
                {km !== null && km > 0 && (
                    <StatCard emoji="✈️" label="KM Travelled" value={`${km.toLocaleString()} km`} sub={kmSub} />
                )}
            </div>

            {/* Unfinished Business */}
            {stats.unfinishedTodos.length > 0 && (
                <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card p-4">
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-3">
                        📌 Unfinished Business — try next time
                    </p>
                    <div className="flex flex-col gap-1.5">
                        {stats.unfinishedTodos.map(t => (
                            <p key={t.id} className="text-sm text-text-secondary flex items-start gap-2">
                                <span className="mt-0.5 text-text-muted shrink-0">·</span>
                                <span>{t.text}</span>
                            </p>
                        ))}
                        {stats.totalUnfinished > 3 && (
                            <p className="text-xs text-text-muted mt-1 pl-4">+{stats.totalUnfinished - 3} more</p>
                        )}
                    </div>
                </div>
            )}

            {/* Budget Breakdown */}
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

            {/* Group's Favourite */}
            {stats.favourite && (
                <div className="rounded-[var(--radius-lg)] border border-success/30 bg-success/5 p-4">
                    <p className="text-[10px] font-semibold text-success uppercase tracking-widest mb-2">🏆 Group's Favourite</p>
                    <p className="text-base font-semibold text-text-primary">
                        {stats.favourite.emoji && <span className="mr-2">{stats.favourite.emoji}</span>}
                        {stats.favourite.title || stats.favourite.name}
                    </p>
                </div>
            )}

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={handleUseAsTemplate}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-[var(--radius-md)] bg-accent text-white hover:bg-accent-hover active:scale-[0.98] transition-all"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Use as Template
                </button>
                <button
                    onClick={handleWandaRecap}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-[var(--radius-md)] border border-accent/30 text-accent hover:bg-accent/5 active:scale-[0.98] transition-all"
                >
                    🪄 <span className="wanda-serif">Wanda</span> Recap
                </button>
                {effectiveStatus === 'archived' && (
                    <button
                        onClick={handleUnarchive}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium rounded-[var(--radius-md)] border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                    >
                        Restore Trip
                    </button>
                )}
            </div>
        </div>
    )
}
