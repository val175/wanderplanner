import Modal from '../shared/Modal'
import Button from '../shared/Button'

export default function JoinTripModal({ pendingInvite, onAccept, onDecline }) {
    if (!pendingInvite) return null

    // Destructure the basic info to show in the modal (e.g., name, emoji, dates, etc.)
    const { name, emoji, startDate, endDate, travelers, destinations } = pendingInvite

    return (
        <Modal isOpen={!!pendingInvite} onClose={onDecline} maxWidth="max-w-sm">
            <div className="p-6 text-center space-y-5">
                <div className="mx-auto w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center text-3xl mb-2">
                    {emoji || '✈️'}
                </div>

                <div>
                    <h2 className="font-heading text-xl font-bold text-text-primary mb-1">
                        You've been invited!
                    </h2>
                    <p className="text-sm text-text-muted">
                        You have received an invitation to join the following trip.
                    </p>
                </div>

                <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] p-4 text-left space-y-3">
                    <div>
                        <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">Trip Name</p>
                        <p className="text-sm text-text-primary font-semibold">{name || 'Unnamed Trip'}</p>
                    </div>

                    {(startDate || endDate) && (
                        <div>
                            <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">Dates</p>
                            <p className="text-sm text-text-primary">
                                {startDate || '?'} {endDate ? `→ ${endDate}` : ''}
                            </p>
                        </div>
                    )}

                    {destinations?.length > 0 && (
                        <div>
                            <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">Destinations</p>
                            <p className="text-sm text-text-primary">
                                {destinations.map(d => `${d.flag || ''} ${d.city}`).join(', ')}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button variant="secondary" className="flex-1" onClick={onDecline}>
                        Decline
                    </Button>
                    <Button className="flex-1" onClick={onAccept}>
                        Join Trip
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
