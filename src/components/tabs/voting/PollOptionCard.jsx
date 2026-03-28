import { useState } from 'react'
import AvatarCircle from '../../shared/AvatarCircle'
import { formatIdeaPrice } from './votingUtils'

export default function PollOptionCard({ option, poll, activeUserId, onVote, isLeader, globalTokensRemaining, globalVetoesRemaining, resolveProfile }) {
  const [imgError, setImgError] = useState(false)
  const userVotes = poll.votes?.[activeUserId] || { tokens: {}, veto: null }

  const myTokens = userVotes.tokens[option.id] || 0
  const isMyVeto = userVotes.veto === option.id

  let totalTokens = 0
  let totalVetoes = 0
  Object.values(poll.votes || {}).forEach(vote => {
    totalTokens += (vote.tokens[option.id] || 0)
    if (vote.veto === option.id) totalVetoes += 1
  })

  const isVetoedByAnyone = totalVetoes > 0

  return (
    <div className={`relative flex flex-col rounded-[var(--radius-lg)] border-[2px] transition-all bg-bg-card
        ${isVetoedByAnyone ? 'border-danger/30 opacity-70 grayscale' : isLeader ? 'border-accent ring-1 ring-accent/20' : 'border-border'}
        ${myTokens > 0 && !isLeader ? 'border-amber-300' : ''}`}>

      {isLeader && !isVetoedByAnyone && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full z-20 flex items-center gap-1.5 whitespace-nowrap">
          🏆 Current Leader
        </div>
      )}

      {isVetoedByAnyone && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-body/50 backdrop-blur-[1px] rounded-[var(--radius-lg)] pointer-events-none">
          <span className="rotate-[-6deg] text-danger font-semibold border-2 border-danger px-4 py-1.5 rounded-[var(--radius-md)] bg-bg-card opacity-90 tracking-wider uppercase">Vetoed 🧨</span>
        </div>
      )}

      {/* Image Thumbnail */}
      <div className={`h-32 w-full bg-bg-secondary rounded-t-[calc(var(--radius-lg)-2px)] overflow-hidden shrink-0 flex items-center justify-center relative ${isLeader ? 'mt-0' : ''}`}>
        {option.imageUrl && !imgError ? (
          <img src={option.imageUrl} className="w-full h-full object-cover" alt="" loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <span className="text-4xl">{option.emoji || '✨'}</span>
        )}
      </div>

      {/* Info Section */}
      <div className="flex-1 p-3 flex flex-col">
        <a href={option.url} target="_blank" rel="noreferrer" className="text-base font-semibold font-heading text-text-primary hover:text-accent line-clamp-2 leading-tight mb-1">
          {option.title}
        </a>
        <div className="text-xs text-text-secondary flex flex-wrap items-center gap-1">
          {(() => {
            const { amount, unit } = formatIdeaPrice(option.priceDetails)
            return (
              <>
                <span className="font-semibold">{amount}</span>
                <span className="text-[10px] tracking-wider uppercase">/{unit}</span>
              </>
            )
          })()}
          {option.sourceName && <span className="opacity-50">•</span>}
          {option.sourceName && <span>{option.sourceName}</span>}
        </div>

        {/* Global Stats */}
        <div className="mt-auto pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center -space-x-1.5 min-w-[32px]">
            {totalTokens > 0 ? (
              <div className="flex items-center -space-x-1.5">
                {Object.entries(poll.votes || {}).filter(([k, v]) => v.tokens[option.id] > 0).slice(0, 3).map(([k, v], i) => (
                  <div key={k} style={{ zIndex: 10 - i }}>
                    <AvatarCircle profile={resolveProfile(k)} size={24} />
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-text-muted font-medium">No tokens yet</span>
            )}
          </div>
          {totalTokens > 0 && (
            <div className="bg-amber-500/10 text-amber-600 font-semibold text-[10px] uppercase tracking-wider px-2 py-1 rounded">
              {totalTokens} Tokens
            </div>
          )}
        </div>

        {/* Voting Controls */}
        <div className={`mt-2 flex flex-col gap-2 shrink-0 z-20 ${poll.status === 'resolved' ? 'pointer-events-none opacity-50' : ''}`}>
          {myTokens > 0 ? (
            <div className="flex items-center justify-between border border-amber-500 rounded-[var(--radius-md)] overflow-hidden">
              <button onClick={() => onVote(poll.id, option.id, 'token', 'remove')}
                className="w-10 h-10 flex items-center justify-center text-amber-500 hover:bg-amber-500/10 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
              </button>
              <span className="text-xs font-semibold text-amber-500 tracking-wider uppercase"><span className="text-base">{myTokens}</span> TOKENS</span>
              <button onClick={() => onVote(poll.id, option.id, 'token', 'add')}
                className="w-10 h-10 flex items-center justify-center text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 transition-colors"
                disabled={globalTokensRemaining <= 0 || isVetoedByAnyone}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
          ) : (
            <button onClick={() => onVote(poll.id, option.id, 'token', 'add')}
              className="w-full border border-border bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors py-2.5 rounded-[var(--radius-md)] text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
              disabled={globalTokensRemaining <= 0 || isVetoedByAnyone}>
              <span className="text-base leading-none text-text-muted">+ 🟡</span> Add Token
            </button>
          )}

          <button onClick={() => onVote(poll.id, option.id, 'veto')}
            disabled={(globalVetoesRemaining === 0 && !isMyVeto)}
            className={`text-[10px] font-semibold text-center mt-1 uppercase tracking-wider transition-colors ${isMyVeto ? 'text-danger' : 'text-text-muted hover:text-danger'}`}>
            {isMyVeto ? '🧨 VETOED' : 'VETO'}
          </button>
        </div>
      </div>
    </div>
  )
}
