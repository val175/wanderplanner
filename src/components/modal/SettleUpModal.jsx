import { useMemo } from 'react'
import Modal from '../shared/Modal'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateBalances, simplifyDebts } from '../../utils/splitwise'
import { formatCurrency } from '../../utils/helpers'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import Button from '../shared/Button'
import Label from '../shared/Label'

export default function SettleUpModal({ tripId, onClose }) {
    const { state, dispatch, showToast } = useTripContext()
    const { resolveProfile } = useProfiles()
    const trip = state.trips[tripId]
    const travelers = useTripTravelers()
    const currency = trip?.currency || 'PHP'

    const { transactions, allSettled } = useMemo(() => {
        if (!trip || travelers.length === 0) return { transactions: [], allSettled: true }
        const balances = calculateBalances(trip.spendingLog || [], travelers)
        const txns = simplifyDebts(balances)
        return { transactions: txns, allSettled: txns.length === 0 }
    }, [trip, travelers])

    const handleArchive = () => {
        dispatch({ type: ACTIONS.ARCHIVE_TRIP, payload: tripId })
        showToast('🗓️ Trip archived — memories locked in!', 'success')
        onClose()
    }

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="💸 Settle Up"
            description="Confirm everyone's square before archiving."
            maxWidth="max-w-md"
        >
            <div className="px-6 pb-6 pt-2">
                {/* Transactions */}
                <div className="mb-5">
                    {allSettled ? (
                        <div className="text-center py-6">
                            <div className="text-4xl mb-2">🎉</div>
                            <p className="text-sm font-semibold text-text-primary">All squared up!</p>
                            <p className="text-xs text-text-muted mt-1">No outstanding balances found.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label className="mb-3 block">
                                Simplified Debts ({transactions.length} transfer{transactions.length !== 1 ? 's' : ''})
                            </Label>
                            {transactions.map((txn, i) => {
                                const from = resolveProfile(txn.from)
                                const to = resolveProfile(txn.to)
                                return (
                                    <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-bg-secondary border border-border">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                <span className="text-danger font-semibold">{from?.name || txn.from}</span>
                                                <span className="text-text-muted mx-2">→</span>
                                                <span className="text-success font-semibold">{to?.name || txn.to}</span>
                                            </p>
                                        </div>
                                        <span className="text-sm font-semibold text-text-primary shrink-0">
                                            {formatCurrency(txn.amount, currency)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <Button
                        type="button"
                        onClick={handleArchive}
                        className="w-full"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                        {allSettled ? 'Archive Trip' : 'Settled — Archive Trip'}
                    </Button>
                    {!allSettled && (
                        <button
                            type="button"
                            onClick={handleArchive}
                            className="w-full rounded-[var(--radius-md)] py-2 text-sm text-text-muted transition-colors hover:text-text-primary"
                        >
                            Skip & Archive anyway
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    )
}
