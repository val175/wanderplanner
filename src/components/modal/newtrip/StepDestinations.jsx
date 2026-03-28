import CityCombobox, { COUNTRY_FLAGS_MAP } from '../../shared/CityCombobox'

export default function StepDestinations({ form, setForm }) {
  const handleAdd = () => {
    setForm(f => ({ ...f, destinations: [...f.destinations, { city: '', country: '', flag: '' }] }))
  }

  const handleDestChange = (index, updates) => {
    setForm(f => {
      const updated = [...f.destinations]
      updated[index] = { ...updated[index], ...updates }
      return { ...f, destinations: updated }
    })
  }

  const handleCountryChange = (index, country) => {
    const flag = COUNTRY_FLAGS_MAP[country.trim()] || form.destinations[index].flag || '🌍'
    handleDestChange(index, { country, flag })
  }

  const handleRemove = (index) => {
    if (form.destinations.length <= 1) return
    setForm(f => ({ ...f, destinations: f.destinations.filter((_, i) => i !== index) }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Where are you going?</h2>
        <p className="text-sm text-text-muted font-medium">Add your destinations in order of visit.</p>
      </div>

      <div className="space-y-3">
        {form.destinations.map((dest, index) => (
          <div key={index} className="flex items-start gap-2 p-3 bg-bg-secondary border border-border rounded-[var(--radius-md)]">
            <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0 mt-2">
              {index + 1}
            </div>
            <span className="text-xl flex-shrink-0 mt-1.5 w-7 text-center">
              {dest.flag || <span className="text-text-muted text-sm">📍</span>}
            </span>
            <CityCombobox
              value={dest.city}
              country={dest.country}
              flag={dest.flag}
              onChange={updates => handleDestChange(index, updates)}
            />
            <input
              type="text"
              value={dest.country}
              onChange={e => handleCountryChange(index, e.target.value)}
              placeholder="Country"
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                         text-text-primary placeholder:text-text-muted text-sm
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
            />
            <button type="button" onClick={() => handleRemove(index)}
              disabled={form.destinations.length <= 1}
              className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-0 disabled:pointer-events-none transition-all shrink-0 mt-0.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border-strong rounded-[var(--radius-md)] text-sm text-text-muted font-medium hover:text-accent hover:border-accent/40 hover:bg-accent-muted/20 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Destination
      </button>
    </div>
  )
}
