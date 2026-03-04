import { useState, useCallback } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { ACTIONS } from '../state/tripReducer'

const TRIPS_COLLECTION = 'trips'

/** Generate a random 10-character alphanumeric slug */
function generateShareId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/** Get the base URL for sharing (handles both dev and prod) */
function getBaseUrl() {
    return window.location.origin + window.location.pathname
}

/**
 * Hook to manage share link generation and copying for a given trip.
 * Returns:
 *   - shareUrl: the current share URL if shareId exists, null otherwise
 *   - isGenerating: true while Firestore write is in flight
 *   - copied: true briefly after a copy
 *   - generateAndCopy: generates a shareId (if needed) and copies the link
 *   - revoke: clears the shareId, invalidating old URLs
 */
export function useShareTrip(trip, dispatch) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [copied, setCopied] = useState(false)

    const shareUrl = trip?.shareId
        ? `${getBaseUrl()}?trip=${trip.shareId}`
        : null

    const generateAndCopy = useCallback(async () => {
        if (!trip) return

        setIsGenerating(true)
        try {
            let currentShareId = trip.shareId
            if (!currentShareId) {
                currentShareId = generateShareId()
                // Persist to Firestore
                await updateDoc(doc(db, TRIPS_COLLECTION, trip.id), { shareId: currentShareId })
                // Update local state
                dispatch({
                    type: ACTIONS.GENERATE_SHARE_LINK,
                    payload: { tripId: trip.id, shareId: currentShareId },
                })
            }

            const url = `${getBaseUrl()}?trip=${currentShareId}`
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        } catch (err) {
            console.error('[Wanderplan] Failed to generate share link:', err)
        } finally {
            setIsGenerating(false)
        }
    }, [trip, dispatch])

    const revoke = useCallback(async () => {
        if (!trip?.shareId) return
        try {
            await updateDoc(doc(db, TRIPS_COLLECTION, trip.id), { shareId: null })
            dispatch({ type: ACTIONS.REVOKE_SHARE_LINK, payload: trip.id })
        } catch (err) {
            console.error('[Wanderplan] Failed to revoke share link:', err)
        }
    }, [trip, dispatch])

    return { shareUrl, isGenerating, copied, generateAndCopy, revoke }
}
