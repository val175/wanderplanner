import { useState, useMemo } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    getSortedRowModel,
} from '@tanstack/react-table'
import EditableText from '../shared/EditableText'
import DatePicker from '../shared/DatePicker'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import Card from '../shared/Card'
import Select, { SelectItem } from '../shared/Select'
import { formatCurrency } from '../../utils/helpers'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { triggerHaptic } from '../../utils/haptics'

export const MONDAY_STATUSES = [
    { value: 'to_book', label: 'To Book', colors: 'bg-warning/10 text-warning border-warning/20' },
    { value: 'requested', label: 'Requested', colors: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    { value: 'confirmed', label: 'Confirmed', colors: 'bg-success/10 text-success border-success/20' },
    { value: 'cancelled', label: 'Cancelled', colors: 'bg-danger/10 text-danger border-danger/20' },
]

// Migrate old statuses to new statuses internally
export function migrateStatus(status) {
    if (status === 'not_started') return 'to_book'
    if (status === 'in_progress') return 'requested'
    if (status === 'booked') return 'confirmed'
    return status || 'idea'
}

function StatusPill({ value, onChange, disabled }) {
    const current = MONDAY_STATUSES.find(s => s.value === value) || MONDAY_STATUSES[0]

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            className={`text-left min-h-[44px] sm:min-h-0 text-[14px] sm:text-xs font-semibold ${current.colors}`}
        >
            {MONDAY_STATUSES.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                    <span className="inline-flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${opt.value === 'confirmed' ? 'bg-success' : opt.value === 'cancelled' ? 'bg-danger' : opt.value === 'requested' ? 'bg-blue-500' : 'bg-warning'}`} />
                        {opt.label}
                    </span>
                </SelectItem>
            ))}
        </Select>
    )
}

function TypeDropdown({ value, onChange, disabled }) {
    const current = BOOKING_CATEGORIES.find(c => c.id === value) || BOOKING_CATEGORIES[0]

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            className={`bg-transparent border-transparent text-2xl sm:text-xl px-1 py-1 min-h-[44px] sm:min-h-0 min-w-[44px] ${disabled ? 'cursor-default' : 'hover:bg-bg-hover'}`}
        >
            {BOOKING_CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.emoji}</SelectItem>
            ))}
        </Select>
    )
}


