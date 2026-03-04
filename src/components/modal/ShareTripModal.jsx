import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTripContext } from '../../context/TripContext'
import { useShareTrip } from '../../hooks/useShareTrip'

export default function ShareTripModal({ trip, onClose }) {
    const { dispatch } = useTripContext()
    const { shareUrl, isGenerating, copied, generateAndCopy, revoke } = useShareTrip(trip, dispatch)
    const [revoking, setRevoking] = useState(false)
    const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)

    const handleRevoke = async () => {
        setRevoking(true)
        await revoke()
        setRevoking(false)
        setShowRevokeConfirm(false)
    }

    const handleGenerateAndCopy = (e) => {
        e.stopPropagation()
        generateAndCopy()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
            onMouseDown={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative w-full sm:max-w-md bg-bg-card rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6"
                onMouseDown={e => e.stopPropagation()}
                style={{ animation: 'wanda-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
                <style>{`@keyframes wanda-pop { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-base font-bold text-text-primary font-heading">Share Trip</h2>
                        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                            Allowed users can open your trip via this link.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Trip display */}
                <div className="flex items-center gap-3 mb-5 p-3 rounded-[var(--radius-md)] bg-bg-secondary border border-border">
                    <span className="text-2xl">{trip?.emoji || '✈️'}</span>
                    <div>
                        <p className="text-sm font-semibold text-text-primary leading-tight">{trip?.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                            {trip?.destinations?.map(d => d.city).join(' → ') || 'No destinations yet'}
                        </p>
                    </div>
                </div>

                {/* Link box */}
                <div className="mb-4">
                    <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Share Link
                    </label>
                    <input
                        type="text"
                        readOnly
                        value={shareUrl || 'Click "Generate & Copy link" to create a unique link'}
                        className="w-full text-sm bg-bg-secondary border border-border rounded-[var(--radius-md)] px-3 py-2 text-text-secondary font-mono truncate outline-none focus:border-accent/50 cursor-default"
                        onClick={e => e.target.select()}
                    />
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={handleGenerateAndCopy}
                        disabled={isGenerating}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-[var(--radius-md)] transition-all duration-200
              ${copied
                                ? 'bg-success/10 text-success border border-success/20'
                                : 'bg-accent text-white hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Generating…
                            </>
                        ) : copied ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                {shareUrl ? 'Copy link' : 'Generate & Copy link'}
                            </>
                        )}
                    </button>

                    {shareUrl && !showRevokeConfirm && (
                        <button
                            type="button"
                            onClick={() => setShowRevokeConfirm(true)}
                            className="w-full text-sm text-text-muted hover:text-danger transition-colors py-2"
                        >
                            Revoke link
                        </button>
                    )}

                    {showRevokeConfirm && (
                        <div className="rounded-[var(--radius-md)] border border-danger/20 bg-danger/5 p-3 text-center">
                            <p className="text-xs text-danger font-medium mb-2">
                                This will invalidate the current link permanently.
                            </p>
                            <div className="flex gap-2 justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowRevokeConfirm(false)}
                                    className="text-xs px-3 py-1.5 rounded-[var(--radius-sm)] border border-border text-text-muted hover:text-text-primary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRevoke}
                                    disabled={revoking}
                                    className="text-xs px-3 py-1.5 rounded-[var(--radius-sm)] bg-danger text-white hover:bg-danger/90 disabled:opacity-60"
                                >
                                    {revoking ? 'Revoking…' : 'Revoke'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
