import { useState, useMemo } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency } from '../../utils/helpers'
import Button from '../shared/Button'
import { calculateBalances, simplifyDebts, buildSplits } from '../../utils/splitwise'

// ── Shared Colors ─────────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#D97757', '#8FB3D9', '#82A88D', '#E6C27A', '#B88FB5', '#7A8B99',
]

// ── Stacked Summary Bar ───────────────────────────────────────────────────────
function BudgetSummaryBar({ budget, totals, currency, divisor }) {
  if (!budget || budget.length === 0) return null
  const targetMax = totals.max || 1
  const remaining = Math.max(0, totals.max - totals.actual)
  const isOver = totals.actual > totals.max && totals.max > 0

  return (
    <div className="mt-8">
      <div className="h-6 w-full rounded-md bg-bg-input flex overflow-hidden border border-border/50">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          const widthPct = Math.min(100, (cat.actual / targetMax) * 100)
          return (
            <div
              key={cat.id}
              className="h-full border-r border-[#000000]/10 last:border-r-0 transition-all duration-300"
              style={{ width: `${widthPct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              title={`${cat.name}: ${formatCurrency(Math.round(cat.actual / divisor), currency)}`}
            />
          )
        })}
        {isOver && (
          <div
            className="h-full bg-danger/80 transition-all duration-300"
            style={{ width: `${Math.min(100, ((totals.actual - totals.max) / totals.actual) * 100)}%` }}
            title={`Over budget by ${formatCurrency(Math.round((totals.actual - totals.max) / divisor), currency)}`}
          />
        )}
      </div>
      <div className="flex justify-end mt-1.5">
        {!isOver && totals.max > 0 ? (
          <span className="text-[11px] font-medium text-text-muted">
            {formatCurrency(Math.round(remaining / divisor), currency)} Remaining
          </span>
        ) : isOver ? (
          <span className="text-[11px] font-medium text-danger">
            {formatCurrency(Math.round((totals.actual - totals.max) / divisor), currency)} Over Budget
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          return (
            <div key={cat.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-[11px] text-text-secondary">{cat.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ category, index, currency, travelers, perPerson }) {
  const { dispatch } = useTripContext()
  const divisor = perPerson ? Math.max(travelers, 1) : 1
  const isOver = category.actual > category.max && category.max > 0

  const [editingMax, setEditingMax] = useState(false)
  const [maxDraft, setMaxDraft] = useState('')

  const handleMaxSave = () => {
    setEditingMax(false)
    const num = Number(maxDraft) || 0
    if (num * divisor !== category.max) {
      dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { max: num * divisor } } })
    }
  }

  const handleMaxKeyDown = (e) => {
    if (e.key === 'Enter') handleMaxSave()
    if (e.key === 'Escape') setEditingMax(false)
  }

  const maxAxis = Math.max(category.max || 1, category.actual || 0) * 1.1
  const actualPct = Math.min(100, ((category.actual || 0) / maxAxis) * 100)
  const barColor = CHART_COLORS[index % CHART_COLORS.length]

  return (
    <div className="animate-fade-in relative overflow-hidden group bg-[var(--color-bg-card)] border border-border rounded-[14px] transition-colors duration-200">
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[22px] leading-none bg-bg-secondary w-10 h-10 rounded-xl flex items-center justify-center border border-border/50">{category.emoji}</span>
            <EditableText
              value={category.name}
              onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { name: val } } })}
              className="font-heading text-base text-text-primary px-1"
            />
          </div>
          <div className="flex flex-col items-end">
            <p className={`font-heading text-[17px] leading-none ${isOver ? 'text-danger' : 'text-text-primary'}`}>
              {formatCurrency(Math.round((category.actual || 0) / divisor), currency)}
            </p>
            {editingMax ? (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[10px] text-text-muted">/</span>
                <input
                  autoFocus type="number" min="0" value={maxDraft}
                  onChange={e => setMaxDraft(e.target.value)}
                  onBlur={handleMaxSave} onKeyDown={handleMaxKeyDown}
                  className="w-16 px-1 py-0.5 text-[10px] font-mono rounded bg-bg-input border border-accent text-text-primary focus:outline-none"
                  placeholder="0"
                />
                <span className="text-[10px] text-text-muted">max</span>
              </div>
            ) : (
              <p
                onClick={() => { setMaxDraft(category.max ? Math.round(category.max / divisor) : ''); setEditingMax(true) }}
                className="text-[10px] text-text-muted font-medium mt-1 cursor-pointer hover:text-accent transition-colors py-0.5 px-1 -mr-1 rounded hover:bg-bg-hover"
                title="Click to edit max target"
              >
                / {category.max > 0 ? formatCurrency(Math.round(category.max / divisor), currency) : 'Set'} max
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 h-[6px] bg-bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${isOver ? 'bg-danger' : ''}`}
            style={{ width: `${actualPct}%`, backgroundColor: isOver ? undefined : barColor }}
          />
        </div>

        {isOver && (
          <p className="text-[11px] text-danger font-medium flex items-center gap-1 mt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block shrink-0" />
            Over budget by {formatCurrency(Math.round((category.actual - category.max) / divisor), currency)}
          </p>
        )}
        {!isOver && <div className="h-1" />}
      </div>

      <button
        onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: category.id })}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger hover:bg-danger/10 w-6 h-6 rounded-full flex items-center justify-center transition-all bg-bg-card border border-border z-10"
        title="Delete category"
      >
        <span className="text-[10px]">✕</span>
      </button>
    </div>
  )
}

