import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { GLOBAL_CATEGORIES } from '../../constants/categories'
import Card from '../shared/Card'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { hapticImpact } from '../../utils/haptics'
import IdeaExtractorModal from '../modal/IdeaExtractorModal'
import ConfirmDialog from '../shared/ConfirmDialog'
import Select, { SelectItem } from '../shared/Select'
import EmptyState from '../shared/EmptyState'
import IdeaTableView from './voting/IdeaTableView'
import IdeaCard from './voting/IdeaCard'
import PollCard from './voting/PollCard'
import { FloatingActionBar } from './voting/votingUtils'
import { useVoting } from '../../hooks/useVoting'

export default function VotingTab() {
  const { activeTrip, dispatch } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()

  const [filter, setFilter] = useState('all')
  const [showIdeaExtractor, setShowIdeaExtractor] = useState(false)
  const [ideaView, setIdeaView] = useState(() => localStorage.getItem('votingTab_view') || 'table')
  const pollTitleRef = useRef(null)

  const {
    selectedIdeaIds, setSelectedIdeaIds,
    pollTitle, setPollTitle,
    isCreatingPoll, setIsCreatingPoll,
    globalTokensRemaining, globalVetoesRemaining,
    handleDeleteIdea, handleUpdateIdea,
    toggleIdeaSelection, handleSelectAll,
    handleCreatePoll, handlePollVote,
    handleDeletePoll, confirmDeletePoll, pendingDeletePollId, setPendingDeletePollId,
    handleCancelPoll, confirmCancelPoll, pendingCancelPollId, setPendingCancelPollId,
    handleResolvePoll,
  } = useVoting()

  function switchView(v) { setIdeaView(v); localStorage.setItem('votingTab_view', v) }

  useEffect(() => {
    const handler = () => setIsCreatingPoll(true)
    window.addEventListener('open-add-vote', handler)
    return () => window.removeEventListener('open-add-vote', handler)
  }, [])

  useEffect(() => {
    if (isCreatingPoll && pollTitleRef.current) {
      setTimeout(() => {
        pollTitleRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        pollTitleRef.current.focus()
      }, 50)
    }
  }, [isCreatingPoll])

  const ideas = activeTrip?.ideas || []
  const polls = activeTrip?.polls || []

  const visibleIdeas = useMemo(() => {
    let arr = [...ideas].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (filter !== 'all') {
      arr = arr.filter(i => (i.type || 'other') === filter)
    }
    return arr
  }, [ideas, filter])

  return (
    <div className="space-y-8 animate-fade-in pb-24 w-full">
      {/* Token Bank */}
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

      {/* Polls Section */}
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
            <div className="w-full py-24 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 bg-bg-secondary rounded-2xl flex items-center justify-center text-3xl border border-border mb-5 saturate-0">🗳️</div>
              <h3 className="text-xl font-semibold font-heading text-text-primary">No active polls yet</h3>
              <p className="text-sm text-text-secondary mt-2 max-w-[340px] mb-8 leading-relaxed">Select 2 or more conflicting ideas from the pool below to pit them against each other in a formal vote.</p>
              {!isCreatingPoll && (
                <Button variant="primary" size="sm" onClick={() => setIsCreatingPoll(true)}>
                  Create Proposal
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Idea Board Section */}
      <div className="space-y-4 relative">
        <div className="flex flex-col gap-4">
          {/* Poll creation input */}
          {isCreatingPoll && (
            <div className="animate-fade-in flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-bg-card border border-border rounded-[var(--radius-lg)]">
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

          {/* Toolbar */}
          <div className={`transition-all duration-300 flex flex-col md:flex-row md:items-center justify-end border-b border-border pb-4 mb-2 relative gap-2 ${isCreatingPoll ? '-mt-2' : ''}`}>
            <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
              <Select value={filter} onValueChange={setFilter} className="!w-auto min-w-[140px] shrink-0" size="sm">
                <SelectItem value="all">All Categories</SelectItem>
                {GLOBAL_CATEGORIES.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</SelectItem>
                ))}
              </Select>

              <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0 h-9">
                <button id="idea-view-table" onClick={() => switchView('table')}
                  className={`px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${ideaView === 'table' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                  Table
                </button>
                <button id="idea-view-grid" onClick={() => switchView('grid')}
                  className={`px-3 text-sm font-medium rounded-[var(--radius-sm)] transition-colors flex items-center gap-1.5 ${ideaView === 'grid' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}>
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

          {/* Mobile FAB */}
          {createPortal(
            <button onClick={() => { hapticImpact('medium'); setShowIdeaExtractor(true) }}
              className="fixed bottom-24 right-4 z-40 block md:hidden bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Extract Idea
            </button>,
            document.body
          )}
        </div>

        {/* Idea Pool */}
        {ideas.length === 0 ? (
          <EmptyState
            className="mt-8"
            emoji="📦"
            title="The board is empty"
            subtitle="Paste a link to any hotel, Airbnb, or tour — or ask Wanda for recommendations your group can vote on."
            wandaPrompt={`Help us find some cool things to do or places to stay in ${activeTrip?.cities?.map(c => c.city).join(', ') || 'my destinations'}.\n\n[INSTRUCTION]:\nGive me 3 hotel recommendations and 3 activity ideas for our trip. IMPORTANT: For EACH one, you MUST call the "add_idea_to_voting_room" tool so the group can vote on them.`}
          />
        ) : ideaView === 'table' ? (
          <div className="mt-4">
            <IdeaTableView
              ideas={visibleIdeas}
              resolveProfile={resolveProfile}
              onDelete={handleDeleteIdea}
              onUpdate={handleUpdateIdea}
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

      <ConfirmDialog
        isOpen={!!pendingDeletePollId}
        onClose={() => setPendingDeletePollId(null)}
        onConfirm={confirmDeletePoll}
        title="Delete poll?"
        message="The ideas will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        danger
      />
      <ConfirmDialog
        isOpen={!!pendingCancelPollId}
        onClose={() => setPendingCancelPollId(null)}
        onConfirm={confirmCancelPoll}
        title="Cancel poll?"
        message="All tokens will be refunded and ideas will return to the pool."
        confirmLabel="Cancel Poll"
        danger={false}
      />

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
