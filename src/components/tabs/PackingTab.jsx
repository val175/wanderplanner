import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import AvatarCircle from '../shared/AvatarCircle'

// ── Category config ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'documents', label: 'Documents', emoji: '📄', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { id: 'clothing', label: 'Clothing', emoji: '👕', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  { id: 'tech', label: 'Tech', emoji: '📱', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200' },
  { id: 'toiletries', label: 'Toiletries', emoji: '🧴', color: 'bg-pink-500/10 text-pink-600 border-pink-200' },
  { id: 'misc', label: 'Misc', emoji: '📦', color: 'bg-stone-500/10 text-stone-600 border-stone-200' },
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
function CategoryPill({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const cat = CATEGORIES.find(c => c.id === value) || CATEGORIES[4]

  const handleOpen = (e) => {
    e.stopPropagation()
    const rect = buttonRef.current.getBoundingClientRect()
    setCoords({
      left: rect.left,
      top: rect.bottom + window.scrollY + 4
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !buttonRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', () => setOpen(false), { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', () => setOpen(false))
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${cat.color}`}
      >
        <span>{cat.emoji}</span>
        <span className="hidden sm:inline">{cat.label}</span>
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[100] rounded-[var(--radius-md)] border border-border bg-bg-card shadow-lg min-w-[140px] py-1"
          style={{ top: coords.top, left: coords.left }}
        >
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              onClick={(e) => {
                e.stopPropagation()
                onChange(c.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors
                ${c.id === value ? 'bg-accent/8 text-accent font-semibold' : 'hover:bg-bg-hover text-text-secondary'}`}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Qty Stepper ─────────────────────────────────────────────────────────────
function QtyStepper({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 justify-center">
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        disabled={value <= 1}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /></svg>
      </button>
      <span className="text-sm font-medium tabular-nums min-w-[1.25rem] text-center">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}

// ── Checkbox cell ───────────────────────────────────────────────────────────
function PackedCheckbox({ packed, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex-shrink-0 flex items-center justify-center rounded border-2 transition-all duration-150
        ${packed
          ? 'bg-success border-success text-white'
          : 'border-border-strong hover:border-accent'}`}
      style={{ width: 18, height: 18 }}
      aria-label={packed ? 'Mark unpacked' : 'Mark packed'}
    >
      {packed && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

// ── Assignee Pill ───────────────────────────────────────────────────────────
function AssigneePill({ value, packedBy, isPacked, onChange, tripTravelers, resolveProfile, currentUserProfile }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  // Normalize to array of IDs
  // We need to merge currentUserProfile.id into tripTravelers if it's not there, so they can assign to themselves
  const allTravelers = useMemo(() => {
    const ids = [...tripTravelers]
    if (currentUserProfile?.id && !ids.includes(currentUserProfile.id)) {
      ids.unshift(currentUserProfile.id)
    }
    return ids
  }, [tripTravelers, currentUserProfile])

  const assignees = Array.isArray(value) ? value : (value === 'shared' ? allTravelers : (value ? [value] : []))

  const handleOpen = (e) => {
    e.stopPropagation()
    const rect = buttonRef.current.getBoundingClientRect()
    setCoords({ left: rect.left, top: rect.bottom + window.scrollY + 4 })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && !buttonRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('scroll', () => setOpen(false), { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('scroll', () => setOpen(false))
    }
  }, [open])

  let displayNode = null
  let displayName = ''

  if (assignees.length > 1) {
    if (isPacked && packedBy) {
      const p = resolveProfile(packedBy)
      if (p) {
        displayNode = <AvatarCircle profile={p} size={22} />
      }
      displayName = `Packed by ${p?.name?.split(' ')[0]}`
    } else {
      displayNode = (
        <div className="flex flex-row items-center gap-1.5 pl-0.5 pr-2 py-0.5">
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
          <span className="text-[13px] font-medium text-text-primary pt-px truncate max-w-[90px]">
            {assignees.length === 2
              ? `${resolveProfile(assignees[0])?.name?.split(' ')[0]} & ${resolveProfile(assignees[1])?.name?.split(' ')[0]}`
              : `${assignees.length} people`}
          </span>
        </div>
      )
      displayName = assignees.map(id => resolveProfile(id)?.name).filter(Boolean).join(', ')
    }
  } else if (assignees.length === 1) {
    const p = resolveProfile(assignees[0])
    if (p) {
      displayNode = (
        <div className="flex flex-row items-center gap-1.5 pl-0.5 pr-2 py-0.5">
          <AvatarCircle profile={p} size={22} />
          <span className="text-[13px] font-medium text-text-primary pt-px truncate max-w-[90px]">
            {p.name.split(' ')[0]}
          </span>
        </div>
      )
      displayName = p.name
    } else {
      displayNode = (
        <div className="flex flex-row items-center gap-1.5 pl-1.5 pr-2.5 py-1">
          <div className="w-[18px] h-[18px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </div>
          <span className="text-[13px] font-medium text-text-primary pt-px">Unassigned</span>
        </div>
      )
      displayName = 'Unassigned'
    }
  } else {
    displayNode = (
      <div className="flex flex-row items-center gap-1.5 pl-1.5 pr-2.5 py-1">
        <div className="w-[18px] h-[18px] flex items-center justify-center rounded-full border border-dashed border-border text-text-muted shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        </div>
        <span className="text-[13px] font-medium text-text-primary pt-px">Unassigned</span>
      </div>
    )
    displayName = 'Unassigned'
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="inline-flex items-center justify-center rounded-full border border-border/60 bg-bg-secondary hover:bg-bg-hover transition-colors group"
        title={displayName}
      >
        {displayNode}
      </button>

      {open && coords && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[100] rounded-[var(--radius-md)] border border-border bg-bg-card shadow-lg min-w-[170px] py-1"
          style={{ top: coords.top, left: coords.left }}
        >
          {allTravelers.map(tId => {
            const p = resolveProfile(tId)
            if (!p) return null
            const isSelected = assignees.includes(tId)
            return (
              <button
                key={tId}
                onClick={(e) => {
                  e.stopPropagation()
                  const next = isSelected ? assignees.filter(id => id !== tId) : [...assignees, tId]
                  onChange(next)
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors hover:bg-bg-hover text-text-secondary`}
              >
                <div className="flex-1 flex items-center gap-2">
                  <AvatarCircle profile={p} size={16} />
                  <span className="truncate">{p.name}</span>
                </div>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}

// ── Inline add row ──────────────────────────────────────────────────────────
function InlineAddRow({ onAdd, defaultAssignee }) {
  const inputRef = useRef(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('misc')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), category, qty: 1, notes: '', packed: false, assignee: defaultAssignee })
    setName('')
    inputRef.current?.focus()
  }

  return (
    <tr className="border-t border-border/40 bg-accent/[0.02]">
      <td className="px-2 py-2 align-middle">
        <div className="flex items-center justify-center">
          <div className="w-[18px] h-[18px] rounded border-2 border-border/30 border-dashed" />
        </div>
      </td>
      <td className="px-2 py-2">
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="+ New item (press Enter to add)"
            className="w-full px-2 py-1.5 text-[13px] bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </form>
      </td>
      <td className="px-2 py-2 align-middle">
        <CategoryPill value={category} onChange={setCategory} />
      </td>
      <td colSpan={4} className="px-2 py-2 text-xs text-text-muted italic opacity-60">
        Fill in details after adding…
      </td>
    </tr>
  )
}

// ── Main Packing Tab ────────────────────────────────────────────────────────
export default function PackingTab() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const { currentUserProfile, resolveProfile } = useProfiles()
  const [celebration, setCelebration] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState('group') // 'group' | 'me'

  if (!activeTrip) return null

  const items = activeTrip.packingList || []

  // Create a filtered list of all items matching 'My List' rules if needed, to calculate progress accurately for the view
  const visibleItems = useMemo(() => {
    if (viewMode === 'group') return items
    const myId = currentUserProfile?.id
    if (!myId) return []
    const travelers = activeTrip.travelerIds || []

    return items.filter(p => {
      const assignees = Array.isArray(p.assignee)
        ? p.assignee
        : (p.assignee === 'shared' ? travelers : (p.assignee ? [p.assignee] : []))

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
    dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: id })
  }, [dispatch])

  const onAdd = useCallback((data) => {
    dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: data })
  }, [dispatch])

  const handleStarterList = () => {
    const travelers = activeTrip.travelerIds || []
    STARTER_ITEMS.forEach(item =>
      dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: { ...item, assignee: travelers } })
    )
    showToast("Starter list added! Remove what you don't need 🧳")
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
          />
        </div>
      ),
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Item',
      size: 999, // fluid
      cell: info => (
        <EditableText
          value={info.getValue()}
          onSave={val => onUpdate(info.row.original.id, { name: val })}
          inputClassName="w-full"
          className={`text-[13px] font-medium block w-full ${info.row.original.packed ? 'line-through text-text-muted' : 'text-text-primary'
            }`}
        />
      ),
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
        />
      ),
    },
    {
      id: 'notes',
      accessorKey: 'notes',
      header: 'Notes',
      size: 999, // fluid
      cell: info => (
        <EditableText
          value={info.getValue() || ''}
          onSave={val => onUpdate(info.row.original.id, { notes: val })}
          inputClassName="w-full"
          className="text-sm text-text-muted block w-full truncate"
          placeholder="Add note…"
        />
      ),
    },
    {
      id: 'assignee',
      header: <div className="text-center w-full">Assigned</div>,
      size: 90,
      cell: info => (
        <div className="flex justify-center">
          <AssigneePill
            value={info.row.original.assignee}
            packedBy={info.row.original.packedBy}
            isPacked={info.row.original.packed}
            onChange={val => onUpdate(info.row.original.id, { assignee: val })}
            tripTravelers={activeTrip.travelerIds || []}
            resolveProfile={resolveProfile}
            currentUserProfile={currentUserProfile}
          />
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 40,
      cell: info => (
        <button
          onClick={() => onDelete(info.row.original.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all rounded hover:bg-bg-hover"
          aria-label="Delete item"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      ),
    },
  ], [onToggle, onUpdate, onDelete])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <CelebrationEffect trigger={celebration} />
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          dispatch({ type: ACTIONS.RESET_PACKING })
          showToast('Packing list reset')
        }}
        title="Reset Packing List?"
        message="This will uncheck all packed items. Your items will not be removed."
        confirmLabel="Reset All"
        danger={false}
      />

      {/* ── Header Card ── */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
          <div className="flex items-center justify-between xl:justify-start w-full gap-3">
            <h2 className="font-heading text-lg text-text-primary">🧳 Packing List</h2>
            {total > 0 && (
              <span className="text-sm text-text-muted tabular-nums">{packed}/{total} items packed</span>
            )}
          </div>
        </div>
        <ProgressBar value={packed} max={total} colorClass="bg-accent" height="h-2" />
      </Card>

      {/* ── Category filter pills + actions row ── */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: filter pills */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setCategoryFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[var(--radius-pill)] whitespace-nowrap transition-colors
                ${categoryFilter === f.id
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-muted hover:text-text-secondary border border-border'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-bg-secondary p-0.5 rounded-[var(--radius-md)] border border-border mr-1 sm:mr-3">
            <button
              onClick={() => setViewMode('group')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all ${viewMode === 'group' ? 'bg-bg-card shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              Everyone
            </button>
            <button
              onClick={() => setViewMode('me')}
              className={`px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all flex items-center gap-1.5 ${viewMode === 'me' ? 'bg-bg-card shadow-sm text-accent' : 'text-text-muted hover:text-text-secondary'
                }`}
            >
              {viewMode === 'me' && currentUserProfile?.photo ? (
                <img src={currentUserProfile.photo} alt="" className="w-3.5 h-3.5 rounded-full" />
              ) : viewMode === 'me' ? (
                <div className="w-3.5 h-3.5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-[7px] font-bold">
                  {currentUserProfile?.name?.charAt(0) || 'M'}
                </div>
              ) : null}
              Just Me
            </button>
          </div>

          {total === 0 ? (
            <Button variant="secondary" size="sm" onClick={handleStarterList}>📋 Starter list</Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={handleStarterList}>📋 Starter list</Button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-text-muted hover:text-danger transition-colors ml-1 hidden sm:block"
              >
                Reset all
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[600px]">
            <thead>
              <tr className="border-b border-border/50">
                {table.getHeaderGroups()[0].headers.map(header => (
                  <th
                    key={header.id}
                    className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted overflow-hidden"
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
                  className={`group border-t border-border/20 transition-colors ${row.original.packed ? 'hover:bg-bg-hover/40' : 'hover:bg-bg-hover'
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
              <InlineAddRow onAdd={onAdd} defaultAssignee={viewMode === 'me' && currentUserProfile?.id ? [currentUserProfile.id] : []} />
            </tbody>
          </table>
        </div>
      </Card>

      {total === 0 && (
        <div className="text-center py-12 text-text-muted">
          <div className="text-4xl mb-3">🧳</div>
          <p className="text-sm">No items yet. Add your first item or use the starter list.</p>
        </div>
      )}
    </div>
  )
}
