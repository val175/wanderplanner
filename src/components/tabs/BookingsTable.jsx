import { useState, useMemo, useEffect, useRef } from 'react'
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    getSortedRowModel,
} from '@tanstack/react-table'
import EditableText from '../shared/EditableText'
import DatePicker from '../shared/DatePicker'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import { formatCurrency } from '../../utils/helpers'

export const MONDAY_STATUSES = [
    { value: 'idea', label: 'Idea', colors: 'bg-text-muted/10 text-text-muted border-text-muted/20' },
    { value: 'to_book', label: 'To Book', colors: 'bg-warning/10 text-warning border-warning/20' },
    { value: 'requested', label: 'Requested', colors: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    { value: 'confirmed', label: 'Confirmed ✓', colors: 'bg-success/10 text-success border-success/20' },
    { value: 'cancelled', label: 'Cancelled', colors: 'bg-danger/10 text-danger border-danger/20' },
]

// Migrate old statuses to new statuses internally
export function migrateStatus(status) {
    if (status === 'not_started') return 'to_book'
    if (status === 'in_progress') return 'requested'
    if (status === 'booked') return 'confirmed'
    return status || 'idea'
}

function StatusPill({ value, onChange }) {
    const current = MONDAY_STATUSES.find(s => s.value === value) || MONDAY_STATUSES[0]

    return (
        <div className="relative inline-block w-full">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className={`appearance-none cursor-pointer w-full text-center px-2 py-1.5 text-xs font-semibold rounded-[var(--radius-sm)]
          border transition-all hover:opacity-80 focus:ring-2 focus:ring-accent/50 ${current.colors}`}
            >
                {MONDAY_STATUSES.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] opacity-60">▾</span>
        </div>
    )
}

function TypeDropdown({ value, onChange }) {
    const current = BOOKING_CATEGORIES.find(c => c.id === value) || BOOKING_CATEGORIES[0]

    return (
        <div className="relative inline-block">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="appearance-none cursor-pointer bg-transparent text-xl pl-1 pr-4 py-1 hover:bg-bg-hover rounded transition-colors"
                title={current.label}
            >
                {BOOKING_CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji}</option>
                ))}
            </select>
            <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] opacity-40">▾</span>
        </div>
    )
}

// ── Inline Add Row ──────────────────────────────────────────────────────────
function InlineAddRow({ onAdd }) {
    const [name, setName] = useState('')
    const [category, setCategory] = useState(BOOKING_CATEGORIES[0].id)
    const inputRef = useRef(null)

    const handleSubmit = (e) => {
        e?.preventDefault()
        if (!name.trim()) return
        onAdd({
            name: name.trim(),
            category,
            status: 'to_book',
            amountPaid: 0,
            confirmationNumber: '',
            providerLink: '',
            location: '',
        })
        setName('')
        inputRef.current?.focus()
    }

    return (
        <tr className="border-t border-border/40 bg-accent/[0.02]">
            <td className="p-2 align-middle">
                <TypeDropdown value={category} onChange={setCategory} />
            </td>
            <td className="p-2">
                <form onSubmit={handleSubmit} className="flex h-full">
                    <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                        placeholder="+ New Booking (press Enter to add)"
                        className="w-full bg-transparent border-none outline-none text-sm text-text-primary px-2 placeholder:text-text-muted/70 focus:ring-1 focus:ring-accent rounded transition-all"
                    />
                </form>
            </td>
            <td colSpan={100} className="p-2 text-xs text-text-muted italic opacity-60">
                Enter details to save...
            </td>
        </tr>
    )
}

