import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ReceiptScannerModal from '../modal/ReceiptScannerModal'
import Modal from '../shared/Modal'
import Card from '../shared/Card'
import TabHeader from '../common/TabHeader'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency, formatDate } from '../../utils/helpers'
import Button from '../shared/Button'
import DatePicker from '../shared/DatePicker'
import AvatarCircle from '../shared/AvatarCircle'
import { calculateBalances, simplifyDebts, buildSplits } from '../../utils/splitwise'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import Select, { SelectItem } from '../shared/Select'
import { hapticImpact } from '../../utils/haptics'
import { Plus, Check, X, Pencil } from 'lucide-react'
import { GLOBAL_CATEGORIES, CATEGORY_MAP } from '../../constants/categories'

function AddExpenseModal({ isOpen, onClose, onAdd, travelers, categories }) {
  const [expenseData, setExpenseData] = useState({
    description: '',
    amount: '',
    category: categories[0]?.name || '',
    paidBy: travelers[0]?.id || ''
  })

  // Prefill check (if needed, though here it's simple state)
  useEffect(() => {
    if (isOpen) {
      setExpenseData({
        description: '',
        amount: '',
        category: categories[0]?.name || '',
        paidBy: travelers[0]?.id || ''
      })
    }
  }, [isOpen, categories, travelers])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!expenseData.description.trim() || !expenseData.amount) return
    const splits = buildSplits(Number(expenseData.amount), travelers.map(t => t.id), 'equal')
    onAdd({
      description: expenseData.description.trim(),
      amount: Number(expenseData.amount),
      category: expenseData.category,
      paidBy: expenseData.paidBy,
      splitBetween: travelers.map(t => t.id),
      splits,
      splitMode: 'equal',
      date: new Date().toISOString()
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💸 Log New Expense">
      <div className="p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Description</label>
          <input
            value={expenseData.description}
            onChange={e => setExpenseData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Dinner at 7-Eleven"
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 focus:outline-none focus:border-accent transition-colors"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Amount</label>
            <input
              type="number"
              value={expenseData.amount}
              onChange={e => setExpenseData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary px-3 py-2 font-mono focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Category</label>
            <Select value={expenseData.category} onValueChange={v => setExpenseData(prev => ({ ...prev, category: v }))}>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.emoji} {c.name}</SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Paid By</label>
          <Select value={expenseData.paidBy} onValueChange={v => setExpenseData(prev => ({ ...prev, paidBy: v }))}>
            {travelers.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </Select>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!expenseData.description.trim() || !expenseData.amount}>
            Log Expense
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Shared Colors ─────────────────────────────────────────────────────────────
const CHART_COLORS = ['#E08D8D', '#DBC0A7', '#A3B18A', '#93AFBA'] // Coral, Peach, Sage, Blue

const inputCls = 'w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'

// ── Consolidated Budget Health Card ───────────────────────────────────────────
function BudgetHealthCard({ budget, totals, currency, isReadOnly }) {
  const { dispatch } = useTripContext()
  const targetMax = totals.max || 1
  const isOver = totals.actual > totals.max && totals.max > 0
  const remaining = Math.max(0, totals.max - totals.actual)

  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newMax, setNewMax] = useState('')

  const handleAdd = () => {
    if (newCategoryId) {
      const cat = CATEGORY_MAP[newCategoryId]
      if (!cat) return
      
      dispatch({
        type: ACTIONS.ADD_BUDGET_CATEGORY,
        payload: {
          id: cat.id,
          name: cat.label,
          emoji: cat.emoji,
          max: newMax ? Number(newMax.replace(/[^0-9.]/g, '')) : 0
        }
      })
      setIsAdding(false)
      setNewCategoryId('')
      setNewMax('')
      hapticImpact('light')
    }
  }

  return (
    <Card className="p-4 border-border bg-bg-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading font-semibold text-sm text-text-primary text-balance">Overall Budget</h3>

        {!isReadOnly && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            <Plus size={10} strokeWidth={3} />
            Add Category
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="text-[13px] text-text-secondary font-medium">
          <span className={`tabular-nums ${isOver ? 'text-danger' : 'text-text-primary'}`}>
            {formatCurrency(Math.round(totals.actual), currency)}
          </span>
          <span className="text-text-muted"> spent of </span>
          <span className="text-text-primary tabular-nums">{formatCurrency(Math.round(totals.max), currency)}</span>
        </p>
      </div>

      {/* Stacked bar */}
      <div className="h-3 w-full rounded-full bg-bg-secondary flex overflow-hidden border border-border/30 mb-6">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          const w = Math.min(100, (cat.actual / targetMax) * 100)
          return (
            <div key={cat.id} className="h-full border-r border-black/5 last:border-r-0 transition-all duration-300"
              style={{ width: `${w}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              title={`${cat.name}: ${formatCurrency(Math.round(cat.actual), currency)}`} />
          )
        })}
        {isOver && (
          <div className="h-full bg-danger/80 transition-all"
            style={{ width: `${Math.min(40, ((totals.actual - totals.max) / totals.actual) * 100)}%` }} />
        )}
      </div>

      {/* Individual Category Bars */}
      <div className="space-y-4">
        {budget.map((cat, i) => {
          const catIsOver = cat.actual > cat.max && cat.max > 0
          const pct = cat.max > 0 ? Math.min(100, (cat.actual / cat.max) * 100) : 0
          const color = CHART_COLORS[i % CHART_COLORS.length]

          return (
            <div key={cat.id} className="group">
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cat.emoji}</span>
                  <EditableText
                    value={cat.name}
                    onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: cat.id, updates: { name: val } } })}
                    className="text-xs font-medium text-text-secondary"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-mono font-bold tabular-nums ${catIsOver ? 'text-danger' : 'text-text-primary'}`}>
                    {formatCurrency(Math.round(cat.actual || 0), currency)}
                  </span>
                  <EditableText
                    value={cat.max > 0 ? String(cat.max) : ''}
                    onSave={val => {
                      const n = Number(val.replace(/[^0-9.]/g, ''))
                      dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: cat.id, updates: { max: isNaN(n) ? 0 : n } } })
                    }}
                    placeholder="0"
                    className="text-[10px] text-text-muted/60 font-medium"
                    inputClassName="w-20"
                    readOnly={isReadOnly}
                    displayValue={cat.max > 0 ? `/${formatCurrency(Math.round(cat.max), currency)}` : '/Set limit'}
                  />
                  {!isReadOnly && (
                    <button
                      onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: cat.id })}
                      className="opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out p-1 text-text-muted hover:text-danger"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: catIsOver ? 'var(--color-danger)' : color }} />
              </div>
            </div>
          )
        })}

        {isAdding && (
          <div className="group pt-2 animate-in fade-in slide-in-from-top-1 border-t border-border/20 mt-2">
            <div className="flex flex-col gap-2.5 mb-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Pick Category</label>
                <Select value={newCategoryId || 'none'} onValueChange={v => setNewCategoryId(v === 'none' ? '' : v)}>
                  <SelectItem value="none">Select a category...</SelectItem>
                  {GLOBAL_CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </Select>
              </div>
              
              <div className="flex items-end gap-2">
                <div className="flex-1 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Limit ({currency})</label>
                  <input
                    value={newMax}
                    onChange={e => setNewMax(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAdd()
                      if (e.key === 'Escape') setIsAdding(false)
                    }}
                    placeholder="e.g. 5000"
                    className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] px-3 py-2 text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div className="flex gap-1 pb-1">
                  <button
                    onClick={handleAdd}
                    disabled={!newCategoryId}
                    className="h-9 px-3 bg-accent hover:bg-accent-hover text-white rounded-[var(--radius-md)] transition-colors disabled:opacity-30"
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => setIsAdding(false)}
                    className="h-9 px-3 bg-bg-secondary hover:bg-bg-hover text-text-muted rounded-[var(--radius-md)] transition-colors"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {budget.length === 0 && !isAdding && (
        <p className="text-[11px] text-text-muted text-center py-4 italic">No budget limits defined</p>
      )}
    </Card>
  )
}

