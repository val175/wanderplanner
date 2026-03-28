import { useState } from 'react'
import AvatarCircle from '../../shared/AvatarCircle'
import { formatIdeaPrice } from './votingUtils'

export default function IdeaCard({ idea, resolveProfile, onDelete, isSelectable, isSelected, onSelect }) {
  const [imgError, setImgError] = useState(false)
  const isBooked = idea.status === 'booked'

  return (
    <div
      onClick={() => isSelectable && onSelect(idea)}
      className={`group relative flex flex-col rounded-[var(--radius-lg)] border bg-bg-card overflow-hidden transition-all duration-300
      ${isSelectable ? 'cursor-pointer hover:border-border-strong hover:-translate-y-0.5' : ''}
      ${isSelected ? 'ring-2 ring-accent border-accent' : 'border-border'}
      ${isBooked ? 'opacity-60 grayscale' : ''}
    `}>
      {/* Selection Checkbox Overlay */}
      {isSelectable && (
        <div className="absolute top-3 left-3 z-30 w-6 h-6 rounded-full border-2 border-white/80 bg-black/40 flex items-center justify-center transition-transform duration-200 backdrop-blur-sm">
          <div className={`w-3 h-3 rounded-full bg-accent transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`}></div>
        </div>
      )}

      {/* Booked Status Banner */}
      {isBooked && (
        <div className="bg-success text-white text-[10px] font-semibold uppercase tracking-wider py-1.5 text-center flex items-center justify-center gap-1.5 absolute top-0 inset-x-0 z-10">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Added to Itinerary/Bookings
        </div>
      )}

      {/* Delete button */}
      {onDelete && !isSelectable && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }}
          className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 backdrop-blur-sm hover:bg-danger ease-out"
          aria-label="Delete idea"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 0 0 1 1-1h4a1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}

      {/* Top Half: Image or emoji fallback */}
      <div className={`relative h-44 w-full flex items-center justify-center bg-bg-secondary overflow-hidden ${isBooked ? 'mt-6' : ''}`}>
        {idea.imageUrl && !imgError ? (
          <img src={idea.imageUrl} alt={idea.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy" onError={() => setImgError(true)} />
        ) : (
          <div className="text-6xl filter saturate-150 transform group-hover:scale-110 transition-transform duration-500">
            {idea.emoji || '✨'}
          </div>
        )}
        {idea.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-black/30 pointer-events-none" />}

        {/* Source Badge */}
        {idea.sourceName && (
          <div className="absolute top-3 left-3 bg-bg-card/90 backdrop-blur-md border border-border/50 rounded-md px-2 py-1 text-[10px] font-semibold flex items-center gap-1.5 text-text-secondary z-10">
            {idea.sourceName.includes('Airbnb') && '🏠'}
            {idea.sourceName.includes('TikTok') && '🎵'}
            {idea.sourceName.includes('TripAdvisor') && '🦉'}
            {idea.sourceName}
          </div>
        )}

        {/* Proposer Badge */}
        {idea.proposerId && (
          <div className="absolute top-3 right-3 bg-bg-card/90 backdrop-blur-md border border-border/50 rounded-full py-1 pl-2.5 pr-1 text-[10px] font-semibold flex items-center gap-1.5 text-text-secondary z-10">
            Proposed by
            <AvatarCircle profile={resolveProfile(idea.proposerId)} size={18} />
          </div>
        )}
      </div>

      {/* Bottom Half: Details */}
      <div className="p-4 flex flex-col flex-1 relative">
        <a href={idea.url} target="_blank" rel="noopener noreferrer"
          className="group/link flex items-start justify-between gap-2 mb-1 z-10"
          onClick={e => isSelectable && e.preventDefault()}
        >
          <h3 className="font-heading font-semibold text-base text-text-primary leading-tight group-hover/link:text-accent transition-colors line-clamp-2">
            {idea.title}
          </h3>
          <svg className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
        </a>
        {idea.description && <p className="text-[13px] text-text-secondary line-clamp-2 mt-1 block">"{idea.description}"</p>}

        <div className="mt-4 mb-2 flex items-center justify-between">
          <div>
            {(() => {
              const { amount, unit } = formatIdeaPrice(idea.priceDetails)
              return (
                <>
                  <span className="font-semibold text-sm text-text-primary mr-1">{amount}</span>
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">/{unit}</span>
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
