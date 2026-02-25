import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MONDAY_STATUSES, migrateStatus } from './BookingsTable'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import { formatCurrency } from '../../utils/helpers'

// ── Cost Input ─────────────────────────────────────────────────────────────────
// A number input that shows formatted currency when blurred and raw number when focused
function CostInput({ value, currency, onChange }) {
    const [focused, setFocused] = useState(false)
    const [draft, setDraft] = useState(value ? String(value) : '')

    // Sync from outside when not focused
    useEffect(() => {
        if (!focused) setDraft(value ? String(value) : '')
    }, [value, focused])

    return (
        <input
            type={focused ? 'number' : 'text'}
            value={focused ? draft : (value ? formatCurrency(value, currency) : formatCurrency(0, currency))}
            onFocus={() => { setDraft(value ? String(value) : ''); setFocused(true) }}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { setFocused(false); onChange(Number(draft) || 0) }}
            className="w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors tabular-nums"
            placeholder={formatCurrency(0, currency)}
        />
    )
}

export default function BookingDrawer({ booking, currency, onUpdate, onClose }) {
    const [mounted, setMounted] = useState(false)


    useEffect(() => {
        setMounted(true)
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    if (!booking || !mounted) return null

    const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]
    const statusConfig = MONDAY_STATUSES.find(s => s.value === migrateStatus(booking.status)) || MONDAY_STATUSES[0]

    return createPortal(
        <div className="relative z-[9999]">
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-bg-primary/50 backdrop-blur-sm transition-opacity duration-300 ${mounted ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 w-full max-w-md bg-bg-card border-l border-border/50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${mounted ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{categoryConfig.emoji}</span>
                        <div>
                            <EditableText
                                value={booking.name}
                                onSave={val => onUpdate(booking.id, { name: val })}
                                className="font-heading text-lg font-bold text-text-primary block"
                            />
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold border ${statusConfig.colors}`}>
                                {statusConfig.label}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-muted hover:text-text-primary rounded-full hover:bg-bg-hover transition-colors"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">

                    {/* Quick Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Date</span>
                            <div className="pt-1">
                                <DatePicker
                                    value={booking.bookByDate || booking.startDate || ''}
                                    onChange={val => onUpdate(booking.id, { bookByDate: val })}
                                    className="text-text-primary text-sm block cursor-pointer hover:underline"
                                    placeholder="Add date..."
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cost</span>
                            <CostInput
                                value={booking.amountPaid}
                                currency={currency}
                                onChange={val => onUpdate(booking.id, { amountPaid: val })}
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Conf #</span>
                            <EditableText
                                value={booking.confirmationNumber}
                                onSave={val => onUpdate(booking.id, { confirmationNumber: val })}
                                className="text-accent font-mono text-sm block"
                                placeholder="Add confirmation..."
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Link</span>
                            <EditableText
                                value={booking.providerLink || ''}
                                onSave={val => onUpdate(booking.id, { providerLink: val })}
                                className="text-accent text-sm block hover:underline"
                                placeholder="Add URL..."
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Location</span>
                        <EditableText
                            value={booking.location || ''}
                            onSave={val => onUpdate(booking.id, { location: val })}
                            className="text-text-primary text-sm block"
                            placeholder="e.g. 1-2-3 Shinjuku, Tokyo"
                        />
                    </div>

                    <hr className="border-border/30" />

                    {/* Notes (Rich text stand-in) */}
                    <div className="space-y-2 flex-1 flex flex-col min-h-[150px]">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes & Policies</span>
                        <EditableText
                            value={booking.notes || ''}
                            onSave={val => onUpdate(booking.id, { notes: val })}
                            multiline
                            className="text-text-secondary text-sm block w-full bg-transparent"
                            inputClassName="min-h-[120px]"
                            placeholder="Add confirmation emails, cancellation policies, or lockbox codes here..."
                        />
                    </div>

                    <hr className="border-border/30" />

                    {/* Attachments Placeholder */}
                    <div className="space-y-3 pb-8">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Attachments</span>
                        <div className="border border-dashed border-border/50 rounded-[var(--radius-md)] p-6 text-center text-text-muted">
                            <svg className="mx-auto mb-2 opacity-50" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                            <p className="text-sm">Attachments coming soon</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>,
        document.body
    )
}
