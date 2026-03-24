import { useEffect, useRef } from 'react'

/**
 * LevelUpModal — full-screen celebration shown when the user levels up.
 * Triggered by the `xp-level-up` custom window event fired from ProfileContext.
 * Wired into App.jsx via a useEffect listener.
 */
export default function LevelUpModal({ event, onClose }) {
  const { newLevel } = event?.detail || {}
  const timerRef = useRef(null)

  useEffect(() => {
    // Auto-dismiss after 5 seconds
    timerRef.current = setTimeout(onClose, 5000)
    return () => clearTimeout(timerRef.current)
  }, [onClose])

  if (!newLevel) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center gap-5 px-10 py-12 rounded-3xl text-center"
        style={{
          background: 'var(--color-bg-card)',
          border: `2px solid ${newLevel.frameColor}`,
          boxShadow: `0 0 60px ${newLevel.frameColor}55, 0 0 120px ${newLevel.frameColor}22`,
          maxWidth: 400,
          animation: 'levelUpBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow pulse ring */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            border: `1px solid ${newLevel.frameColor}44`,
            animation: 'levelUpPulse 2s ease-in-out infinite',
          }}
        />

        {/* Level emoji */}
        <div style={{ fontSize: 72, lineHeight: 1, animation: 'levelUpSpin 0.6s ease-out' }}>
          {newLevel.emoji}
        </div>

        {/* Level badge */}
        <div
          className="px-4 py-1 rounded-full text-white text-xs font-bold uppercase tracking-widest"
          style={{ background: newLevel.frameColor }}
        >
          Level {newLevel.level}
        </div>

        {/* Title */}
        <div>
          <h2
            className="font-heading text-4xl font-bold tracking-tight"
            style={{ color: newLevel.frameColor }}
          >
            {newLevel.title}
          </h2>
          <p className="text-text-secondary text-sm mt-1">You leveled up!</p>
        </div>

        {/* XP reward callout */}
        <p className="text-text-muted text-xs leading-relaxed max-w-[240px]">
          Your frame, map marker and Wanda personality have been upgraded.
        </p>

        {/* Dismiss */}
        <button
          onClick={onClose}
          className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-transform active:scale-95"
          style={{ background: newLevel.frameColor }}
        >
          Keep exploring! ✈️
        </button>

        {/* Progress bar (auto-dismiss timer) */}
        <div className="w-full h-0.5 rounded-full overflow-hidden bg-border/30 mt-2">
          <div
            className="h-full rounded-full"
            style={{
              background: newLevel.frameColor,
              animation: 'levelUpTimer 5s linear forwards',
              transformOrigin: 'left',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes levelUpBounce {
          from { opacity: 0; transform: scale(0.7) translateY(20px); }
          to   { opacity: 1; transform: scale(1)   translateY(0); }
        }
        @keyframes levelUpSpin {
          from { transform: rotate(-20deg) scale(0.6); }
          to   { transform: rotate(0deg)  scale(1); }
        }
        @keyframes levelUpPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.8; transform: scale(1.01); }
        }
        @keyframes levelUpTimer {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  )
}
