import { useState, useMemo, useRef, useEffect } from 'react'
import ReceiptScannerModal from '../modal/ReceiptScannerModal'
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

// ── Shared Colors ─────────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#D97757', '#8FB3D9', '#82A88D', '#E6C27A', '#B88FB5', '#7A8B99',
]

const inputCls = 'w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'
const selectCls = 'w-full px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:border-accent focus:outline-none transition-colors'

// ── Extracted Budget Progress Bar ─────────────────────────────────────────────
function BudgetProgressBar({ budget, totals, currency, divisor }) {
  const targetMax = totals.max || 1
  const isOver = totals.actual > totals.max && totals.max > 0
  const remaining = Math.max(0, totals.max - totals.actual)

  return (
    <div className="bg-bg-card border border-border rounded-[var(--radius-lg)] p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Overall Budget</span>
        <span className={`text-[11px] font-semibold ${isOver ? 'text-danger' : 'text-text-muted'}`}>
          {isOver ? 'Over Budget' : `${formatCurrency(Math.round(remaining / divisor), currency)} Left`}
        </span>
      </div>

      <div className="h-4 w-full rounded-full bg-bg-secondary flex overflow-hidden border border-border/30">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          const w = Math.min(100, (cat.actual / targetMax) * 100)
          return (
            <div key={cat.id} className="h-full border-r border-black/5 last:border-r-0 transition-all duration-300"
              style={{ width: `${w}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              title={`${cat.name}: ${formatCurrency(Math.round(cat.actual / divisor), currency)}`} />
          )
        })}
        {isOver && (
          <div className="h-full bg-danger/80 transition-all"
            style={{ width: `${Math.min(40, ((totals.actual - totals.max) / totals.actual) * 100)}%` }} />
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {budget.filter(c => c.actual > 0).map((cat, i) => {
          const idx = budget.indexOf(cat)
          return (
            <span key={cat.id} className="flex items-center gap-1 text-[10px] text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
              {cat.name}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Group Balances Card ───────────────────────────────────────────────────────
function GroupBalancesCard({ spendingLog, travelers, currency }) {
  const balances = useMemo(() => calculateBalances(spendingLog, travelers), [spendingLog, travelers])
  const transactions = useMemo(() => simplifyDebts(balances), [balances])
  const [showSettle, setShowSettle] = useState(false)

  // "Total fronted" per person — how much each payer put out
  // Must be declared before any early return to satisfy Rules of Hooks
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
    <Card className="border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-base text-text-primary">Group Balances</h3>
        {transactions.length > 0 && (
          <button
            onClick={() => setShowSettle(p => !p)}
            className="text-[10px] font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
          >
            Settle up
          </button>
        )}
      </div>

      {/* Per-person net balance */}
      <div className="space-y-2 mb-3">
        {travelers.map(t => {
          const bal = balances[t.id] || 0
          const isPos = bal > 0.01
          const isNeg = bal < -0.01
          return (
            <div key={t.id} className="flex items-center gap-2">
              {t.avatar
                ? <img src={t.avatar} alt={t.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[10px] font-semibold text-text-secondary shrink-0">
                  {t.name?.[0]?.toUpperCase()}
                </div>
              }
              <span className="flex-1 text-[13px] text-text-primary truncate">{t.name}</span>
              <span className={`text-[13px] font-mono font-semibold tabular-nums ${isPos ? 'text-green-500' : isNeg ? 'text-danger' : 'text-text-muted'}`}>
                {isPos ? '+' : ''}{formatCurrency(Math.sign(bal) * Math.round(Math.abs(bal)), currency)}
              </span>
            </div>
          )
        })}
      </div>

      {/* "Total fronted" summary */}
      <p className="text-[10px] text-text-muted border-t border-border/40 pt-2 font-medium">
        Total fronted: {travelers.map(t => `${t.name.split(' ')[0]} (${formatCurrency(Math.round(fronted[t.id] || 0), currency)})`).join(' · ')}
      </p>

      {/* Settle-up transactions */}
      {showSettle && transactions.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
          <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-2">How to settle</p>
          {(() => {
            const COFFEE_THRESHOLD = 300
            const MICRO_PHRASES = [
              (from, to) => `${from}, just buy ${to} a coffee next time ☕`,
              (from, to) => `${from} owes ${to} a round of drinks 🍻`,
              (from, to) => `${from}, grab ${to} some dessert next time 🍦`,
              (from, to) => `${from}, get ${to} a snack 🧇`,
              (from, to) => `${from} owes ${to} boba tea 🧋`,
            ]
            return transactions.map((tx, i) => {
              const from = travelers.find(t => t.id === tx.from)
              const to = travelers.find(t => t.id === tx.to)
              const fromName = from?.name?.split(' ')[0] || '?'
              const toName = to?.name?.split(' ')[0] || '?'
              const rounded = Math.round(tx.amount)
              const isTrivial = rounded < COFFEE_THRESHOLD

              if (isTrivial) {
                // Pick a stable phrase based on the debtor+creditor combo
                const phraseIdx = ((tx.from || '').charCodeAt(0) + (tx.to || '').charCodeAt(0)) % MICRO_PHRASES.length
                const phrase = MICRO_PHRASES[phraseIdx](fromName, toName)
                return (
                  <div key={i} className="flex items-center justify-center gap-2 py-2 px-3 bg-accent/10 border border-accent/20 rounded-[var(--radius-md)] text-[12px]">
                    <span className="italic text-accent-hover font-medium">{phrase}</span>
                  </div>
                )
              }

              return (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 bg-bg-secondary rounded-[var(--radius-md)] text-[12px]">
                  <span className="font-medium text-text-primary">{fromName}</span>
                  <span className="text-text-muted">→</span>
                  <span className="font-medium text-text-primary">{toName}</span>
                  <span className="ml-auto font-mono font-semibold">{formatCurrency(rounded, currency)}</span>
                </div>
              )
            })
          })()}
        </div>
      )}
    </Card>
  )
}

// ── Compact Category Budgets Card ─────────────────────────────────────────────
function CategoryBudgetsCard({ budget, currency, divisor, perPerson, travelers, isReadOnly }) {
  const { dispatch } = useTripContext()
  const [addingCategory, setAddingCategory] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📌')
  const [newMax, setNewMax] = useState('')
  const commonEmojis = ['🍽️', '🚕', '🏨', '🎟️', '🛍️', '🎁', '🍸', '✈️', '💆', '📸', '💊', '📌']

  const handleAddCategory = (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    dispatch({ type: ACTIONS.ADD_BUDGET_CATEGORY, payload: { name: newName.trim(), emoji: newEmoji, max: newMax ? Number(newMax) : 0 } })
    setNewName(''); setNewEmoji('📌'); setNewMax(''); setAddingCategory(false)
  }

  return (
    <Card className="border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-base text-text-primary">Category Budgets</h3>
        {!isReadOnly && (
          <button
            onClick={() => setAddingCategory(p => !p)}
            className="text-[10px] font-medium uppercase tracking-widest text-accent hover:text-accent-hover transition-colors"
          >
            {addingCategory ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {addingCategory && (
        <form onSubmit={handleAddCategory} className="flex items-center gap-2 mb-3 pb-3 border-b border-border/40">
          <select value={newEmoji} onChange={e => setNewEmoji(e.target.value)}
            className="px-2 py-1 text-base bg-bg-input border border-border rounded-[var(--radius-md)] focus:outline-none">
            {commonEmojis.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Category name..." autoFocus
            className="flex-1 px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          <input value={newMax} onChange={e => setNewMax(e.target.value)}
            type="number" min="0" placeholder="Max budget"
            className="w-28 px-2 py-1.5 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none" />
          <Button type="submit" size="sm" disabled={!newName.trim()}>Add</Button>
        </form>
      )}

      <div className="space-y-3">
        {budget.map((cat, i) => {
          const isOver = cat.actual > cat.max && cat.max > 0
          const pct = cat.max > 0 ? Math.min(100, (cat.actual / cat.max) * 100) : 0
          const color = CHART_COLORS[i % CHART_COLORS.length]

          return (
            <div key={cat.id} className="group">
              <div className="flex items-baseline justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px]">{cat.emoji}</span>
                  <EditableText
                    value={cat.name}
                    onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: cat.id, updates: { name: val } } })}
                    className="text-[13px] font-medium text-text-primary px-0.5"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[12px] font-mono font-semibold ${isOver ? 'text-danger' : 'text-text-primary'}`}>
                    {formatCurrency(Math.round((cat.actual || 0) / divisor), currency)}
                  </span>
                  <EditableText
                    value={cat.max > 0 ? String(cat.max) : ''}
                    onSave={val => {
                      const n = Number(val.replace(/[^0-9.]/g, ''))
                      dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: cat.id, updates: { max: isNaN(n) ? 0 : n } } })
                    }}
                    placeholder="0"
                    className="text-[10px] text-text-muted/60 font-medium"
                    inputClassName="w-20 py-0 px-1 text-xs"
                    readOnly={isReadOnly}
                    displayValue={cat.max > 0 ? `/${formatCurrency(Math.round(cat.max / divisor), currency)}` : '/Set max'}
                  />
                  <button
                    onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: cat.id })}
                    className="opacity-0 group-hover:opacity-100 p-2 text-text-muted hover:text-danger"
                    title="Delete Category"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
              <div className="h-[5px] bg-bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: isOver ? 'var(--color-danger)' : color }} />
              </div>
            </div>
          )
        })}
      </div>

      {budget.length === 0 && (
        <p className="text-[12px] text-text-muted text-center py-4">No categories yet</p>
      )}
    </Card>
  )
}

