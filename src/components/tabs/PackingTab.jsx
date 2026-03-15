import { useState, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Checkbox from '@radix-ui/react-checkbox'
import { useProfiles } from '../../context/ProfileContext'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import Card from '../shared/Card'
import ProgressBar from '../shared/ProgressBar'
import CelebrationEffect from '../shared/CelebrationEffect'
import ConfirmDialog from '../shared/ConfirmDialog'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import EditableText from '../shared/EditableText'
import Select, { SelectItem } from '../shared/Select'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import AvatarCircle from '../shared/AvatarCircle'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { triggerHaptic, hapticImpact } from '../../utils/haptics'
import TabHeader from '../common/TabHeader'
import EmptyState from '../shared/EmptyState'

function AddPackingModal({ isOpen, onClose, onAdd, defaultAssignee }) {
  const [itemData, setItemData] = useState({
    name: '',
    category: 'misc',
    qty: 1
  })

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!itemData.name.trim()) return
    onAdd({
      name: itemData.name.trim(),
      category: itemData.category,
      qty: Number(itemData.qty) || 1,
      notes: '',
      packed: false,
      assignee: defaultAssignee || []
    })
    setItemData({ name: '', category: 'misc', qty: 1 })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🧳 Add New Item">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Item Name</label>
          <input
            value={itemData.name}
            onChange={e => setItemData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Universal Adapter"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
            <Select value={itemData.category} onValueChange={v => setItemData(prev => ({ ...prev, category: v }))}>
              {CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Quantity</label>
            <input
              type="number"
              value={itemData.qty}
              onChange={e => setItemData(prev => ({ ...prev, qty: e.target.value }))}
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
              min="1"
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!itemData.name.trim()}>
            Add Item
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Packing Badge Engine ──────────────────────────────────────────────────────
// Maps itinerary activity keywords → matching packing item keywords → badge emoji
const BADGE_RULES = [
  { activityPattern: /hik|trek|mountain|trail|climb/i, itemPattern: /shoe|sneaker|boot|footwear/i, badge: '🥾' },
  { activityPattern: /beach|swim|snorkel|dive|surf|pool/i, itemPattern: /swimsuit|swim|sunscreen|spf|towel|bikini/i, badge: '🩱' },
  { activityPattern: /ski|snowboard|snow|winter sport/i, itemPattern: /jacket|thermal|glove|beanie|snow|ski/i, badge: '❄️' },
  { activityPattern: /museum|gallery|theatre|theater|opera|formal|dinner|gala/i, itemPattern: /dress|blazer|suit|formal|heels|shirt/i, badge: '🎩' },
  { activityPattern: /camping|camp|overnight hike|bivouac/i, itemPattern: /sleeping bag|tent|torch|flashlight|camp/i, badge: '⛺' },
  { activityPattern: /rain|wet season|monsoon/i, itemPattern: /umbrella|raincoat|rain jacket|poncho/i, badge: '🌧️' },
  { activityPattern: /yoga|meditation|wellness|spa|fitness/i, itemPattern: /yoga|mat|activewear|gym/i, badge: '🧘' },
]

/**
 * Returns a Map<itemId, string[]> — badges for each packing item based on
 * what's in the itinerary.
 */
function usePackingBadges(items, itinerary) {
  return useMemo(() => {
    const badgeMap = new Map()
    if (!itinerary?.length || !items?.length) return badgeMap

    // Collect all activity text from the entire itinerary
    const allActivityText = itinerary
      .flatMap(day => day.activities || [])
      .map(a => `${a.name || ''} ${a.notes || ''} ${a.location || ''}`)
      .join(' ')

    // Find which rules are triggered
    const triggeredBadges = BADGE_RULES.filter(rule => rule.activityPattern.test(allActivityText))
    if (!triggeredBadges.length) return badgeMap

    // For each item, check if any triggered badge applies
    items.forEach(item => {
      const itemText = `${item.name || ''} ${item.notes || ''}`
      const badges = triggeredBadges
        .filter(rule => rule.itemPattern.test(itemText))
        .map(rule => rule.badge)
      if (badges.length) badgeMap.set(item.id, badges)
    })

    return badgeMap
  }, [items, itinerary])
}

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'documents', label: 'Documents', emoji: '📄' },
  { id: 'clothing', label: 'Clothing', emoji: '👕' },
  { id: 'tech', label: 'Tech', emoji: '📱' },
  { id: 'toiletries', label: 'Toiletries', emoji: '🧴' },
  { id: 'misc', label: 'Misc', emoji: '📦' },
]

