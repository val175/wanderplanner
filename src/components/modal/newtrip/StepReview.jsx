import { useProfiles } from '../../../context/ProfileContext'
import DatePicker from '../../shared/DatePicker'
import AvatarCircle from '../../shared/AvatarCircle'
import { CURRENCIES } from '../../../constants/currencies'

export default function StepReview({ form, setForm }) {
  const { profiles } = useProfiles()
  const currencyObj = CURRENCIES.find(c => c.code === form.currency)
  const symbol = currencyObj ? currencyObj.symbol : form.currency

  const selectedBudget = form.budgetCategories.filter(c => c.selected !== false)
  const totalMin = selectedBudget.reduce((s, c) => s + (c.min || 0), 0)
  const totalMax = selectedBudget.reduce((s, c) => s + (c.max || 0), 0)

  const selectedProfiles = profiles.filter(p => (form.travelerIds || []).includes(p.id))

  const toggleItem = (listKey, idx) => {
    setForm(f => {
      const arr = [...(f[listKey] || [])]
      arr[idx] = { ...arr[idx], selected: arr[idx].selected === false ? true : false }
      return { ...f, [listKey]: arr }
    })
  }

  const todosByCategory = (form.todos || []).reduce((acc, todo, idx) => {
    if (!todo.text) return acc
    const cat = todo.category || 'Tasks'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...todo, originalIndex: idx })
    return acc
  }, {})

  const packingBySection = (form.packingList || []).reduce((acc, item, idx) => {
    if (!item.name) return acc
    const sec = item.section || 'Misc'
    if (!acc[sec]) acc[sec] = []
    acc[sec].push({ ...item, originalIndex: idx })
    return acc
  }, {})

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Review your itinerary</h2>
        <p className="text-sm text-text-muted font-medium">Uncheck anything you don't want to include in the trip.</p>
      </div>

      <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)]">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{form.emoji}</span>
            <div>
              <h3 className="font-heading text-lg font-semibold text-text-primary">{form.name || 'Untitled Trip'}</h3>
              {selectedProfiles.length > 0 ? (
                <div className="flex items-center gap-1.5 mt-1">
                  {selectedProfiles.map(p => <AvatarCircle key={p.id} profile={p} size={22} ring />)}
                  <span className="text-xs text-text-muted ml-1">{selectedProfiles.map(p => p.name).join(', ')}</span>
                </div>
              ) : (
                <p className="text-sm text-text-muted">{form.travelers} {form.travelers === 1 ? 'wanderer' : 'wanderers'}</p>
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-5">
          {/* Dates */}
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1.5">Dates</p>
            <div className="flex items-center gap-3">
              <DatePicker
                value={form.startDate}
                onChange={val => setForm(f => ({ ...f, startDate: val }))}
                placeholder="Start Date"
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-md)] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />
              <span className="text-text-muted text-sm px-1">to</span>
              <DatePicker
                value={form.endDate}
                onChange={val => setForm(f => ({ ...f, endDate: val }))}
                min={form.startDate || undefined}
                placeholder="End Date"
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-md)] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
          </div>

          {/* Destinations */}
          {form.destinations.some(d => d.city.trim()) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Destinations</p>
              <div className="space-y-1.5">
                {form.destinations.map((d, i) => d.city.trim() ? (
                  <label key={i} className="flex items-center gap-2.5 p-2 rounded-[var(--radius-sm)] hover:bg-bg-hover cursor-pointer transition-colors border border-transparent hover:border-border">
                    <input type="checkbox" className="w-4 h-4 text-accent bg-bg-input border-border rounded focus:ring-accent focus:ring-2"
                      checked={d.selected !== false} onChange={() => toggleItem('destinations', i)} />
                    <span className={`text-sm ${d.selected === false ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {d.flag || '📍'} {d.city}{d.country ? `, ${d.country}` : ''}
                    </span>
                  </label>
                ) : null)}
              </div>
            </div>
          )}

          {/* Todos */}
          {Object.keys(todosByCategory).length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Activities & Tasks</p>
              <div className="space-y-3">
                {Object.entries(todosByCategory).map(([cat, tasks]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-text-secondary mb-1">{cat}</p>
                    <div className="space-y-1.5 pl-1.5 border-l-2 border-border/50">
                      {tasks.map(t => (
                        <label key={t.originalIndex} className="flex items-start gap-2.5 p-1.5 rounded-[var(--radius-sm)] hover:bg-bg-hover cursor-pointer transition-colors">
                          <input type="checkbox" className="w-4 h-4 mt-0.5 text-accent bg-bg-input border-border rounded focus:ring-accent focus:ring-2 shrink-0"
                            checked={t.selected !== false} onChange={() => toggleItem('todos', t.originalIndex)} />
                          <span className={`text-sm leading-snug ${t.selected === false ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                            {t.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget */}
          {(form.budgetCategories || []).some(c => c.min > 0 || c.max > 0) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Budget Estimates</p>
              <div className="space-y-1.5">
                {form.budgetCategories.map((c, i) => (c.min > 0 || c.max > 0) ? (
                  <label key={i} className="flex items-center justify-between gap-2.5 p-2 rounded-[var(--radius-sm)] hover:bg-bg-hover cursor-pointer transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center gap-2.5">
                      <input type="checkbox" className="w-4 h-4 text-accent bg-bg-input border-border rounded focus:ring-accent focus:ring-2"
                        checked={c.selected !== false} onChange={() => toggleItem('budgetCategories', i)} />
                      <span className={`text-sm ${c.selected === false ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {c.emoji} {c.name}
                      </span>
                    </div>
                    <span className={`text-sm font-medium ${c.selected === false ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                      {symbol}{(c.min || 0).toLocaleString()} – {symbol}{(c.max || 0).toLocaleString()}
                    </span>
                  </label>
                ) : null)}
              </div>
              <div className="mt-3 flex justify-between items-center pt-3 border-t border-border">
                <span className="text-sm font-medium text-text-secondary">Selected Total</span>
                <span className="text-sm font-heading font-semibold text-accent">
                  {symbol}{totalMin.toLocaleString()} – {symbol}{totalMax.toLocaleString()} {form.currency}
                </span>
              </div>
            </div>
          )}

          {/* Itinerary preview */}
          {(form.itinerary || []).length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">
                Itinerary <span className="normal-case font-normal">({form.itinerary.length} day{form.itinerary.length !== 1 ? 's' : ''} imported)</span>
              </p>
              <div className="space-y-2">
                {form.itinerary.map((day, i) => (
                  <div key={i} className="p-2.5 rounded-[var(--radius-md)] bg-bg-hover border border-border/60">
                    <p className="text-xs font-semibold text-text-primary mb-1">
                      Day {day.dayNumber ?? i + 1}{day.date ? ` · ${day.date}` : ''}{day.location ? ` — ${day.location}` : ''}
                    </p>
                    {(day.activities || []).length > 0 && (
                      <div className="space-y-0.5 pl-1.5 border-l-2 border-accent/30">
                        {day.activities.map((a, j) => (
                          <p key={j} className="text-xs text-text-secondary leading-snug">
                            {a.time ? <span className="text-text-muted mr-1.5">{a.time}</span> : null}
                            {a.emoji ? <span className="mr-1">{a.emoji}</span> : null}
                            {a.name}
                            {a.estCost ? <span className="text-text-muted ml-1.5">· {a.estCost}</span> : null}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Packing List */}
          {Object.keys(packingBySection).length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-2">Packing List</p>
              <div className="space-y-3">
                {Object.entries(packingBySection).map(([section, items]) => (
                  <div key={section}>
                    <p className="text-xs font-semibold text-text-secondary mb-1">{section}</p>
                    <div className="space-y-1.5 pl-1.5 border-l-2 border-border/50">
                      {items.map(item => (
                        <label key={item.originalIndex} className="flex items-center gap-2.5 p-1.5 rounded-[var(--radius-sm)] hover:bg-bg-hover cursor-pointer transition-colors">
                          <input type="checkbox" className="w-4 h-4 text-accent bg-bg-input border-border rounded focus:ring-accent focus:ring-2 shrink-0"
                            checked={item.selected !== false} onChange={() => toggleItem('packingList', item.originalIndex)} />
                          <span className={`text-sm ${item.selected === false ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                            {item.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