// ── Inline Expense Table Row ──────────────────────────────────────────────────
function InlineExpenseRow({ categories, travelers, currency, onAdd, prefill }) {
  const today = new Date().toISOString().slice(0, 10)
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState(categories[0]?.name || '')
  const [paidBy, setPaidBy] = useState(travelers[0]?.id || '')
  const [amount, setAmount] = useState('')
  const descRef = useRef()
  const amtRef = useRef()

  // Sync selects when props change (must be effects, not useMemo, to avoid rendering side-effects)
  useEffect(() => { if (categories[0] && !cat) setCat(categories[0].name) }, [categories])
  useEffect(() => { if (travelers[0] && !paidBy) setPaidBy(travelers[0].id) }, [travelers])

  // Handle prefilled data from receipt scan
  useEffect(() => {
    if (prefill) {
      if (prefill.description) setDesc(prefill.description)
      if (prefill.amount) setAmount(String(prefill.amount))
      if (prefill.category) {
        // Try to match category by name (case-insensitive)
        const matched = categories.find(c => c.name.toLowerCase() === prefill.category.toLowerCase())
        if (matched) setCat(matched.name)
        else setCat(prefill.category) // Fallback to provided string
      }
    }
  }, [prefill, categories])

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!desc.trim() || !amount) return
    const splits = buildSplits(Number(amount), travelers.map(t => t.id), 'equal')
    onAdd({
      description: desc.trim(),
      amount: Number(amount),
      category: cat,
      paidBy,
      splitBetween: travelers.map(t => t.id),
      splits,
      splitMode: 'equal',
    })
    setDesc(''); setAmount('')
    descRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <tr className="border-t border-border/30 bg-accent/[0.03]">
      {/* Date */}
      <td className="py-2 px-3 text-[11px] text-text-muted whitespace-nowrap">Today</td>
      {/* Description */}
      <td className="py-2 px-2">
        <input
          ref={descRef}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What did you spend on?"
          className={inputCls}
          autoFocus
        />
      </td>
      {/* Category */}
      <td className="py-2 px-2 min-w-[130px]">
        <Select value={cat} onValueChange={setCat} size="sm">
          {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.emoji} {c.name}</SelectItem>)}
        </Select>
      </td>
      {/* Paid By */}
      {travelers.length > 1 && (
        <td className="py-2 px-2 min-w-[110px]">
          <Select value={paidBy} onValueChange={setPaidBy} size="sm">
            {travelers.map(t => <SelectItem key={t.id} value={t.id}>{t.name.split(' ')[0]}</SelectItem>)}
          </Select>
        </td>
      )}
      {/* Amount */}
      <td className="py-2 px-2 min-w-[90px]">
        <input
          ref={amtRef}
          type="number" min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="0"
          className={inputCls + ' text-right font-mono'}
        />
      </td>
      {/* Submit */}
      <td className="py-2 px-3">
        <button
          onClick={handleSubmit}
          disabled={!desc.trim() || !amount}
          className="w-7 h-7 rounded-[var(--radius-sm)] bg-accent text-white flex items-center justify-center disabled:opacity-30 hover:bg-accent-hover transition-colors text-sm font-medium shrink-0"
          title="Add expense (Enter)"
        >+</button>
      </td>
    </tr>
  )
}


