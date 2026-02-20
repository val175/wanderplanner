import { useRef, useEffect, useState, useCallback } from 'react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'

/* ─────────────────────────────────────────────────────────────
   TabBar — glass morphism pill design
   - Sticky glass nav with backdrop-blur
   - Active tab = filled white/bg-card pill (no underline)
   - Inactive tabs = transparent text, no border
   - Same scroll / overflow / IntersectionObserver logic retained
   - "More ▾" dropdown updated to match pill aesthetic
───────────────────────────────────────────────────────────── */
export default function TabBar() {
  const { state, dispatch } = useTripContext()
  const activeTab = state.activeTab
  const scrollRef = useRef(null)
  const activeTabRef = useRef(null)
  const observerRef = useRef(null)
  const tabRefs = useRef({})

  const [showLeftMask, setShowLeftMask] = useState(false)
  const [showRightMask, setShowRightMask] = useState(false)
  const [overflowTabs, setOverflowTabs] = useState([])
  const [showMore, setShowMore] = useState(false)

  // Derive hasConcert from activeTrip bookings
  const { activeTrip } = useTripContext()
  const hasConcert = activeTrip?.bookings?.some(b => b.category === 'concert') || false

  const visibleTabs = TAB_CONFIG.filter(tab => {
    if (tab.conditional && tab.id === 'concert') return hasConcert
    return true
  })

  const handleTabClick = (tabId) => {
    dispatch({ type: ACTIONS.SET_TAB, payload: tabId })
    setShowMore(false)
  }

  // Update scroll fade masks
  const updateMasks = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeftMask(el.scrollLeft > 4)
    setShowRightMask(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  // IntersectionObserver to detect clipped tabs → "More" dropdown
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    if (observerRef.current) observerRef.current.disconnect()

    const hidden = new Set()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const tabId = entry.target.dataset.tabId
          if (!tabId) return
          if (entry.intersectionRatio < 0.9) hidden.add(tabId)
          else hidden.delete(tabId)
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

  // Scroll listener + resize
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

  // Scroll active tab into view on change
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
    /* ── Glass nav bar ── */
    <nav
      className="sticky top-0 z-20"
      style={{
        background: 'var(--color-bg-primary)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Inner pill track — adds a subtle inset groove for the pills to sit in */}
      <div className="relative flex items-center min-h-[48px]">

        {/* Left fade mask */}
        {showLeftMask && (
          <div
            className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, var(--color-bg-primary), transparent)' }}
            aria-hidden="true"
          />
        )}

        {/* Scrollable strip */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide flex-1 items-center"
          style={{ scrollSnapType: 'x mandatory' }}
          role="tablist"
          aria-label="Trip sections"
        >
          {/* Left padding */}
          <div className="w-3 md:w-5 shrink-0" />

          {/* Pill row */}
          <div className="flex items-center gap-0.5 py-2">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id
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
                    relative flex items-center gap-1.5 px-3 py-1.5
                    rounded-full text-sm font-medium whitespace-nowrap
                    transition-all duration-200 shrink-0
                    ${isActive
                      /* Active: solid white pill — card elevation above the glass nav */
                      ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                      /* Inactive: ghost — just text, no background */
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                    }
                  `}
                >
                  <span className="text-[15px] leading-none">{tab.emoji}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right padding */}
          <div className="w-3 md:w-5 shrink-0" />
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

        {/* "More ▾" — pill-style, consistent with active tab treatment */}
        {hasOverflow && (
          <div className="relative shrink-0 flex items-center pr-3 pl-1 z-20" data-more-menu>
            <button
              onClick={() => setShowMore(o => !o)}
              className={`
                flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full
                transition-all duration-200
                ${activeIsOverflow
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
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
                width="9" height="9" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
                className={`transition-transform duration-150 ${showMore ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown — glass card */}
            {showMore && (
              <div
                className="absolute top-full right-0 mt-2 min-w-[148px] py-1.5 z-50 rounded-[var(--radius-md)]"
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-modal)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {overflowTabs.map(tab => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
                        transition-colors duration-100 rounded-[6px] mx-0.5
                        ${isActive
                          ? 'text-accent font-medium bg-accent/8'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                        }
                      `}
                    >
                      <span>{tab.emoji}</span>
                      <span className="flex-1">{tab.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
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
