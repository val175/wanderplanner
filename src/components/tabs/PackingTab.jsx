import { useState, useMemo, useCallback } from 'react'
import Card from '../shared/Card'
import ProgressBar from '../shared/ProgressBar'
import CelebrationEffect from '../shared/CelebrationEffect'
import ConfirmDialog from '../shared/ConfirmDialog'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { PACKING_SECTIONS } from '../../constants/tabs'

function PackingItem({ item, onToggle, onDelete }) {
  return (
    <div className="flex items-center gap-3 py-1.5 group">
      <button
        onClick={onToggle}
        className={`flex-shrink-0 w-4.5 h-4.5 rounded border-2 transition-all flex items-center justify-center
          ${item.packed
            ? 'bg-success border-success text-white animate-check-pop'
            : 'border-border-strong hover:border-accent'}`}
        style={{ width: 18, height: 18 }}
      >
        {item.packed && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${item.packed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
        {item.name}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-xs transition-opacity"
      >
        ✕
      </button>
    </div>
  )
}

function AddItemForm({ section, onAdd }) {
  const [name, setName] = useState('')
  const [expanded, setExpanded] = useState(false)

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="text-xs text-accent hover:text-accent-hover transition-colors mt-1">
        + Add item
      </button>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), section })
    setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Item name..."
        className="flex-1 px-2 py-1 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
        autoFocus
      />
      <button type="submit" className="px-2 py-1 text-xs bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">
        Add
      </button>
      <button type="button" onClick={() => setExpanded(false)} className="text-xs text-text-muted">✕</button>
    </form>
  )
}

export default function PackingTab() {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const [celebration, setCelebration] = useState(0)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')

  if (!activeTrip) return null
  const trip = activeTrip
  const items = trip.packingList || []

  const packed = items.filter(p => p.packed).length
  const total = items.length

  const sections = useMemo(() => {
    const secs = [...new Set(items.map(p => p.section))]
    PACKING_SECTIONS.forEach(s => { if (!secs.includes(s)) secs.push(s) })
    return secs
  }, [items])

  const grouped = useMemo(() => {
    const groups = {}
    sections.forEach(s => { groups[s] = [] })
    items.forEach(item => {
      const sec = item.section || 'Misc'
      if (!groups[sec]) groups[sec] = []
      groups[sec].push(item)
    })
    return groups
  }, [items, sections])

  const handleToggle = useCallback((itemId) => {
    dispatch({ type: ACTIONS.TOGGLE_PACKING_ITEM, payload: itemId })
    const item = items.find(p => p.id === itemId)
    if (item && !item.packed) {
      const newPacked = packed + 1
      if (newPacked === total) {
        setCelebration(c => c + 1)
        showToast("All packed! You're ready to go 🧳")
      }
    }
  }, [dispatch, items, packed, total, showToast])

  const sectionEmojis = {
    'Documents': '📄',
    'Clothing': '👕',
    'Tech': '📱',
    'Concert Essentials': '🎸',
    'Toiletries': '🧴',
    'Misc': '📦',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <CelebrationEffect trigger={celebration} />
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => { dispatch({ type: ACTIONS.RESET_PACKING }); showToast('Packing list reset') }}
        title="Reset Packing List?"
        message="This will uncheck all packed items. Your items will not be removed."
        confirmLabel="Reset All"
        danger={false}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-text-primary">🧳 Packing · {packed}/{total} packed</h2>
        {total > 0 && (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-xs text-text-muted hover:text-danger transition-colors"
          >
            Reset all
          </button>
        )}
      </div>

      {/* Overall progress */}
      <ProgressBar value={packed} max={total} colorClass="bg-accent" height="h-2.5" />

      {/* Sections */}
      {Object.entries(grouped).map(([section, sectionItems]) => {
        if (sectionItems.length === 0 && !PACKING_SECTIONS.includes(section)) return null
        const secPacked = sectionItems.filter(i => i.packed).length
        const emoji = sectionEmojis[section] || '📦'

        return (
          <Card key={section}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-sm font-semibold text-text-primary">{emoji} {section}</h3>
              <span className="text-xs text-text-muted">{secPacked}/{sectionItems.length}</span>
            </div>

            <div className="space-y-1">
              {sectionItems.map(item => (
                <PackingItem
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggle(item.id)}
                  onDelete={() => dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: item.id })}
                />
              ))}
            </div>

            <AddItemForm
              section={section}
              onAdd={data => dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: data })}
            />
          </Card>
        )
      })}

      {/* Add section */}
      {addingSection ? (
        <div className="flex gap-2">
          <input
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="Section name"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && newSectionName.trim()) {
                dispatch({ type: ACTIONS.ADD_PACKING_ITEM, payload: { name: 'New item', section: newSectionName.trim() } })
                setNewSectionName('')
                setAddingSection(false)
              }
            }}
          />
          <button onClick={() => setAddingSection(false)} className="text-sm text-text-muted">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingSection(true)} className="text-sm text-accent hover:text-accent-hover transition-colors">
          + Add section
        </button>
      )}
    </div>
  )
}