// ── Add Category Form ─────────────────────────────────────────────────────────
function AddCategoryForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [showEmojis, setShowEmojis] = useState(false)
  const commonEmojis = ['🍽️', '🚕', '🏨', '🎟️', '🛍️', '🎁', '🍸', '✈️', '💆', '📸', '💊', '📌']

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji })
    setName(''); setEmoji('📌')
  }

  return (
    <Card className="border border-accent/30 bg-accent/5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-text-muted font-medium">New Budget Category</label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button type="button" onClick={() => setShowEmojis(!showEmojis)}
              className="w-10 h-10 rounded-xl bg-bg-card border border-border/50 flex items-center justify-center text-xl hover:bg-bg-hover transition-colors">
              {emoji}
            </button>
            {showEmojis && (
              <div className="absolute top-12 left-0 p-2 bg-bg-card border border-border rounded-xl z-20 w-[180px] grid grid-cols-4 gap-1 animate-fade-in">
                {commonEmojis.map(e => (
                  <button key={e} type="button" onClick={() => { setEmoji(e); setShowEmojis(false) }}
                    className="h-8 flex items-center justify-center text-lg hover:bg-bg-hover rounded-md transition-colors">{e}</button>
                ))}
              </div>
            )}
          </div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Category name..."
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
            autoFocus />
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>Add</Button>
        </div>
      </form>
    </Card>
  )
}

// ── Add Spending Form (with Splitwise fields) ─────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'
const labelCls = 'text-[11px] text-text-muted font-medium block mb-1'

