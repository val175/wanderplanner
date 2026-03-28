function upsertDocumentMap(state, tripId, updater) {
  const current = state.documentsByTrip?.[tripId] || {}
  const next = typeof updater === 'function' ? updater(current) : updater
  return {
    ...state,
    documentsByTrip: {
      ...(state.documentsByTrip || {}),
      [tripId]: next,
    },
  }
}

function updateDocumentInTrip(state, tripId, documentId, updater) {
  return upsertDocumentMap(state, tripId, current => {
    const existing = current[documentId]
    if (!existing) return current
    const updated = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater }
    return { ...current, [documentId]: updated }
  })
}

function deleteDocumentFromTrip(state, tripId, documentId) {
  return upsertDocumentMap(state, tripId, current => {
    const next = { ...current }
    delete next[documentId]
    return next
  })
}

export const documentCases = {
  SET_DOCUMENTS_FOR_TRIP: (state, payload) => {
    const { tripId, documents } = payload
    return upsertDocumentMap(state, tripId, documents || {})
  },

  ADD_DOCUMENT: (state, payload) => {
    const tripId = payload.tripId || state.activeTripId
    if (!tripId) return state
    return upsertDocumentMap(state, tripId, current => ({
      ...current,
      [payload.id]: {
        ...payload,
        tripId,
      },
    }))
  },

  UPDATE_DOCUMENT: (state, payload) => {
    const tripId = payload.tripId || state.activeTripId
    if (!tripId) return state
    return updateDocumentInTrip(state, tripId, payload.id, prev => ({ ...prev, ...payload.updates }))
  },

  DELETE_DOCUMENT: (state, payload) => {
    const tripId = payload.tripId || state.activeTripId
    if (!tripId) return state
    return deleteDocumentFromTrip(state, tripId, payload.id || payload)
  },

  LINK_DOCUMENT: (state, payload) => {
    const tripId = payload.tripId || state.activeTripId
    if (!tripId) return state
    return updateDocumentInTrip(state, tripId, payload.id, prev => {
      const linked = prev.linkedEntities || []
      const link = { type: payload.linkType || payload.entityType || 'unknown', id: payload.entityId, label: payload.label || '' }
      if (!link.id) return prev
      if (linked.some(item => item.id === link.id && item.type === link.type)) return prev
      return { ...prev, linkedEntities: [...linked, link] }
    })
  },

  UNLINK_DOCUMENT: (state, payload) => {
    const tripId = payload.tripId || state.activeTripId
    if (!tripId) return state
    return updateDocumentInTrip(state, tripId, payload.id, prev => ({
      ...prev,
      linkedEntities: (prev.linkedEntities || []).filter(item => !(item.type === (payload.linkType || payload.entityType || 'unknown') && item.id === payload.entityId)),
    }))
  },
}
