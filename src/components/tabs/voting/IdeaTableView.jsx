import { useState, useMemo } from 'react'
import { Pencil, Check, X } from 'lucide-react'
import Card from '../../shared/Card'
import AvatarCircle from '../../shared/AvatarCircle'
import { formatDate } from '../../../utils/helpers'
import { formatIdeaPrice, CategoryPill } from './votingUtils'

// ── Idea Table Row ──
function IdeaTableRow({ idea, resolveProfile, onDelete, onUpdate, isSelectable, isSelected, onSelect }) {
  const [imgError, setImgError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const isBooked = idea.status === 'booked'
  const proposer = resolveProfile(idea.proposerId)
  const date = idea.createdAt ? formatDate(idea.createdAt) : '—'

  const startEdit = () => {
    setEditData({ title: idea.title || '', description: idea.description || '', priceDetails: idea.priceDetails || '' })
    setIsEditing(true)
  }
  const saveEdit = () => {
    onUpdate?.(idea.id, editData)
    setIsEditing(false)
  }

  const inputCls = "w-full bg-bg-input border border-border rounded-[var(--radius-sm)] px-2 py-1 text-text-primary focus:outline-none focus:border-accent"

  if (isEditing) {
    return (
      <tr className="border-t border-border/20 bg-bg-hover/30">
        <td className="px-2 py-3 w-10"><div className="w-4 h-4" /></td>
        <td className="px-2 py-3 w-12">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center shrink-0">
            <span className="text-xl">{idea.emoji || '✨'}</span>
          </div>
        </td>
        <td className="px-2 py-3 min-w-0">
          <div className="flex flex-col gap-1.5">
            <input
              autoFocus
              value={editData.title}
              onChange={e => setEditData(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setIsEditing(false) }}
              className={`${inputCls} text-[13px] font-semibold`}
              placeholder="Title"
            />
            <input
              value={editData.description}
              onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Escape') setIsEditing(false) }}
              className={`${inputCls} text-[11px]`}
              placeholder="Description"
            />
          </div>
        </td>
        <td className="px-2 py-3 whitespace-nowrap"><CategoryPill type={idea.type || 'other'} /></td>
        <td className="px-2 py-3 whitespace-nowrap">
          <input
            value={editData.priceDetails}
            onChange={e => setEditData(p => ({ ...p, priceDetails: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setIsEditing(false) }}
            className={`${inputCls} text-[13px]`}
            placeholder="e.g. $20"
          />
        </td>
        <td className="px-2 py-3 whitespace-nowrap">
          {proposer ? (
            <div className="flex items-center gap-1.5">
              <AvatarCircle profile={proposer} size={22} />
              <span className="text-[12px] text-text-secondary">{proposer.name?.split(' ')[0]}</span>
            </div>
          ) : <span className="text-text-muted text-xs">—</span>}
        </td>
        <td className="px-2 py-3 text-[12px] text-text-muted whitespace-nowrap">{date}</td>
        <td className="px-2 py-3 w-[80px]">
          <div className="flex items-center gap-1.5 justify-center">
            <button onClick={saveEdit} className="p-1 text-success hover:text-success/80 transition-colors" title="Save">
              <Check size={16} />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1 text-text-muted hover:text-danger transition-colors" title="Cancel">
              <X size={16} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`group border-t border-border/20 transition-colors ${isBooked ? 'opacity-40 grayscale' : 'hover:bg-bg-hover/50'} ${isSelected ? 'bg-accent/5' : ''}`}>
      <td className="px-2 py-3 w-10">
        {isSelectable && !isBooked ? (
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(idea)}
            className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer rounded" />
        ) : <div className="w-4 h-4" />}
      </td>
      <td className="px-2 py-3 w-12">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center shrink-0">
          {idea.imageUrl && !imgError ? (
            <img src={idea.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setImgError(true)} />
          ) : <span className="text-xl">{idea.emoji || '✨'}</span>}
        </div>
      </td>
      <td className="px-2 py-3 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-semibold text-[14px] text-text-primary leading-tight truncate">{idea.title}</span>
          {idea.url && (
            <a href={idea.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-text-muted hover:text-accent transition-colors" title="Open link">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            </a>
          )}
        </div>
        {idea.description && <span className="text-[11px] text-text-muted mt-0.5 block truncate">{idea.description}</span>}
      </td>
      <td className="px-2 py-3 whitespace-nowrap"><CategoryPill type={idea.type || 'other'} /></td>
      <td className="px-2 py-3 whitespace-nowrap">
        <span className="text-[13px] font-semibold text-text-primary">
          {idea.priceDetails || <span className="text-text-muted opacity-40 italic text-[12px]">—</span>}
        </span>
      </td>
      <td className="px-2 py-3 whitespace-nowrap">
        {proposer ? (
          <div className="flex items-center gap-1.5">
            <AvatarCircle profile={proposer} size={22} />
            <span className="text-[12px] text-text-secondary">{proposer.name?.split(' ')[0]}</span>
          </div>
        ) : <span className="text-text-muted text-xs">—</span>}
      </td>
      <td className="px-2 py-3 text-[12px] text-text-muted whitespace-nowrap">{date}</td>
      <td className="px-2 py-3 w-[80px]">
        {!isBooked && (
          <div className="flex items-center gap-1 justify-center opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out">
            <button onClick={(e) => { e.stopPropagation(); startEdit() }} className="p-1.5 text-text-muted hover:text-accent transition-colors" title="Edit">
              <Pencil size={14} />
            </button>
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }} className="p-1.5 text-text-muted hover:text-danger transition-colors" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Idea Mobile Card ──
function IdeaMobileCard({ idea, resolveProfile, onDelete, isSelectable, isSelected, onSelect }) {
  const [imgError, setImgError] = useState(false)
  const proposer = resolveProfile(idea.proposerId)
  const date = idea.createdAt ? formatDate(idea.createdAt) : '—'
  const isBooked = idea.status === 'booked'

  return (
    <div
      className={`bg-bg-card border p-3 rounded-[var(--radius-md)] transition-all
        ${isSelected ? 'border-accent bg-accent/5 ring-2 ring-accent/20' : 'border-border'}
        ${isBooked ? 'opacity-40 grayscale' : ''}
        ${isSelectable && !isBooked ? 'cursor-pointer' : ''}`}
      onClick={isSelectable && !isBooked ? () => onSelect(idea) : undefined}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-secondary flex items-center justify-center shrink-0">
          {idea.imageUrl && !imgError
            ? <img src={idea.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" onError={() => setImgError(true)} />
            : <span className="text-xl">{idea.emoji || '✨'}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-[13px] text-text-primary truncate">{idea.title}</p>
              {idea.description && <p className="text-[11px] text-text-muted mt-0.5 truncate">{idea.description}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {idea.priceDetails && <span className="text-[13px] font-semibold text-text-primary">{idea.priceDetails}</span>}
              {!isBooked && onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(idea.id) }} className="p-1 text-text-muted hover:text-danger transition-colors" title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-secondary pt-2 border-t border-border/20">
        <CategoryPill type={idea.type || 'other'} />
        <span className="flex-1" />
        <span className="text-text-muted">{date}</span>
        {proposer && (
          <div className="flex items-center gap-1 text-text-muted">
            <AvatarCircle profile={proposer} size={16} />
            <span>{proposer.name?.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Idea Table View ──
export default function IdeaTableView({ ideas, resolveProfile, onDelete, onUpdate, isSelectable, selectedIdeaIds, onSelect, isExtracting, onSelectAll }) {
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const allSelected = ideas.length > 0 && ideas.every(i => selectedIdeaIds.has(i.id))

  const sorted = useMemo(() => {
    return [...ideas].sort((a, b) => {
      let va, vb
      if (sortCol === 'name') {
        va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      if (sortCol === 'category') {
        va = a.type || ''; vb = b.type || ''
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      if (sortCol === 'cost') {
        va = parseFloat((a.priceDetails || '').split(/[-–]/)[0].replace(/[^0-9.]/g, '')) || 0
        vb = parseFloat((b.priceDetails || '').split(/[-–]/)[0].replace(/[^0-9.]/g, '')) || 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0)
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [ideas, sortCol, sortDir])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <svg className="w-3 h-3 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
    return sortDir === 'asc'
      ? <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
  }

  const thClass = "px-2 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted text-left select-none"
  const sortable = "cursor-pointer hover:text-text-primary transition-colors"

  return (
    <div>
      {/* Mobile card view */}
      <div className="flex flex-col gap-3 md:hidden">
        {sorted.map(idea => (
          <IdeaMobileCard key={idea.id} idea={idea} resolveProfile={resolveProfile} onDelete={onDelete}
            isSelectable={isSelectable} isSelected={selectedIdeaIds.has(idea.id)} onSelect={onSelect} />
        ))}
        {sorted.length === 0 && !isExtracting && (
          <p className="py-8 text-center text-text-muted text-sm">No ideas match this filter.</p>
        )}
      </div>

      {/* Desktop table view */}
      <Card className="hidden md:block rounded-[var(--radius-lg)] overflow-hidden animate-fade-in">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 w-10">
                  {isSelectable && (
                    <input type="checkbox" checked={allSelected} onChange={() => onSelectAll(ideas, allSelected)}
                      className="w-4 h-4 accent-[var(--color-accent)] cursor-pointer" />
                  )}
                </th>
                <th className="px-2 py-2 w-12" />
                <th className={`${thClass} ${sortable}`} onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">NAME <SortIcon col="name" /></div>
                </th>
                <th className={`${thClass} ${sortable}`} onClick={() => toggleSort('category')}>
                  <div className="flex items-center gap-1">CATEGORY <SortIcon col="category" /></div>
                </th>
                <th className={`${thClass} ${sortable}`} onClick={() => toggleSort('cost')}>
                  <div className="flex items-center gap-1">EST. COST <SortIcon col="cost" /></div>
                </th>
                <th className={thClass}>ADDED BY</th>
                <th className={`${thClass} ${sortable}`} onClick={() => toggleSort('date')}>
                  <div className="flex items-center gap-1">DATE <SortIcon col="date" /></div>
                </th>
                <th className="px-2 py-2 w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {isExtracting && (
                <tr className="border-b border-border/50 animate-pulse">
                  <td colSpan={8} className="py-3 px-4">
                    <div className="h-4 bg-bg-secondary rounded w-2/3" />
                  </td>
                </tr>
              )}
              {sorted.map(idea => (
                <IdeaTableRow key={idea.id} idea={idea} resolveProfile={resolveProfile} onDelete={onDelete}
                  onUpdate={onUpdate} isSelectable={isSelectable} isSelected={selectedIdeaIds.has(idea.id)} onSelect={onSelect} />
              ))}
              {sorted.length === 0 && !isExtracting && (
                <tr><td colSpan={8} className="py-12 text-center text-text-muted text-sm">No ideas match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
