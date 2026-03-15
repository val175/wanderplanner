import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { TAB_CONFIG } from '../../constants/tabs'

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

export default function BottomNav() {
    const { state, dispatch } = useTripContext()
    const isMobile = useMediaQuery('(max-width: 767px)')
    const activeTrip = (state.activeTripId && state.trips?.[state.activeTripId]) || null
    const badges = useBadges(activeTrip)

    // Only render on mobile
    if (!isMobile) return null

    // The 4 core tabs for the bottom nav
    const coreTabs = ['overview', 'itinerary', 'budget', 'ai']

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-bg-primary)] border-t border-[var(--color-border)] pb-[env(safe-area-inset-bottom)] md:hidden pointer-events-auto">
            <div className="flex items-center justify-around h-14 px-2">
                {coreTabs.map(tabId => {
                    const tab = tabId === 'ai'
                        ? { id: 'ai', label: 'Wanda', emoji: '🪄' }
                        : TAB_CONFIG.find(t => t.id === tabId)

                    const isActive = tabId === 'ai'
                        ? state.showAIAssistant // Assuming we add this state, or we just handle it via the existing AIAssistant logic
                        : state.activeTab === tabId

                    return (
                        <button
                            key={tabId}
                            onClick={() => {
                                if (tabId === 'ai') {
                                    // Trigger AI assistant
                                    // For now, let's just dispatch an event that AIAssistant listens to, or we manage it in context
                                    // Currently AIAssistant manages its own state, we might need to expose it or just let the button float
                                    // Actually, user said: "integrate AI chat as a full-screen overlay mode on mobile".
                                    const ev = new CustomEvent('toggle-wanda-mobile');
                                    window.dispatchEvent(ev);
                                } else {
                                    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
                                }
                            }}
                            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                                }`}
                        >
                            <span className="relative inline-flex">
                                <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{tab.emoji}</span>
                                {tabId === 'overview' && badges.overview && (
                                    <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white px-[3px] leading-none">
                                        {badges.overview > 9 ? '9+' : badges.overview}
                                    </span>
                                )}
                                {tabId === 'budget' && badges.budget && (
                                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-warning" />
                                )}
                            </span>
                            <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
