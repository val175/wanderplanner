import { useState } from 'react'
import { MoreHorizontal, Mic } from 'lucide-react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { TAB_CONFIG } from '../../constants/tabs'
import Modal from '../shared/Modal'

// The complete primary nav on mobile: four real destinations + More.
// Wanda is a FAB (AIAssistant) — an assistant, not a destination.
const CORE_TAB_IDS = ['overview', 'itinerary', 'bookings', 'budget']

function useBadges(trip) {
    if (!trip) return {}
    const today = new Date(); today.setHours(0, 0, 0, 0)

    // Overview: overdue todos + high-priority unconfirmed bookings
    const overdueTodos = (trip.todos || []).filter(t => {
        if (t.done) return false
        if (t.priority === 'high') return true
        if (t.dueDate) return new Date(t.dueDate + 'T00:00:00') < today
        return false
    }).length

    const urgentBookings = (trip.bookings || []).filter(b => {
        if (b.status === 'booked' || b.status === 'confirmed') return false
        if (b.priority) return true
        if (b.bookByDate) return Math.ceil((new Date(b.bookByDate + 'T00:00:00') - today) / 86400000) <= 7
        return false
    }).length

    const overviewCount = overdueTodos + urgentBookings

    // Budget: dot if any category is over its max
    const overBudget = (trip.budget || []).some(b => (b.actual || 0) > (b.max || 0))

    return { overview: overviewCount > 0 ? overviewCount : null, budget: overBudget }
}

function NavButton({ label, icon: Icon, isActive, onClick, badge, dot }) {
    return (
        <button
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={onClick}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
        >
            <span className="relative inline-flex">
                <Icon size={20} strokeWidth={1.75} className={`${isActive ? 'scale-110' : ''} transition-transform`} aria-hidden="true" />
                {badge && (
                    <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-[var(--radius-pill)] bg-danger px-[4px] text-xs font-bold leading-none text-white">
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
                {dot && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-warning" />
                )}
            </span>
            <span className="text-xs font-medium tracking-tight">{label}</span>
        </button>
    )
}

export default function BottomNav() {
    const { state, dispatch, activeTrip } = useTripContext()
    const isMobile = useMediaQuery('(max-width: 767px)')
    const [showMore, setShowMore] = useState(false)
    const badges = useBadges(activeTrip)

    // Only render on mobile
    if (!isMobile) return null

    const coreTabs = CORE_TAB_IDS.map(id => TAB_CONFIG.find(t => t.id === id)).filter(Boolean)

    // Everything that isn't in the core row lives in the More sheet
    const moreTabs = TAB_CONFIG.filter(t =>
        !CORE_TAB_IDS.includes(t.id) &&
        (!t.conditional || activeTrip?.concertTheme)
    )

    const goTo = (tabId) => {
        dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
        setShowMore(false)
    }

    const moreActive = moreTabs.some(t => t.id === state.activeTab)

    return (
        <>
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)] md:hidden pointer-events-auto">
                <div
                    role="tablist"
                    aria-label="Mobile Navigation"
                    className="flex items-center justify-around h-14 px-2"
                >
                    {coreTabs.map(tab => (
                        <NavButton
                            key={tab.id}
                            label={tab.label}
                            icon={tab.icon}
                            isActive={state.activeTab === tab.id}
                            onClick={() => goTo(tab.id)}
                            badge={tab.id === 'overview' ? badges.overview : null}
                            dot={tab.id === 'budget' && badges.budget}
                        />
                    ))}
                    <NavButton
                        label="More"
                        icon={MoreHorizontal}
                        isActive={moreActive || showMore}
                        onClick={() => setShowMore(true)}
                    />
                </div>
            </nav>

            {/* More sheet — the rest of the destinations, plus Voice */}
            <Modal isOpen={showMore} onClose={() => setShowMore(false)} title="More" maxWidth="max-w-md">
                <div className="grid grid-cols-3 gap-2 p-4 pb-6">
                    {moreTabs.map(tab => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => goTo(tab.id)}
                                className={`flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-3 transition-colors ${state.activeTab === tab.id
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-text-secondary hover:bg-bg-hover active:bg-bg-hover'
                                    }`}
                            >
                                <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                                <span className="text-xs font-medium">{tab.label}</span>
                            </button>
                        )
                    })}
                    <button
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('toggle-walkie'))
                            setShowMore(false)
                        }}
                        className="flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-3 text-text-secondary hover:bg-bg-hover active:bg-bg-hover transition-colors"
                    >
                        <Mic size={22} strokeWidth={1.75} aria-hidden="true" />
                        <span className="text-xs font-medium">Voice</span>
                    </button>
                </div>
            </Modal>
        </>
    )
}