// ── Main Table Component ───────────────────────────────────────────────────
export default function BookingsTable({
    bookings,
    currency,
    hiddenColumns,
    onUpdate,
    onDelete,
    onRowClick,
    isReadOnly
}) {
    const data = useMemo(() => bookings, [bookings])

    const columns = useMemo(() => [
        {
            id: 'category',
            accessorKey: 'category',
            header: 'Type',
            size: 60,
            cell: info => {
                const cat = BOOKING_CATEGORIES.find(c => c.id === info.getValue()) || BOOKING_CATEGORIES[0]
                return <span className="text-xl">{cat.emoji}</span>
            },
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: 'Booking Name',
            size: 250,
            cell: info => (
                <span className="text-[13px] font-medium text-text-primary truncate block">{info.getValue()}</span>
            ),
        },
        {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            size: 140,
            cell: info => (
                <div onClick={e => e.stopPropagation()}>
                    <StatusPill
                        value={migrateStatus(info.getValue())}
                        onChange={val => onUpdate(info.row.original.id, { status: val })}
                        disabled={isReadOnly}
                    />
                </div>
            )
        },
        {
            id: 'dates',
            header: 'Dates / Times',
            size: 180,
            accessorFn: row => row.bookByDate || row.startDate || '',
            cell: info => {
                const dateVal = info.getValue()
                return (
                    <span className={`text-text-secondary text-sm ${!dateVal ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        {dateVal || '—'}
                    </span>
                )
            }
        },
        {
            id: 'confirmation',
            accessorKey: 'confirmationNumber',
            header: 'Confirmation #',
            size: 150,
            cell: info => {
                const val = info.getValue()
                return (
                    <div className={`flex items-center gap-1 ${!val ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        <span className="font-mono text-text-primary text-xs truncate">{val || '—'}</span>
                        {val && (
                            <button
                                data-no-drawer
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(val) }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent rounded transition-colors shrink-0"
                                title="Copy to clipboard"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                            </button>
                        )}
                    </div>
                )
            }
        },
        {
            id: 'cost',
            header: 'Amount',
            accessorKey: 'amountPaid',
            size: 100,
            cell: info => (
                <span className="text-text-primary text-xs font-medium tabular-nums font-mono block text-right">
                    {info.getValue() ? formatCurrency(info.getValue(), currency) : <span className="text-text-muted">—</span>}
                </span>
            )
        },
        {
            id: 'location',
            header: 'Location',
            accessorKey: 'location',
            size: 140,
            cell: info => {
                const val = info.getValue()
                return (
                    <span className={`text-xs text-text-muted truncate block ${!val ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        {val || '—'}
                    </span>
                )
            }
        },
        {
            id: 'actions',
            header: '',
            size: 48,
            cell: info => !isReadOnly && (
                <div data-no-drawer className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            triggerHaptic('medium')
                            onDelete(info.row.original.id)
                        }}
                        className="p-1 text-text-muted hover:text-danger rounded transition-colors"
                        title="Delete Booking"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                </div>
            )
        }
    ], [currency, onDelete, isReadOnly])

    // Map hidden array strings to an object { [columnId]: false }
    const columnVisibility = useMemo(() => {
        const visibility = {}
        hiddenColumns.forEach(c => { visibility[c] = false })
        return visibility
    }, [hiddenColumns])

    const table = useReactTable({
        data,
        columns,
        state: {
            columnVisibility,
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    })

    const isMobile = useMediaQuery('(max-width: 767px)')

    if (isMobile) {
        return (
            <div className="flex flex-col gap-3 pb-6">
                {data.map(booking => {
                    const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]
                    const status = MONDAY_STATUSES.find(s => s.value === migrateStatus(booking.status)) || MONDAY_STATUSES[0]
                    return (
                        <Card key={booking.id} className="p-3 border border-border cursor-pointer" onClick={() => onRowClick?.(booking)}>
                            {/* HEADER */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-xl shrink-0">{categoryConfig.emoji}</span>
                                    <p className="font-semibold text-[13px] text-text-primary truncate">{booking.name || 'Untitled'}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${status.colors}`}>
                                        {status.label}
                                    </span>
                                    {!isReadOnly && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onDelete(booking.id) }}
                                            className="p-1 text-text-muted hover:text-danger transition-colors"
                                            title="Delete booking"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* FOOTER — date (left) + cost (right) */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20" onClick={e => e.stopPropagation()}>
                                <DatePicker
                                    value={booking.bookByDate || booking.startDate || ''}
                                    onChange={val => onUpdate(booking.id, { bookByDate: val })}
                                    className="text-[11px] text-text-muted cursor-pointer"
                                    placeholder="Set date..."
                                />
                                <EditableText
                                    value={booking.amountPaid ? String(booking.amountPaid) : ''}
                                    displayValue={booking.amountPaid ? formatCurrency(booking.amountPaid, currency) : undefined}
                                    onSave={newVal => onUpdate(booking.id, { amountPaid: Number(newVal) || 0 })}
                                    className="text-[13px] font-mono font-semibold tabular-nums text-text-primary text-right"
                                    inputClassName="w-full text-right"
                                    placeholder={formatCurrency(0, currency)}
                                />
                            </div>
                        </Card>
                    )
                })}
            </div>
        )
    }

    // Fixed table layout to allow truncation and defined widths
    return (
        <Card className="border border-border overflow-hidden">
            <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
                <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-sm">
                    <thead>
                        <tr className="border-b border-border/50">
                            {table.getHeaderGroups()[0].headers.map(header => (
                                <th
                                    key={header.id}
                                    className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted overflow-hidden"
                                    style={{ width: header.column.id === 'name' ? '100%' : header.column.getSize() }}
                                >
                                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map(row => (
                            <tr
                                key={row.id}
                                className="group hover:bg-bg-hover/50 transition-colors border-t border-border/20 cursor-pointer"
                                onClick={(e) => { if (!e.target.closest('[data-no-drawer]')) onRowClick?.(row.original) }}
                            >
                                {row.getVisibleCells().map(cell => (
                                    <td
                                        key={cell.id}
                                        className="px-2 py-3 align-middle overflow-hidden"
                                        style={{ width: cell.column.id === 'name' ? '100%' : cell.column.getSize() }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}
