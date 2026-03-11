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
import { calculateBalances, simplifyDebts, buildSplits } from '../../utils/splitwise'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import Select, { SelectItem } from '../shared/Select'
import { hapticImpact } from '../../utils/haptics'
import { Plus, Check, X } from 'lucide-react'

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
  const [newName, setNewName] = useState('')
  const [newMax, setNewMax] = useState('')

  const handleAdd = () => {
    if (newName.trim()) {
      dispatch({
        type: ACTIONS.ADD_BUDGET_CATEGORY,
        payload: {
          name: newName.trim(),
          emoji: '📌',
          max: newMax ? Number(newMax.replace(/[^0-9.]/g, '')) : 0
        }
      })
      setIsAdding(false)
      setNewName('')
      setNewMax('')
      hapticImpact('light')
    }
  }

  return (
    <Card className="p-4 border-border bg-bg-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading font-semibold text-sm text-text-primary">Overall Budget</h3>
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
          <span className={isOver ? 'text-danger' : 'text-text-primary'}>
            {formatCurrency(Math.round(totals.actual), currency)}
          </span>
          <span className="text-text-muted"> spent of </span>
          <span className="text-text-primary">{formatCurrency(Math.round(totals.max), currency)}</span>
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
                  <span className={`text-[11px] font-mono font-bold ${catIsOver ? 'text-danger' : 'text-text-primary'}`}>
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
                    inputClassName="w-16 py-0 px-1 text-xs"
                    readOnly={isReadOnly}
                    displayValue={cat.max > 0 ? `/${formatCurrency(Math.round(cat.max), currency)}` : '/Set limit'}
                  />
                  {!isReadOnly && (
                    <button
                      onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: cat.id })}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-opacity"
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
          <div className="group pt-2 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm">📌</span>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') setIsAdding(false)
                  }}
                  placeholder="Category..."
                  className="w-full text-xs font-medium text-text-primary bg-bg-input border border-border rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  value={newMax}
                  onChange={e => setNewMax(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd()
                    if (e.key === 'Escape') setIsAdding(false)
                  }}
                  placeholder="Limit"
                  className="w-16 text-xs font-medium text-text-primary bg-bg-input border border-border rounded-[var(--radius-sm)] px-2 py-1 focus:outline-none focus:border-accent font-mono"
                />
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="p-1 text-accent hover:bg-accent/10 rounded transition-colors disabled:opacity-30"
                >
                  <Check size={14} strokeWidth={2.5} />
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-1 text-text-muted hover:bg-bg-secondary rounded transition-colors"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden opacity-50 border border-border/20">
              <div className="h-full bg-border/20 w-0" />
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

// Note: GroupBalancesCard remains as a standalone Card or similar functionality

