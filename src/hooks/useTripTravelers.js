import { useMemo } from 'react'
import { useTripContext } from '../context/TripContext'
import { useProfiles } from '../context/ProfileContext'

/**
 * Returns a stable, resolved list of traveler objects for the active trip.
 *
 * Design:
 *  - travelerIds is ALWAYS the source of truth for WHO the travelers are
 *    (it's kept up to date when travelers are added/removed).
 *  - travelersSnapshot is used as a name/avatar lookup cache.
 *  - resolveProfile fills in gaps for travelers not in the snapshot.
 *
 * Each traveler object: { id, name, avatar }
 */
export function useTripTravelers() {
    const { activeTrip } = useTripContext()
    const { currentUserProfile, resolveProfile } = useProfiles()

    return useMemo(() => {
        if (!activeTrip) return []

        const ids = activeTrip.travelerIds || []

        // Build a lookup map from the snapshot for O(1) name/avatar access
        const snapshotMap = {}
        for (const s of (activeTrip.travelersSnapshot || [])) {
            if (s?.id) {
                snapshotMap[s.id] = {
                    name: s.name || s.displayName || null,
                    // Support both old (avatar/photoURL) and new (photo/customPhoto) fields
                    photo: s.customPhoto || s.photo || s.avatar || s.photoURL || null,
                }
            }
        }

        if (ids.length > 0) {
            const results = ids.map(id => {
                // 1. Try snapshot cache first (no async lookup needed)
                if (snapshotMap[id]?.name) {
                    return { id, name: snapshotMap[id].name, photo: snapshotMap[id].photo }
                }
                // 2. Try live profile resolution
                const p = resolveProfile(id)
                if (p) {
                    return {
                        id,
                        name: p.name || p.displayName || 'Traveler',
                        photo: p.customPhoto || p.photo || p.photoURL || null,
                    }
                }
                // 3. If it's the current user, use their profile
                if (currentUserProfile && (id === currentUserProfile.uid || id === currentUserProfile.id)) {
                    return {
                        id,
                        name: currentUserProfile.name || 'You',
                        photo: currentUserProfile.customPhoto || currentUserProfile.photo || null,
                    }
                }
                // 4. Profile not yet loaded — placeholder keeps count correct
                return { id, name: 'Traveler', photo: null }
            })

            // Deduplicate by ID only, in case multiple distinct users have the same name
            const unique = []
            const seenIds = new Set()
            for (const r of results) {
                if (!seenIds.has(r.id)) {
                    seenIds.add(r.id)
                    unique.push(r)
                }
            }
            return unique
        }

        if (currentUserProfile) {
            return [{
                id: currentUserProfile.uid || currentUserProfile.id || 'me',
                name: currentUserProfile.name || 'You',
                photo: currentUserProfile.customPhoto || currentUserProfile.photo || null,
            }]
        }

        return []
    }, [activeTrip, currentUserProfile, resolveProfile])
}
