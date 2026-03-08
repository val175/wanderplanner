import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { calculateBalances, simplifyDebts } from '../../utils/splitwise'
import { formatCurrency } from '../../utils/helpers'
import { useTripTravelers } from '../../hooks/useTripTravelers'

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

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
            onMouseDown={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative w-full sm:max-w-md bg-bg-card border border-border rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
                onMouseDown={e => e.stopPropagation()}
                style={{ animation: 'wanda-pop 0.2s cubic-bezier(0.34,1.56,0.64,1)' }}
            >
                <style>{`@keyframes wanda-pop{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-base font-bold text-text-primary font-heading">💸 Settle Up</h2>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                            Confirm everyone's square before archiving.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                </div>

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
                            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-3">
                                Simplified Debts ({transactions.length} transfer{transactions.length !== 1 ? 's' : ''})
                            </p>
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
                                        <span className="text-sm font-bold text-text-primary shrink-0">
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
                    <button
                        type="button"
                        onClick={handleArchive}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-[var(--radius-md)] bg-accent text-white hover:bg-accent-hover active:scale-[0.98] transition-all"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>
                        {allSettled ? 'Archive Trip' : 'Settled — Archive Trip'}
                    </button>
                    {!allSettled && (
                        <button
                            type="button"
                            onClick={handleArchive}
                            className="w-full text-sm text-text-muted hover:text-text-primary transition-colors py-2"
                        >
                            Skip & Archive anyway
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
