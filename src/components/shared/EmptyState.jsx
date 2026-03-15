/**
 * EmptyState — standard empty-state block with optional Wanda CTA.
 * Includes dashed border wrapper (VotingTab standard).
 * Opens Wanda and auto-submits the prompt via wanda-prefill event.
 */
export default function EmptyState({ emoji, title, subtitle, wandaPrompt, action, className }) {
  const handleWanda = () => {
    if (wandaPrompt) {
      window.dispatchEvent(new CustomEvent('wanda-prefill', { detail: { text: wandaPrompt } }))
    }
  }

  return (
    <div className={`border-2 border-dashed border-border rounded-[var(--radius-xl)] bg-bg-secondary/30 ${className || ''}`}>
      <div className="py-16 flex flex-col items-center gap-3 text-center px-4">
        <span className="text-4xl">{emoji}</span>
        <div>
          <p className="font-semibold text-text-primary font-heading text-balance">{title}</p>
          {subtitle && <p className="text-sm text-text-muted mt-1 text-balance max-w-xs mx-auto">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
          {action}
          {wandaPrompt && (
            <button
              onClick={handleWanda}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] border border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover hover:text-text-primary text-xs font-medium transition-colors"
            >
              🪄 Ask <span className="wanda-serif">Wanda</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
