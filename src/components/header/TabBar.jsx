import { useRef, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'

export default function TabBar() {
  const { state, activeTrip, dispatch } = useTripContext()
  const activeTab = state.activeTab
  const scrollRef = useRef(null)
  const activeTabRef = useRef(null)

  const hasConcert = activeTrip?.bookings?.some(b => b.category === 'concert') || false

  const visibleTabs = TAB_CONFIG.filter(tab => {
    if (tab.conditional && tab.id === 'concert') {
      return hasConcert
    }
    return true
  })

  const handleTabClick = (tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
  }

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current
      const tabEl = activeTabRef.current
      const containerRect = container.getBoundingClientRect()
      const tabRect = tabEl.getBoundingClientRect()

      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        tabEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [activeTab])

  return (
    <nav className="border-b border-border bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-20">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide px-8"
        role="tablist"
        aria-label="Trip sections"
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={`
                relative flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium
                whitespace-nowrap transition-colors duration-200
                shrink-0
                ${isActive
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary'
                }
              `}
            >
              <span className="text-base leading-none">{tab.emoji}</span>
              <span>{tab.label}</span>

              {/* Active indicator — bottom border */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-accent rounded-full"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
