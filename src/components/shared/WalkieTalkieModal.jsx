import React, { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { createPortal } from 'react-dom'
import { X, Mic, MicOff, Radio } from 'lucide-react'
import { TripContext } from '../../context/TripContext'
import { buildTripSystemPrompt } from '../../hooks/useAI'
import { useWandaLive } from '../../hooks/useWandaLive'
import { hapticSelection } from '../../utils/haptics'
import { useLiveWeatherContext } from '../../hooks/useLiveWeatherContext'
import { wandaRuntime } from '../../utils/wandaRuntime'

function buildVoiceSystemPrompt(activeTrip, weatherContext) {
  const base = buildTripSystemPrompt(activeTrip)
  const weather = weatherContext ? `LIVE WEATHER:\n${weatherContext}` : ''
  const tab = wandaRuntime.activeTab ? `ACTIVE TAB: ${wandaRuntime.activeTab}` : ''
  const ui = wandaRuntime.uiContext ? `UI CONTEXT: ${wandaRuntime.uiContext}` : ''
  const context = [weather, tab, ui].filter(Boolean).join('\n')
  return [
    base,
    context,
    'VOICE MODE: You are speaking aloud to the user in real-time. Keep every reply to 2-3 short sentences maximum. Be warm and conversational — no lists, no markdown, no bullet points.',
  ].filter(Boolean).join('\n\n')
}

export default function WalkieTalkieModal() {
  const [isOpen, setIsOpen] = useState(false)
  const { activeTrip } = useContext(TripContext)
  const weatherContext = useLiveWeatherContext(activeTrip)
  const weatherRef = useRef(weatherContext)
  useEffect(() => { weatherRef.current = weatherContext }, [weatherContext])

  const { isConnected, isListening, isSpeaking, error, startSession, endSession } = useWandaLive()

  // Open/close via custom event from BottomNav (mobile) or AIAssistant mic button (desktop)
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggle-walkie', handleToggle)
    window.addEventListener('toggle-walkie-mobile', handleToggle) // legacy mobile event
    return () => {
      window.removeEventListener('toggle-walkie', handleToggle)
      window.removeEventListener('toggle-walkie-mobile', handleToggle)
    }
  }, [])

  // End session when modal closes
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (!isOpen && prevOpenRef.current && isConnected) {
      endSession()
    }
    prevOpenRef.current = isOpen
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    hapticSelection()
    setIsOpen(false)
  }, [])

  // The mic button: start session (first tap) or end session (tap while connected)
  // Must be an onClick handler — iOS Safari requires AudioContext + getUserMedia inside a gesture
  const handleMicPress = useCallback(() => {
    hapticSelection()
    if (isConnected) {
      endSession()
    } else {
      const prompt = buildVoiceSystemPrompt(activeTrip, weatherRef.current)
      startSession(prompt)
    }
  }, [isConnected, activeTrip, startSession, endSession])

  if (!isOpen) return null

  const statusLabel = (() => {
    if (error) return { text: error, color: 'text-red-400' }
    if (isSpeaking) return { text: 'Wanda is speaking', color: 'text-[var(--color-text-muted)]' }
    if (isListening) return { text: 'Listening', color: 'text-[var(--color-accent)] animate-pulse' }
    if (isConnected) return { text: 'Connected', color: 'text-[var(--color-text-muted)]' }
    return { text: 'Tap the mic to start', color: 'text-[var(--color-text-muted)]' }
  })()

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
        .walkie-ring-listen { animation: walkie-pulse-ring 1s ease-out infinite; }
        .walkie-ring-speak  { animation: walkie-speaking-ring 1.2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="w-full flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪄</span>
          <span className="font-heading text-base font-semibold text-[var(--color-text-primary)] tracking-tight">
            Wanda Voice
          </span>
          {isConnected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 uppercase tracking-widest">
              <Radio size={10} className="animate-pulse" /> Live
            </span>
          )}
        </div>
        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Center area */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-8 gap-3 text-center">
        {!isConnected && !error && (
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed max-w-[260px]">
            Talk to Wanda in real-time. She can hear your voice and respond with audio instantly.
          </p>
        )}
        {isConnected && !isSpeaking && isListening && (
          <p className="text-[var(--color-text-muted)] text-sm">
            Speak naturally — Wanda is listening
          </p>
        )}
        {isSpeaking && (
          <p className="text-[var(--color-text-muted)] text-sm">
            Interrupt anytime by speaking
          </p>
        )}
        {error && (
          <p className="text-red-400 text-sm max-w-[260px]">{error}</p>
        )}
      </div>

      {/* Status label */}
      <div className="mb-4 h-5 flex items-center justify-center">
        <span className={`text-xs font-medium tracking-wide uppercase ${statusLabel.color}`}>
          {statusLabel.text}
        </span>
      </div>

      {/* Mic button */}
      <div className="mb-16 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          {isListening && !isSpeaking && (
            <div
              className="walkie-ring-listen absolute w-[72px] h-[72px] rounded-full bg-[var(--color-accent)]"
              style={{ pointerEvents: 'none' }}
            />
          )}
          {isSpeaking && (
            <div
              className="walkie-ring-speak absolute w-[72px] h-[72px] rounded-full bg-[var(--color-accent)]"
              style={{ pointerEvents: 'none' }}
            />
          )}
          <button
            type="button"
            onClick={handleMicPress}
            className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all shadow-lg ${
              isConnected
                ? 'bg-[var(--color-accent)] text-white scale-105'
                : 'bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border)] text-[var(--color-text-secondary)]'
            }`}
          >
            {isConnected ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
