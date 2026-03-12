import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getCategory, GLOBAL_CATEGORIES } from '../../constants/categories'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatDate, formatCurrency, formatCurrencyRange, generateId } from '../../utils/helpers'
import AvatarCircle from '../shared/AvatarCircle'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import IdeaExtractorModal from '../modal/IdeaExtractorModal'
import TabHeader from '../common/TabHeader'

// ── Category helpers ──

/**
 * Standardize price display for ideas/options
 * Format: ₱1,234 (est.) /TOTAL
 */
function formatIdeaPrice(priceDetails, currency = 'PHP') {
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
function CategoryPill({ type }) {
    const meta = getCategory(type)
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary hover:bg-bg-hover">
            {meta.emoji} {meta.label}
        </span>
    )
}

// ── Source favicon helper ──
function SourceIcon({ sourceName }) {
    if (!sourceName) return null
    const emoji =
        sourceName.includes('Airbnb') ? '🏠' :
            sourceName.includes('TikTok') ? '🎵' :
                sourceName.includes('TripAdvisor') ? '🦉' :
                    sourceName.includes('Google') ? '📍' : '🔗'
    return <span className="mr-0.5">{emoji}</span>
}

// ── Idea Table Row ──
function IdeaTableRow({ idea, resolveProfile, onDelete, isSelectable, isSelected, onSelect }) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [imgError, setImgError] = useState(false)
    const isBooked = idea.status === 'booked'
    const proposer = resolveProfile(idea.proposerId)
    const date = idea.createdAt ? formatDate(idea.createdAt) : '—'
    const priceNum = parseFloat((idea.priceDetails || '').replace(/[^0-9.]/g, '')) || 0

    return (
        <tr
            className={`group border-b border-border transition-colors ${isBooked ? 'opacity-40 grayscale' : 'hover:bg-bg-hover'
                } ${isSelected ? 'bg-accent/5' : ''}`}
        >
            {/* Checkbox */}
            <td className="pl-4 pr-2 py-3 w-10">
                {isSelectable && !isBooked ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onSelect(idea)}
                        className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer rounded"
                    />
                ) : (
                    <div className="w-4 h-4" />
                )}
            </td>

            {/* Thumbnail */}
            <td className="pr-3 py-3 w-12">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center shrink-0">
                    {idea.imageUrl && !imgError ? (
                        <img
                            src={idea.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <span className="text-xl">{idea.emoji || '✨'}</span>
                    )}
                </div>
            </td>

            {/* Name & source */}
            <td className="py-3 pr-4 min-w-0">
                <a
                    href={idea.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[14px] text-text-primary hover:text-accent transition-colors line-clamp-1 leading-tight block"
                    onClick={e => isSelectable && e.preventDefault()}
                >
                    {idea.title}
                </a>
                {idea.sourceName && (
                    <span className="text-[11px] text-text-muted flex items-center gap-0.5 mt-0.5">
                        <SourceIcon sourceName={idea.sourceName} />{idea.sourceName}
                        {idea.description && <span className="ml-1 opacity-60">· {idea.description.slice(0, 40)}{idea.description.length > 40 ? '…' : ''}</span>}
                    </span>
                )}
            </td>

            {/* Category */}
            <td className="py-3 pr-4 whitespace-nowrap">
                <CategoryPill type={idea.type || 'other'} />
            </td>

            {/* Est. Cost */}
            <td className="py-3 pr-4 whitespace-nowrap">
                {(() => {
                    const { amount, unit } = formatIdeaPrice(idea.priceDetails)
                    if (amount === 'TBD') return <span className="text-text-muted text-xs">—</span>
                    return (
                        <span className="text-[13px] font-semibold text-text-primary">
                            {amount}
                            <span className="text-[10px] font-semibold text-text-muted ml-0.5 uppercase">
                                /{unit}
                            </span>
                        </span>
                    )
                })()}
            </td>

            {/* Proposed by */}
            <td className="py-3 pr-4 whitespace-nowrap">
                {proposer ? (
                    <div className="flex items-center gap-1.5">
                        <AvatarCircle profile={proposer} size={22} />
                        <span className="text-[12px] text-text-secondary">{proposer.name?.split(' ')[0]}</span>
                    </div>
                ) : <span className="text-text-muted text-xs">—</span>}
            </td>

            {/* Date */}
            <td className="py-3 pr-4 text-[12px] text-text-muted whitespace-nowrap">{date}</td>

            {/* Actions */}
            <td className="py-3 pr-3 w-10 relative">
                {onDelete && (
                    <div className="relative">
                        <button
                            onClick={() => setMenuOpen(v => !v)}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none duration-150 ease-out"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-8 z-50 bg-bg-card border border-border rounded-[var(--radius-md)] py-1 min-w-[120px] animate-fade-in">
                                <button
                                    onClick={() => { setMenuOpen(false); onDelete(idea.id) }}
                                    className="w-full text-left px-3 py-2 text-[13px] text-danger hover:bg-bg-hover transition-colors flex items-center gap-2"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </td>
        </tr>
    )
}

// ── Idea Table View ──
function IdeaTableView({ ideas, resolveProfile, onDelete, isSelectable, selectedIdeaIds, onSelect, isExtracting, onSelectAll }) {
    const [sortCol, setSortCol] = useState('date')
    const [sortDir, setSortDir] = useState('desc')
    const allSelected = ideas.length > 0 && ideas.every(i => selectedIdeaIds.has(i.id))

    const sorted = useMemo(() => {
        return [...ideas].sort((a, b) => {
            let va, vb
            if (sortCol === 'name') {
                va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase()
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            }
            if (sortCol === 'category') {
                va = a.type || ''; vb = b.type || ''
                return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
            }
            if (sortCol === 'cost') {
                va = parseFloat((a.priceDetails || '').split(/[-–]/)[0].replace(/[^0-9.]/g, '')) || 0
                vb = parseFloat((b.priceDetails || '').split(/[-–]/)[0].replace(/[^0-9.]/g, '')) || 0
                return sortDir === 'asc' ? va - vb : vb - va
            }
            // date (default)
            va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0)
            return sortDir === 'asc' ? va - vb : vb - va
        })
    }, [ideas, sortCol, sortDir])

    function toggleSort(col) {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortCol(col); setSortDir('asc') }
    }

    const SortIcon = ({ col }) => {
        if (sortCol !== col) return <svg className="w-3 h-3 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
        return sortDir === 'asc'
            ? <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            : <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
    }

    const thClass = "px-0 pb-3 text-xs font-bold uppercase tracking-wider text-text-muted text-left select-none"
    const sortable = "cursor-pointer hover:text-text-primary transition-colors"

    return (
        <div className="border border-border rounded-[var(--radius-lg)] bg-bg-card overflow-hidden animate-fade-in">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-border">
                        <th className="pl-4 pr-2 pb-3 pt-3 w-10">
                            {isSelectable && (
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => onSelectAll(ideas, allSelected)}
                                    className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer"
                                />
                            )}
                        </th>
                        <th className="pr-3 pb-3 pt-3 w-12" />
                        <th className={`${thClass} ${sortable} pt-3`} onClick={() => toggleSort('name')}>
                            <div className="flex items-center gap-1">NAME <SortIcon col="name" /></div>
                        </th>
                        <th className={`${thClass} ${sortable} pt-3`} onClick={() => toggleSort('category')}>
                            <div className="flex items-center gap-1">CATEGORY <SortIcon col="category" /></div>
                        </th>
                        <th className={`${thClass} ${sortable} pt-3`} onClick={() => toggleSort('cost')}>
                            <div className="flex items-center gap-1">EST. COST <SortIcon col="cost" /></div>
                        </th>
                        <th className={`${thClass} pt-3`}>ADDED BY</th>
                        <th className={`${thClass} ${sortable} pt-3`} onClick={() => toggleSort('date')}>
                            <div className="flex items-center gap-1">DATE <SortIcon col="date" /></div>
                        </th>
                        <th className="w-10 pb-3 pt-3 pr-3" />
                    </tr>
                </thead>
                <tbody>
                    {isExtracting && (
                        <tr className="border-b border-border animate-pulse">
                            <td colSpan={8} className="py-3 px-4">
                                <div className="h-4 bg-bg-secondary rounded w-2/3" />
                            </td>
                        </tr>
                    )}
                    {sorted.map(idea => (
                        <IdeaTableRow
                            key={idea.id}
                            idea={idea}
                            resolveProfile={resolveProfile}
                            onDelete={onDelete}
                            isSelectable={isSelectable}
                            isSelected={selectedIdeaIds.has(idea.id)}
                            onSelect={onSelect}
                        />
                    ))}
                    {sorted.length === 0 && !isExtracting && (
                        <tr><td colSpan={8} className="py-12 text-center text-text-muted text-sm">No ideas match this filter.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}

// ── Floating Action Bar ──
function FloatingActionBar({ count, isCreatingPoll, onStartDraft, onSubmit, disabled, onCancel }) {
    if (count < 2) return null
    return createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
            <div className="flex items-center gap-3 bg-[#1A1918] text-white rounded-full px-5 py-3 border border-white/20">
                <div>
                    <div className="text-[13px] font-semibold">{count} {count === 1 ? 'Idea' : 'Ideas'} Selected</div>
                    <div className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Ready to vote?</div>
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

function PollOptionCard({ option, poll, activeUserId, onVote, isLeader, globalTokensRemaining, globalVetoesRemaining, resolveProfile }) {
    const [imgError, setImgError] = useState(false)
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
                    <span className="rotate-[-6deg] text-danger font-semibold border-2 border-danger px-4 py-1.5 rounded-[var(--radius-md)] bg-bg-card opacity-90 tracking-widest uppercase">Vetoed 🧨</span>
                </div>
            )}

            {/* Image Thumbnail */}
            <div className={`h-32 w-full bg-bg-secondary rounded-t-[calc(var(--radius-lg)-2px)] overflow-hidden shrink-0 flex items-center justify-center relative ${isLeader ? 'mt-0' : ''}`}>
                {option.imageUrl && !imgError ? (
                    <img
                        src={option.imageUrl}
                        className="w-full h-full object-cover"
                        alt=""
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
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

                {/* Global Stats section */}
                <div className="mt-auto pt-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center -space-x-1.5 min-w-[32px]">
                        {/* We would render avatars of voters here if we had resolveProfile passed down, but total is good for now. Or fake it with initial circles for demo if 0. */}
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
                        <div className="bg-amber-500/10 text-amber-600 font-semibold text-[10px] uppercase tracking-widest px-2 py-1 rounded">
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
                            <span className="text-xs font-semibold text-amber-500 tracking-widest uppercase"><span className="text-base">{myTokens}</span> TOKENS</span>
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
                            className="w-full border border-border bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors py-2.5 rounded-[var(--radius-md)] text-[11px] font-semibold uppercase tracking-widest flex items-center justify-center gap-2"
                            disabled={globalTokensRemaining <= 0 || isVetoedByAnyone}
                        >
                            <span className="text-base leading-none text-text-muted">+ 🟡</span> Add Token
                        </button>
                    )}

                    {/* Simplified Veto Text Link below */}
                    <button
                        onClick={() => onVote(poll.id, option.id, 'veto')}
                        disabled={(globalVetoesRemaining === 0 && !isMyVeto)}
                        className={`text-[10px] font-semibold text-center mt-1 uppercase tracking-widest transition-colors ${isMyVeto ? 'text-danger' : 'text-text-muted hover:text-danger'}`}
                    >
                        {isMyVeto ? '🧨 VETOED' : 'VETO'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Poll Container Card ──
function PollCard({ poll, activeUserId, onVote, onResolve, onDelete, onCancel, resolveProfile, globalTokensRemaining, globalVetoesRemaining }) {
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
        <div className="flex flex-col md:flex-row border border-border rounded-[var(--radius-xl)] bg-bg-card overflow-hidden relative mb-6">
            {/* Options container — order-1 on mobile (top) */}
            <div className="order-1 md:order-2 w-full md:w-[70%] p-4 md:p-6 flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4 sm:gap-2">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            {poll.status === 'resolved' ? (
                                <span className="text-[10px] font-semibold text-success uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-success"></div> RESOLVED</span>
                            ) : (
                                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> ACTIVE POLL</span>
                            )}
                        </div>
                        <h2 className="text-[22px] font-heading font-semibold text-text-primary leading-tight mb-2">
                            {poll.title}
                        </h2>
                        {poll.status === 'active' && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-accent uppercase tracking-wider">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                Closes in 24 hours
                            </div>
                        )}
                    </div>

                    {poll.status === 'active' && (
                        <div className="flex flex-col gap-2 items-end w-full sm:w-auto">
                            <Button onClick={() => onResolve(poll)} variant="secondary" className="w-full sm:w-auto px-5 py-2 text-[11px] uppercase tracking-wider font-semibold shadow-none hover:bg-bg-hover">
                                Resolve Early
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex overflow-x-auto gap-5 pb-4 snap-x pl-1 pt-3">
                    {poll.options.map(opt => (
                        <div key={opt.id} className="min-w-[240px] w-[240px] max-w-[240px] snap-start shrink-0">
                            <PollOptionCard option={opt} poll={poll} activeUserId={activeUserId} onVote={onVote} isLeader={leaderId === opt.id} globalTokensRemaining={globalTokensRemaining} globalVetoesRemaining={globalVetoesRemaining} resolveProfile={resolveProfile} />
                        </div>
                    ))}
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-4 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        <button onClick={() => onDelete(poll.id)} className="hover:text-danger hover:underline transition-colors">Delete/Archive</button>
                        {onCancel && <button onClick={() => onCancel(poll.id)} className="hover:text-accent hover:underline transition-colors">Cancel Poll & Refund</button>}
                    </div>
                </div>
            </div>

            {/* Activity Log container — order-2 on mobile (bottom) */}
            <div className="order-2 md:order-1 w-full md:w-[30%] border-t md:border-t-0 md:border-r border-border p-4 md:p-6 bg-bg-primary flex flex-col shrink-0">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.15em] mb-3 md:mb-6">Activity Log</h3>
                <div className="flex-1 space-y-4 md:space-y-5 overflow-y-auto pr-2 max-h-[200px] md:max-h-none">
                    {logs.length === 0 ? (
                        <p className="text-xs text-text-secondary mt-6 font-medium">Start a poll to see voting activity here.</p>
                    ) : (
                        logs.map(log => (
                            <div key={log.id} className="flex gap-3 items-start relative">
                                <div className="absolute left-3.5 top-8 bottom-[-20px] w-px bg-border -z-10"></div>
                                <AvatarCircle profile={log.user} size={28} />
                                <p className="text-[13px] text-text-secondary leading-snug">
                                    <span className="font-semibold text-text-primary">{log.user?.name || 'Someone'}</span> {log.action} <span className="font-semibold text-text-primary">{log.target}</span>.
                                    <span className="block text-[10px] text-text-muted uppercase font-semibold mt-1 tracking-wider">Just Now</span>
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Idea Card (Original + Selection Logic) ──
function IdeaCard({ idea, resolveProfile, onDelete, isSelectable, isSelected, onSelect }) {
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

            {/* Target Status Banner */}
            {isBooked && (
                <div className="bg-success text-white text-[10px] font-semibold uppercase tracking-widest py-1.5 text-center flex items-center justify-center gap-1.5 absolute top-0 inset-x-0 z-10">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Added to Itinerary/Bookings
                </div>
            )}

            {/* Delete button — visible on card hover (only when not selecting) */}
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

            {/* Top Half: Real image or emoji fallback */}
            <div className={`relative h-44 w-full flex items-center justify-center bg-bg-secondary overflow-hidden ${isBooked ? 'mt-6' : ''}`}>
                {idea.imageUrl && !imgError ? (
                    <img
                        src={idea.imageUrl}
                        alt={idea.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="text-6xl filter saturate-150 transform group-hover:scale-110 transition-transform duration-500">
                        {idea.emoji || '✨'}
                    </div>
                )}
                {idea.imageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-black/30 pointer-events-none" />}

                {/* Source Badge */}
                {idea.sourceName && (
                    <div className="absolute top-3 left-3 bg-bg-card/90 backdrop-blur-md border border-border/50 rounded-md px-2 py-1 text-[10px] font-semibold flex items-center gap-1.5 text-text-secondary z-10 transition-opacity">
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
                <a href={idea.url} target="_blank" rel="noopener noreferrer" className="group/link flex items-start justify-between gap-2 mb-1 z-10" onClick={e => isSelectable && e.preventDefault()}>
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

// ── Main Tab Component ──
export default function VotingTab() {
    const { activeTrip, dispatch, showToast } = useTripContext()
    const { currentUserProfile, resolveProfile } = useProfiles()

    const [filter, setFilter] = useState('all')
    const [showIdeaExtractor, setShowIdeaExtractor] = useState(false)

    // View toggle: 'grid' | 'table'
    const [ideaView, setIdeaView] = useState(() => localStorage.getItem('votingTab_view') || 'table')
    function switchView(v) { setIdeaView(v); localStorage.setItem('votingTab_view', v) }

    // Proposal Creation State
    const [isCreatingPoll, setIsCreatingPoll] = useState(false)
    const [selectedIdeaIds, setSelectedIdeaIds] = useState(new Set())
    const [pollTitle, setPollTitle] = useState('')

    const pollTitleRef = useRef(null)

    // Scroll to input when we start creating a poll
    useEffect(() => {
        if (isCreatingPoll && pollTitleRef.current) {
            // Slight delay ensures the DOM has painted the element before scrolling
            setTimeout(() => {
                pollTitleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                pollTitleRef.current.focus()
            }, 50)
        }
    }, [isCreatingPoll])

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

    const handleSelectAll = (ideas, allSelected) => {
        if (allSelected) {
            setSelectedIdeaIds(new Set())
        } else {
            setSelectedIdeaIds(new Set(ideas.filter(i => i.status !== 'booked').map(i => i.id)))
        }
    }

    const startCreatingPoll = () => setIsCreatingPoll(true)

    const handleCreatePoll = () => {
        if (selectedIdeaIds.size < 2 || !pollTitle.trim()) return

        const selectedOptions = ideas.filter(i => selectedIdeaIds.has(i.id)).map(idea => ({
            id: idea.id || generateId(),
            title: idea.title || "Untitled",
            emoji: idea.emoji || "✨",
            imageUrl: idea.imageUrl || null,
            priceDetails: idea.priceDetails || "TBD",
            description: idea.description || "",
            url: idea.url || "",
            sourceName: idea.sourceName || "Link"
        }))

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

    const handleCancelPoll = (pollId) => {
        if (window.confirm("Are you sure you want to cancel this poll? All tokens will be refunded and ideas will return to the pool.")) {
            dispatch({ type: ACTIONS.CANCEL_POLL, payload: pollId })
            showToast("Poll cancelled and contents returned to idea pool.")
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

        triggerHaptic('heavy')

        // Add the winning option to bookings
        dispatch({
            type: ACTIONS.ADD_BOOKING,
            payload: {
                name: winningOption.title || winningOption.sourceName || 'Untitled Proposal Winner',
                provider: winningOption.sourceName || '',
                category: (winningOption.type === 'lodging' ? 'hotel' : (winningOption.type === 'activity' ? 'experience' : 'custom')),
                providerLink: winningOption.url || '',
            }
        })

        // Remove the poll — winner is now in Bookings, poll has served its purpose
        dispatch({ type: ACTIONS.DELETE_POLL, payload: poll.id })

        showToast(`🎉 "${winningOption.title}" won with ${highestTokens} tokens — added to Bookings!`)

        // Short delay so the toast is readable before switching tabs
        setTimeout(() => {
            dispatch({ type: ACTIONS.SET_TAB, payload: 'bookings' })
        }, 1500)
    }

    return (
        <div className="space-y-8 animate-fade-in pb-16 w-full">
            {/* ── Layer 1: Header (Token Bank) ── */}
            <div className="flex justify-end">
                <Card className="px-5 py-2.5 rounded-full flex items-center gap-4 border border-border">
                    <div className="flex gap-1.5 items-center">
                        <span className="text-xs font-semibold text-text-secondary mr-1">Your Bank:</span>
                        <div className="flex gap-1">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < globalTokensRemaining ? 'bg-amber-400' : 'bg-border'}`} />
                            ))}
                        </div>
                    </div>
                    <div className="w-px h-4 bg-border"></div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${globalVetoesRemaining === 0 ? 'text-text-muted opacity-50 grayscale' : 'text-danger'}`}>
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
                                onCancel={handleCancelPoll}
                                resolveProfile={resolveProfile}
                                globalTokensRemaining={globalTokensRemaining}
                                globalVetoesRemaining={globalVetoesRemaining}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex border-2 border-dashed border-border/60 rounded-[var(--radius-xl)] bg-transparent relative">
                        {/* Empty Poll - Full width */}
                        <div className="w-full py-24 flex flex-col items-center justify-center text-center px-4">
                            <div className="w-14 h-14 bg-bg-secondary rounded-2xl flex items-center justify-center text-3xl border border-border mb-5 saturate-0">🗳️</div>
                            <h3 className="text-xl font-semibold font-heading text-text-primary">No active polls yet</h3>
                            <p className="text-sm text-text-secondary mt-2 max-w-[340px] mb-8 leading-relaxed">Select 2 or more conflicting ideas from the pool below to pit them against each other in a formal vote.</p>
                            {!isCreatingPoll && (
                                <Button variant="primary" onClick={() => setIsCreatingPoll(true)}>
                                    Create Proposal
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Idea Board Section (Divergent Phase) ── */}
            <div className="space-y-4 relative">

                {/* ── Layer 2: The Toolbar (Unified Filters & Actions) ── */}
                <div className="flex flex-col gap-4">
                    {/* Search / Multi-Select Title (Floating logic) */}
                    {isCreatingPoll && (
                        <div className="animate-fade-in fade-in flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-bg-card border border-border rounded-[var(--radius-lg)]">
                            <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xl shrink-0">📝</div>
                            <div className="flex-1 w-full relative">
                                <label className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1 block">Name Your Proposal</label>
                                <input
                                    ref={pollTitleRef}
                                    type="text"
                                    value={pollTitle}
                                    onChange={e => setPollTitle(e.target.value)}
                                    placeholder="e.g., Where are we staying in Paris?"
                                    className="w-full bg-transparent border-0 border-b-2 border-transparent focus:border-accent px-0 py-1 text-base font-semibold text-text-primary focus:ring-0 transition-colors outline-none placeholder:text-text-muted placeholder:font-normal"
                                    autoFocus
                                />
                            </div>
                            <p className="text-[11px] font-medium text-text-secondary sm:w-48 leading-relaxed hidden sm:block">Select at least <strong>2 ideas</strong> below to bundle them into a unified vote.</p>
                        </div>
                    )}

                    <div className={`transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 mb-2 relative gap-2 ${isCreatingPoll ? '-mt-2' : ''}`}>
                        <div className="flex-1">
                            <select
                                value={filter}
                                onChange={e => setFilter(e.target.value)}
                                className="text-sm bg-bg-secondary border border-border rounded-[var(--radius-md)] px-3 py-1.5 text-text-primary focus:outline-none focus:border-accent w-auto min-w-[140px] cursor-pointer"
                            >
                                <option value="all">All Categories</option>
                                {GLOBAL_CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.emoji} {cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
                            {/* View toggle */}
                            <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                                <button
                                    id="idea-view-table"
                                    onClick={() => switchView('table')}
                                    className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${ideaView === 'table' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                                    Table
                                </button>
                                <button
                                    id="idea-view-grid"
                                    onClick={() => switchView('grid')}
                                    className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${ideaView === 'grid' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                                    Grid
                                </button>
                            </div>

                            <div className="hidden md:block shrink-0">
                                <Button size="sm" onClick={() => setShowIdeaExtractor(true)} className="shrink-0">
                                    + Extract Idea
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* FAB — mobile only */}
                    {createPortal(
                        <button
                            onClick={() => { hapticImpact('medium'); setShowIdeaExtractor(true) }}
                            className="fixed bottom-24 right-4 z-40 block md:hidden shadow-lg bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                            Extract Idea
                        </button>,
                        document.body
                    )}
                </div>

                {/* Idea Pool: Grid or Table */}
                {ideas.length === 0 ? (
                    <div className="py-24 mt-8 text-center flex flex-col items-center justify-center border-2 border-dashed border-border rounded-[var(--radius-xl)] bg-bg-secondary/30">
                        <span className="text-5xl opacity-50 mb-4 saturate-0">📦</span>
                        <h3 className="font-heading font-semibold text-lg text-text-primary">The board is empty</h3>
                        <p className="text-sm text-text-secondary max-w-sm mt-1 mb-6 leading-relaxed">Paste a link to any hotel, Airbnb, or tour, and Wanda will generate an idea card for the group to vote on.</p>
                        <ul className="text-xs text-text-muted space-y-2 text-left bg-bg-card px-6 py-4 rounded-xl border border-border">
                            <li className="flex items-center gap-2">✅ Extracts titles, images, and prices</li>
                            <li className="flex items-center gap-2">✅ Works with most travel websites</li>
                            <li className="flex items-center gap-2">✅ Group ideas into Proposals for voting</li>
                        </ul>
                    </div>
                ) : ideaView === 'table' ? (
                    <div className="mt-4">
                        <IdeaTableView
                            ideas={visibleIdeas}
                            resolveProfile={resolveProfile}
                            onDelete={handleDeleteIdea}
                            isSelectable={isCreatingPoll}
                            selectedIdeaIds={selectedIdeaIds}
                            onSelect={toggleIdeaSelection}
                            onSelectAll={handleSelectAll}
                            isExtracting={false}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 mt-6 relative pb-4">
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

            <IdeaExtractorModal isOpen={showIdeaExtractor} onClose={() => setShowIdeaExtractor(false)} />

            {/* Floating action bar — shown whenever 2+ ideas are selected */}
            <FloatingActionBar
                count={selectedIdeaIds.size}
                isCreatingPoll={isCreatingPoll}
                onStartDraft={() => setIsCreatingPoll(true)}
                onSubmit={handleCreatePoll}
                disabled={isCreatingPoll && !pollTitle.trim()}
                onCancel={() => { setSelectedIdeaIds(new Set()); setIsCreatingPoll(false) }}
            />
        </div>
    )
}
