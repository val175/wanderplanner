import { useState } from 'react'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'

const TYPE_MAP = {
    food: 'food', restaurant: 'food', cafe: 'food', dining: 'food', bar: 'food',
    activity: 'activity', tour: 'activity', experience: 'activity',
    nightlife: 'activity',
    lodging: 'lodging', hotel: 'lodging', stay: 'lodging', airbnb: 'lodging', accommodation: 'lodging',
    transport: 'transport', car: 'transport', flight: 'transport',
    shopping: 'shopping', mall: 'shopping',
}

export default function IdeaExtractorModal({ isOpen, onClose }) {
    const { dispatch } = useTripContext()
    const { currentUserProfile } = useProfiles()
    const [url, setUrl] = useState('')
    const [isExtracting, setIsExtracting] = useState(false)

    const handleClose = () => {
        if (isExtracting) return
        setUrl('')
        onClose()
    }

    const handleExtract = async (e) => {
        e.preventDefault()
        if (!url.trim()) return
        setIsExtracting(true)
        try {
            let token = ''
            try {
                const { auth } = await import('../../firebase/config')
                if (auth.currentUser) token = await auth.currentUser.getIdToken()
            } catch (_) {}

            const res = await fetch('/api/extract-pin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({ url }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || `Error ${res.status}`)
            }
            const data = await res.json()

            dispatch({
                type: ACTIONS.ADD_IDEA,
                payload: {
                    url: data.url,
                    title: data.title || 'Untitled Idea',
                    type: TYPE_MAP[data.category?.toLowerCase()] || 'other',
                    priceDetails: (data.estimatedCost && data.estimatedCost !== 'null') ? data.estimatedCost : 'TBD',
                    description: [data.vibe, data.location].filter(Boolean).join(' • '),
                    emoji: '✨',
                    imageUrl: data.thumbnail_url || null,
                    sourceName: data.sourceName || 'Link',
                    proposerId: currentUserProfile?.id,
                },
            })
            setUrl('')
            onClose()
        } catch (err) {
            alert(err.message || 'Could not parse link. Try again.')
        } finally {
            setIsExtracting(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Extract Idea" maxWidth="max-w-md">
            <div className="p-6 space-y-4">
                <p className="text-sm text-text-secondary leading-relaxed">
                    Paste a link from TikTok, TripAdvisor, Airbnb, or any blog to let Wanda generate an idea card.
                </p>
                <form onSubmit={handleExtract} className="space-y-4">
                    <input
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="https://..."
                        disabled={isExtracting}
                        autoFocus
                        className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent placeholder:text-text-muted"
                    />
                    <div className="flex justify-end gap-3 pt-1">
                        <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={isExtracting}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={isExtracting || !url.trim()}>
                            {isExtracting ? 'Extracting...' : 'Extract'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    )
}
