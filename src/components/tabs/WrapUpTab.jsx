import { useMemo } from 'react'
import { useTripContext } from '../../context/TripContext'
import { formatCurrency } from '../../utils/helpers'
import { haversineDistance, geocodeCity } from '../../utils/helpers'
import { ACTIONS } from '../../state/tripReducer'
import { useState, useEffect } from 'react'

/* ─────────────────────────────────────────────────────────────
   Stat Card — one bento tile
───────────────────────────────────────────────────────────── */
function StatCard({ emoji, label, value, sub, accent = false, highlight = false }) {
    return (
        <div className={`rounded-[var(--radius-lg)] border p-4 flex flex-col gap-2
      ${highlight ? 'border-accent/30 bg-accent/5' : 'border-border bg-bg-card'}`}>
            <span className="text-2xl leading-none">{emoji}</span>
            <div>
                <p className={`font-heading text-2xl font-bold leading-tight
          ${accent ? 'text-accent' : 'text-text-primary'}`}>
                    {value}
                </p>
                {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
            </div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-auto">{label}</p>
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
            ; (async () => {
                const coords = await Promise.all(uniq.map(d => geocodeCity(d.city, d.country || null)))
                if (!active) return
                let dist = 0
                for (let i = 0; i < coords.length - 1; i++) {
                    if (coords[i] && coords[i + 1]) {
                        dist += haversineDistance(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])
                    }
                }
                setKm(Math.round(dist))
            })()
        return () => { active = false }
    }, [destinations])

    return km
}

import { useProfiles } from '../../context/ProfileContext'

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
        const allActivities = itinerary.flatMap(d => d.activities || [])
        const totalDays = itinerary.length
        const totalActivities = allActivities.length

        const todos = trip.todos || []
        const doneTodos = todos.filter(t => t.done).length
        const todoPct = todos.length > 0 ? Math.round((doneTodos / todos.length) * 100) : 100

        const budget = trip.budget || []
        const budgetMax = budget.reduce((s, b) => s + (b.max || 0), 0)
        const totalSpent = budget.reduce((s, b) => s + (b.actual || 0), 0)
        let budgetLabel = null
        let budgetHighlight = false
        if (budgetMax > 0) {
            const delta = ((budgetMax - totalSpent) / budgetMax) * 100
            const absDelta = Math.abs(Math.round(delta))
            if (delta >= 0) {
                budgetLabel = `${absDelta}% under budget`
                budgetHighlight = true
            } else {
                budgetLabel = `${absDelta}% over budget 😬`
            }
        }

        // Group's favourite: highest-voted idea
        const ideas = trip.ideas || []
        let favourite = null
        if (ideas.length > 0) {
            const ranked = ideas.map(idea => ({
                ...idea,
                score: Object.values(idea.votes || {}).reduce((s, v) => s + v, 0),
            })).sort((a, b) => b.score - a.score)
            if (ranked[0]?.score > 0) favourite = ranked[0]
        }
        // Fallback to resolved poll winner
        if (!favourite) {
            const resolved = (trip.polls || []).filter(p => p.status === 'resolved')
            if (resolved.length > 0) {
                const poll = resolved[0]
                const optionScores = (poll.options || []).map(opt => ({
                    ...opt,
                    score: Object.values(poll.votes || {}).reduce((s, uv) => s + ((uv.tokens || {})[opt.id] || 0), 0),
                })).sort((a, b) => b.score - a.score)
                if (optionScores[0]) favourite = { title: optionScores[0].title, emoji: optionScores[0].emoji }
            }
        }

        const countries = [...new Set((trip.destinations || []).map(d => d.flag).filter(Boolean))]

        return { totalDays, totalActivities, todoPct, doneTodos, todos: todos.length, budgetLabel, budgetHighlight, totalSpent, currency: trip.currency, favourite, countries }
    }, [trip])

    const handleUseAsTemplate = () => {
        dispatch({
            type: ACTIONS.DUPLICATE_AS_TEMPLATE,
            payload: {
                tripId: trip.id,
                profileId: currentUserProfile?.id,
                uid: currentUserProfile?.uid
            }
        })
        showToast('✈️ Template created — dates & expenses stripped', 'success')
    }

    const handleUnarchive = () => {
        dispatch({ type: ACTIONS.UNARCHIVE_TRIP, payload: trip.id })
        showToast('Trip restored to active', 'success')
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Hero */}
            <div className="text-center py-6">
                <div className="text-5xl mb-4 animate-pulse-warm">🎉</div>
                <h1 className="font-heading text-3xl font-bold text-text-primary">{trip.name}</h1>
                <p className="text-sm text-text-muted mt-2">
                    {effectiveStatus === 'archived' ? '📁 Archived memory' : '📖 Completed trip'}
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard emoji="🗓️" label="Days" value={stats.totalDays} sub={trip.startDate && trip.endDate ? `${trip.startDate} → ${trip.endDate}` : null} />
                <StatCard emoji="📍" label="Activities" value={stats.totalActivities} sub={`across ${stats.totalDays} days`} />
                {stats.countries.length > 0 && (
                    <StatCard emoji={stats.countries[0]} label="Countries" value={stats.countries.length} sub={stats.countries.join('  ')} />
                )}
                {stats.todoPct === 100 && (
                    <StatCard emoji="✅" label="Tasks" value="100%" sub="All done!" accent highlight />
                )}
                {stats.todoPct < 100 && stats.todos > 0 && (
                    <StatCard emoji="✅" label="Tasks Done" value={`${stats.todoPct}%`} sub={`${stats.doneTodos}/${stats.todos}`} />
                )}
                {stats.budgetLabel && (
                    <StatCard emoji="💰" label="Budget" value={formatCurrency(stats.totalSpent, stats.currency)} sub={stats.budgetLabel} accent={stats.budgetHighlight} highlight={stats.budgetHighlight} />
                )}
                {km !== null && km > 0 && (
                    <StatCard emoji="✈️" label="KM Travelled" value={`${km.toLocaleString()} km`} sub="estimated route" />
                )}
                {stats.favourite && (
                    <div className="col-span-2 sm:col-span-3 rounded-[var(--radius-lg)] border border-success/30 bg-success/5 p-4">
                        <p className="text-[10px] font-bold text-success uppercase tracking-widest mb-2">🏆 Group's Favourite</p>
                        <p className="text-base font-bold text-text-primary">
                            {stats.favourite.emoji && <span className="mr-2">{stats.favourite.emoji}</span>}
                            {stats.favourite.title || stats.favourite.name}
                        </p>
                    </div>
                )}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={handleUseAsTemplate}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-[var(--radius-md)] bg-accent text-white hover:bg-accent-hover active:scale-[0.98] transition-all"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    Use as Template
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
