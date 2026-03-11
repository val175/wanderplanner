import { useState } from 'react'
import { auth } from '../firebase/config'
import { useTripContext } from '../context/TripContext'
import { ACTIONS } from '../state/tripReducer'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'

export function useSnapToAdd() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const { dispatch, showToast } = useTripContext()

    const validateFile = (file) => {
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
        if (!validTypes.includes(file.type)) {
            throw new Error('Invalid file type. Please upload an Image, PDF, or Text file.')
        }
        // Limit size to 10MB approx
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('File is too large. Please upload a file smaller than 10MB.')
        }
    }

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]
                resolve(base64)
            }
            reader.onerror = error => reject(error)
        })
    }

    const snapToAdd = async (file) => {
        setLoading(true)
        setError(null)

        try {
            validateFile(file)
            const base64 = await fileToBase64(file)
            
            let token = ''
            try {
                if (auth.currentUser) token = await auth.currentUser.getIdToken()
            } catch (e) { console.warn("Failed to get auth token", e) }

            const response = await fetch(`${VERCEL_API}/api/multimodal-ingest`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: JSON.stringify({
                    file: base64,
                    mimeType: file.type
                })
            })

            if (!response.ok) {
                const errData = await response.json()
                throw new Error(errData.error || 'Failed to process file')
            }

            const { data, vector } = await response.json()

            // Push to local state (tripReducer ADD_BOOKING generates an ID and syncs to Firestore)
            dispatch({
                type: ACTIONS.ADD_BOOKING,
                payload: {
                    name: data.title || 'New Booking',
                    category: data.type || 'other',
                    startDate: data.date || '',
                    location: data.location || '',
                    confirmationNumber: data.confirmationNumber || '',
                    amountPaid: Number(data.amountPaid) || 0,
                    status: data.status || 'not_started',
                    notes: data.notes || '',
                    providerLink: data.providerLink || null,
                    attachments: [{
                        id: Date.now(),
                        name: file.name,
                        type: file.type,
                        url: `data:${file.type};base64,${base64}`,
                        dateAdded: new Date().toISOString()
                    }],
                    vector: vector // Matryoshka Embedding (256-dim)
                }
            })

            showToast(`"${data.title || 'Booking'}" added successfully! ✨`)
            return { data, vector }
        } catch (err) {
            const msg = err.message || 'An unexpected error occurred'
            setError(msg)
            showToast(msg, 'error')
            throw err
        } finally {
            setLoading(false)
        }
    }

    return { snapToAdd, loading, error }
}