// ── Main Table Component ───────────────────────────────────────────────────
export default function BookingsTable({
    bookings,
    currency,
    hiddenColumns,
    onUpdate,
    onDelete,
    onAdd,
    onRowClick
}) {
    const data = useMemo(() => bookings, [bookings])

    const columns = useMemo(() => [
        {
            id: 'category',
            accessorKey: 'category',
            header: 'Type',
            size: 60,
            cell: info => (
                <TypeDropdown
                    value={info.getValue()}
                    onChange={val => onUpdate(info.row.original.id, { category: val })}
                />
            ),
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: 'Booking Name',
            size: 250,
            cell: info => (
                <div className="flex items-center gap-2 group cursor-pointer" onClick={() => onRowClick?.(info.row.original)}>
                    <EditableText
                        value={info.getValue()}
                        onSave={val => onUpdate(info.row.original.id, { name: val })}
                        className="text-[13px] font-medium text-text-primary flex-1 truncate"
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent transition-opacity rounded hover:bg-bg-hover"
                        title="Open Details"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </button>
                </div>
            ),
        },
        {
            id: 'status',
            accessorKey: 'status',
            header: 'Status',
            size: 140,
            cell: info => (
                <StatusPill
                    value={migrateStatus(info.getValue())}
                    onChange={val => onUpdate(info.row.original.id, { status: val })}
                />
            )
        },
        {
            id: 'dates',
            header: 'Dates / Times',
            size: 180,
            accessorFn: row => row.bookByDate || row.startDate || '',
            cell: info => {
                const row = info.row.original
                // Minimal date display for now. Will be enhanced when we normalize start/end dates.
                const dateVal = row.bookByDate || row.startDate || ''
                return (
                    <div className="w-full">
                        <DatePicker
                            value={dateVal}
                            onChange={val => onUpdate(row.id, { bookByDate: val })}
                            className="text-text-secondary text-sm block cursor-pointer"
                            placeholder="Set date..."
                        />
                    </div>
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
                    <div className="flex items-center gap-1 group">
                        <EditableText
                            value={val}
                            onSave={newVal => onUpdate(info.row.original.id, { confirmationNumber: newVal })}
                            className="font-mono text-text-primary text-xs flex-1 truncate"
                            placeholder="—"
                        />
                        {val && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(val)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent transition-opacity rounded"
                                title="Copy to clipboard"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        )}
                    </div>
                )
            }
        },
        {
            id: 'cost',
            accessorKey: 'amountPaid',
            header: 'Cost',
            size: 100,
            cell: info => (
                <EditableText
                    value={info.getValue() ? String(info.getValue()) : ''}
                    onSave={val => onUpdate(info.row.original.id, { amountPaid: Number(val) || 0 })}
                    className="text-text-primary text-sm font-medium tabular-nums text-right block w-full"
                    placeholder={formatCurrency(0, currency)}
                />
            ),
        },
        {
            id: 'providerLink',
            accessorKey: 'providerLink',
            header: 'Link',
            size: 140,
            cell: info => {
                const val = info.getValue()
                return (
                    <div className="flex items-center gap-1">
                        <EditableText
                            value={val}
                            onSave={newVal => onUpdate(info.row.original.id, { providerLink: newVal })}
                            className="text-accent text-sm truncate flex-1 hover:underline"
                            placeholder="Add link..."
                        />
                        {val && (
                            <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" className="p-1 text-text-muted hover:text-accent" onClick={e => e.stopPropagation()}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </a>
                        )}
                    </div>
                )
            }
        },
        {
            id: 'location',
            accessorKey: 'location',
            header: 'Location',
            size: 200,
            cell: info => (
                <EditableText
                    value={info.getValue()}
                    onSave={newVal => onUpdate(info.row.original.id, { location: newVal })}
                    className="text-text-secondary text-sm truncate block w-full"
                    placeholder="Add location..."
                />
            )
        },
        {
            id: 'actions',
            header: '',
            size: 40,
            cell: info => (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete(info.row.original.id)
                    }}
                    className="w-full text-center text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                >
                    ×
                </button>
            )
        }
    ], [currency, onUpdate, onDelete, onRowClick])

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

    // Fixed table layout to allow truncation and defined widths
    return (
        <div className="w-full overflow-x-auto overflow-y-visible -mx-5 px-5 sm:mx-0 sm:px-0 scrollbar-thin">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-sm">
                <thead>
                    <tr className="border-b border-border/50">
                        {table.getHeaderGroups()[0].headers.map(header => (
                            <th
                                key={header.id}
                                className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted overflow-hidden"
                                style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : 'auto' }}
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
                            className="group hover:bg-bg-hover transition-colors border-t border-border/20"
                        >
                            {row.getVisibleCells().map(cell => (
                                <td
                                    key={cell.id}
                                    className={`px-2 py-3 align-middle overflow-hidden ${cell.column.id === 'actions' ? 'w-10' : ''
                                        }`}
                                    style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : 'auto' }}
                                >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                    <InlineAddRow onAdd={onAdd} />
                </tbody>
            </table>
        </div>
    )
}
