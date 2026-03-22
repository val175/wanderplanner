export const wandaRuntime = {
  weatherContext: '',
  activeTab: 'overview',
  selectedMapPoint: null,
  pendingMapFocus: null,
  pendingItineraryFocus: null,
  uiContext: '',
}

export function setWandaRuntime(patch = {}) {
  Object.assign(wandaRuntime, patch)
  return wandaRuntime
}
