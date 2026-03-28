import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

export const votingCases = {
  ADD_IDEA: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      ideas: [{
        id: generateId(),
        status: 'pending',
        votes: {},
        createdAt: new Date().toISOString(),
        ...payload,
      }, ...(trip.ideas || [])],
    }))
  },

  VOTE_IDEA: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      ideas: (trip.ideas || []).map(idea => {
        if (idea.id !== payload.ideaId) return idea
        const currentVote = idea.votes[payload.userId]
        const newVotes = { ...idea.votes }
        if (currentVote === payload.voteType) {
          delete newVotes[payload.userId]
        } else {
          newVotes[payload.userId] = payload.voteType
        }
        return { ...idea, votes: newVotes }
      }),
    }))
  },

  UPDATE_IDEA: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      ideas: (trip.ideas || []).map(idea =>
        idea.id === payload.ideaId ? { ...idea, ...payload.updates } : idea
      ),
    }))
  },

  UPDATE_IDEA_STATUS: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      ideas: (trip.ideas || []).map(idea =>
        idea.id === payload.ideaId ? { ...idea, status: payload.status } : idea
      ),
    }))
  },

  DELETE_IDEA: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      ideas: (trip.ideas || []).filter(idea => idea.id !== payload),
    }))
  },

  CREATE_POLL: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      polls: [{
        id: generateId(),
        title: payload.title || 'New Poll',
        status: 'active',
        createdAt: new Date().toISOString(),
        deadline: payload.deadline || null,
        proposerId: payload.proposerId,
        options: payload.options || [],
        votes: {},
      }, ...(trip.polls || [])],
      ideas: payload.removeIdeas
        ? (trip.ideas || []).filter(i => !payload.options.some(o => o.id === i.id))
        : trip.ideas,
    }))
  },

  VOTE_POLL: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      polls: (trip.polls || []).map(poll => {
        if (poll.id !== payload.pollId) return poll
        const userVotes = poll.votes[payload.userId] || { tokens: {}, veto: null }
        const newUserVotes = { ...userVotes, tokens: { ...userVotes.tokens } }
        if (payload.type === 'token') {
          const current = newUserVotes.tokens[payload.optionId] || 0
          if (payload.action === 'add') {
            newUserVotes.tokens[payload.optionId] = current + 1
          } else if (payload.action === 'remove' && current > 0) {
            newUserVotes.tokens[payload.optionId] = current - 1
          }
        } else if (payload.type === 'veto') {
          newUserVotes.veto = newUserVotes.veto === payload.optionId ? null : payload.optionId
        }
        return { ...poll, votes: { ...poll.votes, [payload.userId]: newUserVotes } }
      }),
    }))
  },

  RESOLVE_POLL: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      polls: (trip.polls || []).map(poll =>
        poll.id === payload.pollId ? { ...poll, status: 'resolved' } : poll
      ),
    }))
  },

  DELETE_POLL: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      polls: (trip.polls || []).filter(poll => poll.id !== payload),
    }))
  },

  CANCEL_POLL: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => {
      const pollToCancel = (trip.polls || []).find(p => p.id === payload)
      if (!pollToCancel) return trip
      return {
        ...trip,
        polls: trip.polls.filter(p => p.id !== payload),
        ideas: [...(trip.ideas || []), ...pollToCancel.options],
      }
    })
  },

  UPDATE_WANDA_CONVERSATION: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({ ...trip, wandaConversation: payload }))
  },

  CLEAR_WANDA_CONVERSATION: (state, _payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({ ...trip, wandaConversation: [] }))
  },

  ADD_WANDA_ALERT: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      wandaAlerts: [
        ...(trip.wandaAlerts || []).slice(-9),
        { ...payload, id: generateId(), createdAt: Date.now() },
      ],
    }))
  },

  CLEAR_WANDA_ALERTS: (state, _payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({ ...trip, wandaAlerts: [] }))
  },
}
