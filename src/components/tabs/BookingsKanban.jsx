import { useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core'
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MONDAY_STATUSES, migrateStatus } from './BookingsTable'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import Card from '../shared/Card'
import { formatCurrency } from '../../utils/helpers'

// ── Kanban Column (Droppable) ──────────────────────────────────────────────
function KanbanColumn({ id, title, bookings, currency, onRowClick }) {
    // SortableContext requires an array of IDs
    const itemIds = useMemo(() => bookings.map(b => b.id), [bookings])

    return (
        <div className="flex flex-col flex-shrink-0 w-72 bg-bg-secondary/20 border border-border/50 rounded-[var(--radius-lg)] p-2">
            <div className="px-3 py-2 mb-2 flex items-center justify-between border-b border-border/30">
                <h3 className="font-semibold text-sm text-text-primary">{title}</h3>
                <span className="text-xs font-medium text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border/50">
                    {bookings.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] scrollbar-hide">
                <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
                    {bookings.map(booking => (
                        <SortableCard
                            key={booking.id}
                            booking={booking}
                            currency={currency}
                            onRowClick={onRowClick}
                        />
                    ))}
                </SortableContext>
                {bookings.length === 0 && (
                    <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
                        Drop here
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Sortable Ticket (Draggable) ────────────────────────────────────────────
function SortableCard({ booking, currency, onRowClick }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: booking.id, data: booking })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative cursor-grab active:cursor-grabbing ${isDragging ? 'z-50' : ''}`}
        >
            <BookingCardContent booking={booking} currency={currency} onRowClick={onRowClick} />
        </div>
    )
}

// ── Shared Card Content (used by Sortable and Overlay) ───────────────────
function BookingCardContent({ booking, currency, onRowClick }) {
    const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]

    return (
        <div
            onClick={(e) => {
                // Prevent drag click from triggering click, handled loosely by dnd-kit usually,
                // but can safely invoke row click.
                onRowClick?.(booking)
            }}
            className="bg-bg-card border border-border/50 shadow-sm rounded-[var(--radius-md)] p-3 hover:border-accent/40 active:border-accent transition-colors block text-left"
        >
            <div className="flex items-start gap-2 mb-2">
                <span className="text-xl leading-none pt-0.5">{categoryConfig.emoji}</span>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-text-primary leading-tight truncate">
                        {booking.name}
                    </h4>
                    {(booking.bookByDate || booking.startDate) && (
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                            {booking.bookByDate || booking.startDate}
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Row */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-2">
                <span className="text-[11px] px-2 py-0.5 bg-bg-hover rounded-full text-text-muted">
                    {categoryConfig.label}
                </span>
                {booking.amountPaid > 0 && (
                    <span className="text-xs font-mono font-medium text-text-secondary">
                        {formatCurrency(booking.amountPaid, currency)}
                    </span>
                )}
            </div>
        </div>
    )
}

// ── Main Kanban Board ──────────────────────────────────────────────────────
export default function BookingsKanban({ bookings, currency, onUpdate, onRowClick }) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Requires 5px movement before drag starts (prevents accidental drags on click)
            }
        }),
        useSensor(KeyboardSensor)
    )

    // Group bookings by status
    const groupedBookings = useMemo(() => {
        const groups = {}
        MONDAY_STATUSES.forEach(s => groups[s.value] = [])
        bookings.forEach(b => {
            const status = migrateStatus(b.status)
            if (groups[status]) {
                groups[status].push(b)
            } else {
                // Fallback for unknown status
                groups[MONDAY_STATUSES[0].value].push(b)
            }
        })
        return groups
    }, [bookings])

    const handleDragEnd = (event) => {
        const { active, over } = event

        // Dropped outside any valid target
        if (!over) return

        const bookingId = active.id
        const activeData = active.data.current
        const newStatus = over.id // The drop container ID (or another item ID)

        // If dropped on another item, `over.id` is the item ID. We need its container.
        // Dnd-kit sortable adds `sortable.containerId` to the data payload.
        const overStatus = over.data?.current?.sortable?.containerId || over.id

        // If the status changed, update it.
        if (activeData && migrateStatus(activeData.status) !== overStatus) {
            // Validate it's a real status
            if (MONDAY_STATUSES.find(s => s.value === overStatus)) {
                onUpdate(bookingId, { status: overStatus })
            }
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] min-h-[400px] scrollbar-thin items-start">
                {MONDAY_STATUSES.map(statusObj => (
                    <KanbanColumn
                        key={statusObj.value}
                        id={statusObj.value}
                        title={statusObj.label}
                        bookings={groupedBookings[statusObj.value]}
                        currency={currency}
                        onRowClick={onRowClick}
                    />
                ))}
            </div>
            {/* We could add a DragOverlay here for a ghost image, but standard HTML5 dragging is often enough for simple boards. */}
        </DndContext>
    )
}
