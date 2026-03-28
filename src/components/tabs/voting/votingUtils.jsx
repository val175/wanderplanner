import { createPortal } from 'react-dom'
import { getCategory } from '../../../constants/categories'
import AvatarCircle from '../../shared/AvatarCircle'
import { formatCurrency, formatCurrencyRange } from '../../../utils/helpers'

/**
 * Standardize price display for ideas/options
 * Format: ₱1,234 (est.) /TOTAL
 */
export function formatIdeaPrice(priceDetails, currency = 'PHP') {
  if (!priceDetails || priceDetails === 'TBD' || priceDetails === '???' || priceDetails === 'null') {
    return { amount: 'TBD', unit: 'total' }
  }

  const [rawAmount, rawUnit] = priceDetails.split('/')
  const unit = (rawUnit || 'total').toLowerCase().trim()
  let amount = rawAmount.replace(/PHP|USD|EUR|GBP|JPY/gi, '').trim()

  // Handle price ranges like "60000 - 120000" or "60,000 – 120,000"
  const rangeMatch = amount.match(/^([\d,]+)\s*[-–]\s*([\d,]+)/)
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1].replace(/,/g, ''))
    const high = parseFloat(rangeMatch[2].replace(/,/g, ''))
    return { amount: formatCurrencyRange(low, high, currency), unit }
  }

  // Single number
  const num = parseFloat(amount.replace(/[^0-9.]/g, ''))
  if (!isNaN(num) && num > 0) {
    amount = `${formatCurrency(num, currency)} (est.)`
  } else if (!amount.toLowerCase().includes('(est.)')) {
    amount = `${amount} (est.)`
  }

  return { amount, unit }
}

export function CategoryPill({ type }) {
  const meta = getCategory(type)
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover">
      {meta.emoji} {meta.label}
    </span>
  )
}

export function SourceIcon({ sourceName }) {
  if (!sourceName) return null
  const emoji =
    sourceName.includes('Airbnb') ? '🏠' :
      sourceName.includes('TikTok') ? '🎵' :
        sourceName.includes('TripAdvisor') ? '🦉' :
          sourceName.includes('Google') ? '📍' : '🔗'
  return <span className="mr-0.5">{emoji}</span>
}

export function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-bg-card overflow-hidden animate-pulse flex flex-col">
      <div className="h-40 bg-bg-secondary w-full" />
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div>
          <div className="h-4 bg-bg-secondary rounded w-3/4 mb-2" />
          <div className="h-3 bg-bg-secondary rounded w-full mb-1" />
          <div className="h-3 bg-bg-secondary rounded w-2/3" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-bg-secondary rounded flex-1" />
          <div className="h-8 bg-bg-secondary rounded flex-1" />
        </div>
      </div>
    </div>
  )
}

export function TokenInventory({ poll, activeUserId }) {
  const userVotes = poll.votes?.[activeUserId] || { tokens: {}, veto: null }
  const tokensUsed = Object.values(userVotes.tokens).reduce((sum, count) => sum + count, 0)
  const tokensRemaining = 3 - tokensUsed
  const hasVetoed = !!userVotes.veto

  return (
    <div className="flex items-center gap-3 bg-bg-secondary px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-semibold border border-border">
      <div className="flex gap-1 items-center">
        <span className="text-text-secondary mr-1">Tokens:</span>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${i < tokensRemaining ? 'bg-amber-400' : 'bg-border'}`} />
        ))}
      </div>
      <div className="w-px h-3 bg-border" />
      <div className={`flex items-center gap-1 ${hasVetoed ? 'opacity-50 grayscale' : 'text-danger'}`}>
        <span>🧨</span> {hasVetoed ? '0' : '1'} Veto
      </div>
    </div>
  )
}

export function FloatingActionBar({ count, isCreatingPoll, onStartDraft, onSubmit, disabled, onCancel }) {
  if (count < 2) return null
  return createPortal(
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
      <div className="flex items-center gap-3 bg-[#1A1918] text-white rounded-full px-5 py-3 border border-white/20">
        <div>
          <div className="text-[13px] font-semibold">{count} {count === 1 ? 'Idea' : 'Ideas'} Selected</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Ready to vote?</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <button
          onClick={onCancel}
          className="text-[12px] font-semibold text-white/60 hover:text-white transition-colors px-2"
        >Cancel</button>
        <button
          onClick={isCreatingPoll ? onSubmit : onStartDraft}
          disabled={disabled}
          className={`flex items-center gap-2 text-[13px] font-semibold px-5 py-2 rounded-[var(--radius-pill)] transition-colors ${disabled ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white'}`}
        >
          {isCreatingPoll ? 'Start Poll' : 'Create Proposal'}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>,
    document.body
  )
}