const STARTER_ITEMS = [
  { name: 'Passport', category: 'documents', qty: 1 },
  { name: 'Travel insurance', category: 'documents', qty: 1 },
  { name: 'Flight / hotel bookings printout', category: 'documents', qty: 1 },
  { name: 'Local SIM or roaming plan', category: 'documents', qty: 1 },
  { name: 'T-shirts', category: 'clothing', qty: 4 },
  { name: 'Comfortable walking shoes', category: 'clothing', qty: 1 },
  { name: 'Light jacket / rain layer', category: 'clothing', qty: 1 },
  { name: 'Underwear & socks', category: 'clothing', qty: 5 },
  { name: 'Phone charger', category: 'tech', qty: 1 },
  { name: 'Universal power adapter', category: 'tech', qty: 1 },
  { name: 'Portable battery pack', category: 'tech', qty: 1 },
  { name: 'Earphones / earbuds', category: 'tech', qty: 1 },
  { name: 'Toothbrush & toothpaste', category: 'toiletries', qty: 1 },
  { name: 'Sunscreen SPF 50+', category: 'toiletries', qty: 1 },
  { name: 'Deodorant', category: 'toiletries', qty: 1 },
  { name: 'Prescription medication', category: 'toiletries', qty: 1 },
  { name: 'Reusable water bottle', category: 'misc', qty: 1 },
  { name: 'Snacks for the plane', category: 'misc', qty: 1 },
  { name: 'Travel pillow', category: 'misc', qty: 1 },
]

// ── Category pill + dropdown ────────────────────────────────────────────────
function CategoryPill({ value, onChange, disabled }) {
  const cat = CATEGORIES.find(c => c.id === value) || CATEGORIES[4]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-3 sm:px-2 py-1 sm:py-0.5 rounded-[var(--radius-pill)] text-xs font-medium border border-border bg-bg-secondary text-text-secondary transition-colors ${disabled ? 'cursor-default' : 'hover:bg-bg-hover'}`}
        >
          <span className="text-lg sm:text-base">{cat.emoji}</span>
          <span className="hidden sm:inline">{cat.label}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[9999] rounded-[var(--radius-md)] border border-border bg-bg-card min-w-[140px] py-1 animate-scale-in focus:outline-none"
        >
          {CATEGORIES.map(c => (
            <DropdownMenu.Item
              key={c.id}
              onSelect={() => onChange(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none outline-none transition-colors
                ${c.id === value
                  ? 'text-accent font-semibold data-[highlighted]:bg-accent/15'
                  : 'text-text-secondary data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary'
                }`}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── Qty Stepper ─────────────────────────────────────────────────────────────
function QtyStepper({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 justify-center">
      <button
        onClick={() => !disabled && onChange(Math.max(1, value - 1))}
        className={`w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center rounded-[5px] bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors touch-target ${disabled ? 'opacity-50 cursor-default' : ''}`}
        disabled={value <= 1 || disabled}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:w-[10px] sm:h-[10px]"><path d="M5 12h14" /></svg>
      </button>

      <span className="text-base sm:text-sm font-medium tabular-nums min-w-[1.5rem] sm:min-w-[1.25rem] text-center">{value}</span>
      <button
        onClick={() => !disabled && onChange(value + 1)}
        className={`w-7 h-7 sm:w-5 sm:h-5 flex items-center justify-center rounded-[5px] bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors touch-target ${disabled ? 'opacity-50 cursor-default' : ''}`}
        disabled={disabled}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sm:w-[10px] sm:h-[10px]"><path d="M12 5v14M5 12h14" /></svg>
      </button>

    </div>
  )
}

