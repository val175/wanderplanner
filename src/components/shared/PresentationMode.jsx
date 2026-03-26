import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import html2canvas from 'html2canvas'
import { useTripContext } from '../../context/TripContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { formatDateRange, formatCurrency, daysUntil } from '../../utils/helpers'
import { getCategory } from '../../constants/categories'
import AvatarCircle from './AvatarCircle'
import WandWordmark from './WandWordmark'

/* ─────────────────────────────────────────────────────────────
   Data helpers
───────────────────────────────────────────────────────────── */
function getCountdownLabel(startDate) {
    const days = daysUntil(startDate)
    if (days === null) return null
    if (days > 1) return `${days} days to go 🚀`
    if (days === 1) return 'Tomorrow! 🎉'
    if (days === 0) return 'Departing today! ✈️'
    return 'Trip is underway! 🌍'
}

function getBudgetPerPerson(trip) {
    const total = (trip.budget || []).reduce((s, b) => s + (b.max || 0), 0)
    const travelers = Math.max(trip.travelers || 1, 1)
    return { total, perPerson: total > 0 ? Math.round(total / travelers) : 0 }
}

/* ─────────────────────────────────────────────────────────────
   Slide components (5 slides)
───────────────────────────────────────────────────────────── */

// Slide 1 — Hero
function SlideHero({ trip, travelerProfiles }) {
    const route = (trip.destinations || []).map(d => `${d.flag || ''} ${d.city}`).join('  →  ')
    const countdownLabel = getCountdownLabel(trip.startDate)

    return (
        <div className="flex flex-col items-center justify-center text-center gap-6 px-8 h-full">
            <div className="text-[96px] leading-none">{trip.emoji || '✈️'}</div>
            <h1 className="font-heading text-5xl sm:text-6xl font-bold tracking-tighter text-text-primary leading-tight max-w-xl">
                {trip.name}
            </h1>
            {route && (
                <p className="text-lg text-text-secondary font-medium">{route}</p>
            )}
            <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-text-muted">
                    {formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}
                    {trip.travelers > 1 && ` · ${trip.travelers} travelers`}
                </p>
                {countdownLabel && (
                    <span className="inline-block px-5 py-2 rounded-[var(--radius-pill)] bg-accent text-text-inverse text-sm font-bold tracking-wide">
                        {countdownLabel}
                    </span>
                )}
            </div>
            {travelerProfiles.length > 0 && (
                <div className="flex items-center justify-center -space-x-2 mt-1">
                    {travelerProfiles.map(p => (
                        <div key={p.id} className="border-[3px] border-bg-primary rounded-full">
                            <AvatarCircle profile={p} size={44} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// Slide 2 — The Plan (itinerary)
function SlideItinerary({ trip }) {
    const days = [...(trip.itinerary || [])].sort((a, b) => a.dayNumber - b.dayNumber)

    return (
        <div className="flex flex-col h-full px-8 py-6 overflow-hidden">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest text-center mb-6 shrink-0">
                The Plan
            </p>
            {days.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-text-muted text-sm">No itinerary added yet</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-0 pr-1">
                    {days.map((day, i) => {
                        const highlights = (day.activities || []).slice(0, 3).map(a => a.name).filter(Boolean)
                        return (
                            <div
                                key={day.id || i}
                                className="flex items-baseline gap-4 py-3 border-b border-border/60 last:border-0"
                            >
                                <span className="text-xs font-bold text-text-muted shrink-0 w-12 text-right tabular-nums">
                                    Day {day.dayNumber}
                                </span>
                                <span className="text-sm font-bold text-text-primary shrink-0">
                                    {day.emoji || '📍'} {day.location || 'TBA'}
                                </span>
                                {highlights.length > 0 && (
                                    <span className="text-sm text-text-secondary truncate min-w-0">
                                        {highlights.join(' · ')}
                                    </span>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// Slide 3 — What's Booked
function SlideBookings({ trip }) {
    const confirmed = (trip.bookings || []).filter(b => b.status === 'booked')
    const pending = (trip.bookings || []).filter(b => b.status !== 'booked')

    return (
        <div className="flex flex-col h-full px-8 py-6 overflow-hidden">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest text-center mb-6 shrink-0">
                What's Booked
            </p>
            {confirmed.length === 0 && pending.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-text-muted text-sm">No bookings added yet</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {confirmed.length > 0 && (
                        <div className="space-y-2">
                            {confirmed.map(b => {
                                const cat = getCategory(b.category)
                                return (
                                    <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-success/8 border border-success/20">
                                        <span className="text-lg shrink-0">{cat.emoji}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-text-primary truncate">{b.name}</p>
                                            {b.confirmationNumber && (
                                                <p className="text-xs text-text-muted font-mono">{b.confirmationNumber}</p>
                                            )}
                                        </div>
                                        <span className="text-success text-sm font-bold shrink-0">✓</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {pending.length > 0 && (
                        <div className="space-y-2">
                            {confirmed.length > 0 && (
                                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider pt-2">Still to book</p>
                            )}
                            {pending.map(b => {
                                const cat = getCategory(b.category)
                                return (
                                    <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] bg-bg-secondary border border-border">
                                        <span className="text-lg shrink-0 opacity-60">{cat.emoji}</span>
                                        <p className="text-sm font-medium text-text-secondary truncate flex-1">{b.name}</p>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Slide 4 — Budget
function SlideBudget({ trip }) {
    const { total, perPerson } = getBudgetPerPerson(trip)
    const categories = (trip.budget || []).filter(b => b.max > 0).sort((a, b) => b.max - a.max)

    return (
        <div className="flex flex-col items-center h-full px-8 py-6 overflow-hidden">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest text-center mb-6 shrink-0">
                Budget
            </p>
            {total === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-text-muted text-sm">No budget set yet</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-6 flex-1 overflow-y-auto w-full pr-1">
                    {/* Big number */}
                    <div className="text-center">
                        <p className="font-heading text-7xl font-bold tracking-tighter text-text-primary leading-none">
                            {formatCurrency(perPerson, trip.currency)}
                        </p>
                        <p className="text-sm text-text-muted mt-2">
                            per person · {formatCurrency(total, trip.currency)} total
                        </p>
                    </div>

                    {/* Category breakdown */}
                    {categories.length > 0 && (
                        <div className="w-full max-w-sm space-y-2.5">
                            {categories.map(cat => {
                                const pct = Math.round((cat.max / total) * 100)
                                return (
                                    <div key={cat.id} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-text-secondary font-medium">
                                                {cat.emoji} {cat.name}
                                            </span>
                                            <span className="text-text-muted tabular-nums">
                                                {formatCurrency(cat.max, trip.currency)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-accent"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Slide 5 — Before We Go (todos + packing)
function SlideBeforeWeGo({ trip }) {
    const openTodos = (trip.todos || []).filter(t => !t.done)
    const packingTotal = (trip.packingList || []).length
    const packingPacked = (trip.packingList || []).filter(p => p.packed).length
    const packingPct = packingTotal > 0 ? Math.round((packingPacked / packingTotal) * 100) : null

    const priorityTodos = openTodos.filter(t => t.priority).slice(0, 5)
    const otherTodos = openTodos.filter(t => !t.priority).slice(0, 5 - priorityTodos.length)
    const shownTodos = [...priorityTodos, ...otherTodos]
    const remaining = openTodos.length - shownTodos.length

    return (
        <div className="flex flex-col h-full px-8 py-6 overflow-hidden">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-widest text-center mb-6 shrink-0">
                Before We Go
            </p>
            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
                {/* Packing progress */}
                {packingTotal > 0 && (
                    <div className="p-4 rounded-[var(--radius-lg)] bg-bg-secondary border border-border">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-text-primary">🧳 Packing list</p>
                            <p className="text-sm font-bold text-accent">{packingPct}%</p>
                        </div>
                        <div className="h-2 rounded-full bg-bg-card border border-border overflow-hidden">
                            <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{ width: `${packingPct}%` }}
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-1.5">{packingPacked} of {packingTotal} items packed</p>
                    </div>
                )}

                {/* Open todos */}
                {openTodos.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                            Open tasks ({openTodos.length})
                        </p>
                        {shownTodos.map(todo => (
                            <div key={todo.id} className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-md)] bg-bg-secondary border border-border">
                                {todo.priority && <span className="text-warning text-xs shrink-0">⚡</span>}
                                <p className="text-sm text-text-primary truncate flex-1">{todo.text}</p>
                                {todo.dueDate && (
                                    <p className="text-xs text-text-muted shrink-0 font-mono">{todo.dueDate}</p>
                                )}
                            </div>
                        ))}
                        {remaining > 0 && (
                            <p className="text-xs text-text-muted text-center pt-1">+ {remaining} more tasks</p>
                        )}
                    </div>
                ) : (
                    packingTotal === 0 && (
                        <div className="flex flex-1 items-center justify-center pt-16">
                            <p className="text-text-muted text-sm text-center">All clear — nothing pending! 🎉</p>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────
   Slide definitions
───────────────────────────────────────────────────────────── */
const SLIDES = [
    { id: 'hero',       label: 'Overview' },
    { id: 'itinerary',  label: 'The Plan' },
    { id: 'bookings',   label: "What's Booked" },
    { id: 'budget',     label: 'Budget' },
    { id: 'before',     label: 'Before We Go' },
]

/* ─────────────────────────────────────────────────────────────
   Main PresentationMode
───────────────────────────────────────────────────────────── */
export default function PresentationMode({ onClose }) {
    const { activeTrip } = useTripContext()
    const travelerProfiles = useTripTravelers()
    const [slide, setSlide] = useState(0)
    const [isExporting, setIsExporting] = useState(false)
    const exportRef = useMemo(() => ({ current: null }), [])

    if (!activeTrip) return null
    const trip = activeTrip

    const goTo = useCallback((i) => setSlide(Math.max(0, Math.min(SLIDES.length - 1, i))), [])

    // Keyboard navigation
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goTo(slide + 1)
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goTo(slide - 1)
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [slide, goTo, onClose])

    const handleExport = async () => {
        if (isExporting || !exportRef.current) return
        setIsExporting(true)
        try {
            await new Promise(r => setTimeout(r, 100))
            const canvas = await html2canvas(exportRef.current, {
                scale: 2, useCORS: true, backgroundColor: null, logging: false,
                width: 1080, height: 1920,
            })
            const link = document.createElement('a')
            link.download = `${trip.name.replace(/\s+/g, '-')}-Trip-Brief.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        } catch (err) {
            console.error('[PresentationMode] Export failed:', err)
        } finally {
            setIsExporting(false)
        }
    }

    const { total: budgetTotal, perPerson: budgetPerPerson } = getBudgetPerPerson(trip)

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-bg-primary flex flex-col">
            <style>{`
                @keyframes pres-slide-in {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Top bar */}
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary/90 backdrop-blur-sm">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors min-w-[44px] min-h-[44px] justify-start"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                    <span className="hidden sm:inline">Close</span>
                </button>

                <span className="text-sm font-semibold text-text-secondary">
                    {SLIDES[slide].label}
                </span>

                <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors disabled:opacity-50 min-h-[44px] flex items-center"
                >
                    {isExporting ? '📸 Saving…' : '📸 Save'}
                </button>
            </div>

            {/* Slide area */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    key={slide}
                    className="absolute inset-0 max-w-2xl mx-auto"
                    style={{ animation: 'pres-slide-in 0.25s cubic-bezier(0.2, 0, 0, 1)' }}
                >
                    {slide === 0 && <SlideHero trip={trip} travelerProfiles={travelerProfiles} />}
                    {slide === 1 && <SlideItinerary trip={trip} />}
                    {slide === 2 && <SlideBookings trip={trip} />}
                    {slide === 3 && <SlideBudget trip={trip} />}
                    {slide === 4 && <SlideBeforeWeGo trip={trip} />}
                </div>

                {/* Side nav arrows */}
                {slide > 0 && (
                    <button
                        onClick={() => goTo(slide - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-card border border-border shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                        aria-label="Previous slide"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6"/>
                        </svg>
                    </button>
                )}
                {slide < SLIDES.length - 1 && (
                    <button
                        onClick={() => goTo(slide + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bg-card border border-border shadow-sm flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                        aria-label="Next slide"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </button>
                )}
            </div>

            {/* Bottom dot navigation */}
            <div className="shrink-0 flex items-center justify-center gap-2.5 py-4 border-t border-border">
                {SLIDES.map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => goTo(i)}
                        aria-label={`Go to ${s.label}`}
                        className={`rounded-full transition-all duration-200 ${
                            i === slide
                                ? 'w-6 h-2 bg-accent'
                                : 'w-2 h-2 bg-border hover:bg-text-muted'
                        }`}
                    />
                ))}
                <span className="ml-2 text-xs text-text-muted tabular-nums">{slide + 1} / {SLIDES.length}</span>
            </div>

            {/* Hidden export canvas — summarises all key info in one portrait card */}
            <ExportCanvas
                containerRef={el => exportRef.current = el}
                trip={trip}
                travelerProfiles={travelerProfiles}
                budgetTotal={budgetTotal}
                budgetPerPerson={budgetPerPerson}
                confirmedBookings={(trip.bookings || []).filter(b => b.status === 'booked')}
                dayHighlights={[...(trip.itinerary || [])].sort((a, b) => a.dayNumber - b.dayNumber).map(d => ({
                    dayNumber: d.dayNumber,
                    location: d.location || '',
                    emoji: d.emoji || '📍',
                    highlights: (d.activities || []).slice(0, 3).map(a => a.name).filter(Boolean),
                }))}
            />
        </div>,
        document.body
    )
}

/* ─────────────────────────────────────────────────────────────
   Export Canvas — 1080×1920 portrait, inline styles only
   (html2canvas cannot read CSS custom properties)
───────────────────────────────────────────────────────────── */
function ExportCanvas({ containerRef, trip, travelerProfiles, budgetTotal, budgetPerPerson, confirmedBookings, dayHighlights }) {
    const route = (trip.destinations || []).map(d => `${d.flag || ''} ${d.city}`).join(' → ')
    const countdownLabel = getCountdownLabel(trip.startDate)

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', left: '-9999px', top: '-9999px',
                width: '1080px', height: '1920px',
                backgroundColor: '#EEE9E3', color: '#1A1A18',
                fontFamily: '"Anthropic Sans", sans-serif',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '140px 100px 120px', boxSizing: 'border-box', gap: '56px',
            }}
        >
            {/* Hero */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '120px', lineHeight: 1 }}>{trip.emoji || '✈️'}</div>
                <h1 style={{ fontSize: '80px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
                    {trip.name}
                </h1>
                {route && <p style={{ fontSize: '28px', fontWeight: 500, color: '#6B6A63', margin: 0 }}>{route}</p>}
                <p style={{ fontSize: '24px', color: '#9B9A93', margin: 0 }}>
                    {formatDateRange(trip.startDate, trip.endDate) || 'Dates TBA'}
                </p>
                {countdownLabel && (
                    <div style={{ backgroundColor: '#D97757', color: '#FFFFFF', fontSize: '26px', fontWeight: 600, padding: '10px 28px', borderRadius: '999px' }}>
                        {countdownLabel}
                    </div>
                )}
                {travelerProfiles.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                        {travelerProfiles.map((p, i) => (
                            <div key={p.id} style={{
                                width: '52px', height: '52px', borderRadius: '50%',
                                border: '3px solid #EEE9E3', marginLeft: i > 0 ? '-14px' : '0',
                                overflow: 'hidden', backgroundColor: '#ECEAE5',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {p.customPhoto || p.photo
                                    ? <img src={p.customPhoto || p.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    : <span style={{ fontSize: '18px', fontWeight: 700, color: '#D97757' }}>{p.name?.[0]?.toUpperCase()}</span>
                                }
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ width: '100%', height: '1px', backgroundColor: '#D8D5CE' }} />

            {/* Itinerary (up to 7 days) */}
            {dayHighlights.length > 0 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9B9A93', margin: 0, textAlign: 'center' }}>THE PLAN</p>
                    {dayHighlights.slice(0, 7).map(day => (
                        <div key={day.dayNumber} style={{ display: 'flex', alignItems: 'baseline', gap: '16px', paddingBottom: '14px', borderBottom: '1px solid #E0DDD6' }}>
                            <span style={{ fontSize: '20px', fontWeight: 600, color: '#9B9A93', minWidth: '72px', textAlign: 'right', flexShrink: 0 }}>Day {day.dayNumber}</span>
                            <span style={{ fontSize: '24px', fontWeight: 700, flexShrink: 0 }}>{day.emoji} {day.location}</span>
                            {day.highlights.length > 0 && (
                                <span style={{ fontSize: '20px', color: '#6B6A63', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{day.highlights.join(' · ')}</span>
                            )}
                        </div>
                    ))}
                    {dayHighlights.length > 7 && (
                        <p style={{ fontSize: '20px', color: '#9B9A93', textAlign: 'center', margin: 0 }}>+ {dayHighlights.length - 7} more days</p>
                    )}
                </div>
            )}

            {/* Confirmed bookings */}
            {confirmedBookings.length > 0 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                    <p style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9B9A93', margin: 0 }}>WHAT'S BOOKED</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                        {confirmedBookings.slice(0, 6).map(b => {
                            const cat = getCategory(b.category)
                            return (
                                <div key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 22px', borderRadius: '999px', backgroundColor: 'rgba(72,167,104,0.12)', border: '1.5px solid rgba(72,167,104,0.3)', fontSize: '22px', fontWeight: 500, color: '#3A9160' }}>
                                    {cat.emoji} {b.name} ✓
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Budget */}
            {budgetTotal > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                    <p style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9B9A93', margin: 0 }}>BUDGET</p>
                    <p style={{ fontSize: '68px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>{formatCurrency(budgetPerPerson, trip.currency)}</p>
                    <p style={{ fontSize: '22px', color: '#9B9A93', margin: 0 }}>per person · {formatCurrency(budgetTotal, trip.currency)} total</p>
                </div>
            )}

            {/* Watermark */}
            <div style={{ marginTop: 'auto', opacity: 0.35 }}>
                <WandWordmark static={true} color="#1A1A18" />
            </div>
        </div>
    )
}
