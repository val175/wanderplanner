import { useState } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'

const COUNTRY_FLAGS = {
  'Philippines': '🇵🇭', 'Singapore': '🇸🇬', 'Thailand': '🇹🇭', 'Malaysia': '🇲🇾',
  'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Taiwan': '🇹🇼', 'Cambodia': '🇰🇭', 'India': '🇮🇳', 'China': '🇨🇳',
  'Hong Kong': '🇭🇰', 'Australia': '🇦🇺', 'New Zealand': '🇳🇿', 'USA': '🇺🇸',
  'UK': '🇬🇧', 'France': '🇫🇷', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
  'Germany': '🇩🇪', 'Netherlands': '🇳🇱', 'Greece': '🇬🇷', 'Turkey': '🇹🇷',
  'UAE': '🇦🇪', 'Mexico': '🇲🇽', 'Brazil': '🇧🇷', 'Canada': '🇨🇦',
}

function CityCard({ city }) {
  const { dispatch } = useTripContext()

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  const handleCountryChange = (val) => {
    const flag = COUNTRY_FLAGS[val.trim()] || city.flag || '🌍'
    updateCity({ country: val, flag })
  }

  return (
    <Card className="animate-fade-in-up">
      {/* City header — editable */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-4xl flex-shrink-0">{city.flag}</span>
        <div className="flex-1 min-w-0">
          <EditableText
            value={city.city}
            onSave={val => updateCity({ city: val })}
            className="font-heading text-xl text-text-primary font-bold"
            placeholder="City name"
          />
          <EditableText
            value={city.country}
            onSave={handleCountryChange}
            className="text-sm text-text-muted mt-0.5"
            placeholder="Country"
          />
        </div>
        <button
          onClick={() => dispatch({ type: ACTIONS.DELETE_CITY, payload: city.id })}
          className="text-xs text-text-muted hover:text-danger transition-colors flex-shrink-0"
          title="Remove city"
        >✕</button>
      </div>

      {/* Info sections */}
      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">✨ Highlights</h4>
          <EditableText value={city.highlights} onSave={val => updateCity({ highlights: val })}
            className="text-sm text-text-secondary" placeholder="What makes this city special?" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">🎯 Must-Do</h4>
          <EditableText value={city.mustDo} onSave={val => updateCity({ mustDo: val })}
            className="text-sm text-text-secondary" placeholder="Can't-miss activities" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">🌤️ Weather</h4>
          <EditableText value={city.weather} onSave={val => updateCity({ weather: val })}
            className="text-sm text-text-secondary" placeholder="Expected weather during your visit" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">💱 Currency Tip</h4>
          <EditableText value={city.currencyTip} onSave={val => updateCity({ currencyTip: val })}
            className="text-sm text-text-secondary" placeholder="Local currency and payment tips" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">📝 Notes</h4>
          <EditableText value={city.notes} onSave={val => updateCity({ notes: val })}
            className="text-sm text-text-secondary" placeholder="Your personal notes for this city…" multiline />
        </div>
      </div>
    </Card>
  )
}

function AddCityForm({ onAdd, onCancel }) {
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!city.trim()) return
    const flag = COUNTRY_FLAGS[country.trim()] || '🌍'
    onAdd({ city: city.trim(), country: country.trim(), flag })
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-text-muted block mb-1">City</label>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g., Bangkok"
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted"
            autoFocus />
        </div>
        <div className="flex-1 min-w-[140px]">
          <label className="text-xs text-text-muted block mb-1">Country</label>
          <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g., Thailand"
            className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted" />
        </div>
        <button type="submit" className="px-4 py-2 text-sm bg-accent text-white rounded-[var(--radius-sm)] hover:bg-accent-hover">Add</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary">Cancel</button>
      </form>
    </Card>
  )
}

export default function CitiesTab() {
  const { activeTrip, dispatch } = useTripContext()
  const [adding, setAdding] = useState(false)
  if (!activeTrip) return null

  const cities = activeTrip.cities || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-text-primary">🏙️ Cities · {cities.length} destinations</h2>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded-[var(--radius-md)] hover:bg-accent-hover transition-colors"
        >
          + Add City
        </button>
      </div>

      {adding && (
        <AddCityForm
          onAdd={data => { dispatch({ type: ACTIONS.ADD_CITY, payload: data }); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      )}

      {cities.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-6">
          {cities.map(city => (
            <CityCard key={city.id} city={city} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <p className="text-4xl mb-3">🏙️</p>
          <p className="text-text-muted">No city guides yet.</p>
          <p className="text-text-muted text-sm mt-1">Click "+ Add City" or add destinations when creating a trip.</p>
        </Card>
      )}
    </div>
  )
}