function AddSpendingForm({ onAdd, onCancel, categories, currency, travelers }) {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState(categories[0]?.name || '')
  const [paidBy, setPaidBy] = useState(travelers[0]?.id || '')
  const [splitBetween, setSplitBetween] = useState(travelers.map(t => t.id))
  const [splitMode, setSplitMode] = useState('equal') // 'equal' | 'amount' | 'percent'
  const [customValues, setCustomValues] = useState({})

  const totalAmount = Number(amount) || 0

  const toggleMember = (id) => {
    setSplitBetween(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const previewSplits = useMemo(() => {
    if (!splitBetween.length || !totalAmount) return {}
    return buildSplits(totalAmount, splitBetween, splitMode, customValues)
  }, [totalAmount, splitBetween, splitMode, customValues])

  const splitTotal = Object.values(previewSplits).reduce((s, v) => s + v, 0)
  const splitValid = splitMode === 'equal' || Math.abs(splitTotal - totalAmount) < 1

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!desc.trim() || !totalAmount || !splitBetween.length || !splitValid) return
    const splits = buildSplits(totalAmount, splitBetween, splitMode, customValues)
    onAdd({ description: desc.trim(), amount: totalAmount, category: cat, paidBy, splitBetween, splits, splitMode })
    setDesc(''); setAmount('')
  }

  const showSplitControls = travelers.length > 1

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Description + Amount */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={labelCls}>Description</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What did you spend on?"
            className={inputCls} autoFocus />
        </div>
        <div className="w-28">
          <label className={labelCls}>Amount</label>
          <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className={inputCls} />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className={labelCls}>Category</label>
        <select value={cat} onChange={e => setCat(e.target.value)} className={inputCls}>
          {categories.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
        </select>
      </div>

      {/* Splitwise section — only shown if >1 traveler */}
      {showSplitControls && (
        <>
          {/* Paid By */}
          <div>
            <label className={labelCls}>Paid by</label>
            <select value={paidBy} onChange={e => setPaidBy(e.target.value)} className={inputCls}>
              {travelers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Split Between */}
          <div>
            <label className={labelCls}>Split between</label>
            <div className="flex flex-wrap gap-2">
              {travelers.map(t => {
                const checked = splitBetween.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleMember(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all duration-150 ${checked
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg-input border-border text-text-secondary hover:border-accent/50'
                      }`}
                  >
                    {t.avatar ? (
                      <img src={t.avatar} alt={t.name} className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-bg-secondary border border-border/50 flex items-center justify-center text-[9px]">
                        {t.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split Mode */}
          {splitBetween.length > 1 && (
            <div>
              <label className={labelCls}>Split mode</label>
              <div className="flex gap-1 bg-bg-secondary rounded-lg p-1 w-fit">
                {[['equal', 'Equal'], ['amount', 'By amount'], ['percent', 'By %']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { setSplitMode(val); setCustomValues({}) }}
                    className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${splitMode === val ? 'bg-bg-card text-text-primary shadow-sm border border-border/50' : 'text-text-muted hover:text-text-primary'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom split inputs */}
          {splitMode !== 'equal' && splitBetween.length > 0 && (
            <div className="bg-bg-secondary rounded-lg p-3 space-y-2">
              {splitBetween.map(id => {
                const traveler = travelers.find(t => t.id === id)
                return (
                  <div key={id} className="flex items-center gap-2">
                    <span className="text-[12px] text-text-secondary flex-1 truncate">{traveler?.name}</span>
                    <div className="flex items-center gap-1">
                      {splitMode === 'percent' && <span className="text-[11px] text-text-muted">%</span>}
                      <input
                        type="number" min="0"
                        value={customValues[id] || ''}
                        onChange={e => setCustomValues(prev => ({ ...prev, [id]: e.target.value }))}
                        placeholder="0"
                        className="w-20 px-2 py-1 text-[12px] bg-bg-input border border-border rounded text-text-primary focus:border-accent focus:outline-none"
                      />
                      {splitMode === 'amount' && <span className="text-[11px] text-text-muted">{currency}</span>}
                    </div>
                  </div>
                )
              })}
              {/* Validation hint */}
              {totalAmount > 0 && (
                <p className={`text-[10px] mt-1 ${splitValid ? 'text-text-muted' : 'text-danger'}`}>
                  {splitMode === 'amount'
                    ? `Total: ${formatCurrency(splitTotal, currency)} / ${formatCurrency(totalAmount, currency)}${!splitValid ? ' — must match' : ''}`
                    : `Total: ${splitTotal.toFixed(0)}%${!splitValid ? ' — must equal 100%' : ''}`
                  }
                </p>
              )}
            </div>
          )}

          {/* Preview */}
          {totalAmount > 0 && splitBetween.length > 0 && splitValid && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(previewSplits).map(([id, share]) => {
                const t = travelers.find(tr => tr.id === id)
                return (
                  <span key={id} className="px-2 py-0.5 rounded-full bg-bg-secondary border border-border/50 text-[10px] text-text-secondary">
                    {t?.name}: {formatCurrency(share, currency)}
                  </span>
                )
              })}
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm" disabled={!desc.trim() || !totalAmount || !splitBetween.length || !splitValid}>
          Log Expense
        </Button>
      </div>
    </form>
  )
}

// ── Balances Panel ────────────────────────────────────────────────────────────
function BalancesPanel({ spendingLog, travelers, currency }) {
  const balances = useMemo(() => calculateBalances(spendingLog, travelers), [spendingLog, travelers])
  const transactions = useMemo(() => simplifyDebts(balances), [balances])

  const hasData = spendingLog.some(e => e.paidBy && e.splits)
  if (!hasData || travelers.length < 2) return null

  return (
    <Card className="border border-border/50 mt-0">
      <div className="flex items-baseline justify-between mb-4 border-b border-border/50 pb-3">
        <h3 className="font-heading text-base text-text-primary">Balances</h3>
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Who owes what</span>
      </div>

      {/* Net balances per person */}
      <div className="space-y-3 mb-5">
        {travelers.map(t => {
          const bal = balances[t.id] || 0
          const isPositive = bal > 0.01
          const isNegative = bal < -0.01
          return (
            <div key={t.id} className="flex items-center gap-3">
              {t.avatar ? (
                <img src={t.avatar} alt={t.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[11px] font-medium text-text-secondary shrink-0">
                  {t.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-text-primary">{t.name}</span>
                  <span className={`text-[13px] font-mono font-semibold ${isPositive ? 'text-green-500' : isNegative ? 'text-danger' : 'text-text-muted'}`}>
                    {isPositive ? '+' : ''}{formatCurrency(Math.round(bal), currency)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-green-500' : isNegative ? 'bg-danger' : 'bg-border'}`}
                    style={{
                      width: `${Math.min(100, (Math.abs(bal) / Math.max(...Object.values(balances).map(Math.abs), 1)) * 100)}%`,
                      marginLeft: isNegative ? 'auto' : undefined
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Simplified settlements */}
      {transactions.length > 0 && (
        <>
          <div className="border-t border-border/50 pt-3 mb-2">
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium mb-3">Settle up</p>
            <div className="space-y-2">
              {transactions.map((tx, i) => {
                const from = travelers.find(t => t.id === tx.from)
                const to = travelers.find(t => t.id === tx.to)
                return (
                  <div key={i} className="flex items-center gap-2 py-2 px-3 bg-bg-secondary rounded-lg border border-border/40">
                    <span className="text-[12px] font-medium text-text-primary">{from?.name}</span>
                    <span className="text-[10px] text-text-muted">→</span>
                    <span className="text-[12px] font-medium text-text-primary">{to?.name}</span>
                    <span className="ml-auto text-[12px] font-mono font-semibold text-text-primary">
                      {formatCurrency(Math.round(tx.amount), currency)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {transactions.length === 0 && (
        <p className="text-[12px] text-text-muted text-center py-2">All settled up ✓</p>
      )}
    </Card>
  )
}

// ── Per-Person Spend Chart ────────────────────────────────────────────────────
function PersonSpendChart({ spendingLog, travelers, currency }) {
  const hasData = travelers.length > 1 && spendingLog.some(e => e.splits)
  if (!hasData) return null

  // Total each person has paid out
  const spent = useMemo(() => {
    const totals = {}
    travelers.forEach(t => { totals[t.id] = 0 })
    spendingLog.forEach(e => {
      if (e.paidBy && totals[e.paidBy] !== undefined) {
        totals[e.paidBy] += e.amount || 0
      }
    })
    return totals
  }, [spendingLog, travelers])

  const maxSpent = Math.max(...Object.values(spent), 1)

  return (
    <Card className="border border-border/50">
      <div className="flex items-baseline justify-between mb-4 border-b border-border/50 pb-3">
        <h3 className="font-heading text-base text-text-primary">Paid by</h3>
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Fronted costs</span>
      </div>
      <div className="space-y-3">
        {travelers.map((t, i) => {
          const amount = spent[t.id] || 0
          const pct = (amount / maxSpent) * 100
          return (
            <div key={t.id} className="flex items-center gap-3">
              {t.avatar ? (
                <img src={t.avatar} alt={t.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-bg-secondary border border-border flex items-center justify-center text-[11px] font-medium text-text-secondary shrink-0">
                  {t.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="text-[12px] font-medium text-text-primary">{t.name}</span>
                  <span className="text-[12px] font-mono text-text-secondary">{formatCurrency(Math.round(amount), currency)}</span>
                </div>
                <div className="h-[6px] bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Main BudgetTab ────────────────────────────────────────────────────────────
export default function BudgetTab() {
  const { activeTrip, dispatch } = useTripContext()
  const { currentUserProfile } = useProfiles()

  const [perPerson, setPerPerson] = useState(false)
  const [addingSpend, setAddingSpend] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [search, setSearch] = useState('')

  if (!activeTrip) return null
  const trip = activeTrip
  const budget = trip.budget || []
  const currency = trip.currency || 'PHP'

  // Build traveler list from travelersSnapshot — used for Splitwise UI
  const travelers = useMemo(() => {
    const snapshot = trip.travelersSnapshot || []
    if (!snapshot.length) {
      // Fallback: just the current user
      return currentUserProfile ? [{ id: currentUserProfile.uid || 'me', name: currentUserProfile.name || 'You', avatar: currentUserProfile.customPhoto || currentUserProfile.photo || null }] : []
    }
    return snapshot.map(s => ({
      id: s.id,
      name: s.name || s.displayName || 'Traveler',
      avatar: s.avatar || s.photoURL || null,
    }))
  }, [trip.travelersSnapshot, currentUserProfile])

  const totals = useMemo(() => ({
    min: budget.reduce((s, b) => s + (b.min || 0), 0),
    max: budget.reduce((s, b) => s + (b.max || 0), 0),
    actual: budget.reduce((s, b) => s + (b.actual || 0), 0),
  }), [budget])

  const divisor = perPerson ? Math.max(trip.travelers, 1) : 1

  // Filtered spending log
  const filteredLog = useMemo(() => {
    const log = trip.spendingLog || []
    if (!search.trim()) return log
    const q = search.toLowerCase()
    return log.filter(e =>
      e.description?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    )
  }, [trip.spendingLog, search])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Level Summary Card */}
      <Card className="border border-border/60 relative overflow-hidden">
        <div className="flex items-center justify-between mb-8 pl-1">
          <h2 className="font-heading text-lg text-text-primary flex items-center gap-2">
            <span className="text-xl">💰</span> Overall Budget
          </h2>
          <button
            onClick={() => setPerPerson(!perPerson)}
            className={`px-4 py-1.5 text-[11px] font-medium rounded-full border transition-all duration-200 uppercase tracking-widest
              ${perPerson ? 'bg-accent text-white border-accent' : 'border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
          >
            {perPerson ? 'Per Person' : 'Total'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5 text-center mb-2 pl-1">
          <div className="relative">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1.5">Target Budget</p>
            <p className="font-heading text-2xl sm:text-3xl text-text-secondary tracking-tight">{formatCurrency(Math.round(totals.max / divisor), currency)}</p>
            <div className="absolute right-0 top-2 bottom-2 w-px bg-border/50 hidden sm:block" />
          </div>
          <div>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1.5">Spent</p>
            <p className={`font-heading text-2xl sm:text-3xl tracking-tight ${totals.actual > totals.max && totals.max > 0 ? 'text-danger' : 'text-text-primary'}`}>
              {formatCurrency(Math.round(totals.actual / divisor), currency)}
            </p>
          </div>
        </div>

        <div className="pl-1">
          <BudgetSummaryBar budget={budget} totals={totals} currency={currency} divisor={divisor} />
        </div>
      </Card>

      {/* 2-Column Layout */}
      <div className="grid sm:grid-cols-3 gap-6 items-start">

        {/* Left Col — Category Cards */}
        <div className="sm:col-span-2 space-y-5">
          {budget.map((cat, i) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              index={i}
              currency={currency}
              travelers={trip.travelers}
              perPerson={perPerson}
            />
          ))}

          {addingCategory ? (
            <AddCategoryForm
              onAdd={data => { dispatch({ type: ACTIONS.ADD_BUDGET_CATEGORY, payload: data }); setAddingCategory(false) }}
              onCancel={() => setAddingCategory(false)}
            />
          ) : (
            <Button variant="ghost" size="lg" className="w-full" onClick={() => setAddingCategory(true)}>
              + Add budget category
            </Button>
          )}
        </div>

        {/* Right Col — Spending Log + Balances */}
        <div className="sm:col-span-1 sm:sticky sm:top-[88px] space-y-4">

          {/* Spending Log Card */}
          <Card className="border border-border/50">
            <div className="flex justify-between items-baseline mb-4 border-b border-border/50 pb-3">
              <h3 className="font-heading text-base text-text-primary">Spending Log</h3>
              <button
                onClick={() => setAddingSpend(!addingSpend)}
                className="text-[11px] font-bold text-accent hover:text-accent-hover tracking-wide uppercase"
              >
                {addingSpend ? 'Cancel' : '+ Log expense'}
              </button>
            </div>

            {addingSpend && (
              <div className="mb-5 bg-bg-secondary p-3 rounded-xl border border-border/50">
                <AddSpendingForm
                  categories={budget}
                  currency={currency}
                  travelers={travelers}
                  onAdd={data => { dispatch({ type: ACTIONS.ADD_SPENDING, payload: data }); setAddingSpend(false) }}
                  onCancel={() => setAddingSpend(false)}
                />
              </div>
            )}

            {/* Search */}
            {(trip.spendingLog?.length > 0) && (
              <div className="mb-3">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search expenses..."
                  className="w-full px-3 py-2 text-sm bg-bg-secondary border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
                />
              </div>
            )}

            {filteredLog.length > 0 ? (
              <div className="space-y-1">
                {filteredLog.map(entry => {
                  const catIndex = budget.findIndex(c => c.name === entry.category)
                  const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'
                  const paidByTraveler = travelers.find(t => t.id === entry.paidBy)

                  return (
                    <div key={entry.id} className="flex gap-3 py-2.5 px-1.5 rounded-lg hover:bg-bg-hover group transition-colors">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center border border-border/50 text-[13px]">
                        {budget.find(c => c.name === entry.category)?.emoji || '💸'}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-text-primary truncate">{entry.description}</p>
                          <p className="text-[13px] font-mono font-medium text-text-primary whitespace-nowrap">
                            {formatCurrency(entry.amount, currency)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: dotColor }} />
                            {entry.category}
                            {paidByTraveler && (
                              <span className="normal-case tracking-normal font-normal text-text-muted/70">· paid by {paidByTraveler.name}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-text-muted/70 tabular-nums">{entry.date}</p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => dispatch({ type: ACTIONS.DELETE_SPENDING, payload: entry.id })}
                          className="w-5 h-5 flex items-center justify-center rounded-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Delete expense"
                        >
                          <span className="text-[10px]">✕</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-text-muted">
                {search ? (
                  <>
                    <p className="text-xl mb-2 opacity-50">🔍</p>
                    <p className="text-xs">No expenses match "{search}"</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl mb-2 opacity-50">💸</p>
                    <p className="text-xs">No expenses logged yet</p>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* Per-person spend chart */}
          <PersonSpendChart spendingLog={trip.spendingLog || []} travelers={travelers} currency={currency} />

          {/* Balances + settle-up */}
          <BalancesPanel spendingLog={trip.spendingLog || []} travelers={travelers} currency={currency} />

        </div>
      </div>
    </div>
  )
}