// ── Group Spend Card ──────────────────────────────────────────────────────────
function GroupBalancesCard({ spendingLog, travelers, currency }) {
  const balances = useMemo(() => calculateBalances(spendingLog, travelers), [spendingLog, travelers])
  const transactions = useMemo(() => simplifyDebts(balances), [balances])
  const [showSettle, setShowSettle] = useState(false)

  // Total amount paid by each traveler
  const spent = useMemo(() => {
    const t = {}
    travelers.forEach(tr => { t[tr.id] = 0 })
    spendingLog.forEach(e => {
      if (e.paidBy && t[e.paidBy] !== undefined) t[e.paidBy] += e.amount || 0
    })
    return t
  }, [spendingLog, travelers])

  const totalSpend = useMemo(() =>
    Object.values(spent).reduce((s, v) => s + v, 0)
  , [spent])

  const hasData = spendingLog.some(e => e.paidBy) && travelers.length > 0
  if (!hasData) return null

  return (
    <Card className="border-border bg-bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-sm text-text-primary text-balance">Group Spend</h3>

        {transactions.length > 0 && (
          <button
            onClick={() => setShowSettle(p => !p)}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent-hover transition-colors"
          >
            {showSettle ? 'Hide' : 'Settle up'}
          </button>
        )}
      </div>

      {/* Per-traveler spend with progress bar */}
      <div className="space-y-3 mb-4">
        {travelers.map(t => {
          const amount = spent[t.id] || 0
          const pct = totalSpend > 0 ? (amount / totalSpend) * 100 : 0
          return (
            <div key={t.id}>
              <div className="flex items-center gap-2.5 mb-1.5">
                <AvatarCircle profile={t} size={24} />
                <span className="flex-1 text-sm font-medium text-text-secondary truncate">{t.name?.split(' ')[0]}</span>
                <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                  {formatCurrency(Math.round(amount), currency)}
                </span>
              </div>
              <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent/70 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-text-muted border-t border-border/20 pt-3 font-semibold uppercase tracking-wider">
        Total: {formatCurrency(Math.round(totalSpend), currency)}
      </p>

      {showSettle && transactions.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-border/20 pt-4 animate-in fade-in slide-in-from-top-1">
          {transactions.map((tx, i) => {
            const from = travelers.find(t => t.id === tx.from)?.name?.split(' ')[0] || '?'
            const to = travelers.find(t => t.id === tx.to)?.name?.split(' ')[0] || '?'
            return (
              <div key={i} className="flex items-center gap-2 py-2 px-3 bg-bg-secondary/50 rounded-[var(--radius-md)] text-xs border border-border/30">
                <span className="font-bold text-text-primary">{from}</span>
                <span className="text-text-muted">→</span>
                <span className="font-bold text-text-primary">{to}</span>
                <span className="ml-auto font-mono font-bold text-text-primary">{formatCurrency(Math.round(tx.amount), currency)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}


function SpendingLogTable({ spendingLog, budget, travelers, currency, onAdd, onDelete, onEdit, search, onSearch, onShowScan, isReadOnly }) {
  const showPaidBy = travelers.length > 1
  const [editId, setEditId] = useState(null)
  const [editData, setEditData] = useState({})
  const [highlightedExpenseId, setHighlightedExpenseId] = useState(null)
  const [sortCol, setSortCol] = useState('date') // 'date' | 'description' | 'amount' | 'category' | 'payer'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'

  useEffect(() => {
    const handleHighlight = (e) => {
      const { tab, id } = e.detail
      if (tab === 'budget') {
        setHighlightedExpenseId(id)
        setTimeout(() => {
          const el = document.getElementById(`expense-${id}`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
        setTimeout(() => setHighlightedExpenseId(null), 2000)
      }
    }
    window.addEventListener('highlight-item', handleHighlight)
    return () => window.removeEventListener('highlight-item', handleHighlight)
  }, [])

  const startEdit = (entry) => {
    setEditId(entry.id)
    setEditData({ description: entry.description, amount: entry.amount, category: entry.category })
  }
  const commitEdit = () => {
    if (onEdit && editId) {
      onEdit(editId, { description: editData.description.trim(), amount: Number(editData.amount), category: editData.category })
    }
    setEditId(null)
  }

  const sortedAndFiltered = useMemo(() => {
    let result = spendingLog
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
      )
    }

    return [...result].sort((a, b) => {
      let va, vb
      if (sortCol === 'description') {
        va = (a.description || '').toLowerCase(); vb = (b.description || '').toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      if (sortCol === 'amount') {
        va = Number(a.amount) || 0; vb = Number(b.amount) || 0
        return sortDir === 'asc' ? va - vb : vb - va
      }
      if (sortCol === 'category') {
        va = (a.category || '').toLowerCase(); vb = (b.category || '').toLowerCase()
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      if (sortCol === 'payer') {
        va = travelers.find(t => t.id === a.paidBy)?.name || ''
        vb = travelers.find(t => t.id === b.paidBy)?.name || ''
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      // date (default)
      va = a.date ? new Date(a.date).getTime() : 0
      vb = b.date ? new Date(b.date).getTime() : 0
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [spendingLog, search, sortCol, sortDir, travelers])

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    hapticImpact('light')
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <svg className="w-3 h-3 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7-7 7 7" /></svg>
    return sortDir === 'asc'
      ? <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      : <svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
  }

  return (
    <Card className="border-border bg-bg-card overflow-hidden">

      {/* ── Mobile card view ── */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {sortedAndFiltered.length === 0 && (
          <p className="text-center text-[13px] text-text-muted py-6 text-balance">
            {search ? `No results for "${search}"` : 'No expenses yet — tap + Log Expense to add one'}
          </p>

        )}
        {sortedAndFiltered.map(entry => {
          const catIndex = budget.findIndex(c => c.name === entry.category)
          const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'
          const catEmoji = budget.find(c => c.name === entry.category)?.emoji || '💸'
          const paidByName = travelers.find(t => t.id === entry.paidBy)?.name?.split(' ')[0]
          const dateLabel = formatDate(entry.date)
          return (
            <div 
              id={`expense-${entry.id}`}
              key={entry.id} 
              className={`bg-bg-card border p-3 rounded-[var(--radius-md)] transition-all ${
                highlightedExpenseId === entry.id ? 'border-accent bg-accent/10 ring-2 ring-accent/30' : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary truncate">{entry.description}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">{dateLabel}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[14px] font-mono font-bold text-text-primary tabular-nums">
                    {formatCurrency(entry.amount, currency)}
                  </span>
                  {onDelete && (
                    <button onClick={() => onDelete(entry.id)} className="p-1.5 text-text-muted hover:text-danger touch-target">

                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-secondary pt-2 border-t border-border/20">
                <span className="flex items-center gap-1">
                  <span>{catEmoji}</span>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  {entry.category}
                </span>
                {showPaidBy && entry.paidBy && (
                  <div className="flex items-center gap-1.5 text-text-muted">
                    <span>·</span>
                    <span className="text-[11px]">Payer</span>
                    <div className="flex items-center gap-1 bg-bg-secondary/50 px-1.5 py-0.5 rounded-full border border-border/50">
                      <AvatarCircle profile={travelers.find(t => t.id === entry.paidBy)} size={14} />
                      <span className="text-[10px] text-text-secondary font-medium">{paidByName}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table view ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
             <tr className="border-b border-border/50">
               <th className={`py-2 px-3 w-[160px] text-left text-xs font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer hover:text-text-primary transition-colors`} onClick={() => toggleSort('date')}>
                 <div className="flex items-center gap-1 whitespace-nowrap">Date <SortIcon col="date" /></div>
               </th>
               <th className={`py-2 px-2 text-left text-xs font-bold uppercase tracking-wider text-text-muted select-none`}>
                 <div className="flex items-center gap-1">Expense</div>
               </th>
               <th className={`py-2 px-2 text-right w-[120px] text-xs font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer hover:text-text-primary transition-colors`} onClick={() => toggleSort('amount')}>
                 <div className="flex items-center justify-end gap-1">Amount <SortIcon col="amount" /></div>
               </th>
               <th className={`py-2 px-2 w-[160px] text-left text-xs font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer hover:text-text-primary transition-colors`} onClick={() => toggleSort('category')}>
                 <div className="flex items-center gap-1">Category <SortIcon col="category" /></div>
               </th>
               {showPaidBy && (
                 <th className={`py-2 px-2 w-[140px] text-left text-xs font-bold uppercase tracking-wider text-text-muted select-none cursor-pointer hover:text-text-primary transition-colors`} onClick={() => toggleSort('payer')}>
                   <div className="flex items-center gap-1">Payer <SortIcon col="payer" /></div>
                 </th>
               )}
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>

            {sortedAndFiltered.length === 0 && (
              <tr>
                <td colSpan={showPaidBy ? 6 : 5} className="py-10 text-center text-text-muted">
                  {search ? (
                    <span className="text-[13px]">No results for "{search}"</span>
                  ) : (
                    <span className="text-[13px]">No expenses yet — click + Log Expense to add one</span>
                  )}
                </td>
              </tr>
            )}

            {sortedAndFiltered.map(entry => {
              const catIndex = budget.findIndex(c => c.name === entry.category)
              const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'
              const catEmoji = budget.find(c => c.name === entry.category)?.emoji || '💸'
              const paidByName = travelers.find(t => t.id === entry.paidBy)?.name?.split(' ')[0]
              const dateLabel = formatDate(entry.date)
              const isEditing = editId === entry.id

              if (isEditing) {
                return (
                  <tr key={entry.id} className="border-t border-border/20 bg-bg-hover">
                  <td className="py-2 px-3">
                    <DatePicker
                      value={editData.date}
                      onChange={v => setEditData(p => ({ ...p, date: v }))}
                      className="text-text-primary text-xs w-[140px] whitespace-nowrap"
                      disabled={isReadOnly}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={editData.description}
                      onChange={e => setEditData(p => ({ ...p, description: e.target.value }))}
                      className="w-full text-xs bg-bg-input border border-border rounded-[var(--radius-sm)] px-2 py-1 text-text-primary focus:outline-none focus:border-accent"
                      autoFocus
                    />
                  </td>
                  <td className="py-2 px-2 text-right">
                    <input
                      type="number"
                      value={editData.amount}
                      onChange={e => setEditData(p => ({ ...p, amount: e.target.value }))}
                      className="w-24 text-xs bg-bg-input border border-border rounded-[var(--radius-sm)] px-2 py-1 font-mono text-text-primary focus:outline-none text-right"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Select
                      value={editData.category}
                      onValueChange={v => setEditData(p => ({ ...p, category: v }))}
                      size="sm"
                    >
                      {budget.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.emoji} {c.name}</SelectItem>
                      ))}
                    </Select>
                  </td>
                  {showPaidBy && (
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5 opacity-50">
                        <AvatarCircle profile={travelers.find(t => t.id === entry.paidBy)} size={18} />
                        <span className="text-xs text-text-muted truncate">{paidByName}</span>
                      </div>
                    </td>
                  )}
                  <td className="py-2 px-3">
                    <div className="flex gap-1">
                      <button onClick={commitEdit} className="p-1 text-success hover:text-success/80 touch-target"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="p-1 text-text-muted hover:text-danger touch-target"><X size={14} /></button>
                    </div>
                  </td>
                  </tr>
                )
              }

              return (
                <tr 
                  id={`expense-${entry.id}`}
                  key={entry.id} 
                  className={`border-t border-border/20 group transition-colors ${
                    highlightedExpenseId === entry.id ? 'bg-accent/10 ring-2 ring-accent/30' : 'hover:bg-bg-hover'
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className={`transition-opacity duration-150 ${!entry.date ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                      <DatePicker
                        value={entry.date}
                        onChange={v => onUpdate(entry.id, { date: v })}
                        className="text-text-muted text-xs tabular-nums w-[140px] whitespace-nowrap"
                        disabled={isReadOnly}
                        placeholder="Set date"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-text-primary">{entry.description}</span>
                      {showPaidBy && entry.splits && Object.keys(entry.splits).length < travelers.length && (
                        <span title="Split mismatch" className="text-[10px] cursor-help">⚠️</span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className="text-[13px] font-mono font-semibold text-text-primary tabular-nums">
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span className="flex items-center gap-1.5 text-[12px] text-text-secondary">
                      <span className="text-[11px]">{catEmoji}</span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                        {entry.category}
                      </span>
                    </span>
                  </td>
                  {showPaidBy && (
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5">
                        <AvatarCircle profile={travelers.find(t => t.id === entry.paidBy)} size={20} />
                        <span className="text-[12px] text-text-secondary truncate max-w-[80px]">{paidByName || '—'}</span>
                      </div>
                    </td>
                  )}
                  <td className="py-3 px-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 blur-sm group-hover:blur-none transition-all duration-150 ease-out">
                      {onEdit && !entry.source && (
                        <button onClick={() => startEdit(entry)} className="p-1.5 text-text-muted hover:text-accent touch-target" title="Edit">

                          <Pencil size={13} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="p-2 flex items-center justify-center text-text-muted hover:text-danger touch-target"
                          title="Delete log"
                        >

                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── Main BudgetTab ─────────────────────────────────────────────────────────────
export default function BudgetTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const travelers = useTripTravelers()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [showScanModal, setShowScanModal] = useState(false)

  if (!activeTrip) return null
  const trip = activeTrip
  const budget = trip.budget || []
  const currency = trip.currency || 'PHP'

  const totals = useMemo(() => ({
    min: budget.reduce((s, b) => s + (b.min || 0), 0),
    max: budget.reduce((s, b) => s + (b.max || 0), 0),
    actual: budget.reduce((s, b) => s + (b.actual || 0), 0),
  }), [budget])

  const handleAddSpending = (data) => {
    dispatch({ type: ACTIONS.ADD_SPENDING, payload: data })
  }

  const handleEditSpending = (id, updates) => {
    dispatch({ type: ACTIONS.UPDATE_SPENDING, payload: { id, updates } })
  }

  const handleDeleteSpending = (id) => {
    dispatch({ type: ACTIONS.DELETE_SPENDING, payload: id })
  }

  return (
    <div className="space-y-5 animate-tab-enter stagger-1 pb-24 w-full">

      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSpending}
        travelers={travelers}
        categories={budget}
      />

      {/* ── Layer 2: The Toolbar (Unified Filters & Actions) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-4 gap-2">
        {/* Left: Search & Category Filter */}
        <div className="flex flex-col sm:flex-row flex-1 md:max-w-2xl gap-2">
          <div className="flex-1">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search expenses..."
              className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter} className="w-full sm:w-auto min-w-[140px]" size="md">
            <SelectItem value="all">All Categories</SelectItem>
            {budget.map(cat => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.emoji} {cat.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Right: Actions — horizontally scrollable on mobile */}
        <div className="flex overflow-x-auto scrollbar-hide md:overflow-visible w-full md:w-auto pb-2 md:pb-0 items-center gap-2">
          {!isReadOnly && (
            <>
              <Button
                onClick={() => setShowScanModal(true)}
                variant="secondary"
                size="sm"
                className="shrink-0"
              >
                Extract Receipt
              </Button>

              <div className="hidden md:block shrink-0">
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  size="sm"
                  className="shrink-0"
                >
                  ➕ Log Expense
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAB — mobile only */}
      {!isReadOnly && createPortal(
        <button
          onClick={() => { hapticImpact('medium'); setIsAddModalOpen(true) }}
          className="fixed bottom-24 right-4 z-40 block md:hidden bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          Log Expense
        </button>,
        document.body
      )}

      <ReceiptScannerModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
      />

      {/* 2:1 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start animate-tab-enter stagger-2">

        {/* Left Column (2/3 width) - Spending Log */}
        <div className="lg:col-span-2">
          <SpendingLogTable
            spendingLog={useMemo(() => {
              let log = trip.spendingLog || []
              if (categoryFilter !== 'all') {
                log = log.filter(e => e.category === categoryFilter)
              }
              return log
            }, [trip.spendingLog, categoryFilter])}
            budget={budget}
            travelers={travelers}
            currency={currency}
            onAdd={isReadOnly ? null : handleAddSpending}
            onEdit={isReadOnly ? null : handleEditSpending}
            onDelete={isReadOnly ? null : handleDeleteSpending}
            search={search}
            onSearch={setSearch}
            onShowScan={() => setShowScanModal(true)}
            isReadOnly={isReadOnly}
          />
        </div>

        {/* Right Column (1/3 width) - Analytics & Health */}
        <div className="lg:col-span-1 space-y-5 lg:sticky lg:top-0">
          <GroupBalancesCard
            spendingLog={trip.spendingLog || []}
            travelers={travelers}
            currency={currency}
          />

          <BudgetHealthCard
            budget={budget}
            totals={totals}
            currency={currency}
            isReadOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  )
}
