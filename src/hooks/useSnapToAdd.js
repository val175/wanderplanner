import { useState } from 'react'
import { auth } from '../firebase/config'
import { useTripContext } from '../context/TripContext'
import { ACTIONS } from '../state/tripReducer'
import { generateId } from '../utils/helpers'
import { prepareDocumentForStorage, uploadDocumentToStorage } from '../utils/documentVault'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'

export function useSnapToAdd() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const { dispatch, showToast, activeTrip } = useTripContext()

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
            if (!activeTrip?.id) throw new Error('Select a trip before adding documents')
            const prepared = await prepareDocumentForStorage(file, {
                image: { maxEdge: 1600, quality: 0.84 },
            })
            const base64 = await fileToBase64(prepared.storageFile)
            
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
            console.log('[useSnapToAdd] Received extracted data:', data)

            // Sanitize date to YYYY-MM-DD for stability
            const sanitizedDate = data.date ? data.date.split('T')[0] : ''
            const bookingId = generateId()
            const uploadedBy = auth.currentUser?.uid || ''
            const documentTitle = data.title || (file.name ? `Booking: ${file.name}` : 'New Booking')
            const documentRecord = await uploadDocumentToStorage({
                file: prepared.storageFile,
                prepared,
                tripId: activeTrip.id,
                title: documentTitle,
                category: data.type || 'booking',
                sourceTab: 'bookings',
                sourceEntityType: 'booking',
                sourceEntityId: bookingId,
                uploadedBy,
                parsedSummary: [
                    data.title ? `Title: ${data.title}` : '',
                    data.location ? `Location: ${data.location}` : '',
                    data.date ? `Date: ${data.date}` : '',
                    data.confirmationNumber ? `Confirmation: ${data.confirmationNumber}` : '',
                ].filter(Boolean).join('\n'),
                linkedEntities: [{ type: 'booking', id: bookingId, label: documentTitle }],
            })

            dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: documentRecord })

            // Push to local state (tripReducer ADD_BOOKING generates an ID and syncs to Firestore)
            dispatch({
                type: ACTIONS.ADD_BOOKING,
                payload: {
                    id: bookingId,
                    name: data.title || (file.name ? `Booking: ${file.name}` : 'New Booking'),
                    category: data.type || 'custom',
                    startDate: sanitizedDate,
                    location: data.location || '',
                    confirmationNumber: data.confirmationNumber || '',
                    amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : (Number(data.amountPaid) || 0),
                    status: data.status || 'confirmed',
                    notes: data.notes || '',
                    providerLink: data.providerLink || null,
                    documentIds: [documentRecord.id],
                    attachments: [{
                        id: documentRecord.id,
                        documentId: documentRecord.id,
                        name: documentRecord.title,
                        type: documentRecord.mimeType,
                        url: documentRecord.downloadUrl,
                        previewUrl: documentRecord.previewUrl,
                        dateAdded: documentRecord.createdAt
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
