import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { formatCurrency } from '../../utils/helpers'

function BudgetChart({ budget, currency }) {
  const data = budget.map(cat => ({
    name: cat.name,
    emoji: cat.emoji,
    min: cat.min || 0,
    max: cat.max || 0,
    actual: cat.actual || 0,
  }))

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-bg-secondary border border-border rounded-[var(--radius-md)] p-3">
        <p className="text-text-primary font-medium text-sm mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value, currency)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="name"
          stroke="var(--color-text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="var(--color-text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => formatCurrency(v, currency)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="min" name="Min Budget" fill="#6A9BCC" opacity={0.4} radius={[2, 2, 0, 0]} />
        <Bar dataKey="max" name="Max Budget" fill="#6A9BCC" opacity={0.7} radius={[2, 2, 0, 0]} />
        <Bar dataKey="actual" name="Actual Spent" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.actual > entry.max ? '#C15F3C' : '#D97757'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CategoryCard({ category, currency, travelers, perPerson }) {
  const { dispatch } = useTripContext()
  const divisor = perPerson ? Math.max(travelers, 1) : 1
  const isOver = category.actual > category.max && category.max > 0

  return (
    <Card className="animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{category.emoji}</span>
          <EditableText
            value={category.name}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { name: val } } })}
            className="font-medium text-text-primary text-sm"
          />
        </div>
        <button
          onClick={() => dispatch({ type: ACTIONS.DELETE_BUDGET_CATEGORY, payload: category.id })}
          className="text-xs text-text-muted hover:text-danger transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-text-muted text-xs block">Min</span>
          <EditableText
            value={category.min ? String(Math.round(category.min / divisor)) : ''}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { min: (Number(val) || 0) * divisor } } })}
            className="text-text-primary font-mono text-xs"
            placeholder="0"
          />
        </div>
        <div>
          <span className="text-text-muted text-xs block">Max</span>
          <EditableText
            value={category.max ? String(Math.round(category.max / divisor)) : ''}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { max: (Number(val) || 0) * divisor } } })}
            className="text-text-primary font-mono text-xs"
            placeholder="0"
          />
        </div>
        <div>
          <span className="text-text-muted text-xs block">Actual</span>
          <EditableText
            value={category.actual ? String(Math.round(category.actual / divisor)) : ''}
            onSave={val => dispatch({ type: ACTIONS.UPDATE_BUDGET_CATEGORY, payload: { id: category.id, updates: { actual: (Number(val) || 0) * divisor } } })}
            className={`font-mono text-xs ${isOver ? 'text-danger font-bold' : 'text-text-primary'}`}
            placeholder="0"
          />
        </div>
      </div>
      {isOver && (
        <p className="text-xs text-danger mt-2 font-medium">⚠ Over budget by {formatCurrency(category.actual - category.max, currency)}</p>
      )}
      <div className="mt-2 text-xs text-text-muted">
        Range: {formatCurrency(Math.round(category.min / divisor), currency)} – {formatCurrency(Math.round(category.max / divisor), currency)}
        {perPerson && ' per person'}
      </div>
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
        <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">Add</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary">Cancel</button>
      </form>
    </Card>
  )
}

export default function BudgetTab() {
  const { activeTrip, dispatch } = useTripContext()
  const [perPerson, setPerPerson] = useState(false)
  const [addingSpend, setAddingSpend] = useState(false)

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
      {/* Summary */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-text-primary">💰 Budget</h2>
          <button
            onClick={() => setPerPerson(!perPerson)}
            className={`px-3 py-1 text-xs rounded-[var(--radius-pill)] border transition-colors
              ${perPerson ? 'bg-accent text-white border-accent' : 'border-border text-text-muted hover:text-text-secondary'}`}
          >
            {perPerson ? 'Per Person' : 'Total'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-5 text-center">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider">Min Estimate</p>
            <p className="font-heading text-xl text-text-primary mt-1">{formatCurrency(Math.round(totals.min / divisor), currency)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider">Max Estimate</p>
            <p className="font-heading text-xl text-text-primary mt-1">{formatCurrency(Math.round(totals.max / divisor), currency)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider">Spent</p>
            <p className={`font-heading text-xl mt-1 ${totals.actual > totals.max && totals.max > 0 ? 'text-danger' : 'text-accent'}`}>
              {formatCurrency(Math.round(totals.actual / divisor), currency)}
            </p>
          </div>
        </div>
        {perPerson && <p className="text-xs text-text-muted text-center mt-2">Showing per person ({trip.travelers} travelers)</p>}
      </Card>

      {/* Chart */}
      {budget.length > 0 && (
        <Card>
          <BudgetChart budget={budget} currency={currency} />
        </Card>
      )}

      {/* Category cards */}
      <div className="grid sm:grid-cols-2 gap-5">
        {budget.map(cat => (
          <CategoryCard key={cat.id} category={cat} currency={currency} travelers={trip.travelers} perPerson={perPerson} />
        ))}
      </div>

      <button
        onClick={() => dispatch({ type: ACTIONS.ADD_BUDGET_CATEGORY, payload: { name: 'New Category', emoji: '📌' } })}
        className="text-sm text-accent hover:text-accent-hover transition-colors"
      >
        + Add budget category
      </button>

      {/* Spending Log */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-sm text-text-primary">Spending Log</h3>
          <button onClick={() => setAddingSpend(true)} className="text-xs text-accent hover:text-accent-hover">+ Log expense</button>
        </div>
        {addingSpend && (
          <div className="mb-3">
            <AddSpendingForm
              categories={budget}
              currency={currency}
              onAdd={data => { dispatch({ type: ACTIONS.ADD_SPENDING, payload: data }); setAddingSpend(false) }}
              onCancel={() => setAddingSpend(false)}
            />
          </div>
        )}
        {trip.spendingLog?.length > 0 ? (
          <div className="space-y-2">
            {trip.spendingLog.map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 group">
                <div>
                  <p className="text-sm text-text-primary">{entry.description}</p>
                  <p className="text-xs text-text-muted">{entry.date} · {entry.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-text-primary">{formatCurrency(entry.amount, currency)}</span>
                  <button
                    onClick={() => dispatch({ type: ACTIONS.DELETE_SPENDING, payload: entry.id })}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-xs transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">No expenses logged yet.</p>
        )}
      </Card>
    </div>
  )
}
