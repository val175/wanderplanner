import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { TAB_CONFIG } from '../../constants/tabs'

export default function BottomNav() {
    const { state, dispatch } = useTripContext()
    const isMobile = useMediaQuery('(max-width: 767px)')

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
                            <span className={`text-xl ${isActive ? 'scale-110' : ''} transition-transform`}>{tab.emoji}</span>
                            <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
