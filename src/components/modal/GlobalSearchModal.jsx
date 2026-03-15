import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TAB_CONFIG } from '../../constants/tabs'
import { hapticImpact, hapticSelection } from '../../utils/haptics'
import { formatDate } from '../../utils/helpers'

const TABS = {
  itinerary: { label: 'Itinerary', emoji: '📅' },
  bookings: { label: 'Bookings', emoji: '🎫' },
  todos: { label: 'To Do', emoji: '✅' },
  budget: { label: 'Budget', emoji: '💰' },
  voting: { label: 'Voting', emoji: '🗳️' }
}

const COMMANDS = [
  ...TAB_CONFIG.filter(t => !t.conditional).map(t => ({
    id: `nav-${t.id}`,
    isCommand: true,
    title: `Go to ${t.label}`,
    subtitle: 'Navigate',
    emoji: t.emoji,
    action: (dispatch) => dispatch({ type: ACTIONS.SET_TAB, payload: t.id }),
  })),
  {
    id: 'open-wanda',
    isCommand: true,
    title: 'Open Wanda',
    subtitle: 'AI Assistant',
    emoji: '🪄',
    action: () => window.dispatchEvent(new CustomEvent('open-wanda')),
  },
]

export default function GlobalSearchModal({ isOpen, onClose }) {
  const { activeTrip, dispatch } = useTripContext()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearchingAI, setIsSearchingAI] = useState(false)
  const [aiResults, setAiResults] = useState([])
  const inputRef = useRef(null)

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setAiResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Handle Cmd+K globally
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          hapticImpact('light')
          window.dispatchEvent(new CustomEvent('open-global-search'))
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Helper to safely get string values for searching
  const safeStr = (obj, keys = []) => {
    return keys.map(k => String(obj?.[k] || '')).join(' ').toLowerCase()
  }

  // ── local text-matching ──
  const results = useMemo(() => {
    if (!activeTrip || !query.trim()) return []

    const q = query.toLowerCase().trim()
    const r = []

    // 1. Itinerary search
    ;(activeTrip.itinerary || []).forEach(day => {
      ;(day.activities || []).forEach(act => {
        if (safeStr(act, ['name', 'location', 'notes']).includes(q)) {
          r.push({
            id: act.id,
            tab: 'itinerary',
            title: act.name || 'Unnamed Activity',
            subtitle: `${formatDate(day.date)} • ${act.location || 'No location'}`,
            data: act
          })
        }
      })
    })

    // 2. Bookings search
    ;(activeTrip.bookings || []).forEach(bk => {
      if (safeStr(bk, ['name', 'confirmationNumber', 'notes', 'category']).includes(q)) {
        r.push({
          id: bk.id,
          tab: 'bookings',
          title: bk.name || 'Unnamed Booking',
          subtitle: `${bk.category || 'Booking'} • ${bk.status === 'confirmed' ? 'Confirmed' : 'Pending'}`,
          data: bk
        })
      }
    })

    // 3. To Do search
    ;(activeTrip.todos || []).forEach(todo => {
      if (safeStr(todo, ['text', 'phase']).includes(q)) {
        r.push({
          id: todo.id,
          tab: 'todos',
          title: todo.text || 'Unnamed Task',
          subtitle: `Phase: ${todo.phase} • ${todo.done ? 'Done' : 'Pending'}`,
          data: todo
        })
      }
    })

    // 4. Budget search (spendingLog)
    ;(activeTrip.spendingLog || []).forEach(exp => {
      if (safeStr(exp, ['description', 'category']).includes(q)) {
        r.push({
          id: exp.id,
          tab: 'budget',
          title: exp.description || 'Unnamed Expense',
          subtitle: `${exp.category} • ${exp.amount}`,
          data: exp
        })
      }
    })

    // 5. Voting search (ideas & polls)
    ;(activeTrip.ideas || []).forEach(idea => {
      if (safeStr(idea, ['title', 'description', 'sourceName']).includes(q)) {
        r.push({
          id: idea.id,
          tab: 'voting',
          title: idea.title || 'Unnamed Idea',
          subtitle: `Idea pool • ${idea.priceDetails || 'TBD'}`,
          data: idea
        })
      }
    })
    ;(activeTrip.polls || []).forEach(poll => {
      (poll.options || []).forEach(opt => {
        if (safeStr(opt, ['title', 'description', 'sourceName']).includes(q)) {
          r.push({
            id: poll.id,
            tab: 'voting',
            title: opt.title || 'Unnamed Option',
            subtitle: `In poll: ${poll.title}`,
            data: opt
          })
        }
      })
      if (safeStr(poll, ['title', 'notes']).includes(q)) {
          r.push({
            id: poll.id,
            tab: 'voting',
            title: poll.title || 'Unnamed Poll',
            subtitle: `Poll • ${poll.status}`,
            data: poll
          })
      }
    })

    // 6. Append AI results if any
    return [...r, ...aiResults]
  }, [activeTrip, query, aiResults])

  // All selectable items: commands when empty, filtered commands + results when typing
  const allItems = useMemo(() => {
    if (query.trim() === '') return COMMANDS
    const q = query.toLowerCase()
    return [
      ...COMMANDS.filter(c => c.title.toLowerCase().includes(q)),
      ...results,
    ]
  }, [query, results])

  // Reset selection when items change
  useEffect(() => setSelectedIndex(0), [allItems.length])

  const handleAISearch = async () => {
    if (!activeTrip || !query.trim() || isSearchingAI) return
    setIsSearchingAI(true)
    hapticImpact('light')
    try {
      const tripSummary = {
        itinerary: activeTrip.itinerary || [],
        bookings: activeTrip.bookings || [],
        todos: activeTrip.todos || [],
        spendingLog: activeTrip.spendingLog || [],
        ideas: activeTrip.ideas || [],
        polls: activeTrip.polls || []
      }

      const res = await fetch('https://wanderplan-rust.vercel.app/api/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, trip: tripSummary })
      })
      if (!res.ok) throw new Error('Failed AI search')
      const data = await res.json()

      if (data && data.results) {
         setAiResults(data.results.map(r => ({ ...r, subtitle: `✨ AI: ${r.subtitle}` })))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearchingAI(false)
    }
  }

  const handleSelect = (item) => {
    hapticSelection()
    if (item.isCommand) {
      item.action(dispatch)
    } else {
      dispatch({ type: ACTIONS.SET_TAB, payload: item.tab })
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('highlight-item', { detail: { id: item.id, tab: item.tab } }))
      }, 150)
    }
    onClose()
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-32 px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl bg-bg-card border border-border rounded-2xl overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-4 border-b border-border/50 gap-3">
          <Search className="text-text-muted shrink-0" size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent border-none text-text-primary placeholder:text-text-muted text-base sm:text-lg outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-bg-hover text-text-muted transition-colors">
              <X size={16} />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] bg-bg-input border border-border">
            <span className="text-[10px] font-mono font-medium text-text-muted">esc</span>
          </div>
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto scrollbar-hide py-2">
          {query.trim() === '' ? (
            // Command list (empty state)
            <div className="flex flex-col px-2 py-2">
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Commands</p>
              {COMMANDS.map((cmd, idx) => {
                const isSelected = idx === selectedIndex
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center gap-4 w-full text-left px-4 py-3 rounded-xl transition-all ${
                      isSelected ? 'bg-bg-hover border border-border/50' : 'bg-transparent border border-transparent'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-bg-input shrink-0 border border-border/50 flex items-center justify-center text-lg w-9 h-9">{cmd.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">{cmd.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{cmd.subtitle}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : allItems.length === 0 && !isSearchingAI ? (
           <div className="px-6 py-12 text-center">
             <p className="text-sm text-text-muted mb-2">No results for "{query}"</p>
             <button
               onClick={handleAISearch}
               className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-[var(--radius-sm)] text-accent text-xs font-medium cursor-pointer hover:bg-accent/20 transition-colors"
             >
               🪄 Ask Wanda to search semantically
             </button>
           </div>
        ) : allItems.length === 0 && isSearchingAI ? (
           <div className="px-6 py-12 flex flex-col items-center justify-center">
             <div className="flex gap-1.5 mb-3">
               {[0, 1, 2].map(i => (
                 <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
               ))}
             </div>
             <p className="text-sm text-text-muted">Wanda is searching your trip...</p>
           </div>
        ) : (
            <div className="flex flex-col px-2 pb-2">
              {/* Commands section (when typing) */}
              {allItems.some(i => i.isCommand) && (
                <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Commands</p>
              )}
              {allItems.map((item, idx) => {
                const isSelected = idx === selectedIndex
                const icon = item.isCommand ? item.emoji : TABS[item.tab]?.emoji

                // Insert "Results" section header before first non-command item
                const prevIsCommand = idx > 0 && allItems[idx - 1].isCommand
                const showResultsHeader = !item.isCommand && (idx === 0 || prevIsCommand)

                return (
                  <React.Fragment key={item.isCommand ? item.id : `${item.tab}-${item.id}`}>
                    {showResultsHeader && (
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wide">Results</p>
                    )}
                    <button
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center gap-4 w-full text-left px-4 py-3 rounded-xl transition-all ${
                        isSelected ? 'bg-bg-hover border border-border/50' : 'bg-transparent border border-transparent'
                      }`}
                    >
                      <div className="p-2 rounded-lg bg-bg-input shrink-0 border border-border/50 flex items-center justify-center text-lg w-9 h-9">
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{item.title}</p>
                        <p className="text-xs text-text-muted truncate mt-0.5 max-w-[90%]">{item.subtitle}</p>
                      </div>
                      {!item.isCommand && (
                        <div className="shrink-0 text-text-muted opacity-50">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                        </div>
                      )}
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-bg-sidebar border-t border-border flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="font-sans px-1 py-0.5 rounded bg-bg-input border border-border">↑↓</kbd> to navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="font-sans px-1 py-0.5 rounded bg-bg-input border border-border">↵</kbd> to select</span>
          </div>
          <span className="font-medium flex items-center gap-1">Powered by <span className="text-accent wanda-serif">Wanda</span></span>
        </div>
      </div>
    </div>,
    document.body
  )
}
