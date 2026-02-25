import { useState, useMemo } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency } from '../../utils/helpers'
import Button from '../shared/Button'

// ── Shared Colors ────────────────────────────────────────────────────────────
// Ensure consistent colors for categories across the stacked bar and bullet charts
const CHART_COLORS = [
  '#D97757', // Coral / Gifts
  '#8FB3D9', // Blue / Food
  '#82A88D', // Green / Transport
  '#E6C27A', // Yellow/Gold / Activities
  '#B88FB5', // Purple / Custom
  '#7A8B99', // Slate / Default
]

// ── Stacked Summary Bar ──────────────────────────────────────────────────────
function BudgetSummaryBar({ budget, totals, currency, divisor }) {
  if (!budget || budget.length === 0) return null

  const targetMax = totals.max || 1 // Avoid divide by zero
  const totalActual = totals.actual || 0
  const remaining = Math.max(0, totals.max - totals.actual)
  const isOver = totals.actual > totals.max && totals.max > 0

  return (
    <div className="mt-8">
      {/* The stacked bar */}
      <div className="h-6 w-full rounded-md bg-bg-input flex overflow-hidden border border-border/50">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          const widthPct = Math.min(100, (cat.actual / targetMax) * 100)
          return (
            <div
              key={cat.id}
              className="h-full border-r border-[#000000]/10 last:border-r-0 transition-all duration-300"
              style={{
                width: `${widthPct}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length]
              }}
              title={`${cat.name}: ${formatCurrency(Math.round(cat.actual / divisor), currency)}`}
            />
          )
        })}

        {/* If over budget, show a red segment for the overage */}
        {isOver && (
          <div
            className="h-full bg-danger/80 transition-all duration-300 pattern-diagonal-lines pattern-bg-danger pattern-fg-white/20"
            style={{ width: `${Math.min(100, ((totals.actual - totals.max) / totals.actual) * 100)}%` }}
            title={`Over budget by ${formatCurrency(Math.round((totals.actual - totals.max) / divisor), currency)}`}
          />
        )}
      </div>

      {/* Embedded remaining text (or overage) */}
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

      {/* Legend below the bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
        {budget.map((cat, i) => {
          if (!cat.actual || cat.actual <= 0) return null
          return (
            <div key={cat.id} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-[11px] text-text-secondary">{cat.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CategoryCard({ category, index, currency, travelers, perPerson }) {
  const { dispatch } = useTripContext()
  const divisor = perPerson ? Math.max(travelers, 1) : 1
  const isOver = category.actual > category.max && category.max > 0

  const handleAmount = (field, rawVal) => {
    const num = Number(rawVal) || 0
    dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { [field]: num * divisor } } })
  }

  // Calculate bullet chart percentages
  const maxAxis = Math.max(category.max || 1, category.actual || 0) * 1.1 // Add 10% headroom
  const minPct = Math.min(100, ((category.min || 0) / maxAxis) * 100)
  const maxPct = Math.min(100, ((category.max || 0) / maxAxis) * 100)
  const actualPct = Math.min(100, ((category.actual || 0) / maxAxis) * 100)

  const barColor = CHART_COLORS[index % CHART_COLORS.length]

  return (
    <Card className="animate-fade-in relative overflow-hidden group">
      {/* Header */}
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
          {category.max > 0 && (
            <p className="text-[10px] text-text-muted font-medium mt-1">
              / {formatCurrency(Math.round(category.max / divisor), currency)} max
            </p>
          )}
        </div>
      </div>

      {/* Delete button (absolute positioned, shows on hover) */}
      <button
        onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: category.id })}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger hover:bg-danger/10 w-6 h-6 rounded-full flex items-center justify-center transition-all bg-bg-card border border-border z-10"
        title="Delete category"
      >
        <span className="text-[10px]">✕</span>
      </button>

      {/* Bullet Chart */}
      <div className="mt-5 mb-4 relative h-[6px] bg-bg-input rounded-full overflow-hidden">
        {/* Min-Max Target Range Shading */}
        {category.max > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-border/40"
            style={{
              left: `${minPct}%`,
              width: `${Math.max(0, maxPct - minPct)}%`
            }}
          />
        )}

        {/* Actual Progress Bar */}
        <div
          className={`absolute top-0 bottom-0 rounded-full transition-all duration-300 ${isOver ? 'bg-danger' : ''}`}
          style={{
            left: '0%',
            width: `${actualPct}%`,
            backgroundColor: isOver ? undefined : barColor
          }}
        />

        {/* Target Minimum Marker */}
        {category.min > 0 && (
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-text-primary/30 z-10"
            style={{ left: `${minPct}%` }}
          />
        )}
      </div>

      <div className="mt-1 grid grid-cols-3 gap-3">
        {[{ field: 'min', label: 'Min target' }, { field: 'max', label: 'Max target' }, { field: 'actual', label: 'Spent' }].map(({ field, label }) => {
          const storedVal = category[field] || 0
          const displayVal = storedVal ? Math.round(storedVal / divisor) : ''
          const isActualOver = field === 'actual' && isOver
          return (
            <div key={field}>
              <label className="text-text-muted text-[10px] font-semibold uppercase tracking-wide block mb-1">{label}</label>
              <input
                type="number"
                min="0"
                defaultValue={displayVal || ''}
                key={`${category.id}-${field}-${divisor}`}
                onBlur={e => handleAmount(field, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                placeholder="0"
                className={`w-full px-2 py-1.5 text-sm font-mono rounded-[var(--radius-sm)] border
                  bg-bg-input text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:border-accent transition-colors
                  ${isActualOver
                    ? 'border-danger/40 text-danger font-bold'
                    : 'border-border hover:border-border-strong'
                  }`}
              />
            </div>
          )
        })}
      </div>

      {isOver && (
        <p className="text-[11px] text-danger mt-3 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block shrink-0" />
          Over budget by {formatCurrency(Math.round((category.actual - category.max) / divisor), currency)}
        </p>
      )}
      {!isOver && category.min > 0 && (
        <p className="text-[10px] text-text-muted mt-3 font-medium">
          Target Minimum: {formatCurrency(Math.round(category.min / divisor), currency)}
        </p>
      )}
    </Card>
  )
}

function AddCategoryForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [showEmojis, setShowEmojis] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji })
    setName('')
    setEmoji('📌')
  }

  const commonEmojis = ['🍽️', '🚕', '🏨', '🎟️', '🛍️', '🎁', '🍸', '✈️', '💆', '📸', '💊', '📌']

  return (
    <Card className="border border-accent/30 bg-accent/5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-text-muted font-medium">New Budget Category</label>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojis(!showEmojis)}
              className="w-10 h-10 rounded-xl bg-bg-card border border-border/50 flex items-center justify-center text-xl hover:bg-bg-hover transition-colors"
              title="Pick an emoji"
            >
              {emoji}
            </button>
            {showEmojis && (
              <div className="absolute top-12 left-0 p-2 bg-bg-card border border-border rounded-xl z-20 w-[180px] grid grid-cols-4 gap-1 animate-fade-in">
                {commonEmojis.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEmoji(e); setShowEmojis(false) }}
                    className="h-8 flex items-center justify-center text-lg hover:bg-bg-hover rounded-md transition-colors"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Category name..."
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
            autoFocus
          />
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!name.trim()}>Add</Button>
        </div>
      </form>
    </Card>
  )
}

function AddSpendingForm({ onAdd, onCancel, categories, currency }) {
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState(categories[0]?.name || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!desc.trim() || !amount) return
    onAdd({ description: desc.trim(), amount: Number(amount), category: cat })
    setDesc('')
    setAmount('')
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-text-muted block mb-1">Description</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What did you spend on?"
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted" autoFocus />
        </div>
        <div className="w-28">
          <label className="text-xs text-text-muted block mb-1">Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary" />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Category</label>
          <select value={cat} onChange={e => setCat(e.target.value)}
            className="px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary">
            {categories.map(c => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-2 w-full justify-end">
          <Button type="submit" size="md">Add</Button>
          <Button type="button" variant="ghost" size="md" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  )
}

export default function BudgetTab() {
  const { activeTrip, dispatch } = useTripContext()
  const [perPerson, setPerPerson] = useState(false)
  const [addingSpend, setAddingSpend] = useState(false)

  const [addingCategory, setAddingCategory] = useState(false)

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
              ${perPerson
                ? 'bg-accent text-white border-accent'
                : 'border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover'}`}
          >
            {perPerson ? 'Per Person' : 'Total'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-5 text-center mb-2 pl-1">
          <div className="relative">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1.5">Min Estimate</p>
            <p className="font-heading text-2xl sm:text-3xl text-text-secondary tracking-tight">{formatCurrency(Math.round(totals.min / divisor), currency)}</p>
            <div className="absolute right-0 top-2 bottom-2 w-px bg-border/50 hidden sm:block" />
          </div>
          <div className="relative">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest mb-1.5">Max Estimate</p>
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

        {/* Stacked Horizon Bar */}
        <div className="pl-1">
          <BudgetSummaryBar budget={budget} totals={totals} currency={currency} divisor={divisor} />
        </div>
      </Card>

      {/* 2-Column Desktop Grid Layout */}
      <div className="grid sm:grid-cols-3 gap-6 items-start">

        {/* Left Col (Categories) - Spans 2 cols on desktop */}
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
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => setAddingCategory(true)}
            >
              + Add budget category
            </Button>
          )}
        </div>

        {/* Right Col (Spending Log) - Spans 1 col, sticky */}
        <div className="sm:col-span-1 sm:sticky sm:top-[88px]">
          <Card className="border border-border/50">
            <div className="flex justify-between items-baseline mb-5 border-b border-border/50 pb-3">
              <h3 className="font-heading text-base text-text-primary">Spending Log</h3>
              <button onClick={() => setAddingSpend(!addingSpend)} className="text-[11px] font-bold text-accent hover:text-accent-hover tracking-wide uppercase">
                {addingSpend ? 'Cancel' : '+ Log expense'}
              </button>
            </div>

            {addingSpend && (
              <div className="mb-6 bg-bg-secondary p-3 rounded-lg border border-border/50">
                <AddSpendingForm
                  categories={budget}
                  currency={currency}
                  onAdd={data => { dispatch({ type: ACTIONS.ADD_SPENDING, payload: data }); setAddingSpend(false) }}
                  onCancel={() => setAddingSpend(false)}
                />
              </div>
            )}

            {trip.spendingLog?.length > 0 ? (
              <div className="space-y-1">
                {trip.spendingLog.map(entry => {
                  // Find category to map the color
                  const catIndex = budget.findIndex(c => c.name === entry.category)
                  const dotColor = catIndex >= 0 ? CHART_COLORS[catIndex % CHART_COLORS.length] : 'var(--color-border)'

                  return (
                    <div key={entry.id} className="flex gap-3 py-2.5 px-1.5 rounded-lg hover:bg-bg-hover group transition-colors">
                      {/* Icon/Color Dot */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center border border-border/50 relative overflow-hidden text-[13px]">
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
                          </p>
                          <p className="text-[10px] text-text-muted/70 tabular-nums">
                            {entry.date}
                          </p>
                        </div>
                      </div>

                      {/* Delete Action */}
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
                <p className="text-xl mb-2 opacity-50">💸</p>
                <p className="text-xs">No expenses logged yet</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
