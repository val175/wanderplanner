import { useState, useMemo } from 'react'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { extractIdeaDetails } from '../../hooks/useAI'
import AvatarCircle from '../shared/AvatarCircle'

// ── Status Mapping ──
const STATUSES = {
    pending: { label: 'Pending', icon: '⏳' },
    consensus: { label: 'Consensus Reached', icon: '✓' },
    rejected: { label: 'Voted Out', icon: '✕' },
}

// ── Loading Skeleton ──
function SkeletonCard() {
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

// ── Idea Card ──
function IdeaCard({ idea, activeUserId, resolveProfile, onVote, onConvert }) {
    const upvotes = Object.values(idea.votes || {}).filter(v => v === 1).length
    const downvotes = Object.values(idea.votes || {}).filter(v => v === -1).length
    const myVote = (idea.votes || {})[activeUserId]

    // Render avatars of people who voted
    const voteAvatars = Object.entries(idea.votes || {})
        .filter(([_, val]) => val !== 0)
        .map(([userId]) => resolveProfile(userId))
        .filter(Boolean)

    const isConsensus = idea.status === 'consensus'
    const isRejected = idea.status === 'rejected'

    return (
        <div className={`relative flex flex-col rounded-[var(--radius-lg)] border bg-bg-card overflow-hidden transition-all duration-300
      ${isConsensus ? 'border-success ring-1 ring-success shadow-sm' : 'border-border'}
      ${isRejected ? 'opacity-60 grayscale' : ''}
    `}>
            {/* Target Status Banner */}
            {isConsensus && (
                <div className="bg-success text-white text-[10px] font-bold uppercase tracking-widest py-1.5 text-center flex items-center justify-center gap-1.5 absolute top-0 inset-x-0 z-10">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    CONSENSUS REACHED
                </div>
            )}

            {/* Top Half: Image Simulation & Meta */}
            <div className={`relative h-44 w-full flex items-center justify-center bg-bg-secondary ${isConsensus ? 'mt-6' : ''}`}>

                {/* Source Badge */}
                {idea.sourceName && (
                    <div className="absolute top-3 left-3 bg-bg-card border border-border rounded shadow-sm px-2 py-1 text-[10px] font-bold flex items-center gap-1 text-text-secondary z-10">
                        {idea.sourceName.includes('Airbnb') && '🏠'}
                        {idea.sourceName.includes('TikTok') && '🎵'}
                        {idea.sourceName.includes('TripAdvisor') && '🦉'}
                        {idea.sourceName}
                    </div>
                )}

                {/* Proposer Badge */}
                {idea.proposerId && (
                    <div className="absolute top-3 right-3 bg-bg-card/90 backdrop-blur-sm border border-border rounded-full shadow-sm py-1 pl-2 pr-1 text-[10px] font-bold flex items-center gap-1.5 text-text-secondary z-10">
                        Proposed by
                        <AvatarCircle profile={resolveProfile(idea.proposerId)} size={18} />
                    </div>
                )}

                {/* Massive Emoji/Image proxy */}
                <div className="text-6xl drop-shadow-md filter saturate-150 transform hover:scale-110 transition-transform duration-300">
                    {idea.emoji || '✨'}
                </div>
            </div>

            {/* Bottom Half: Details */}
            <div className="p-4 flex flex-col flex-1 relative">
                <a
                    href={idea.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start justify-between gap-2 mb-1"
                >
                    <h3 className="font-heading font-bold text-base text-text-primary leading-tight group-hover:text-accent transition-colors line-clamp-2">
                        {idea.title}
                    </h3>
                    <svg className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                </a>

                {idea.description && (
                    <p className="text-[13px] text-text-secondary line-clamp-2 mt-1 block">
                        "{idea.description}"
                    </p>
                )}

                <div className="mt-3 mb-4">
                    <span className="font-bold text-sm text-text-primary">
                        {idea.priceDetails ? idea.priceDetails.split('/')[0] : '???'}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider ml-1">
                        /{idea.priceDetails?.split('/')[1] || ' TOTAL'}
                    </span>
                </div>

                {/* Action Row */}
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-3">

                    {isConsensus ? (
                        <Button className="w-full bg-success hover:bg-success border-success text-white shadow-sm flex items-center justify-center gap-2" onClick={() => onConvert(idea)}>
                            Book It <span aria-hidden="true">&rarr;</span>
                        </Button>
                    ) : isRejected ? (
                        <span className="text-xs font-bold text-danger uppercase tracking-widest flex items-center gap-1 w-full justify-center opacity-70">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            Voted Out
                        </span>
                    ) : (
                        <>
                            {/* Vote Avatars */}
                            <div className="flex items-center -space-x-1.5 flex-1 w-1/3">
                                {voteAvatars.length > 0 ? (
                                    <>
                                        <span className="text-[10px] text-text-muted mr-3 font-medium">Votes:</span>
                                        {voteAvatars.slice(0, 4).map((p, i) => (
                                            <div key={p.id || i} className="rounded-full ring-2 ring-bg-card" style={{ zIndex: 10 - i }}>
                                                <AvatarCircle profile={p} size={20} />
                                            </div>
                                        ))}
                                        {voteAvatars.length > 4 && (
                                            <div className="w-5 h-5 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[9px] font-bold text-text-secondary" style={{ zIndex: 5 }}>
                                                +{voteAvatars.length - 4}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-[10px] text-text-muted font-medium">No votes yet</span>
                                )}
                            </div>

                            {/* + / - Buttons */}
                            <div className="flex w-2/3 gap-2">
                                <button
                                    onClick={() => onVote(idea.id, 1)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[var(--radius-md)] border text-sm font-medium transition-all ${myVote === 1 ? 'bg-success/10 border-success text-success' : 'bg-bg-card border-border hover:bg-bg-hover text-text-secondary'}`}
                                >
                                    <span className={myVote === 1 ? 'scale-110 drop-shadow-sm' : ''}>👍</span> {upvotes || ''}
                                </button>
                                <button
                                    onClick={() => onVote(idea.id, -1)}
                                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-[var(--radius-md)] border text-sm font-medium transition-all ${myVote === -1 ? 'bg-danger/10 border-danger text-danger' : 'bg-bg-card border-border hover:bg-bg-hover text-text-secondary'}`}
                                >
                                    <span className={myVote === -1 ? 'scale-110 drop-shadow-sm' : ''}>👎</span> {downvotes || ''}
                                </button>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    )
}

export default function VotingTab() {
    const { activeTrip, dispatch, showToast } = useTripContext()
    const { currentUserProfile, resolveProfile } = useProfiles()

    const [urlInput, setUrlInput] = useState('')
    const [isExtracting, setIsExtracting] = useState(false)
    const [filter, setFilter] = useState('all') // 'all' | 'lodging' | 'activity'

    const ideas = activeTrip?.ideas || []

    // Derived filtered blocks
    const visibleIdeas = useMemo(() => {
        let arr = [...ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        if (filter !== 'all') {
            arr = arr.filter(i => (i.type || 'other') === filter || filter === 'all')
        }
        return arr
    }, [ideas, filter])

    // Process Votes to Auto-Trigger Consensus logic
    const handleVote = (ideaId, voteType) => {
        const userId = currentUserProfile?.id
        if (!userId) {
            showToast("Must be logged in to vote", "error")
            return
        }
        dispatch({ type: ACTIONS.VOTE_IDEA, payload: { ideaId, userId, voteType } })

        // Instantly evaluate status
        const idea = ideas.find(i => i.id === ideaId)
        if (!idea) return

        // Reconstruct future votes based on this incoming vote
        const futureVotes = { ...idea.votes }
        if (futureVotes[userId] === voteType) delete futureVotes[userId]
        else futureVotes[userId] = voteType

        const upvotes = Object.values(futureVotes).filter(v => v === 1).length
        const downvotes = Object.values(futureVotes).filter(v => v === -1).length
        const totalTravelers = activeTrip?.travelerIds?.length || 1

        // If strictly majority reached, flip to consensus
        if (idea.status !== 'consensus' && upvotes > (totalTravelers / 2)) {
            dispatch({ type: ACTIONS.UPDATE_IDEA_STATUS, payload: { ideaId, status: 'consensus' } })
            showToast("Consensus Reached! 🎉")
        } else if (idea.status !== 'rejected' && downvotes > (totalTravelers / 2)) {
            dispatch({ type: ACTIONS.UPDATE_IDEA_STATUS, payload: { ideaId, status: 'rejected' } })
        } else if ((idea.status === 'consensus' || idea.status === 'rejected') && upvotes <= (totalTravelers / 2) && downvotes <= (totalTravelers / 2)) {
            // Revert to pending if someone retracts a vote breaking majority
            dispatch({ type: ACTIONS.UPDATE_IDEA_STATUS, payload: { ideaId, status: 'pending' } })
        }
    }

    const handleExtract = async (e) => {
        e.preventDefault()
        if (!urlInput.trim() || !urlInput.includes('http')) {
            showToast("Please enter a valid URL", "warning")
            return
        }

        setIsExtracting(true)
        try {
            showToast("Wanda is reading the link...", "info")
            const data = await extractIdeaDetails(urlInput, activeTrip)

            const newIdea = {
                url: urlInput,
                title: data.title || "Untitled Idea",
                type: data.type || "other",
                priceDetails: data.priceDetails || "TBD",
                description: data.description || "",
                emoji: data.emoji || "✨",
                sourceName: data.sourceName || "Link",
                proposerId: currentUserProfile?.id
            }

            dispatch({ type: ACTIONS.ADD_IDEA, payload: newIdea })
            setUrlInput('')
            showToast("Idea added to the board!")

        } catch (err) {
            console.error(err)
            showToast(err.message || "Could not parse link. Try again.", "error")
        } finally {
            setIsExtracting(false)
        }
    }

    const handleConvertToBooking = (idea) => {
        // Push to Bookings Tab Payload
        dispatch({
            type: ACTIONS.ADD_BOOKING,
            payload: {
                provider: idea.sourceName || '',
                category: (idea.type === 'lodging' ? 'hotel' : (idea.type === 'activity' ? 'experience' : 'custom')),
                notes: idea.url || ''
            }
        })
        showToast("Booking draft created! Redirecting...")
        dispatch({ type: ACTIONS.SET_TAB, payload: 'bookings' })
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12 w-full">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight flex items-center gap-2">
                        <span className="text-[26px]">🗳️</span> The Voting Room
                    </h1>
                    <p className="text-sm text-text-secondary mt-1">
                        Propose ideas, vote as a group, and reach consensus.
                    </p>
                </div>

                {/* View Toggle */}
                <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${filter === 'all' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        All Ideas
                    </button>
                    <button
                        onClick={() => setFilter('lodging')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${filter === 'lodging' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        Lodging
                    </button>
                    <button
                        onClick={() => setFilter('activity')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)] transition-all ${filter === 'activity' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
                    >
                        Activities
                    </button>
                </div>
            </div>

            {/* ── Extraction Bar ── */}
            <Card className="p-2 sm:p-2.5">
                <form onSubmit={handleExtract} className="flex gap-2">
                    <div className="flex-1 relative flex items-center">
                        <span className="absolute left-3.5 text-lg opacity-70">✨</span>
                        <input
                            type="url"
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            placeholder="Paste a link from Airbnb, TikTok, or TripAdvisor..."
                            className="w-full pl-11 pr-4 py-3 bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted outline-none focus:ring-0"
                            disabled={isExtracting}
                        />
                    </div>
                    <Button type="submit" disabled={isExtracting || !urlInput.trim()} className="shrink-0 px-6 font-bold shadow-sm h-12">
                        {isExtracting ? 'Extracting...' : 'Extract Idea'}
                    </Button>
                </form>
            </Card>

            {/* ── Masonry / Grid ── */}
            {ideas.length === 0 && !isExtracting ? (
                <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-lg)]">
                    <span className="text-5xl opacity-80 mb-4 saturate-0">📦</span>
                    <h3 className="font-heading font-bold text-lg text-text-primary">The room is empty</h3>
                    <p className="text-sm text-text-secondary max-w-sm mt-1">Paste a link to any Airbnb, hotel, or tour and Wanda will generate an idea card for the group to vote on.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {isExtracting && <SkeletonCard />}
                    {visibleIdeas.map(idea => (
                        <IdeaCard
                            key={idea.id}
                            idea={idea}
                            activeUserId={currentUserProfile?.id}
                            resolveProfile={resolveProfile}
                            onVote={handleVote}
                            onConvert={handleConvertToBooking}
                        />
                    ))}
                </div>
            )}

        </div>
    )
}
