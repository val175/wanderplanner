/**
 * EmptyState — standard empty-state block with optional Wanda CTA.
 * Opens Wanda panel via custom event; pass wandaPrompt to pre-fill the chat.
 */
export default function EmptyState({ emoji, title, subtitle, wandaPrompt, action }) {
  const handleWanda = () => {
    window.dispatchEvent(new CustomEvent('toggle-wanda-mobile'))
    if (wandaPrompt) {
      // Short delay so the panel opens before the prompt fires
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('wanda-prefill', { detail: { text: wandaPrompt } }))
      }, 150)
    }
  }

  return (
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
            🪄 Ask Wanda
          </button>
        )}
      </div>
    </div>
  )
}
