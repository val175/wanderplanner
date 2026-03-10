// src/hooks/useSmartLocation.js
import { useState, useCallback } from 'react'
import { auth } from '../firebase/config'
import { useTripContext } from '../context/TripContext'
import { ACTIONS } from '../state/tripReducer'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'

/**
 * useSmartLocation
 * Manages the resolution of raw location strings into rich objects.
 */
export function useSmartLocation() {
    const { dispatch } = useTripContext()
    const [isResolving, setIsResolving] = useState(false)
    const [error, setError] = useState(null)

    const resolveLocation = useCallback(async (dayId, activityId, query, cityHint = '') => {
        if (!query || query.trim() === '') return;

        setIsResolving(true)
        setError(null)

        try {
            let token = ''
            if (auth.currentUser) token = await auth.currentUser.getIdToken()

            const res = await fetch(`${VERCEL_API}/api/resolve-location`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({ query, cityHint }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || `Resolution failed: ${res.status}`)
            }

            const locationData = await res.json()

            // Update the activity in global state
            dispatch({
                type: ACTIONS.UPDATE_ACTIVITY,
                payload: {
                    dayId,
                    activityId,
                    updates: {
                        location: locationData,
                        // If the placeName is significantly different from the query, 
                        // we keep the query as text but use the object for map/details
                    }
                }
            })

            return locationData
        } catch (e) {
            console.error('[useSmartLocation] Error:', e.message)
            setError(e.message)
            return null
        } finally {
            setIsResolving(false)
        }
    }, [dispatch])

    return {
        resolveLocation,
        isResolving,
        error
    }
}
