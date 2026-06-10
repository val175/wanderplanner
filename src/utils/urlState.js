import { TAB_CONFIG } from '../constants/tabs'

/**
 * URL ⇄ app-state mapping. The reducer remains the single source of truth
 * for navigation; these helpers translate between it and the address bar.
 *
 * Scheme:  /trips/:tripId            → overview tab
 *          /trips/:tripId/:tab       → specific tab
 *
 * The ?trip=<shareId> invite param is intentionally untouched here — it is
 * read once at startup (useFirestoreTrips) and stripped after resolution.
 */

export const VALID_TABS = new Set([...TAB_CONFIG.map(t => t.id), 'wrap-up'])

/** Parse a pathname into { tripId, tab } or null when it isn't a trip URL. */
export function parseTripPath(pathname) {
  const m = pathname.match(/^\/trips\/([^/]+)(?:\/([^/]+))?\/?$/)
  if (!m) return null
  const tab = m[2] && VALID_TABS.has(m[2]) ? m[2] : 'overview'
  return { tripId: decodeURIComponent(m[1]), tab }
}

/** Build the canonical pathname for a trip + tab. */
export function buildTripPath(tripId, tab) {
  const base = `/trips/${encodeURIComponent(tripId)}`
  return tab && tab !== 'overview' ? `${base}/${tab}` : base
}
