import { useState, useRef, useEffect } from 'react'
import { useTripContext } from '../../context/TripContext'
import { buildTripSystemPrompt, sendMessage } from '../../hooks/useAI'

/* ─────────────────────────────────────────────────────────────
   Prompt chips — one-tap shortcuts that pre-fill the input
───────────────────────────────────────────────────────────── */
const PROMPT_CHIPS = [
  { label: '🗺️ Optimize itinerary', text: 'Can you review my itinerary and suggest any improvements or optimizations?' },
  { label: '🍽️ Restaurant tips',    text: 'What are the best restaurants or food experiences I should try on this trip?' },
  { label: '🧳 Packing advice',     text: 'Based on my destinations and dates, what should I make sure to pack?' },
  { label: '💰 Budget check',       text: 'How is my budget looking? Any tips to save money or where to splurge?' },
  { label: '⚡ Hidden gems',        text: 'What are some lesser-known hidden gems or local tips for my destinations?' },
  { label: '📅 Day plan',           text: 'Can you suggest a perfect day itinerary for one of my destinations?' },
]

/* ─────────────────────────────────────────────────────────────
   Message bubble
───────────────────────────────────────────────────────────── */
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-0.5">
          🪄
        </div>
      )}
      <div
        className={`
          max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-accent text-text-inverse rounded-tr-sm'
            : 'bg-bg-secondary border border-border text-text-primary rounded-tl-sm'
          }
        `}
      >
        {msg.text}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Typing indicator
───────────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-0.5">
        🪄
      </div>
      <div className="bg-bg-secondary border border-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main AIAssistant component
───────────────────────────────────────────────────────────── */
export default function AIAssistant() {
  const { activeTrip } = useTripContext()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showChips, setShowChips] = useState(true)
  // Track whether this is the very first mount so we can play bounce-in once
  const [mounted, setMounted] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Trigger bounce-in on first mount with a tiny delay
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const systemPrompt = buildTripSystemPrompt(activeTrip)

  async function handleSend(text) {
    const message = (text || input).trim()
    if (!message || loading) return

    setInput('')
    setError(null)
    setShowChips(false)

    const userMsg = { role: 'user', text: message }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const history = messages
      const reply = await sendMessage(systemPrompt, history, message)
      setMessages(prev => [...prev, { role: 'model', text: reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleChipClick(chip) { handleSend(chip.text) }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleClear() { setMessages([]); setError(null); setShowChips(true) }

  const hasMessages = messages.length > 0

  return (
    <>
      {/* ── Glass pill FAB — bottom-right ── */}
      {mounted && (
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`
            fixed bottom-8 right-8 z-40
            flex items-center gap-2 px-5 py-2.5
            rounded-full text-sm font-semibold
            transition-all duration-200 active:scale-95
            animate-bounce-in
            ${isOpen
              ? 'text-text-secondary'
              : 'text-text-primary'
            }
          `}
          style={{
            background: isOpen
              ? 'var(--color-bg-secondary)'
              : 'var(--color-bg-card)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 4px 24px 0 rgb(0 0 0 / 0.10), 0 1px 4px 0 rgb(0 0 0 / 0.06)',
          }}
          title={isOpen ? 'Close Wanda' : 'Ask Wanda AI'}
          aria-label={isOpen ? 'Close AI assistant' : 'Open AI assistant'}
        >
          <span className="text-base leading-none">{isOpen ? '✕' : '✨'}</span>
          <span>{isOpen ? 'Close' : 'Ask Wanda'}</span>
        </button>
      )}

      {/* ── Chat panel — above FAB, bottom-right ── */}
      <div
        className={`
          fixed bottom-24 right-8 z-40
          w-[min(400px,calc(100vw-2rem))]
          border border-border rounded-[var(--radius-lg)]
          shadow-2xl flex flex-col
          transition-all duration-300 ease-out
          ${isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
          }
        `}
        style={{
          maxHeight: 'min(560px, calc(100dvh - 8rem))',
          background: 'var(--color-bg-primary)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🪄</span>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">Wanda</p>
              <p className="text-[10px] text-text-muted leading-tight">
                {activeTrip ? `Knows your ${activeTrip.name} trip` : 'AI travel assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMessages && (
              <button
                onClick={handleClear}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors px-2 py-1 rounded hover:bg-bg-secondary"
                title="Clear chat"
              >
                Clear
              </button>
            )}
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Connected" />
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {!hasMessages && showChips && (
            <div>
              <p className="text-xs text-text-muted text-center mb-4 leading-relaxed">
                {activeTrip
                  ? `I know your ${activeTrip.emoji || '✈️'} ${activeTrip.name} trip. Ask me anything!`
                  : 'Your AI travel companion. Ask me anything about travel planning!'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROMPT_CHIPS.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => handleChipClick(chip)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-bg-secondary
                               hover:bg-bg-tertiary hover:border-accent/40 text-text-secondary
                               transition-all duration-150 active:scale-95"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && <TypingIndicator />}

          {error && (
            <div className="text-xs text-center text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-2">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick chips mid-conversation */}
        {hasMessages && !loading && (
          <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto flex-shrink-0 scrollbar-none">
            {PROMPT_CHIPS.slice(0, 3).map(chip => (
              <button
                key={chip.label}
                onClick={() => handleChipClick(chip)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-bg-secondary
                           hover:bg-bg-tertiary text-text-muted whitespace-nowrap
                           transition-all duration-150 active:scale-95 flex-shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="px-3 pb-3 pt-1 flex-shrink-0 border-t border-border mt-auto">
          <div className="flex items-end gap-2 mt-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your trip…"
              rows={1}
              className="
                flex-1 resize-none rounded-[var(--radius-md)] border border-border
                bg-bg-secondary text-text-primary placeholder:text-text-muted
                px-3 py-2 text-sm leading-relaxed
                focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20
                transition-all duration-150
                scrollbar-none overflow-hidden
              "
              style={{ minHeight: '38px', maxHeight: '120px' }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="
                w-9 h-9 flex-shrink-0 rounded-[var(--radius-md)]
                bg-accent hover:bg-accent-hover text-text-inverse
                flex items-center justify-center
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 active:scale-95
              "
              aria-label="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-text-muted text-center mt-1.5 opacity-60">
            Powered by Gemini 2.0 Flash · Enter to send
          </p>
        </div>
      </div>

      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
