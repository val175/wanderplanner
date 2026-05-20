import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { spring } from '../../lib/motion'

const DISMISS_MS = 3000

const CONFIG = {
  success: {
    colors: 'bg-success/10 text-success border-success/20',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    bar: 'bg-success',
  },
  error: {
    colors: 'bg-danger/10 text-danger border-danger/20',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    bar: 'bg-danger',
  },
  info: {
    colors: 'bg-info/10 text-info border-info/20',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    bar: 'bg-info',
  },
  warning: {
    colors: 'bg-warning/10 text-warning border-warning/20',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    bar: 'bg-warning',
  },
}

function ToastContent({ message, type }) {
  const cfg = CONFIG[type] || CONFIG.success
  // Countdown bar shrinks from 100% → 0% over DISMISS_MS
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    setProgress(100)
    const start = performance.now()
    let raf
    function tick(now) {
      const elapsed = now - start
      const remaining = Math.max(0, 100 - (elapsed / DISMISS_MS) * 100)
      setProgress(remaining)
      if (remaining > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [message]) // reset when a new toast fires

  return (
    <motion.div
      layout
      role="status"
      aria-live="polite"
      initial={{ y: 20, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 12, opacity: 0, scale: 0.95 }}
      transition={spring.bouncy}
      className={`
        fixed bottom-6 md:bottom-6 left-1/2 -translate-x-1/2 z-[60]
        min-w-[240px] max-w-sm overflow-hidden
        rounded-[var(--radius-lg)] border
        font-medium text-sm
        shadow-lg
        ${cfg.colors}
      `}
      style={{ translateX: '-50%' }}
    >
      {/* Main content row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 opacity-90">{cfg.icon}</span>
        <span className="flex-1 leading-snug">{message}</span>
      </div>

      {/* Countdown bar */}
      <div className="h-[2px] w-full bg-current/10">
        <div
          className={`h-full ${cfg.bar} opacity-60 transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  )
}

export default function Toast({ message, type = 'success', visible }) {
  if (!message) return null

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <ToastContent key={message + type} message={message} type={type} />
      )}
    </AnimatePresence>
  )
}
