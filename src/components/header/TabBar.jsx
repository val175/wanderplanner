import { useRef, useEffect, useState, useCallback } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'

/* ─────────────────────────────────────────────────────────────
   TabBar
   - Horizontal scroll with scroll-snap on mobile/medium viewports
   - CSS fade masks on left/right edges when scrollable
   - "More ▾" dropdown for overflow tabs detected via IntersectionObserver
   - Active tab always scrolled into view
───────────────────────────────────────────────────────────── */
export default function TabBar() {
  const { state, activeTrip, dispatch } = useTripContext()
  const activeTab = state.activeTab
  const scrollRef = useRef(null)
  const activeTabRef = useRef(null)
  const observerRef = useRef(null)
  const tabRefs = useRef({})

  const [showLeftMask, setShowLeftMask] = useState(false)
  const [showRightMask, setShowRightMask] = useState(false)
  const [overflowTabs, setOverflowTabs] = useState([])
  const [showMore, setShowMore] = useState(false)

  const hasConcert = activeTrip?.bookings?.some(b => b.category === 'concert') || false

  const visibleTabs = TAB_CONFIG.filter(tab => {
    if (tab.conditional && tab.id === 'concert') return hasConcert
    return true
  })

  const handleTabClick = (tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
    setShowMore(false)
  }

  // Update scroll masks based on scroll position
  const updateMasks = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftMask(el.scrollLeft > 4)
    setShowRightMask(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  // Detect which tabs are clipped (overflow) using IntersectionObserver
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    // Disconnect previous observer
    if (observerRef.current) observerRef.current.disconnect()

    const hidden = new Set()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const tabId = entry.target.dataset.tabId
          if (!tabId) return
          if (entry.intersectionRatio < 0.9) {
            hidden.add(tabId)
          } else {
            hidden.delete(tabId)
          }
        })
        setOverflowTabs(visibleTabs.filter(t => hidden.has(t.id)))
      },
      { root: container, threshold: 0.9 }
    )

    Object.values(tabRefs.current).forEach(el => {
      if (el) observerRef.current.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [visibleTabs.length, hasConcert])

  // Initial mask state + scroll listener
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateMasks()
    el.addEventListener('scroll', updateMasks, { passive: true })
    window.addEventListener('resize', updateMasks, { passive: true })
    return () => {
      el.removeEventListener('scroll', updateMasks)
      window.removeEventListener('resize', updateMasks)
    }
  }, [updateMasks])

  // Scroll active tab into view when it changes
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

  // Close More dropdown on outside click
  useEffect(() => {
    if (!showMore) return
    const handler = (e) => {
      if (!e.target.closest('[data-more-menu]')) setShowMore(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMore])

  const hasOverflow = overflowTabs.length > 0
  const activeIsOverflow = overflowTabs.some(t => t.id === activeTab)

  return (
    <nav className="border-b border-border bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="relative flex items-stretch">

        {/* Left fade mask */}
        {showLeftMask && (
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(to right, var(--color-bg-primary), transparent)',
            }}
            aria-hidden="true"
          />
        )}

        {/* Scrollable tab strip */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide flex-1"
          style={{ scrollSnapType: 'x mandatory' }}
          role="tablist"
          aria-label="Trip sections"
        >
          {/* Left padding spacer */}
          <div className="w-4 md:w-8 shrink-0" />

          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id
            const isOverflowing = overflowTabs.some(t => t.id === tab.id)
            return (
              <button
                key={tab.id}
                ref={el => {
                  tabRefs.current[tab.id] = el
                  if (isActive) activeTabRef.current = el
                }}
                data-tab-id={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                onClick={() => handleTabClick(tab.id)}
                style={{ scrollSnapAlign: 'start' }}
                className={`
                  relative flex items-center gap-1.5 px-3.5 py-3.5 text-sm font-medium
                  whitespace-nowrap transition-colors duration-150
                  shrink-0
                  ${isActive
                    ? 'text-accent'
                    : 'text-text-muted hover:text-text-secondary'
                  }
                `}
              >
                <span className="text-base leading-none">{tab.emoji}</span>
                <span className="hidden sm:inline">{tab.label}</span>

                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1.5 right-1.5 h-[2.5px] bg-accent rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}

          {/* Right padding spacer */}
          <div className="w-4 md:w-8 shrink-0" />
        </div>

        {/* Right fade mask */}
        {showRightMask && (
          <div
            className="absolute right-0 top-0 bottom-0 pointer-events-none z-10"
            style={{
              width: hasOverflow ? '80px' : '32px',
              background: 'linear-gradient(to left, var(--color-bg-primary) 40%, transparent)',
            }}
            aria-hidden="true"
          />
        )}

        {/* "More ▾" button — only when tabs are truly clipped */}
        {hasOverflow && (
          <div className="relative shrink-0 flex items-center pr-3 pl-1 z-20" data-more-menu>
            <button
              onClick={() => setShowMore(o => !o)}
              className={`
                flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-[var(--radius-sm)]
                transition-colors duration-150
                ${activeIsOverflow
                  ? 'text-accent bg-accent/10'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-secondary'
                }
              `}
              aria-haspopup="true"
              aria-expanded={showMore}
            >
              {activeIsOverflow
                ? <span>{overflowTabs.find(t => t.id === activeTab)?.emoji}</span>
                : <span>More</span>
              }
              <svg
                width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-150 ${showMore ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown */}
            {showMore && (
              <div className="absolute top-full right-0 mt-1 min-w-[140px] bg-bg-primary border border-border rounded-[var(--radius-md)] shadow-lg py-1 z-50">
                {overflowTabs.map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                        transition-colors duration-100
                        ${isActive
                          ? 'text-accent bg-accent/8 font-medium'
                          : 'text-text-secondary hover:bg-bg-secondary'
                        }
                      `}
                    >
                      <span>{tab.emoji}</span>
                      <span>{tab.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
