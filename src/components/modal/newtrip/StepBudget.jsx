import Select, { SelectItem } from '../../shared/Select'
import Input from '../../shared/Input'
import { CURRENCIES } from '../../../constants/currencies'

export default function StepBudget({ form, setForm }) {
  const handleCategoryUpdate = (index, field, value) => {
    setForm(f => {
      const updated = [...f.budgetCategories]
      updated[index] = { ...updated[index], [field]: Number(value) || 0 }
      return { ...f, budgetCategories: updated }
    })
  }

  const totalMin = form.budgetCategories.reduce((s, c) => s + (c.min || 0), 0)
  const totalMax = form.budgetCategories.reduce((s, c) => s + (c.max || 0), 0)
  const currencyObj = CURRENCIES.find(c => c.code === form.currency)
  const symbol = currencyObj ? currencyObj.symbol : form.currency

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Set your group budget</h2>
        <p className="text-sm text-text-muted font-medium">Optional. You can always add or adjust this later.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
        <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))} size="lg">
          {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>)}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Budget Categories</label>
        <div className="space-y-2">
          {form.budgetCategories.map((cat, i) => (
            <div key={i} className="p-2.5 bg-bg-secondary border border-border rounded-[var(--radius-sm)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base w-6 text-center">{cat.emoji}</span>
                <span className="text-sm text-text-secondary font-medium">{cat.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <Input type="number" min="0" value={cat.min || ''}
                    onChange={e => handleCategoryUpdate(i, 'min', e.target.value)}
                    placeholder="Min"
                    className="pl-7 pr-2 text-right"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <Input type="number" min="0" value={cat.max || ''}
                    onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                    placeholder="Max"
                    className="pl-7 pr-2 text-right"
                  />
                </div>
                {(cat.max > 0) && (
                  <div className="col-span-2 sm:flex-1">
                    <input type="range" min="0" max={Math.max(cat.max * 2, 100000)} step="1000"
                      value={cat.max}
                      onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                      className="w-full accent-[var(--color-accent)] h-1.5 rounded-full cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(totalMin > 0 || totalMax > 0) && (
        <div className="flex justify-between items-center px-3 py-2.5 bg-accent-muted/30 rounded-[var(--radius-md)] border border-accent/10">
          <span className="text-sm font-medium text-text-secondary">Estimated Total</span>
          <span className="text-sm font-heading font-semibold text-accent">
            {symbol}{totalMin.toLocaleString()} – {symbol}{totalMax.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
