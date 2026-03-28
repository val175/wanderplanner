import { useState, useRef } from 'react'
import { useTripContext } from '../context/TripContext'
import { useProfiles } from '../context/ProfileContext'
import { ACTIONS } from '../state/tripReducer'
import { generateId } from '../utils/helpers'
import { triggerHaptic } from '../utils/haptics'

/**
 * Manages all voting/polling state and handlers for VotingTab.
 * Handles idea CRUD, poll lifecycle, vote casting, and poll resolution.
 */
export function useVoting() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const { currentUserProfile, awardXp } = useProfiles()
  const votedPollsRef = useRef(new Set())

  const [selectedIdeaIds, setSelectedIdeaIds] = useState(new Set())
  const [pollTitle, setPollTitle] = useState('')
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)

  const ideas = activeTrip?.ideas || []
  const polls = activeTrip?.polls || []

  // Global token/veto bank across all active polls
  const activePolls = polls.filter(p => p.status === 'active')
  let totalTokensUsedByMe = 0
  let totalVetoesUsedByMe = 0
  if (currentUserProfile) {
    activePolls.forEach(poll => {
      const myVotes = poll.votes?.[currentUserProfile.id] || { tokens: {}, veto: null }
      totalTokensUsedByMe += Object.values(myVotes.tokens).reduce((sum, count) => sum + count, 0)
      if (myVotes.veto) totalVetoesUsedByMe += 1
    })
  }
  const globalTokensRemaining = Math.max(0, 3 - totalTokensUsedByMe)
  const globalVetoesRemaining = Math.max(0, 1 - totalVetoesUsedByMe)

  const handleDeleteIdea = (ideaId) => {
    dispatch({ type: ACTIONS.DELETE_IDEA, payload: ideaId })
    showToast('Idea removed')
  }

  const handleUpdateIdea = (ideaId, updates) => {
    dispatch({ type: ACTIONS.UPDATE_IDEA, payload: { ideaId, updates } })
  }

  const toggleIdeaSelection = (idea) => {
    if (idea.status === 'booked') return
    const newSet = new Set(selectedIdeaIds)
    if (newSet.has(idea.id)) newSet.delete(idea.id)
    else newSet.add(idea.id)
    setSelectedIdeaIds(newSet)
  }

  const handleSelectAll = (visibleIdeas, allSelected) => {
    if (allSelected) {
      setSelectedIdeaIds(new Set())
    } else {
      setSelectedIdeaIds(new Set(visibleIdeas.filter(i => i.status !== 'booked').map(i => i.id)))
    }
  }

  const handleCreatePoll = () => {
    if (selectedIdeaIds.size < 2 || !pollTitle.trim()) return
    const selectedOptions = ideas.filter(i => selectedIdeaIds.has(i.id)).map(idea => ({
      id: idea.id || generateId(),
      title: idea.title || 'Untitled',
      emoji: idea.emoji || '✨',
      imageUrl: idea.imageUrl || null,
      priceDetails: idea.priceDetails || 'TBD',
      description: idea.description || '',
      url: idea.url || '',
      sourceName: idea.sourceName || 'Link'
    }))
    dispatch({
      type: ACTIONS.CREATE_POLL,
      payload: {
        title: pollTitle,
        proposerId: currentUserProfile?.id,
        options: selectedOptions,
        removeIdeas: true
      }
    })
    setIsCreatingPoll(false)
    setSelectedIdeaIds(new Set())
    setPollTitle('')
    showToast('Proposal Poll created! Time to vote. 🗳️')
  }

  const handlePollVote = (pollId, optionId, type, action) => {
    dispatch({
      type: ACTIONS.VOTE_POLL,
      payload: { pollId, ideaId: optionId, optionId, userId: currentUserProfile?.id, type, action }
    })
    if (!votedPollsRef.current.has(pollId)) {
      votedPollsRef.current.add(pollId)
      awardXp('vote_cast', 5, { pollId })
    }
  }

  const handleDeletePoll = (pollId) => {
    if (window.confirm('Are you sure you want to delete this poll? The ideas will be permanently removed.')) {
      dispatch({ type: ACTIONS.DELETE_POLL, payload: pollId })
    }
  }

  const handleCancelPoll = (pollId) => {
    if (window.confirm('Are you sure you want to cancel this poll? All tokens will be refunded and ideas will return to the pool.')) {
      dispatch({ type: ACTIONS.CANCEL_POLL, payload: pollId })
      showToast('Poll cancelled and contents returned to idea pool.')
    }
  }

  const handleResolvePoll = (poll) => {
    let highestTokens = -1
    let winningOption = null
    poll.options.forEach(opt => {
      const vetoes = Object.values(poll.votes || {}).filter(v => v.veto === opt.id).length
      if (vetoes > 0) return
      const tokens = Object.values(poll.votes || {}).reduce((sum, v) => sum + (v.tokens[opt.id] || 0), 0)
      if (tokens > highestTokens) {
        highestTokens = tokens
        winningOption = opt
      }
    })
    if (!winningOption) {
      showToast("No valid winner found! Ensure at least one option isn't vetoed.", 'error')
      return
    }
    triggerHaptic('heavy')
    dispatch({
      type: ACTIONS.ADD_BOOKING,
      payload: {
        name: winningOption.title || winningOption.sourceName || 'Untitled Proposal Winner',
        provider: winningOption.sourceName || '',
        category: (winningOption.type === 'lodging' ? 'hotel' : (winningOption.type === 'activity' ? 'experience' : 'custom')),
        providerLink: winningOption.url || '',
      }
    })
    dispatch({ type: ACTIONS.DELETE_POLL, payload: poll.id })
    showToast(`🎉 "${winningOption.title}" won with ${highestTokens} tokens — added to Bookings!`)
    setTimeout(() => {
      dispatch({ type: ACTIONS.SET_TAB, payload: 'bookings' })
    }, 1500)
  }

  return {
    selectedIdeaIds,
    setSelectedIdeaIds,
    pollTitle,
    setPollTitle,
    isCreatingPoll,
    setIsCreatingPoll,
    globalTokensRemaining,
    globalVetoesRemaining,
    handleDeleteIdea,
    handleUpdateIdea,
    toggleIdeaSelection,
    handleSelectAll,
    handleCreatePoll,
    handlePollVote,
    handleDeletePoll,
    handleCancelPoll,
    handleResolvePoll,
  }
}