// ── Group Balances Card ───────────────────────────────────────────────────────
function GroupBalancesCard({ spendingLog, travelers, currency }) {
  const balances = useMemo(() => calculateBalances(spendingLog, travelers), [spendingLog, travelers])
  const transactions = useMemo(() => simplifyDebts(balances), [balances])
  const [showSettle, setShowSettle] = useState(false)

  const fronted = useMemo(() => {
    const t = {}
    travelers.forEach(tr => { t[tr.id] = 0 })
    spendingLog.forEach(e => {
      if (e.paidBy && t[e.paidBy] !== undefined) t[e.paidBy] += e.amount || 0
    })
    return t
  }, [spendingLog, travelers])

  const hasData = spendingLog.some(e => e.paidBy && e.splits) && travelers.length > 1
  if (!hasData) return null

  return (
    <Card className="border-border bg-bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-sm text-text-primary">Group Balances</h3>
        {transactions.length > 0 && (
          <button
            onClick={() => setShowSettle(p => !p)}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent-hover transition-colors"
          >
            {showSettle ? 'Hide' : 'Settle up'}
          </button>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {travelers.map(t => {
          const bal = balances[t.id] || 0
          const isPos = bal > 0.01
          const isNeg = bal < -0.01
          return (
            <div key={t.id} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-text-secondary shrink-0 overflow-hidden">
                {t.avatar ? <img src={t.avatar} alt="" className="w-full h-full object-cover" /> : t.name?.[0]?.toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-medium text-text-secondary truncate">{t.name}</span>
              <span className={`text-sm font-mono font-bold tabular-nums ${isPos ? 'text-green-500' : isNeg ? 'text-danger' : 'text-text-muted'}`}>
                {isPos ? '+' : ''}{formatCurrency(Math.sign(bal) * Math.round(Math.abs(bal)), currency)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-text-muted border-t border-border/20 pt-3 font-semibold uppercase tracking-wider">
        Total fronted: {travelers.map(t => `${t.name.split(' ')[0]} (${formatCurrency(Math.round(fronted[t.id] || 0), currency)})`).join(' · ')}
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



function SpendingLogTable({ spendingLog, budget, travelers, currency, onAdd, onDelete, search, onSearch, onShowScan }) {
  const showPaidBy = travelers.length > 1

  const filtered = useMemo(() => {
    if (!search.trim()) return spendingLog
    const q = search.toLowerCase()
    return spendingLog.filter(e =>
      e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
    )
  }, [spendingLog, search])

  return (
    <Card className="border-border bg-bg-card overflow-hidden">

      {/* ── Mobile card view ── */}
      <div className="flex flex-col gap-3 p-3 md:hidden">
        {filtered.length === 0 && (
          <p className="text-center text-[13px] text-text-muted py-6">
            {search ? `No results for "${search}"` : 'No expenses yet — tap + Log Expense to add one'}
          </p>
        )}
        {filtered.map(entry => {
          const catIndex = budget.findIndex(c => c.name === entry.category)
          const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'
          const catEmoji = budget.find(c => c.name === entry.category)?.emoji || '💸'
          const paidByName = travelers.find(t => t.id === entry.paidBy)?.name?.split(' ')[0]
          const dateLabel = formatDate(entry.date)
          return (
            <div key={entry.id} className="bg-bg-card border border-border p-3 rounded-[var(--radius-md)]">
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
                    <button onClick={() => onDelete(entry.id)} className="p-1.5 text-text-muted hover:text-danger">
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
                {showPaidBy && paidByName && (
                  <span className="text-text-muted">· Paid by {paidByName}</span>
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
              <th className="text-left py-2 px-3 text-xs font-bold uppercase tracking-wider text-text-muted w-[80px]">Date</th>
              <th className="text-left py-2 px-2 text-xs font-bold uppercase tracking-wider text-text-muted">Description</th>
              <th className="text-left py-2 px-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[130px]">Category</th>
              {showPaidBy && <th className="text-left py-2 px-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[100px]">Paid by</th>}
              <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-text-muted w-[100px]">Amount</th>
              <th className="w-[40px]" />
            </tr>
          </thead>
          <tbody>

            {filtered.length === 0 && (
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

            {filtered.map(entry => {
              const catIndex = budget.findIndex(c => c.name === entry.category)
              const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'
              const catEmoji = budget.find(c => c.name === entry.category)?.emoji || '💸'
              const paidByName = travelers.find(t => t.id === entry.paidBy)?.name?.split(' ')[0]
              const dateLabel = formatDate(entry.date)

              return (
                <tr key={entry.id} className="border-t border-border/20 hover:bg-bg-hover group transition-colors">
                  <td className="py-3 px-3 text-[11px] text-text-muted tabular-nums whitespace-nowrap">{dateLabel}</td>
                  <td className="py-3 px-2">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-text-primary">{entry.description}</span>
                      {showPaidBy && entry.splits && Object.keys(entry.splits).length < travelers.length && (
                        <span
                          title="This expense was split between fewer people than are currently on the trip. Delete and re-log to fix the balance."
                          className="text-[10px] cursor-help"
                        >⚠️</span>
                      )}
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
                    <td className="py-3 px-2 text-[12px] text-text-secondary">
                      {paidByName || '—'}
                    </td>
                  )}
                  <td className="py-3 px-2 text-right">
                    <span className="text-[13px] font-mono font-semibold text-text-primary tabular-nums">
                      {formatCurrency(entry.amount, currency)}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(entry.id)}
                        className="p-2 flex items-center justify-center text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete log"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    )}
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

  const handleDeleteSpending = (id) => {
    dispatch({ type: ACTIONS.DELETE_SPENDING, payload: id })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24 w-full">
      {/* ── Layer 1: Header ── */}
      <TabHeader
        title="💰 Budget"
        subtitle="Track expenses and manage trip funds."
      />

      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSpending}
        travelers={travelers}
        categories={budget}
      />

      {/* ── Layer 2: The Toolbar (Unified Filters & Actions) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 mb-6 gap-2">
        {/* Left: Search */}
        <div className="flex-1 md:max-w-sm">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="w-full text-sm bg-bg-input border border-border rounded-[var(--radius-md)] px-4 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />
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
          className="fixed bottom-24 right-4 z-40 block md:hidden shadow-lg bg-accent text-white rounded-full px-4 py-3 font-semibold flex items-center gap-2"
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2/3 width) - Spending Log */}
        <div className="lg:col-span-2">
          <SpendingLogTable
            spendingLog={trip.spendingLog || []}
            budget={budget}
            travelers={travelers}
            currency={currency}
            onAdd={isReadOnly ? null : handleAddSpending}
            onDelete={isReadOnly ? null : handleDeleteSpending}
            search={search}
            onSearch={setSearch}
            onShowScan={() => setShowScanModal(true)}
          />
        </div>

        {/* Right Column (1/3 width) - Analytics & Health */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-[88px]">
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
