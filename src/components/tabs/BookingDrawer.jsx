import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { MONDAY_STATUSES, migrateStatus } from './BookingsTable'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import EditableText from '../shared/EditableText'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import { useProfiles } from '../../context/ProfileContext'
import { formatCurrency } from '../../utils/helpers'

// ── Cost Input ─────────────────────────────────────────────────────────────────
// A number input that shows formatted currency when blurred and raw number when focused
function CostInput({ value, currency, onChange, disabled }) {
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
            onFocus={() => { if (!disabled) { setDraft(value ? String(value) : ''); setFocused(true) } }}
            onChange={e => setDraft(e.target.value)}
            onBlur={() => { setFocused(false); onChange(Number(draft) || 0) }}
            disabled={disabled}
            className={`w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors tabular-nums ${disabled ? 'opacity-80 cursor-default' : ''}`}
            placeholder={formatCurrency(0, currency)}
        />
    )
}

export default function BookingDrawer({ booking, currency, onUpdate, onClose, isReadOnly }) {
    const { currentUserProfile } = useProfiles()
    const [mounted, setMounted] = useState(false)
    const actorId = currentUserProfile?.uid || currentUserProfile?.id


    useEffect(() => {
        setMounted(true)
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onClose])

    const viewAttachment = async (file) => {
        try {
            // Browsers block top-level navigation to data: URIs for security.
            // By converting to a Blob and using an Object URL, we bypass this.
            const response = await fetch(file.url)
            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)
            window.open(objectUrl, '_blank')
            // Note: In high-scale apps we'd revoke the URL, but here it's fine
        } catch (err) {
            console.error("Failed to view attachment:", err)
            window.open(file.url, '_blank') // Fallback
        }
    }

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
                className={`fixed inset-y-0 right-0 w-full max-w-md bg-bg-card border-l border-border transform transition-transform duration-300 ease-out flex flex-col ${mounted ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border/30">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">{categoryConfig.emoji}</span>
                        <div>
                            <EditableText
                                value={booking.name}
                                onSave={val => onUpdate(booking.id, { name: val }, actorId)}
                                className="font-heading text-lg font-semibold text-text-primary block"
                                readOnly={isReadOnly}
                            />
                            <span className="text-[10px] px-2 py-0.5 rounded-[var(--radius-pill)] uppercase tracking-wider font-semibold border border-border bg-bg-secondary text-text-secondary">
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
                                    onChange={val => onUpdate(booking.id, { bookByDate: val }, actorId)}
                                    className={`text-text-primary text-sm block ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:underline'}`}
                                    placeholder="Add date..."
                                    disabled={isReadOnly}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cost</span>
                            <CostInput
                                value={booking.amountPaid}
                                currency={currency}
                                onChange={val => onUpdate(booking.id, { amountPaid: val }, actorId)}
                                disabled={isReadOnly}
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Conf #</span>
                            <EditableText
                                value={booking.confirmationNumber}
                                onSave={val => onUpdate(booking.id, { confirmationNumber: val }, actorId)}
                                className="text-accent font-mono text-sm block"
                                placeholder="Add confirmation..."
                                readOnly={isReadOnly}
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Link</span>
                            <EditableText
                                value={booking.providerLink || ''}
                                onSave={val => onUpdate(booking.id, { providerLink: val }, actorId)}
                                className="text-accent text-sm block hover:underline"
                                placeholder="Add URL..."
                                readOnly={isReadOnly}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Location</span>
                        <EditableText
                            value={booking.location || ''}
                            onSave={val => onUpdate(booking.id, { location: val }, actorId)}
                            className="text-text-primary text-sm block"
                            placeholder="e.g. 1-2-3 Shinjuku, Tokyo"
                            readOnly={isReadOnly}
                        />
                    </div>

                    <hr className="border-border/30" />

                    {/* Notes (Rich text stand-in) */}
                    <div className="space-y-2 flex-1 flex flex-col min-h-[150px]">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes & Policies</span>
                        <EditableText
                            value={booking.notes || ''}
                            onSave={val => onUpdate(booking.id, { notes: val }, actorId)}
                            multiline
                            className="text-text-secondary text-sm block w-full bg-transparent"
                            inputClassName="min-h-[120px]"
                            placeholder="Add confirmation emails, cancellation policies, or lockbox codes here..."
                            readOnly={isReadOnly}
                        />
                    </div>

                    <hr className="border-border/30" />

                    {/* Attachments Section */}
                    <div className="space-y-3 pb-8">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                            Attachments
                        </span>
                        
                        {booking.attachments?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {booking.attachments.map((file) => (
                                    <div key={file.id} className="group relative flex items-center justify-between p-3 bg-bg-secondary/50 border border-border/50 rounded-[var(--radius-md)] hover:border-accent/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 flex-shrink-0 bg-bg-card border border-border/30 rounded flex items-center justify-center text-xl overflow-hidden">
                                                {file.type?.startsWith('image/') ? (
                                                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    '📄'
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-text-primary truncate">{file.name}</p>
                                                <p className="text-[10px] text-text-muted">{file.type?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.preventDefault(); viewAttachment(file) }}
                                                className="p-1.5 text-text-muted hover:text-accent rounded hover:bg-bg-hover"
                                                title="View Attachment"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                            </button>
                                            {!isReadOnly && (
                                                <button 
                                                    onClick={() => {
                                                        const remaining = booking.attachments.filter(a => a.id !== file.id)
                                                        onUpdate(booking.id, { attachments: remaining }, actorId)
                                                    }}
                                                    className="p-1.5 text-text-muted hover:text-danger rounded hover:bg-bg-hover"
                                                    title="Remove"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="border border-dashed border-border/50 rounded-[var(--radius-md)] p-6 text-center text-text-muted">
                                <svg className="mx-auto mb-2 opacity-30" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                <p className="text-xs">No attachments found</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>,
        document.body
    )
}
