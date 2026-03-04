import { useState, useMemo } from 'react'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { extractIdeaDetails } from '../../hooks/useAI'
import AvatarCircle from '../shared/AvatarCircle'

// ── Skeleton Loading ──
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

// ── Token Inventory Widget ──
function TokenInventory({ poll, activeUserId }) {
    const userVotes = poll.votes?.[activeUserId] || { tokens: {}, veto: null }
    const tokensUsed = Object.values(userVotes.tokens).reduce((sum, count) => sum + count, 0)
    const tokensRemaining = 3 - tokensUsed
    const hasVetoed = !!userVotes.veto

    return (
        <div className="flex items-center gap-3 bg-bg-secondary px-3 py-1.5 rounded-full text-xs font-bold border border-border shadow-inner">
            <div className="flex gap-1 items-center">
                <span className="text-text-secondary mr-1">Tokens:</span>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${i < tokensRemaining ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-border'}`} />
                ))}
            </div>
            <div className="w-px h-3 bg-border" />
            <div className={`flex items-center gap-1 ${hasVetoed ? 'opacity-50 grayscale' : 'text-danger'}`}>
                <span>🧨</span> {hasVetoed ? '0' : '1'} Veto
            </div>
        </div>
    )
}

// ── Poll Option Card ──
function PollOptionCard({ option, poll, activeUserId, onVote, isLeader, globalTokensRemaining, globalVetoesRemaining }) {
    const userVotes = poll.votes?.[activeUserId] || { tokens: {}, veto: null }

    const myTokens = userVotes.tokens[option.id] || 0
    const isMyVeto = userVotes.veto === option.id

    // Aggregate tokens globally
    let totalTokens = 0
    let totalVetoes = 0
    Object.values(poll.votes || {}).forEach(vote => {
        totalTokens += (vote.tokens[option.id] || 0)
        if (vote.veto === option.id) totalVetoes += 1
    })

    const isVetoedByAnyone = totalVetoes > 0

    return (
        <div className={`relative flex flex-col h-full rounded-[var(--radius-lg)] border-[2px] transition-all bg-bg-card 
            ${isVetoedByAnyone ? 'border-danger/30 opacity-70 grayscale' : isLeader ? 'border-accent shadow-sm' : 'border-border'}
            ${myTokens > 0 && !isLeader ? 'border-amber-300' : ''}`}>

            {isLeader && !isVetoedByAnyone && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full z-20 flex items-center gap-1.5 shadow-sm whitespace-nowrap">
                    🏆 Current Leader
                </div>
            )}

            {isVetoedByAnyone && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-body/50 backdrop-blur-[1px] rounded-[var(--radius-lg)] pointer-events-none">
                    <span className="rotate-[-6deg] text-danger font-bold border-2 border-danger px-4 py-1.5 rounded-lg bg-bg-card shadow-lg opacity-90 tracking-widest uppercase">Vetoed 🧨</span>
                </div>
            )}

            {/* Image Thumbnail */}
            <div className={`h-32 w-full bg-bg-secondary rounded-t-[calc(var(--radius-lg)-2px)] overflow-hidden shrink-0 flex items-center justify-center relative ${isLeader ? 'mt-0' : ''}`}>
                {option.imageUrl ? (
                    <img src={option.imageUrl} className="w-full h-full object-cover" alt="" loading="lazy" />
                ) : (
                    <span className="text-4xl drop-shadow-md">{option.emoji || '✨'}</span>
                )}
            </div>

            {/* Info Section */}
            <div className="flex-1 p-3 flex flex-col">
                <a href={option.url} target="_blank" rel="noreferrer" className="text-base font-bold font-heading text-text-primary hover:text-accent line-clamp-2 leading-tight mb-1">
                    {option.title}
                </a>
                <div className="text-xs text-text-secondary flex flex-wrap items-center gap-1">
                    <span className="font-bold">{option.priceDetails?.split('/')[0] || 'TBD'}</span>
                    <span className="text-[10px] tracking-wider uppercase">/{option.priceDetails?.split('/')[1] || ' TOTAL'}</span>
                    {option.sourceName && <span className="opacity-50">•</span>}
                    {option.sourceName && <span>{option.sourceName}</span>}
                </div>

                {/* Global Stats section */}
                <div className="mt-auto pt-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center -space-x-1.5 min-w-[32px]">
                        {/* We would render avatars of voters here if we had resolveProfile passed down, but total is good for now. Or fake it with initial circles for demo if 0. */}
                        {totalTokens > 0 ? (
                            <div className="flex items-center -space-x-1.5">
                                {Object.entries(poll.votes || {}).filter(([k, v]) => v.tokens[option.id] > 0).slice(0, 3).map(([k, v], i) => (
                                    <div key={k} className="w-6 h-6 rounded-full bg-bg-secondary border-2 border-bg-card flex items-center justify-center text-[8px]" style={{ zIndex: 10 - i }}>👤</div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-[10px] text-text-muted font-medium">No tokens yet</span>
                        )}
                    </div>
                    {totalTokens > 0 && (
                        <div className="bg-amber-500/10 text-amber-600 font-bold text-[10px] uppercase tracking-widest px-2 py-1 rounded">
                            {totalTokens} Tokens
                        </div>
                    )}
                </div>

                {/* Voting Controls */}
                <div className={`mt-2 flex flex-col gap-2 shrink-0 z-20 ${poll.status === 'resolved' ? 'pointer-events-none opacity-50' : ''}`}>
                    {myTokens > 0 ? (
                        <div className="flex items-center justify-between border border-amber-500 rounded-[var(--radius-md)] overflow-hidden">
                            <button
                                onClick={() => onVote(poll.id, option.id, 'token', 'remove')}
                                className="w-10 h-10 flex items-center justify-center text-amber-500 hover:bg-amber-500/10 transition-colors"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14" /></svg>
                            </button>
                            <span className="text-xs font-bold text-amber-500 tracking-widest uppercase"><span className="text-base">{myTokens}</span> TOKENS</span>
                            <button
                                onClick={() => onVote(poll.id, option.id, 'token', 'add')}
                                className="w-10 h-10 flex items-center justify-center text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 transition-colors"
                                disabled={globalTokensRemaining <= 0 || isVetoedByAnyone}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => onVote(poll.id, option.id, 'token', 'add')}
                            className="w-full border border-border bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors py-2.5 rounded-[var(--radius-md)] text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                            disabled={globalTokensRemaining <= 0 || isVetoedByAnyone}
                        >
                            <span className="text-base leading-none text-text-muted">+ 🟡</span> Add Token
                        </button>
                    )}

                    {/* Simplified Veto Text Link below */}
                    <button
                        onClick={() => onVote(poll.id, option.id, 'veto')}
                        disabled={(globalVetoesRemaining === 0 && !isMyVeto)}
                        className={`text-[10px] font-bold text-center mt-1 uppercase tracking-widest transition-colors ${isMyVeto ? 'text-danger' : 'text-text-muted hover:text-danger'}`}
                    >
                        {isMyVeto ? '🧨 VETOED' : 'VETO'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Poll Container Card ──
function PollCard({ poll, activeUserId, onVote, onResolve, onDelete, resolveProfile, globalTokensRemaining, globalVetoesRemaining }) {
    // Determine Current Leader
    let leaderId = null
    if (poll.status === 'active') {
        let highest = 0
        poll.options.forEach(opt => {
            const vetoes = Object.values(poll.votes || {}).filter(v => v.veto === opt.id).length
            if (vetoes > 0) return
            const tokens = Object.values(poll.votes || {}).reduce((sum, v) => sum + (v.tokens[opt.id] || 0), 0)
            if (tokens > highest) {
                highest = tokens
                leaderId = opt.id
            }
        })
    }

    // Generate simple log of votes
    const logs = []
    Object.entries(poll.votes || {}).forEach(([userId, voteData]) => {
        const user = resolveProfile(userId)
        Object.entries(voteData.tokens || {}).forEach(([optionId, count]) => {
            if (count > 0) {
                const option = poll.options.find(o => o.id === optionId)
                if (option) {
                    logs.push({
                        id: `token-${userId}-${optionId}`,
                        user,
                        action: `placed ${count} token${count > 1 ? 's' : ''} on`,
                        target: option.title
                    })
                }
            }
        })
        if (voteData.veto) {
            const option = poll.options.find(o => o.id === voteData.veto)
            if (option) {
                logs.push({
                    id: `veto-${userId}-${voteData.veto}`,
                    user,
                    action: `vetoed`,
                    target: option.title
                })
            }
        }
    })

    return (
        <div className="flex border border-border rounded-[var(--radius-xl)] bg-bg-card overflow-hidden relative mb-6">
            {/* Left side: Activity Log */}
            <div className="w-[30%] border-r border-border p-6 bg-bg-primary flex flex-col shrink-0">
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-[0.15em] mb-6">Activity Log</h3>
                <div className="flex-1 space-y-5 overflow-y-auto pr-2">
                    {logs.length === 0 ? (
                        <p className="text-xs text-text-secondary mt-6 font-medium">Start a poll to see voting activity here.</p>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex gap-3 items-start relative">
                                <div className="absolute left-3.5 top-8 bottom-[-20px] w-px bg-border -z-10"></div>
                                <AvatarCircle profile={log.user} size={28} />
                                <p className="text-[13px] text-text-secondary leading-snug">
                                    <span className="font-bold text-text-primary">{log.user?.name || 'Someone'}</span> {log.action} <span className="font-bold text-text-primary">{log.target}</span>.
                                    <span className="block text-[10px] text-text-muted uppercase font-bold mt-1 tracking-wider">Just Now</span>
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right side: Options and Actions */}
            <div className="w-[70%] p-6 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            {poll.status === 'resolved' ? (
                                <span className="text-[10px] font-bold text-success uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-success"></div> RESOLVED</span>
                            ) : (
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> ACTIVE POLL</span>
                            )}
                        </div>
                        <h2 className="text-[22px] font-heading font-bold text-text-primary leading-tight mb-2">
                            {poll.title}
                        </h2>
                        {poll.status === 'active' && (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase tracking-wider">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                Closes in 24 hours
                            </div>
                        )}
                    </div>

                    {poll.status === 'active' && (
                        <div className="flex flex-col gap-2 items-end">
                            <Button onClick={() => onResolve(poll)} variant="secondary" className="px-5 py-2 text-[11px] uppercase tracking-wider font-bold shadow-none hover:bg-bg-hover">
                                Resolve Early
                            </Button>
                        </div>
                    )}
                </div>

                {/* Horizontally scrollable cards container — requires stretching items height */}
                <div className="flex overflow-x-auto gap-5 pb-4 snap-x pl-1 pt-3 items-stretch">
                    {poll.options.map(opt => (
                        <div key={opt.id} className="min-w-[240px] w-[240px] max-w-[240px] snap-start shrink-0 flex">
                            <PollOptionCard option={opt} poll={poll} activeUserId={activeUserId} onVote={onVote} isLeader={leaderId === opt.id} globalTokensRemaining={globalTokensRemaining} globalVetoesRemaining={globalVetoesRemaining} />
                        </div>
                    ))}
                </div>

                <div className="mt-3 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    <button onClick={() => onDelete(poll.id)} className="hover:text-danger hover:underline">Delete/Archive Poll</button>
                </div>
            </div>
        </div>
    )
}

// ── Idea Card (Original + Selection Logic) ──
function IdeaCard({ idea, resolveProfile, onDelete, isSelectable, isSelected, onSelect }) {
    const isBooked = idea.status === 'booked'

    return (
        <div
            onClick={() => isSelectable && onSelect(idea)}
            className={`group relative flex flex-col rounded-[var(--radius-lg)] border bg-bg-card overflow-hidden transition-all duration-300
            ${isSelectable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}
            ${isSelected ? 'ring-2 ring-accent border-accent shadow-md' : 'border-border'}
            ${isBooked ? 'opacity-60 grayscale' : ''}
        `}>
            {/* Selection Checkbox Overlay */}
            {isSelectable && (
                <div className="absolute top-3 left-3 z-30 w-6 h-6 rounded-full border-2 border-white/80 bg-black/40 flex items-center justify-center shadow-md transition-transform duration-200 backdrop-blur-sm">
                    <div className={`w-3 h-3 rounded-full bg-accent transition-transform duration-200 ${isSelected ? 'scale-100' : 'scale-0'}`}></div>
                </div>
            )}

            {/* Target Status Banner */}
            {isBooked && (
                <div className="bg-success text-white text-[10px] font-bold uppercase tracking-widest py-1.5 text-center flex items-center justify-center gap-1.5 absolute top-0 inset-x-0 z-10">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Added to Itinerary/Bookings
                </div>
            )}

            {/* Delete button — visible on card hover (only when not selecting) */}
            {onDelete && !isSelectable && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }}
                    className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-danger transition-all duration-150 backdrop-blur-sm"
                    aria-label="Delete idea"
                >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 0 0 1 1-1h4a1 0 0 1 1 1v2" />
                    </svg>
                </button>
            )}

            {/* Top Half: Real image or emoji fallback */}
            <div className={`relative h-44 w-full flex items-center justify-center bg-bg-secondary overflow-hidden ${isBooked ? 'mt-6' : ''}`}>
                {idea.imageUrl ? (
                    <img src={idea.imageUrl} alt={idea.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                    <div className="text-6xl drop-shadow-md filter saturate-150 transform group-hover:scale-110 transition-transform duration-500">
                        {idea.emoji || '✨'}
                    </div>
                )}
                {idea.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-black/30 pointer-events-none" />}

                {/* Source Badge */}
                {idea.sourceName && (
                    <div className="absolute top-3 left-3 bg-bg-card/90 backdrop-blur-md border border-border/50 rounded-md shadow-sm px-2 py-1 text-[10px] font-bold flex items-center gap-1.5 text-text-secondary z-10 transition-opacity">
                        {idea.sourceName.includes('Airbnb') && '🏠'}
                        {idea.sourceName.includes('TikTok') && '🎵'}
                        {idea.sourceName.includes('TripAdvisor') && '🦉'}
                        {idea.sourceName}
                    </div>
                )}

                {/* Proposer Badge */}
                {idea.proposerId && (
                    <div className="absolute top-3 right-3 bg-bg-card/90 backdrop-blur-md border border-border/50 rounded-full shadow-sm py-1 pl-2.5 pr-1 text-[10px] font-bold flex items-center gap-1.5 text-text-secondary z-10">
                        Proposed by
                        <AvatarCircle profile={resolveProfile(idea.proposerId)} size={18} />
                    </div>
                )}
            </div>

            {/* Bottom Half: Details */}
            <div className="p-4 flex flex-col flex-1 relative">
                <a href={idea.url} target="_blank" rel="noopener noreferrer" className="group/link flex items-start justify-between gap-2 mb-1 z-10" onClick={e => isSelectable && e.preventDefault()}>
                    <h3 className="font-heading font-bold text-base text-text-primary leading-tight group-hover/link:text-accent transition-colors line-clamp-2">
                        {idea.title}
                    </h3>
                    <svg className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
                </a>
                {idea.description && <p className="text-[13px] text-text-secondary line-clamp-2 mt-1 block">"{idea.description}"</p>}

                <div className="mt-4 mb-2 flex items-center justify-between">
                    <div>
                        <span className="font-bold text-sm text-text-primary mr-1">{idea.priceDetails ? idea.priceDetails.split('/')[0] : '???'}</span>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">/{idea.priceDetails?.split('/')[1] || ' TOTAL'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main Tab Component ──
export default function VotingTab() {
    const { activeTrip, dispatch, showToast } = useTripContext()
    const { currentUserProfile, resolveProfile } = useProfiles()

    // Idea Extraction State
    const [urlInput, setUrlInput] = useState('')
    const [isExtracting, setIsExtracting] = useState(false)
    const [filter, setFilter] = useState('all')

    // Proposal Creation State
    const [isCreatingPoll, setIsCreatingPoll] = useState(false)
    const [selectedIdeaIds, setSelectedIdeaIds] = useState(new Set())
    const [pollTitle, setPollTitle] = useState('')
    const [showExtractInput, setShowExtractInput] = useState(false)

    const ideas = activeTrip?.ideas || []
    const polls = activeTrip?.polls || []

    // Global Bank Logic
    const activePolls = polls.filter(p => p.status === 'active')
    let totalTokensUsedByMe = 0
    let totalVetoesUsedByMe = 0

    if (currentUserProfile) {
        activePolls.forEach(poll => {
            const myVotes = poll.votes?.[currentUserProfile.id] || { tokens: {}, veto: null }
            const myPollTokens = Object.values(myVotes.tokens).reduce((sum, count) => sum + count, 0)
            totalTokensUsedByMe += myPollTokens
            if (myVotes.veto) totalVetoesUsedByMe += 1
        })
    }

    const globalTokensRemaining = Math.max(0, 3 - totalTokensUsedByMe)
    const globalVetoesRemaining = Math.max(0, 1 - totalVetoesUsedByMe)

    const visibleIdeas = useMemo(() => {
        let arr = [...ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        if (filter !== 'all') {
            arr = arr.filter(i => (i.type || 'other') === filter || filter === 'all')
        }
        return arr
    }, [ideas, filter])

    const handleExtract = async (e) => {
        e.preventDefault()
        if (!urlInput.trim() || !urlInput.includes('http')) {
            showToast("Please enter a valid URL", "warning")
            return
        }

        setIsExtracting(true)
        try {
            showToast("Wanda is reading the link...", "info")
            const data = await extractIdeaDetails(urlInput, activeTrip?.currency)

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
            setShowExtractInput(false)
            showToast("Idea added to the board! 💡")
        } catch (err) {
            console.error(err)
            showToast(err.message || "Could not parse link. Try again.", "error")
        } finally {
            setIsExtracting(false)
        }
    }

    const handleDeleteIdea = (ideaId) => {
        dispatch({ type: ACTIONS.DELETE_IDEA, payload: ideaId })
        showToast("Idea removed")
    }

    // ── Proposal Pipeline Handlers ──
    const toggleIdeaSelection = (idea) => {
        if (idea.status === 'booked') return // cannot select booked ideas
        const newSet = new Set(selectedIdeaIds)
        if (newSet.has(idea.id)) newSet.delete(idea.id)
        else newSet.add(idea.id)
        setSelectedIdeaIds(newSet)
    }

    const handleCreatePoll = () => {
        if (selectedIdeaIds.size < 2 || !pollTitle.trim()) return

        const selectedOptions = ideas.filter(i => selectedIdeaIds.has(i.id))

        dispatch({
            type: ACTIONS.CREATE_POLL,
            payload: {
                title: pollTitle,
                proposerId: currentUserProfile?.id,
                options: selectedOptions,
                removeIdeas: true // auto clean up board
            }
        })

        // Reset state
        setIsCreatingPoll(false)
        setSelectedIdeaIds(new Set())
        setPollTitle('')
        showToast("Proposal Poll created! Time to vote. 🗳️")
    }

    const handlePollVote = (pollId, optionId, type, action) => {
        dispatch({
            type: ACTIONS.VOTE_POLL,
            payload: { pollId, ideaId: optionId, optionId, userId: currentUserProfile?.id, type, action }
        })
    }

    const handleDeletePoll = (pollId) => {
        if (window.confirm("Are you sure you want to delete this poll? The ideas will be permanently removed.")) {
            dispatch({ type: ACTIONS.DELETE_POLL, payload: pollId })
        }
    }

    const handleResolvePoll = (poll) => {
        // Calculate the winner based strictly on tokens for non-vetoed items
        let highestTokens = -1
        let winningOption = null

        poll.options.forEach(opt => {
            // Recompute vetoes
            const vetoes = Object.values(poll.votes || {}).filter(v => v.veto === opt.id).length
            if (vetoes > 0) return // disqualified

            const tokens = Object.values(poll.votes || {}).reduce((sum, v) => sum + (v.tokens[opt.id] || 0), 0)
            if (tokens > highestTokens) {
                highestTokens = tokens
                winningOption = opt
            }
        })

        if (!winningOption) {
            showToast("No valid winner found! Ensure at least one option isn't vetoed.", "error")
            return
        }

        // Add the winning option to bookings (or itinerary if activity)
        dispatch({
            type: ACTIONS.ADD_BOOKING,
            payload: {
                name: winningOption.title || winningOption.sourceName || 'Untitled Proposal Winner',
                provider: winningOption.sourceName || '',
                category: (winningOption.type === 'lodging' ? 'hotel' : (winningOption.type === 'activity' ? 'experience' : 'custom')),
                providerLink: winningOption.url || '',
            }
        })

        dispatch({ type: ACTIONS.RESOLVE_POLL, payload: { pollId: poll.id } })
        showToast(`🎉 Resolving! "${winningOption.title}" won with ${highestTokens} tokens. Redirecting to Bookings...`)

        // Slight delay to let user see toast and status change before redirect
        setTimeout(() => {
            dispatch({ type: ACTIONS.SET_TAB, payload: 'bookings' })
        }, 1500)
    }

    return (
        <div className="space-y-8 animate-fade-in pb-16 w-full">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-text-primary tracking-tight flex items-center gap-3">
                        <span className="text-[32px] drop-shadow-sm">🗳️</span> The Voting Room
                    </h1>
                    <p className="text-sm text-text-secondary mt-1 max-w-lg">
                        Allocate your tokens, track group consensus, and build the trip.
                    </p>
                </div>
                {/* Global Bank Indicator in Top Header */}
                <Card className="px-5 py-2.5 rounded-full flex items-center gap-4 shadow-sm border border-border">
                    <div className="flex gap-1.5 items-center">
                        <span className="text-xs font-bold text-text-secondary mr-1">Your Bank:</span>
                        <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < globalTokensRemaining ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' : 'bg-border'}`} />
                            ))}
                        </div>
                    </div>
                    <div className="w-px h-4 bg-border"></div>
                    <div className={`flex items-center gap-1.5 text-xs font-bold ${globalVetoesRemaining === 0 ? 'text-text-muted opacity-50 grayscale' : 'text-danger'}`}>
                        <span>🧨</span> {globalVetoesRemaining} Veto
                    </div>
                </Card>
            </div>

            {/* ── Polls / Proposals Section (Convergent Phase) ── */}
            <div className="space-y-5 animate-fade-in mt-2 pb-8">
                {polls.length > 0 ? (
                    <div>
                        {polls.map(poll => (
                            <PollCard
                                key={poll.id}
                                poll={poll}
                                activeUserId={currentUserProfile?.id}
                                onVote={handlePollVote}
                                onResolve={handleResolvePoll}
                                onDelete={handleDeletePoll}
                                resolveProfile={resolveProfile}
                                globalTokensRemaining={globalTokensRemaining}
                                globalVetoesRemaining={globalVetoesRemaining}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex border border-border rounded-[var(--radius-xl)] bg-bg-card overflow-hidden relative">
                        {/* Left side: Activity Log */}
                        <div className="w-[30%] border-r border-border p-6 bg-bg-primary flex flex-col shrink-0">
                            <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-[0.15em] mb-6">Activity Log</h3>
                            <div className="flex-1">
                                <p className="text-xs text-text-muted mt-6 font-medium">Start a poll to see voting activity here.</p>
                            </div>
                        </div>

                        {/* Right side: Empty Poll */}
                        <div className="w-[70%] py-24 flex flex-col items-center justify-center text-center">
                            <div className="w-14 h-14 bg-bg-card rounded-2xl flex items-center justify-center text-3xl border border-border mb-5 drop-shadow-sm filter saturate-0">🗳️</div>
                            <h3 className="text-xl font-bold font-heading text-text-primary">No active polls yet</h3>
                            <p className="text-sm text-text-secondary mt-2 max-w-[340px] mb-8 leading-relaxed">Select 2 or more conflicting ideas from the pool below to pit them against each other in a formal vote.</p>
                            {!isCreatingPoll && (
                                <Button variant="secondary" onClick={() => setIsCreatingPoll(true)} className="mb-8 px-6 py-2 shadow-none font-bold text-text-primary hover:bg-bg-hover border-border transition-colors">
                                    Create Proposal
                                </Button>
                            )}
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Select Below</span>
                            <span className="text-text-muted opacity-50">&darr;</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Idea Board Section (Divergent Phase) ── */}
            <div className="space-y-5 relative">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
                    {!isCreatingPoll && (
                        <div>
                        </div>
                    )}
                    {isCreatingPoll && (
                        <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 p-1.5 rounded-xl pl-4">
                            <span className="text-xs font-bold text-accent px-1">{selectedIdeaIds.size} Selected</span>
                            <button onClick={() => { setIsCreatingPoll(false); setSelectedIdeaIds(new Set()) }} className="text-xs font-bold text-text-secondary hover:text-text-primary px-2 transition-colors">Cancel</button>
                            <Button onClick={handleCreatePoll} disabled={selectedIdeaIds.size < 2 || !pollTitle.trim()} className="text-xs py-2 px-5 shadow-md font-bold text-white bg-accent hover:bg-accent/90">
                                Start Poll
                            </Button>
                        </div>
                    )}
                </div>

                {/* Poll Creation Title Input Box */}
                {isCreatingPoll && (
                    <div className="animate-fade-in fade-in flex flex-col sm:flex-row gap-4 items-start sm:items-center p-5 bg-accent/5 border-2 border-accent border-dashed rounded-[var(--radius-lg)] shadow-sm">
                        <div className="text-3xl filter drop-shadow">📝</div>
                        <div className="flex-1 w-full">
                            <label className="text-[11px] font-bold text-accent uppercase tracking-wider mb-1.5 block">Name Your Proposal</label>
                            <input
                                type="text"
                                value={pollTitle}
                                onChange={e => setPollTitle(e.target.value)}
                                placeholder="e.g., Where are we staying in Paris? 🇫🇷"
                                className="w-full bg-bg-card border-none shadow-sm rounded-[var(--radius-md)] px-4 py-3 text-base font-medium focus:ring-2 focus:ring-accent outline-none placeholder:text-text-muted"
                                autoFocus
                            />
                        </div>
                        <p className="text-xs font-medium text-text-secondary sm:w-56 leading-relaxed hidden sm:block">Select at least <strong className="text-text-primary">2 ideas</strong> below to bundle them into a unified vote.</p>
                    </div>
                )}

                {/* View Filters & URL Extractor */}
                <div className={`transition-all duration-300 flex items-center justify-between gap-4 mb-4 relative ${isCreatingPoll ? '-mt-4' : ''}`}>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-[-4px]">
                        {['all', 'lodging', 'activity'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-pill)] text-xs font-medium border transition-colors whitespace-nowrap ${filter === f ? 'bg-accent text-white border-transparent' : 'bg-bg-secondary border-border text-text-muted hover:text-text-secondary'}`}
                            >
                                {f === 'all' ? 'All Categories' : f === 'lodging' ? <><span>🏠</span> Lodging</> : <><span>🎯</span> Activities</>}
                            </button>
                        ))}
                    </div>

                    {!showExtractInput ? (
                        <Button size="sm" onClick={() => setShowExtractInput(true)} className="shrink-0">
                            + Extract Idea
                        </Button>
                    ) : (
                        <div className="p-1 pr-1.5 h-[42px] bg-[#fcf9f5] absolute right-0 z-40 w-full sm:w-[320px] animate-fade-in rounded-full flex items-center border-[#EAE3DE] shadow-sm border-[2px]">
                            <form onSubmit={handleExtract} className="flex gap-2 w-full h-full items-center">
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    placeholder="Paste a link..."
                                    className="flex-1 pl-4 pr-2 py-0 h-full bg-transparent outline-none focus:ring-0 shadow-none border-none text-[14px] font-medium text-text-primary placeholder:text-[#A7A3A0]"
                                    disabled={isExtracting}
                                    autoFocus
                                />
                                <button type="submit" disabled={isExtracting || !urlInput.trim()} className="shrink-0 px-5 py-1.5 text-[13px] font-bold bg-[#EFBCA6] hover:bg-[#E3A387] text-white rounded-full transition-colors disabled:opacity-50 h-[30px] flex items-center justify-center">
                                    {isExtracting ? '...' : 'Add'}
                                </button>
                                <button type="button" onClick={() => setShowExtractInput(false)} className="px-2 text-[#908D89] hover:text-text-primary flex items-center justify-center transition-colors">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Masonry / Grid */}
                {ideas.length === 0 && !isExtracting ? (
                    <div className="py-24 mt-8 text-center flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-xl)] bg-bg-secondary/30">
                        <span className="text-5xl opacity-50 mb-4 saturate-0 filter drop-shadow-sm">📦</span>
                        <h3 className="font-heading font-bold text-lg text-text-primary">The board is empty</h3>
                        <p className="text-sm text-text-secondary max-w-sm mt-1 mb-6 leading-relaxed">Paste a link to any hotel, Airbnb, or tour, and Wanda will generate an idea card for the group to vote on.</p>
                        <ul className="text-xs text-text-muted space-y-2 text-left bg-bg-card px-6 py-4 rounded-xl border border-border shadow-sm">
                            <li className="flex items-center gap-2">✅ Extracts titles, images, and prices</li>
                            <li className="flex items-center gap-2">✅ Works with most travel websites</li>
                            <li className="flex items-center gap-2">✅ Group ideas into Proposals for voting</li>
                        </ul>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-6 relative pb-4">
                        {isExtracting && <SkeletonCard />}
                        {visibleIdeas.map(idea => (
                            <IdeaCard
                                key={idea.id}
                                idea={idea}
                                resolveProfile={resolveProfile}
                                onDelete={handleDeleteIdea}
                                isSelectable={isCreatingPoll}
                                isSelected={selectedIdeaIds.has(idea.id)}
                                onSelect={toggleIdeaSelection}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
