import { useState, useEffect } from 'react'

function WandSVG() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"
      style={{ color: 'var(--color-accent)' }}>
      {/* Stick: tip (upper-right) → handle (lower-left) */}
      <line x1="21" y1="7" x2="5" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* 4-pointed star at the tip */}
      <path d="M21 1.5 L22.5 5.5 L26.5 7 L22.5 8.5 L21 12.5 L19.5 8.5 L15.5 7 L19.5 5.5 Z"
        fill="currentColor" />
      {/* Sparkle dots along the stick */}
      <circle cx="14" cy="14" r="1.1" fill="currentColor" opacity="0.45" />
      <circle cx="9"  cy="19" r="0.85" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

/**
 * Animated Wanderplan wordmark.
 *
 * Sequence (runs once on mount):
 *  200ms → "Wanderplan" fades up into view (Wander normal, plan normal)
 *  950ms → Wand SVG slides in from the left
 * 1550ms → Wand taps the "W" (shake animation)
 * 2400ms → "Wander" cross-fades to italic
 */
export default function WandWordmark({ onComplete }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 950),
      setTimeout(() => setPhase(3), 1550),
      setTimeout(() => setPhase(4), 2400),
      // fire after the italic crossfade transition finishes (450ms after phase 4)
      setTimeout(() => onComplete?.(), 2850),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>

        {/* ── Wand ── */}
        {/* Outer div: pure layout positioning — never animated */}
        <div style={{
          position: 'absolute',
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          paddingRight: '6px',
        }}>
          {/* Inner div: opacity + slide-in via transition, tap via animation */}
          <div style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? 'translateX(0)' : 'translateX(-24px)',
            transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            animation: phase === 3 ? 'wand-tap 0.55s ease-in-out' : 'none',
          }}>
            <WandSVG />
          </div>
        </div>

        {/* ── Wordmark ── */}
        <h1 style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: '2.5rem',
          fontWeight: 400,
          margin: 0,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.5s ease, transform 0.5s ease',
        }}>
          {/* "Wander" — cross-fades normal → italic in phase 4 */}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            {/* Normal Wander — fades out */}
            <span style={{
              display: 'inline-block',
              opacity: phase >= 4 ? 0 : 1,
              transition: 'opacity 0.45s ease',
            }}>Wander</span>
            {/* Italic Wander — absolutely overlaid, fades in */}
            <span style={{
              position: 'absolute',
              left: 0,
              top: 0,
              fontStyle: 'italic',
              opacity: phase >= 4 ? 1 : 0,
              transition: 'opacity 0.45s ease',
              whiteSpace: 'nowrap',
            }}>Wander</span>
          </span>
          {/* "plan" — always normal */}
          plan
        </h1>

      </div>
    </div>
  )
}
