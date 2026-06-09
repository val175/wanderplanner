import React, { useState, useMemo } from 'react'
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

function CopyButton({ value }) {
    const [copied, setCopied] = useState(false)
    const handleCopy = (e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }
    return (
        <button
            data-no-drawer
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 hover-reveal p-1 rounded transition-colors shrink-0"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
            {copied
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success"><polyline points="20 6 9 17 4 12" /></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted hover:text-accent"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            }
        </button>
    )
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

function getBookingScopeLabel(booking, allTravelers = []) {
    const ids = Array.isArray(booking?.travelerIds) && booking.travelerIds.length > 0
        ? booking.travelerIds
        : null
    if (!ids) return 'Whole group'
    if (!allTravelers.length) return `${ids.length} travelers`
    const names = ids
        .map(id => allTravelers.find(t => t.id === id || t.uid === id))
        .filter(Boolean)
        .map(t => t.name?.split(' ')[0] || t.name)
    if (!names.length) return `${ids.length} travelers`
    if (names.length <= 2) return names.join(' & ')
    return `${names[0]} +${names.length - 1}`
}

function isExcluded(booking, currentUserId) {
    if (!currentUserId) return false
    const ids = booking?.travelerIds
    if (!Array.isArray(ids) || ids.length === 0) return false // whole group
    return !ids.includes(currentUserId)
}

// ── Main Table Component ───────────────────────────────────────────────────
export default function BookingsTable({
    bookings,
    currency,
    hiddenColumns,
    onUpdate,
    onDelete,
    onRowClick,
    isReadOnly,
    allTravelers = [],
    currentUserId = null,
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
                <div className="min-w-0">
                    <span className="text-[13px] font-medium text-text-primary truncate block">{info.getValue()}</span>
                    <span className="text-[11px] text-text-muted mt-0.5 block">{getBookingScopeLabel(info.row.original, allTravelers)}</span>
                </div>
            ),
        },
        {
            id: 'scope',
            accessorFn: row => getBookingScopeLabel(row, allTravelers),
            header: 'Scope',
            size: 100,
            cell: info => (
                <span className="text-xs font-medium text-text-secondary">{info.getValue()}</span>
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
                        {val && <CopyButton value={val} />}
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
            accessorFn: row => typeof row.location === 'string' ? row.location : (row.location?.placeName || ''),
            size: 140,
            cell: info => {
                const val = info.row.original.location
                const label = typeof val === 'string' ? val : (val?.placeName || '')
                return (
                    <div className={`flex flex-col min-w-0 ${!label ? 'opacity-0 group-hover:opacity-100 transition-opacity' : ''}`}>
                        <span className="text-xs text-text-muted truncate block">
                            {label || '—'}
                        </span>
                        {val && typeof val === 'object' && (
                            <span className="text-[10px] text-text-muted/70 truncate block">
                                {val.rating != null ? `⭐ ${val.rating}` : ''}
                                {val.reviewCount != null ? ` · ${val.reviewCount.toLocaleString()} reviews` : ''}
                            </span>
                        )}
                    </div>
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

    // Group bookings by seriesId for mobile card view
    const groups = useMemo(() => {
        const result = []
        const seen = {} // seriesId => group index in result
        for (const booking of data) {
            const sid = booking.seriesId
            if (sid) {
                if (seen[sid] !== undefined) {
                    result[seen[sid]].bookings.push(booking)
                } else {
                    seen[sid] = result.length
                    result.push({ seriesId: sid, bookings: [booking] })
                }
            } else {
                result.push({ seriesId: null, bookings: [booking] })
            }
        }
        return result
    }, [data])

    const isMobile = useMediaQuery('(max-width: 767px)')

    if (isMobile) {
        return (
            <div className="flex flex-col gap-3 pb-6">
                {groups.map((group, gi) => {
                    if (!group.seriesId) {
                        // ungrouped — render normally
                        const booking = group.bookings[0]
                        const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]
                        const status = MONDAY_STATUSES.find(s => s.value === migrateStatus(booking.status)) || MONDAY_STATUSES[0]
                        if (isExcluded(booking, currentUserId)) {
                            const scopeLabel = getBookingScopeLabel(booking, allTravelers)
                            return (
                                <Card key={booking.id} className="p-3 border border-border opacity-40 select-none">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg shrink-0 grayscale">{categoryConfig.emoji}</span>
                                        <p className="text-[12px] text-text-muted italic truncate">
                                            {scopeLabel} · {booking.name || 'Untitled'}
                                        </p>
                                    </div>
                                </Card>
                            )
                        }
                        return (
                            <Card key={booking.id} className="p-3 border border-border cursor-pointer" onClick={() => onRowClick?.(booking)}>
                                {/* HEADER */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <span className="text-xl shrink-0">{categoryConfig.emoji}</span>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-[13px] text-text-primary truncate">{booking.name || 'Untitled'}</p>
                                            <p className="text-[11px] text-text-muted mt-0.5">{getBookingScopeLabel(booking)}</p>
                                        </div>
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
                                {/* FOOTER */}
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
                    }

                    // Grouped series — render as a cluster
                    const seriesTotal = group.bookings.reduce((s, b) => s + (Number(b.amountPaid) || 0), 0)
                    return (
                        <div key={`series-${group.seriesId}-${gi}`} className="rounded-[var(--radius-lg)] border border-accent/30 overflow-hidden">
                            {/* Series label */}
                            <div className="flex items-center justify-between px-3 py-2 bg-accent/5 border-b border-accent/20">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                                    Series: {group.seriesId}
                                </span>
                                {seriesTotal > 0 && (
                                    <span className="text-[11px] font-mono font-semibold text-text-primary tabular-nums">
                                        {formatCurrency(seriesTotal, currency)} total
                                    </span>
                                )}
                            </div>
                            {/* Individual bookings in the series */}
                            <div className="divide-y divide-border/20">
                                {group.bookings.map(booking => {
                                    const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]
                                    const status = MONDAY_STATUSES.find(s => s.value === migrateStatus(booking.status)) || MONDAY_STATUSES[0]
                                    if (isExcluded(booking, currentUserId)) {
                                        const scopeLabel = getBookingScopeLabel(booking, allTravelers)
                                        return (
                                            <div key={booking.id} className="p-3 opacity-40 select-none">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg shrink-0 grayscale">{categoryConfig.emoji}</span>
                                                    <p className="text-[12px] text-text-muted italic truncate">
                                                        {scopeLabel} · {booking.name || 'Untitled'}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    }
                                    return (
                                        <div key={booking.id} className="p-3 cursor-pointer hover:bg-bg-hover/40 transition-colors" onClick={() => onRowClick?.(booking)}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="text-xl shrink-0">{categoryConfig.emoji}</span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-[13px] text-text-primary truncate">{booking.name || 'Untitled'}</p>
                                                        <p className="text-[11px] text-text-muted mt-0.5">{getBookingScopeLabel(booking, allTravelers)}</p>
                                                    </div>
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
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

    // Fixed table layout to allow truncation and defined widths
    // Compute row-level meta: is this the first or last row of a series group?
    const seriesMap = useMemo(() => {
        const m = {} // seriesId => [rowIndices]
        table.getRowModel().rows.forEach((row, i) => {
            const sid = row.original.seriesId
            if (sid) {
                if (!m[sid]) m[sid] = []
                m[sid].push(i)
            }
        })
        return m
    }, [table])

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
                        {table.getRowModel().rows.map((row, rowIndex) => {
                            const sid = row.original.seriesId
                            const seriesRows = sid ? seriesMap[sid] : null
                            const isFirstInSeries = sid && seriesRows?.[0] === rowIndex
                            const isLastInSeries = sid && seriesRows?.[seriesRows.length - 1] === rowIndex
                            const seriesTotal = isLastInSeries
                                ? seriesRows.reduce((sum, i) => sum + (Number(table.getRowModel().rows[i]?.original?.amountPaid) || 0), 0)
                                : 0
                            const colCount = row.getVisibleCells().length

                            return (
                                <React.Fragment key={row.id}>
                                    {/* Series header divider — appears before first row of each series group */}
                                    {isFirstInSeries && (
                                        <tr key={`series-header-${sid}`} className="bg-accent/5">
                                            <td colSpan={colCount} className="px-3 py-1.5 border-t border-accent/20">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
                                                    Series: {sid}
                                                </span>
                                            </td>
                                        </tr>
                                    )}

                                    {isExcluded(row.original, currentUserId) ? (
                                        <tr
                                            key={row.id}
                                            className={`border-t opacity-40 select-none ${sid ? 'border-accent/10' : 'border-border/20'}`}
                                        >
                                            <td className="px-2 py-2 text-lg grayscale">
                                                {(BOOKING_CATEGORIES.find(c => c.id === row.original.category) || BOOKING_CATEGORIES[0]).emoji}
                                            </td>
                                            <td colSpan={row.getVisibleCells().length - 1} className="px-2 py-2">
                                                <span className="text-xs text-text-muted italic">
                                                    {getBookingScopeLabel(row.original, allTravelers)} · {row.original.name || 'Untitled'}
                                                </span>
                                            </td>
                                        </tr>
                                    ) : (
                                    <tr
                                        key={row.id}
                                        className={`group hover:bg-bg-hover/50 transition-colors border-t cursor-pointer ${
                                            sid ? 'border-accent/10 bg-accent/[0.02]' : 'border-border/20'
                                        }`}
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
                                    )}

                                    {/* Series subtotal row — appears after last row of each series group */}
                                    {isLastInSeries && seriesTotal > 0 && (
                                        <tr key={`series-total-${sid}`} className="bg-accent/5 border-t border-accent/10">
                                            <td colSpan={colCount - 2} className="px-3 py-1.5">
                                                <span className="text-[10px] text-accent font-semibold">{seriesRows.length} bookings in this series</span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right" colSpan={2}>
                                                <span className="text-xs font-mono font-bold text-text-primary tabular-nums">
                                                    {formatCurrency(seriesTotal, currency)}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}
