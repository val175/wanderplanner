import { generateId } from '../../utils/helpers'
import { updateTrip } from '../reducerUtils'

export const packingCases = {
  ADD_PACKING_ITEM: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      packingList: [...trip.packingList, {
        id: generateId(),
        packed: false,
        section: 'Misc',
        ...payload,
      }],
    }))
  },

  TOGGLE_PACKING_ITEM: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      packingList: trip.packingList.map(p => {
        if (p.id !== payload.itemId) return p
        const nextPacked = !p.packed
        return { ...p, packed: nextPacked, packedBy: nextPacked ? payload.userId : null }
      }),
    }))
  },

  UPDATE_PACKING_ITEM: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      packingList: trip.packingList.map(p =>
        p.id === payload.id ? { ...p, ...payload.updates } : p
      ),
    }))
  },

  DELETE_PACKING_ITEM: (state, payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      packingList: trip.packingList.filter(p => p.id !== payload),
    }))
  },

  RESET_PACKING: (state, _payload) => {
    const activeTripId = state.activeTripId
    return updateTrip(state, activeTripId, trip => ({
      ...trip,
      packingList: trip.packingList.map(p => ({ ...p, packed: false, packedBy: null })),
    }))
  },

  // ADD_PACKING_SECTION — defined in ACTIONS but not yet implemented; returns state unchanged
  ADD_PACKING_SECTION: (state, _payload) => state,
}
