import { useState, useCallback } from 'react'
import { doc, updateDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { ACTIONS } from '../state/tripReducer'

const TRIPS_COLLECTION = 'trips'
const SHARE_LINKS_COLLECTION = 'shareLinks'

/** Generate a random 10-character alphanumeric slug */
function generateShareId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

/** Base URL for sharing — always the app root, never the current trip path */
function getBaseUrl() {
    return window.location.origin + '/'
}

/**
 * Build the public preview snapshot stored at shareLinks/{shareId}.
 * This is the ONLY data a non-member can see before joining — keep it
 * to what JoinTripModal renders plus what acceptInvite needs.
 */
function buildShareSnapshot(trip, userId) {
    return {
        tripId: trip.id,
        name: trip.name || 'Unnamed Trip',
        emoji: trip.emoji || null,
        startDate: trip.startDate || null,
        endDate: trip.endDate || null,
        travelers: trip.travelers || 1,
        destinations: (trip.destinations || []).map(d => ({
            city: d.city || '',
            flag: d.flag || '',
        })),
        travelersSnapshot: trip.travelersSnapshot || [],
        createdBy: userId || null,
        createdAt: serverTimestamp(),
    }
}

/**
 * Hook to manage share link generation and copying for a given trip.
 *
 * Sharing writes two things:
 *   1. `shareId` on the trip doc — security rules use it to permit the
 *      scoped "add self to memberIds" join update.
 *   2. A `shareLinks/{shareId}` doc — a capability token + preview snapshot
 *      that invitees can fetch by exact id without any access to the trip.
 */
export function useShareTrip(trip, dispatch) {
    const userId = auth.currentUser?.uid
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
                await updateDoc(doc(db, TRIPS_COLLECTION, trip.id), { shareId: currentShareId })
                dispatch({
                    type: ACTIONS.GENERATE_SHARE_LINK,
                    payload: { tripId: trip.id, shareId: currentShareId },
                })
            }

            // Always upsert the share-link doc so the preview snapshot stays
            // fresh and links generated before this collection existed are
            // backfilled on next copy.
            await setDoc(
                doc(db, SHARE_LINKS_COLLECTION, currentShareId),
                buildShareSnapshot({ ...trip, shareId: currentShareId }, userId)
            )

            const url = `${getBaseUrl()}?trip=${currentShareId}`
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        } catch (err) {
            console.error('[Wanderplan] Failed to generate share link:', err)
        } finally {
            setIsGenerating(false)
        }
    }, [trip, dispatch, userId])

    const revoke = useCallback(async () => {
        if (!trip?.shareId) return
        try {
            // Delete the capability token first, then disable joining on the trip.
            await deleteDoc(doc(db, SHARE_LINKS_COLLECTION, trip.shareId)).catch(() => { })
            await updateDoc(doc(db, TRIPS_COLLECTION, trip.id), { shareId: null })
            dispatch({ type: ACTIONS.REVOKE_SHARE_LINK, payload: trip.id })
        } catch (err) {
            console.error('[Wanderplan] Failed to revoke share link:', err)
        }
    }, [trip, dispatch])

    return { shareUrl, isGenerating, copied, generateAndCopy, revoke }
}
