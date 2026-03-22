import React, { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { X, Mic, MicOff } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { auth } from '../../firebase/config'
import { TripContext } from '../../context/TripContext'
import { buildTripSystemPrompt } from '../../hooks/useAI'
import { useWalkieTalkie } from '../../hooks/useWalkieTalkie'
import { hapticSelection } from '../../utils/haptics'
import { useLiveWeatherContext } from '../../hooks/useLiveWeatherContext'
import { wandaRuntime } from '../../utils/wandaRuntime'

let _walkieSystemPromptRef = buildTripSystemPrompt(null)

const walkieChatTransport = new DefaultChatTransport({
  api: 'https://wanderplan-rust.vercel.app/api/chat',
  body: () => ({
    systemPrompt: _walkieSystemPromptRef,
    weatherContext: wandaRuntime.weatherContext,
    activeTab: wandaRuntime.activeTab,
    selectedMapPoint: wandaRuntime.selectedMapPoint,
    uiContext: wandaRuntime.uiContext,
  }),
  fetch: async (url, options) => {
    try {
      let token = ''
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken() } catch (e) { console.warn('[Walkie] Token error:', e) }
      }
      const headers = new Headers(options.headers || {})
      headers.set('Content-Type', 'application/json')
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(url, { ...options, headers, mode: 'cors', credentials: 'omit' })
      if (!response.ok) console.error(`[Walkie] HTTP ${response.status}: ${response.statusText}`)
      return response
    } catch (err) {
      console.error('[Walkie] Fetch crash:', err)
      throw err
    }
  }
})

export default function WalkieTalkieModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { activeTrip } = useContext(TripContext)
  const prevStatusRef = useRef('ready')
  const speakRef = useRef(null)
  const weatherContext = useLiveWeatherContext(activeTrip)

  // Keep system prompt in sync with active trip
  useEffect(() => {
    const base = buildTripSystemPrompt(activeTrip)
    _walkieSystemPromptRef = base + '\n\nVOICE MODE: You are responding via voice. Keep every reply to 2-3 short sentences maximum. Be direct and conversational — no lists, no headers, no markdown formatting.'
  }, [activeTrip])

  useEffect(() => {
    wandaRuntime.weatherContext = weatherContext
  }, [weatherContext])

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: walkieChatTransport,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  const handleTranscriptReady = useCallback((text) => {
    if (!text.trim() || status === 'submitted' || status === 'streaming') return
    sendMessage({ text })
  }, [status, sendMessage])

  const {
    isWalkieTalkieMode, isListening, isSpeaking, isMicPreparing, transcript, isSTTSupported,
    toggleWalkieTalkieMode, startListening, stopListening, speak,
  } = useWalkieTalkie({ onTranscriptReady: handleTranscriptReady })

  // Keep speak ref up-to-date for the status effect
  speakRef.current = speak

  // TTS trigger on streaming→ready transition
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (prev === 'streaming' && status === 'ready') {
      const lastMsg = [...messages].reverse().find(m => m.role === 'assistant')
      if (lastMsg) {
        const textParts = lastMsg.parts?.filter(p => p.type === 'text') ?? []
        const text = textParts.map(p => p.text).join('').trim() || lastMsg.content || ''
        if (text) speakRef.current?.(text)
      }
    }
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // Open/close via custom event from BottomNav
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggle-walkie-mobile', handleToggle)
    return () => window.removeEventListener('toggle-walkie-mobile', handleToggle)
  }, [])

  // Turn walkie-talkie mode on/off when modal opens/closes
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      // Modal just opened — enable walkie mode then start listening
      toggleWalkieTalkieMode()
    } else if (!isOpen && prevOpenRef.current) {
      // Modal just closed — disable walkie mode (toggleWalkieTalkieMode handles cleanup)
      if (isWalkieTalkieMode) toggleWalkieTalkieMode()
      // Clear ephemeral messages
      setMessages([])
      prevStatusRef.current = 'ready'
    }
    prevOpenRef.current = isOpen
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    hapticSelection()
    setIsOpen(false)
  }, [])

  // Last assistant message for display
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
  const lastAssistantText = lastAssistantMsg
    ? (lastAssistantMsg.parts?.filter(p => p.type === 'text').map(p => p.text).join('').trim() || lastAssistantMsg.content || '')
    : ''

  if (!isOpen) return null

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-between bg-[var(--color-bg-primary)]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <style>{`
        @keyframes walkie-pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes walkie-speaking-ring {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.2; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        .walkie-ring-listen {
          animation: walkie-pulse-ring 1s ease-out infinite;
        }
        .walkie-ring-speak {
          animation: walkie-speaking-ring 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="w-full flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪄</span>
          <span className="font-heading text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
            Wanda Voice
          </span>
        </div>
        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Wanda response area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-8 gap-4 text-center">
        {isLoading && (
          <p className="text-[var(--color-text-muted)] text-sm italic animate-pulse">
            Wanda is thinking...
          </p>
        )}
        {!isLoading && lastAssistantText && (
          <div className="text-[var(--color-text-primary)] text-[15px] leading-relaxed max-w-[320px] prose prose-sm prose-neutral dark:prose-invert">
            <ReactMarkdown>
              {lastAssistantText.length > 200 ? lastAssistantText.slice(0, 200) + '…' : lastAssistantText}
            </ReactMarkdown>
          </div>
        )}
        {!isLoading && !lastAssistantText && !isListening && !isSpeaking && (
          <p className="text-[var(--color-text-muted)] text-sm">
            {isWalkieTalkieMode ? 'Tap the mic and speak' : 'Starting…'}
          </p>
        )}

        {/* Live transcript */}
        {transcript && isListening && (
          <p className="text-[var(--color-accent)] text-sm font-medium max-w-[280px]">
            "{transcript}"
          </p>
        )}
      </div>

      {/* Status label */}
      <div className="mb-4 h-5 flex items-center justify-center">
        {isListening && isMicPreparing && (
          <span className="text-[var(--color-text-muted)] text-xs font-medium animate-pulse tracking-wide uppercase">
            Getting ready...
          </span>
        )}
        {isListening && !isMicPreparing && (
          <span className="text-[var(--color-accent)] text-xs font-medium animate-pulse tracking-wide uppercase">
            Listening
          </span>
        )}
        {isSpeaking && (
          <span className="text-[var(--color-text-muted)] text-xs tracking-wide uppercase">
            Speaking
          </span>
        )}
        {isLoading && !isSpeaking && (
          <span className="text-[var(--color-text-muted)] text-xs tracking-wide uppercase">
            Thinking
          </span>
        )}
      </div>

      {/* Mic button */}
      <div className="mb-16 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {/* Pulse ring — listening */}
          {isListening && (
            <div
              className="walkie-ring-listen absolute w-[72px] h-[72px] rounded-full bg-[var(--color-accent)]"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* Soft ring — speaking */}
          {isSpeaking && (
            <div
              className="walkie-ring-speak absolute w-[72px] h-[72px] rounded-full bg-[var(--color-accent)]"
              style={{ pointerEvents: 'none' }}
            />
          )}
          <button
            type="button"
            onClick={() => {
              hapticSelection()
              if (isListening) {
                stopListening()
              } else if (!isLoading) {
                startListening()
              }
            }}
            disabled={isLoading}
            className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all shadow-lg ${
              isListening
                ? 'bg-[var(--color-accent)] text-white scale-105'
                : 'bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] disabled:opacity-40'
            }`}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