// ── Spending Log Table ─────────────────────────────────────────────────────────
function SpendingLogTable({ spendingLog, budget, travelers, currency, onAdd, onDelete, search, onSearch, showInline, onToggleInline, onShowScan }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return spendingLog
    const q = search.toLowerCase()
    return spendingLog.filter(e =>
      e.description?.toLowerCase().includes(q) || e.category?.toLowerCase().includes(q)
    )
  }, [spendingLog, search])

  const showPaidBy = travelers.length > 1

  return (
    <Card className="border border-border/50">

      <div className="overflow-x-auto">
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
            {/* Inline input row */}
            {showInline && (
              <InlineExpenseRow
                categories={budget}
                travelers={travelers}
                currency={currency}
                onAdd={(data) => { onAdd(data); setShowInline(false) }}
              />
            )}

            {filtered.length === 0 && !showInline && (
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
                      {/* Warn if this expense was logged when fewer travelers existed */}
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
  const { currentUserProfile } = useProfiles()
  const travelers = useTripTravelers()
  const [perPerson, setPerPerson] = useState(false)
  const [search, setSearch] = useState('')
  const [showInline, setShowInline] = useState(false)
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

  const divisor = perPerson ? Math.max(trip.travelers, 1) : 1

  const handleAddSpending = (data) => {
    dispatch({ type: ACTIONS.ADD_SPENDING, payload: data })
  }

  const handleDeleteSpending = (id) => {
    dispatch({ type: ACTIONS.DELETE_SPENDING, payload: id })
  }

  return (
    <div className="space-y-6 animate-fade-in pb-16 w-full">
      {/* ── Layer 1: Header ── */}
      <TabHeader
        title={<span>💰 Budget</span>}
        subtitle="Track spending, split costs, and manage trip funds."
        rightSlot={
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Spent / Max</span>
            <span className={`text-sm font-semibold ${totals.actual > totals.max ? 'text-danger' : 'text-text-secondary'}`}>
              {formatCurrency(Math.round(totals.actual / divisor), currency)} / {formatCurrency(Math.round(totals.max / divisor), currency)}
            </span>
          </div>
        }
      />

      {/* ── Layer 2: The Toolbar (Unified Filters & Actions) ── */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-4 flex-1">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="px-3 py-1.5 text-sm bg-bg-secondary border border-border/50 rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors w-full max-w-[240px]"
          />

          {/* Per Person Toggle */}
          <div className="flex items-center gap-2 shrink-0 h-full">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Per Person:</span>
            <button
              onClick={() => setPerPerson(!perPerson)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${perPerson ? 'bg-accent' : 'bg-border'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${perPerson ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isReadOnly && (
            <>
              <button
                onClick={() => setShowScanModal(true)}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-[var(--radius-md)] border border-orange-500/20 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10 transition-all"
              >
                📸 Extract Receipt
              </button>

              <Button
                onClick={() => setShowInline(!showInline)}
                size="sm"
                variant={showInline ? 'secondary' : 'primary'}
              >
                {showInline ? 'Cancel' : '+ Log Expense'}
              </Button>
            </>
          )}
        </div>
      </div>

      <ReceiptScannerModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
      />

      {/* 2:1 Grid:wide Left (Activities), narrow Right (Analytics) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2/3 width) */}
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
            showInline={showInline}
            onToggleInline={() => setShowInline(!showInline)}
            onShowScan={() => setShowScanModal(true)}
          />
        </div>

        {/* Right Column (1/3 width) - Analytics Column */}
        <div className="lg:col-span-1 space-y-6 sm:sticky sm:top-[88px]">
          <BudgetProgressBar
            budget={budget}
            totals={totals}
            currency={currency}
            divisor={divisor}
          />

          <CategoryBudgetsCard
            budget={budget}
            currency={currency}
            divisor={divisor}
            perPerson={perPerson}
            travelers={travelers}
            isReadOnly={isReadOnly}
          />

          <GroupBalancesCard
            spendingLog={trip.spendingLog || []}
            travelers={travelers}
            currency={currency}
          />
        </div>
      </div>
    </div>
  )
}
