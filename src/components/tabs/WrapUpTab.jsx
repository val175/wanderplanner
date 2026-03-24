import { useMemo, useState, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { formatCurrency, haversineDistance, geocodeCity, formatDateRange } from '../../utils/helpers'
import { ACTIONS } from '../../state/tripReducer'
import { useProfiles } from '../../context/ProfileContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import Button from '../shared/Button'
import AvatarCircle from '../shared/AvatarCircle'
import WandWordmark from '../shared/WandWordmark'
import html2canvas from 'html2canvas'

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
    if (stopsPerDay >= 6) return 'marathon'
    if (stopsPerDay >= 4) return 'high energy'
    if (stopsPerDay >= 2) return 'well-balanced'
    return 'easy pace'
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
    const { currentUserProfile, awardXp } = useProfiles()
    const travelerProfiles = useTripTravelers()
    const [isExporting, setIsExporting] = useState(false)
    const exportRef = useMemo(() => ({ current: null }), [])

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

    const handleMarkComplete = async () => {
        dispatch({ type: ACTIONS.ARCHIVE_TRIP, payload: trip.id })
        await awardXp?.('trip_completed', 100, { tripId: trip.id })
        showToast('🎉 Trip completed! +100 XP earned!', 'success')
    }

    const handleExportStory = async () => {
        if (isExporting || !exportRef.current) return
        setIsExporting(true)

        try {
            // Wait a tiny bit for any potential re-renders
            await new Promise(r => setTimeout(r, 100))

            const canvas = await html2canvas(exportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
                logging: false,
                width: 1080,
                height: 1920,
            })

            const link = document.createElement('a')
            link.download = `${trip.name.replace(/\s+/g, '-')}-WanderTrip-Story.png`
            link.href = canvas.toDataURL('image/png')
            link.click()

            showToast('📸 Story saved!', 'success')
        } catch (err) {
            console.error('[Export] Failed to generate story:', err)
            showToast('Failed to generate story', 'error')
        } finally {
            setIsExporting(false)
        }
    }

    const relatableKm = getRelatableRoute(km)
    const paceLabel = getPaceLabel(stats.stopsPerDay)

    return (
        <div className="flex flex-col items-center text-center p-6 space-y-12 animate-fade-in pb-24 max-w-4xl mx-auto">
            
            {/* 1. Hero Section */}
            <div className="space-y-4">
                <div className="text-8xl animate-fade-in">{trip.emoji || '🎉'}</div>
                <h1 className="font-heading text-5xl font-bold tracking-tighter text-text-primary leading-tight">
                    {trip.name}
                </h1>

                {/* Date & Travelers */}
                <div className="flex flex-col items-center gap-3">
                    <div className="text-sm font-medium text-text-muted flex items-center gap-2">
                        <span>{formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}</span>
                        {travelerProfiles.length > 0 && (
                            <>
                                <span className="opacity-30">•</span>
                                <div className="flex items-center -space-x-2">
                                    {travelerProfiles.map((p, i) => (
                                        <div key={p.id} className="border-2 border-bg-primary rounded-full overflow-hidden">
                                            <AvatarCircle profile={p} size={24} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

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
            </div>

            {/* 2. Vibes Section (Simple pills, no header) */}
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl px-4">
                {VIBE_TAGS.map(({ label, emoji }) => {
                    const active = (trip.vibes || []).includes(label)
                    return (
                        <button
                            key={label}
                            onClick={() => handleVibe(label)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold transition-all ${
                                active
                                    ? 'bg-accent text-text-inverse border border-transparent'
                                    : 'bg-bg-secondary text-text-secondary border border-border hover:border-accent/40 hover:text-accent'
                            }`}
                        >
                            <span>{emoji}</span> {label}
                        </button>
                    )
                })}
            </div>

            {/* 3. The "Word Cloud" Summary (Paragraph style) */}
            <div className="text-2xl sm:text-4xl font-normal leading-relaxed tracking-tight max-w-[868px] text-text-primary px-4">
                🏃 {stats.totalActivities} activities in total? That's around {Math.round(stats.stopsPerDay)} stops per day! {paceLabel}. 
                {" "}💰 Daily average spend of {formatCurrency(stats.costPerDay, trip.currency)}? {stats.budgetSub}!
                {km !== null && km > 0 && (
                  <>
                    {" "}✈️ You traveled {km.toLocaleString()} km in total, which is equivalent to {relatableKm}.
                  </>
                )}
            </div>

            {/* 4. The CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-6 w-full">
                <Button 
                    variant="secondary"
                    size="sm"
                    onClick={handleExportStory}
                    disabled={isExporting}
                >
                    {isExporting ? '📸 Generating...' : '📸 Generate Story'}
                </Button>
                <Button 
                    variant="secondary"
                    size="sm"
                    onClick={handleUseAsTemplate}
                >
                    📋 Clone Itinerary
                </Button>
                <Button 
                    variant="primary"
                    size="sm"
                    onClick={handleWandaRecap}
                >
                    🪄 <span className="wanda-serif">Wanda</span> Recap
                </Button>
                {effectiveStatus !== 'completed' && effectiveStatus !== 'archived' && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleMarkComplete}
                        className="border-success/60 text-success hover:bg-success/10"
                    >
                        ✅ Mark as Complete · +100 XP
                    </Button>
                )}
            </div>
            {/* ── HIDDEN STORY CANVAS FOR EXPORT ── */}
            <div 
                ref={el => exportRef.current = el}
                style={{
                    position: 'absolute',
                    left: '-9999px',
                    top: '-9999px',
                    width: '1080px',
                    height: '1920px',
                    backgroundColor: '#EEE9E3',
                    color: '#1A1A18',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    textAlign: 'center',
                    padding: '200px 100px 0',
                    zIndex: -100,
                    fontFamily: '"Anthropic Sans", sans-serif',
                }}
            >
                {/* Main Content Wrapper for Centering */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    
                    {/* Hero Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', marginBottom: '80px' }}>
                        {/* Emoji */}
                        <div style={{ fontSize: '120px', lineHeight: 1 }}>{trip.emoji || '🎉'}</div>
                        
                        {/* Title */}
                        <h1 style={{
                            fontSize: '80px',
                            fontWeight: 700,
                            letterSpacing: '-0.02em', 
                            lineHeight: 1.2, 
                            margin: 0,
                            color: '#1A1A18'
                        }}>
                            {trip.name}
                        </h1>

                        {/* Date & Avatars */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 500, color: '#9B9A93', lineHeight: '1' }}>
                                {formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}
                            </span>
                            {travelerProfiles.length > 0 && (
                                <>
                                    <span style={{ fontSize: '20px', color: '#E0DDD6', lineHeight: '1', marginTop: '2px' }}>•</span>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '48px', marginTop: '-12px' }}>
                                        {travelerProfiles.map((p, i) => (
                                            <div
                                                key={p.id}
                                                style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '50%',
                                                    border: '3px solid #EEE9E3',
                                                    marginLeft: i > 0 ? '-14px' : '0',
                                                    overflow: 'hidden',
                                                    backgroundColor: '#ECEAE5',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {p.customPhoto || p.photo ? (
                                                    <img src={p.customPhoto || p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '18px', fontWeight: 700, color: '#D97757', lineHeight: '1' }}>
                                                        {p.name?.[0].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Rating */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {[1, 2, 3, 4, 5].map(n => (
                                <span 
                                    key={n} 
                                    style={{ fontSize: '52px', color: n <= (trip.rating || 0) ? '#facc15' : '#E0DDD6' }}
                                >
                                    ★
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Vibes */}
                    {trip.vibes && trip.vibes.length > 0 && (
                        <div style={{
                            fontSize: '28px',
                            fontWeight: 500,
                            color: '#9B9A93',
                            marginBottom: '64px',
                            letterSpacing: '0.01em',
                        }}>
                            {trip.vibes.map(vibeLabel => {
                                const vibe = VIBE_TAGS.find(v => v.label === vibeLabel)
                                return vibe ? `${vibe.emoji} ${vibe.label}` : vibeLabel
                            }).join(' • ')}
                        </div>
                    )}

                    {/* Summary Text */}
                    <div style={{
                        fontSize: '60px',
                        fontWeight: 400,
                        lineHeight: 1.5,
                        letterSpacing: '-0.01em',
                        maxWidth: '880px',
                        color: '#1A1A18',
                        textAlign: 'center',
                    }}>
                        🏃 {stats.totalActivities} activities in total? That's around {Math.round(stats.stopsPerDay)} stops per day! {paceLabel}.
                        {" "}💰 Daily average spend of {formatCurrency(stats.costPerDay, trip.currency)}? {stats.budgetSub}!
                        {km !== null && km > 0 && (
                            <>
                                {" "}✈️ You traveled {km.toLocaleString()} km in total, equivalent to {relatableKm}.
                            </>
                        )}
                    </div>
                </div>

                {/* Brand Watermark Bottom */}
                <div style={{ position: 'absolute', bottom: '120px', transform: 'scale(1)' }}>
                    <WandWordmark static={true} color="#1A1A18" />
                </div>
            </div>

        </div>
    )
}