// ── Checkbox cell ───────────────────────────────────────────────────────────
function PackedCheckbox({ packed, onToggle, disabled }) {
  return (
    <Checkbox.Root
      checked={packed}
      onCheckedChange={() => !disabled && onToggle()}
      disabled={disabled}
      aria-label={packed ? 'Mark unpacked' : 'Mark packed'}
      className={`w-5 h-5 rounded-[var(--radius-sm)] border-2 flex items-center justify-center transition-all ${packed
        ? 'bg-success border-success text-white animate-check-pop'
        : 'border-border-strong hover:border-accent'
        } ${disabled ? 'cursor-default opacity-80' : ''}`}
    >
      <Checkbox.Indicator>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="sm:w-[10px] sm:h-[10px]">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

// ── Assignee Pill ───────────────────────────────────────────────────────────
function AssigneePill({ value, packedBy, isPacked, onChange, tripTravelers, resolveProfile, currentUserProfile, disabled }) {
  // Normalize to array of IDs, merge currentUserProfile if not already present
  const allTravelers = useMemo(() => {
    const ids = [...tripTravelers]
    if (currentUserProfile?.id && !ids.includes(currentUserProfile.id)) {
      ids.unshift(currentUserProfile.id)
    }
    return ids
  }, [tripTravelers, currentUserProfile])

  const assignees = Array.isArray(value) ? value : (value === 'shared' ? allTravelers : (value ? [value] : []))

  let displayNode = null
  let displayName = ''

  if (assignees.length > 1) {
    displayNode = (
      <div className="flex flex-row items-center">
        <div className="flex -space-x-1.5">
          {assignees.slice(0, 3).map((tId, i) => {
            const p = resolveProfile(tId)
            if (!p) return null
            return (
              <div key={tId} style={{ zIndex: 10 - i }} className="rounded-full flex shrink-0 ring-[1.5px] ring-bg-secondary">
                <AvatarCircle profile={p} size={22} />
              </div>
            )
          })}
        </div>
      </div>
    )
    displayName = assignees.map(id => resolveProfile(id)?.name).filter(Boolean).join(', ')
  } else if (assignees.length === 1) {
    const p = resolveProfile(assignees[0])
    if (p) {
      displayNode = (
        <div className="flex items-center gap-1.5 px-0.5">
          <AvatarCircle profile={p} size={22} />
          <span className="text-[12px] text-text-secondary truncate max-w-[65px]">{p.name?.split(' ')[0]}</span>
        </div>
      )
      displayName = p.name
    } else {
      displayNode = (
        <div className={`w-[22px] h-[22px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent transition-colors ${disabled ? '' : 'hover:bg-bg-hover'}`}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
      )
      displayName = 'Unassigned'
    }
  } else {
    displayNode = (
      <div className={`w-[22px] h-[22px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0 bg-transparent transition-colors ${disabled ? '' : 'hover:bg-bg-hover'}`}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
      </div>
    )
    displayName = 'Unassigned'
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild disabled={disabled}>
        <button
          className={`inline-flex items-center rounded-full border border-transparent transition-all focus:outline-none ${disabled ? 'cursor-default' : 'hover:ring-[2px] ring-accent/30'}`}
          title={displayName}
        >
          {displayNode}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[9999] rounded-[var(--radius-md)] border border-border bg-bg-card min-w-[170px] py-1 animate-scale-in focus:outline-none"
        >
          {allTravelers.map(tId => {
            const p = resolveProfile(tId)
            if (!p) return null
            const isSelected = assignees.includes(tId)
            return (
              <DropdownMenu.CheckboxItem
                key={tId}
                checked={isSelected}
                onCheckedChange={checked => {
                  const next = checked ? [...assignees, tId] : assignees.filter(id => id !== tId)
                  onChange(next)
                }}
                onSelect={e => e.preventDefault()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer select-none outline-none text-text-secondary data-[highlighted]:bg-bg-hover data-[highlighted]:text-text-primary"
              >
                <div className="flex-1 flex items-center gap-2">
                  <AvatarCircle profile={p} size={16} />
                  <span className="truncate">{p.name}</span>
                </div>
                <DropdownMenu.ItemIndicator>
                  <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.CheckboxItem>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}


// ── Main Packing Tab ────────────────────────────────────────────────────────
export default function PackingTab() {
  const { activeTrip, dispatch, showToast, isReadOnly } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [celebration, setCelebration] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState('group') // 'group' | 'me'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  if (!activeTrip) return null

  const items = activeTrip.packingList || []
  const travelers = useTripTravelers()
  const travelerIds = travelers.map(t => t.id)
  const packingBadges = usePackingBadges(items, activeTrip.itinerary)

  // Create a filtered list of all items matching 'My List' rules if needed, to calculate progress accurately for the view
  const visibleItems = useMemo(() => {
    if (viewMode === 'group') return items
    const myId = currentUserProfile?.id
    if (!myId) return []
    const travs = travelerIds

    return items.filter(p => {
      const assignees = Array.isArray(p.assignee)
        ? p.assignee
        : (p.assignee === 'shared' ? travs : (p.assignee ? [p.assignee] : []))

      if (!assignees.includes(myId)) return false

      // If shared among multiple people, only show if unpacked OR I packed it
      if (assignees.length > 1) {
        return !p.packed || p.packedBy === myId
      }
      return true
    })
  }, [items, viewMode, currentUserProfile, activeTrip])

  const packed = visibleItems.filter(p => p.packed).length
  const total = visibleItems.length

  const onToggle = useCallback((itemId) => {
    triggerHaptic('light')
    const item = items.find(p => p.id === itemId)
    dispatch({ type: ACTIONS.TOGGLE_PACKING_ITEM, payload: { itemId, userId: currentUserProfile?.id } })
    if (item && !item.packed) {
      // Show celebration only if packing the last visible item
      if (packed + 1 === total && total > 0) {
        setCelebration(c => c + 1)
        showToast("All packed! You're ready to go 🧳")
      }
    }
  }, [dispatch, items, packed, total, showToast])

  const onUpdate = useCallback((id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_PACKING_ITEM, payload: { id, updates } })
  }, [dispatch])

  const onDelete = useCallback((id) => {
    triggerHaptic('medium')
    dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: id })
  }, [dispatch])

  const onAdd = useCallback((data) => {
    dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: data })
  }, [dispatch])

  const handleStarterList = () => {
    // Deduplicate: skip items whose name already exists (case-insensitive)
    const existingNames = new Set(items.map(i => i.name.toLowerCase()))
    const newItems = STARTER_ITEMS.filter(item => !existingNames.has(item.name.toLowerCase()))
    if (newItems.length === 0) {
      showToast("All starter items are already in your list!", "info")
      return
    }
    newItems.forEach(item =>
      dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: { ...item, assignee: travelerIds } })
    )
    const skipped = STARTER_ITEMS.length - newItems.length
    const msg = skipped > 0
      ? `Added ${newItems.length} items (${skipped} already present) 🧳`
      : "Starter list added! Remove what you don't need 🧳"
    showToast(msg)
  }

  // Filters — only show categories that have at least one visible item
  const filters = useMemo(() => [
    { id: 'all', label: 'All Categories' },
    ...CATEGORIES.filter(c => visibleItems.some(p => (p.category || 'misc') === c.id))
      .map(c => ({ id: c.id, label: `${c.emoji} ${c.label}` })),
  ], [visibleItems])

  // Sort + filter visible items by active category filter, unpacked first
  const data = useMemo(() => {
    let filtered = categoryFilter === 'all' ? visibleItems : visibleItems.filter(p => (p.category || 'misc') === categoryFilter)
    const unpacked = filtered.filter(p => !p.packed)
    const packedItems = filtered.filter(p => p.packed)
    return [...unpacked, ...packedItems]
  }, [visibleItems, categoryFilter])

  const columns = useMemo(() => [
    {
      id: 'packed',
      header: '',
      size: 44,
      cell: info => (
        <div className="flex items-center justify-center">
          <PackedCheckbox
            packed={info.row.original.packed}
            onToggle={() => onToggle(info.row.original.id)}
            disabled={isReadOnly}
          />
        </div>
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Item',
      size: 999, // fluid
      cell: info => {
        const badges = packingBadges.get(info.row.original.id)
        return (
          <div className="flex items-center gap-1.5 w-full min-w-0">
            <EditableText
              value={info.getValue()}
              onSave={val => onUpdate(info.row.original.id, { name: val })}
              className={`text-sm font-medium transition-colors ${info.row.original.packed ? 'text-text-muted line-through' : 'text-text-primary'}`}
              inputClassName="w-full"
              readOnly={isReadOnly}
            />  {badges && !info.row.original.packed && (
              <span className="flex items-center gap-0.5 shrink-0">
                {badges.map((badge, i) => (
                  <span
                    key={i}
                    title="Relevant to your itinerary!"
                    className="text-[13px] animate-pulse"
                    style={{ animationDuration: '2.5s' }}
                  >
                    {badge}
                  </span>
                ))}
              </span>
            )}
          </div>
        )
      },
    },
    {
      id: 'category',
      accessorKey: 'category',
      header: 'Category',
      size: 130,
      cell: info => (
        <CategoryPill
          value={info.getValue() || 'misc'}
          onChange={val => onUpdate(info.row.original.id, { category: val })}
          disabled={isReadOnly}
        />
      ),
    },
    {
      id: 'qty',
      accessorKey: 'qty',
      header: <div className="text-center w-full">Qty</div>,
      size: 80,
      cell: info => (
        <QtyStepper
          value={info.getValue() || 1}
          onChange={val => onUpdate(info.row.original.id, { qty: val })}
          disabled={isReadOnly}
        />
      ),
    },
    {
      id: 'notes',
      accessorKey: 'notes',
      header: 'Notes',
      size: 999, // fluid
      cell: info => {
        const val = info.getValue()
        return (
          <div className={`transition-opacity duration-150 ${!val ? 'opacity-0 group-hover:opacity-100' : ''}`}>
            <EditableText
              value={val || ''}
              onSave={val => onUpdate(info.row.original.id, { notes: val })}
              inputClassName="w-full"
              className="text-sm text-text-muted block w-full truncate"
              placeholder="Add note"
              readOnly={isReadOnly}
            />
          </div>
        )
      },
    },
    {
      id: 'assignee',
      header: <div className="text-center w-full">Assigned</div>,
      size: 110,
      cell: info => (
        <div className="flex justify-center">
          <AssigneePill
            value={info.row.original.assignee}
            packedBy={info.row.original.packedBy}
            isPacked={info.row.original.packed}
            onChange={val => onUpdate(info.row.original.id, { assignee: val })}
            tripTravelers={travelerIds}
            resolveProfile={resolveProfile}
            currentUserProfile={currentUserProfile}
            disabled={isReadOnly}
          />
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 72,
      cell: info => !isReadOnly && (
        <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out">
          <button
            onClick={(e) => { e.stopPropagation(); /* name EditableText handles inline edit */ }}
            className="p-1 text-text-muted hover:text-accent rounded transition-colors touch-target"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(info.row.original.id)
            }}
            className="p-1 text-text-muted hover:text-danger rounded transition-colors touch-target"
            title="Delete"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      )
    },
  ], [onToggle, onUpdate, onDelete])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-5 animate-tab-enter stagger-1 pb-24">

      <CelebrationEffect trigger={celebration} />

      <AddPackingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={onAdd}
        defaultAssignee={viewMode === 'me' && currentUserProfile?.id ? [currentUserProfile.id] : []}
      />

      <TabHeader
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="w-20 h-1.5 rounded-[var(--radius-pill)] bg-bg-secondary overflow-hidden hidden md:block shrink-0">
              <div
                className="h-full rounded-[var(--radius-pill)] bg-accent transition-all duration-300"
                style={{ width: `${total > 0 ? (packed / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold font-heading text-text-muted tabular-nums">
              {packed}/{total} packed
            </span>
          </div>
        }
        rightSlot={
          <>
            <div className="flex-1">
              <Select value={categoryFilter} onValueChange={setCategoryFilter} className="min-w-[140px] h-7 text-xs" size="sm">
                {filters.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label === 'All' ? 'All Items' : f.label}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
              <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border shrink-0">
                <button
                  onClick={() => setViewMode('group')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${viewMode === 'group' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  Everyone
                </button>
                <button
                  onClick={() => setViewMode('me')}
                  className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${viewMode === 'me' ? 'bg-bg-card text-accent' : 'text-text-muted hover:text-text-secondary'}`}
                >
                  Just Me
                </button>
              </div>

              {!isReadOnly && (
                <>
                  <Button variant="secondary" size="sm" onClick={handleStarterList} className="shrink-0">
                    Starter List
                  </Button>

                  <div className="hidden md:block shrink-0">
                    <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="shrink-0">
                      🧳 New Item
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        }
      />

      <div className="animate-tab-enter stagger-2">


      {/* FAB — mobile only */}
      {!isReadOnly && createPortal(
        <button
          onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
          className="fixed bottom-24 right-4 z-40 block md:hidden bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          New Item
        </button>,
        document.body
      )}

      {/* ── Mobile card view ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.map(item => {
          const badges = packingBadges.get(item.id)
          return (
            <div
              key={item.id}
              className={`bg-bg-card border border-border p-3 rounded-[var(--radius-md)] transition-colors ${item.packed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5 shrink-0">
                  <PackedCheckbox
                    packed={item.packed}
                    onToggle={() => onToggle(item.id)}
                    disabled={isReadOnly}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-medium text-sm ${item.packed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {item.name}
                    </span>
                    {badges && !item.packed && (
                      <span className="flex items-center gap-0.5">
                        {badges.map((badge, i) => (
                          <span key={i} title="Relevant to your itinerary!" className="text-[13px] animate-pulse" style={{ animationDuration: '2.5s' }}>{badge}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">{item.notes}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <CategoryPill
                      value={item.category || 'misc'}
                      onChange={val => onUpdate(item.id, { category: val })}
                      disabled={isReadOnly}
                    />
                    <QtyStepper
                      value={item.qty || 1}
                      onChange={val => onUpdate(item.id, { qty: val })}
                      disabled={isReadOnly}
                    />
                    <AssigneePill
                      value={item.assignee}
                      packedBy={item.packedBy}
                      isPacked={item.packed}
                      onChange={val => onUpdate(item.id, { assignee: val })}
                      tripTravelers={travelerIds}
                      resolveProfile={resolveProfile}
                      currentUserProfile={currentUserProfile}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="p-1 text-text-muted hover:text-danger transition-colors shrink-0 touch-target"

                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      </div>


      {/* ── Desktop table view ── */}
      <div className="animate-tab-enter stagger-3">
      <Card className="hidden md:block overflow-hidden">

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50">
                {table.getHeaderGroups()[0].headers.map(header => (
                  <th
                    key={header.id}
                    className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-text-muted overflow-hidden"
                    style={{ width: header.column.columnDef.size === 999 ? 'auto' : header.column.columnDef.size }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={`group border-t border-border/20 transition-colors ${row.original.packed ? 'hover:bg-bg-hover/20' : 'hover:bg-bg-hover/50'
                    }`}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className="px-2 py-2.5 align-middle overflow-hidden"
                      style={{ width: cell.column.columnDef.size === 999 ? 'auto' : cell.column.columnDef.size }}
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
      </div>


      {total === 0 && (
        <EmptyState
          className="mt-4"
          emoji="🧳"
          title="Your packing list is empty"
          subtitle="Add items manually or let Wanda suggest what to pack based on your destinations."
          wandaPrompt={`What should I pack for my trip to ${activeTrip.cities?.map(c => c.city).join(', ') || 'my destinations'}?\n\n[INSTRUCTION]:\nPlease recommend 3 specific packing items based on our destination/dates. IMPORTANT: For EACH item, you MUST call the "add_to_packing_list" tool. Do not just list them in text.`}`}
          action={
            !isReadOnly && (
              <Button variant="primary" size="sm" onClick={handleStarterList}>
                🗂️ Starter List
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
