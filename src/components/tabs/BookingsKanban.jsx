import { useMemo, useState } from 'react'
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
} from '@dnd-kit/core'
import { useMediaQuery } from '../../hooks/useMediaQuery'
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

// Modifier that anchors the DragOverlay top-left corner to the cursor position
const snapCursorToTopLeft = ({ activatorEvent, draggingNodeRect, transform }) => {
    if (draggingNodeRect && activatorEvent) {
        const activatorCoordinates = {
            x: activatorEvent.clientX,
            y: activatorEvent.clientY,
        }
        const offsetX = activatorCoordinates.x - draggingNodeRect.left
        const offsetY = activatorCoordinates.y - draggingNodeRect.top
        return {
            ...transform,
            x: transform.x + offsetX - draggingNodeRect.width / 2,
            y: transform.y + offsetY - 20,
        }
    }
    return transform
}

// ── Kanban Column (Droppable) ──────────────────────────────────────────────
function KanbanColumn({ id, title, bookings, currency, onRowClick, isMobile, isExpanded, onToggleExpand, isReadOnly }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    const itemIds = useMemo(() => bookings.map(b => b.id), [bookings])

    if (isMobile) {
        return (
            <div
                ref={setNodeRef}
                className={`flex flex-col w-full bg-bg-secondary/20 border rounded-[var(--radius-lg)] transition-colors overflow-hidden ${isOver ? 'border-accent/50 bg-accent/5' : 'border-border/50'}`}
            >
                <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-bg-hover active:bg-bg-hover/80 transition-colors"
                    onClick={() => onToggleExpand(id)}
                >
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-[15px] text-text-primary">{title}</h3>
                        <span className="text-xs font-medium text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border/50">
                            {bookings.length}
                        </span>
                    </div>
                    <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </div>

                {isExpanded && (
                    <div className="px-2 pb-3 flex-1 space-y-2">
                        <SortableContext id={id} items={itemIds} strategy={verticalListSortingStrategy}>
                            {bookings.map(booking => (
                                <SortableCard
                                    key={booking.id}
                                    booking={booking}
                                    currency={currency}
                                    onRowClick={onRowClick}
                                    isReadOnly={isReadOnly}
                                />
                            ))}
                        </SortableContext>
                        {bookings.length === 0 && (
                            <div className="h-20 flex items-center justify-center border-2 border-dashed border-border/40 rounded-[var(--radius-md)] text-xs text-text-muted/60 italic">
                                Drop here or add a booking
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col flex-shrink-0 w-72 bg-bg-secondary/20 border rounded-[var(--radius-lg)] p-2 transition-colors ${isOver ? 'border-accent/50 bg-accent/5' : 'border-border/50'}`}
        >
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
function SortableCard({ booking, currency, onRowClick, isReadOnly }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: booking.id, data: booking, disabled: isReadOnly })

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isReadOnly ? {} : attributes)}
            {...(isReadOnly ? {} : listeners)}
            className={`relative ${isReadOnly ? '' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'z-50' : ''}`}
        >
            <BookingCardContent booking={booking} currency={currency} onRowClick={onRowClick} isOverlay={false} />
        </div>
    )
}

// ── Shared Card Content (used by Sortable and Overlay) ───────────────────
function BookingCardContent({ booking, currency, onRowClick, isOverlay }) {
    const categoryConfig = BOOKING_CATEGORIES.find(c => c.id === booking.category) || BOOKING_CATEGORIES[0]

    return (
        <div
            onClick={(e) => {
                onRowClick?.(booking)
            }}
            className={`bg-bg-card border shadow-sm rounded-[var(--radius-md)] p-3 transition-colors block text-left ${isOverlay ? 'border-accent shadow-xl rotate-2 cursor-grabbing' : `border-border/50 ${isReadOnly ? '' : 'hover:border-accent/40 active:border-accent'}`
                }`}
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
export default function BookingsKanban({ bookings, currency, onUpdate, onRowClick, isReadOnly }) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Requires 5px movement before drag starts (prevents accidental drags on click)
            }
        }),
        useSensor(KeyboardSensor)
    )

    const isMobile = useMediaQuery('(max-width: 767px)')
    const [activeId, setActiveId] = useState(null)
    const [expandedAccordion, setExpandedAccordion] = useState(MONDAY_STATUSES[0].value) // Default to first col open

    const activeBooking = useMemo(() => {
        if (!activeId) return null
        return bookings.find(b => b.id === activeId) || null
    }, [activeId, bookings])

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

    const handleDragStart = (event) => {
        setActiveId(event.active.id)
    }

    const handleDragEnd = (event) => {
        setActiveId(null)
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
            onDragStart={isReadOnly ? null : handleDragStart}
            onDragEnd={isReadOnly ? null : handleDragEnd}
            modifiers={[snapCursorToTopLeft]}
        >
            <div className={`flex gap-4 pb-4 scrollbar-thin items-start ${isMobile ? 'flex-col overflow-y-auto h-auto' : 'overflow-x-auto h-[calc(100vh-280px)] min-h-[400px]'}`}>
                {MONDAY_STATUSES.map(statusObj => (
                    <KanbanColumn
                        key={statusObj.value}
                        id={statusObj.value}
                        title={statusObj.label}
                        bookings={groupedBookings[statusObj.value]}
                        currency={currency}
                        onRowClick={onRowClick}
                        isMobile={isMobile}
                        isExpanded={expandedAccordion === statusObj.value}
                        onToggleExpand={(id) => setExpandedAccordion(prev => prev === id ? null : id)}
                        isReadOnly={isReadOnly}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeId && activeBooking ? (
                    <div className="w-72">
                        <BookingCardContent booking={activeBooking} currency={currency} isOverlay={true} />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
