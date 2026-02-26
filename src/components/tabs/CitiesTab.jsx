import { useState } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import CityCombobox, { resolveCity } from '../shared/CityCombobox'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { generateCityGuide } from '../../hooks/useAI'

function CityCard({ city }) {
  const { activeTrip, dispatch } = useTripContext()
  const [loading, setLoading] = useState(false)

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  const handleWandaFill = async () => {
    setLoading(true)
    try {
      const guideObj = await generateCityGuide(city, activeTrip)
      updateCity(guideObj)
    } catch (e) {
      console.error(e)
      dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: "Wanda couldn't generate the guide right now.", type: 'error' } })
    } finally {
      setLoading(false)
    }
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
            onSave={val => updateCity({ country: val })}
            tag="div"
            className="text-sm text-text-muted mt-1"
            placeholder="Country"
          />
        </div>
        <button
          onClick={() => dispatch({ type: ACTIONS.DELETE_CITY, payload: city.id })}
          className="text-xs text-text-muted hover:text-danger transition-colors flex-shrink-0"
          title="Remove city"
        >✕</button>
      </div>

      {/* Insights Dashboard Content */}
      {!(city.weather || city.currencyTip || city.mustDo) ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-t border-border/50 mt-4">
          <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center text-2xl mb-4">
            ✨
          </div>
          <h3 className="font-heading font-semibold text-text-primary mb-2">Need inspiration?</h3>
          <p className="text-sm text-text-muted mb-6 max-w-[280px]">
            Let Wanda generate a quick guide for weather, currency, and must-see spots in {city.city}.
          </p>
          <Button
            onClick={handleWandaFill}
            disabled={loading}
            className="shadow-sm"
          >
            {loading ? '✨ Thinking...' : '✨ Ask Wanda to auto-fill'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {/* Top Widgets: Weather & Currency */}
          <div className="grid grid-cols-2 gap-4 border-t border-b border-border/50 py-4">
            <div className="pr-4 border-r border-border/50">
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5 focus-within:text-accent transition-colors">🌤️ WEATHER</h4>
              <EditableText
                value={city.weather}
                onSave={val => updateCity({ weather: val })}
                className="text-sm font-medium text-text-primary leading-snug whitespace-pre-wrap"
                placeholder="e.g. 🌸 MARCH AVG\n14°C / 5°C"
                multiline
              />
            </div>
            <div className="pl-2">
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1.5 focus-within:text-accent transition-colors">💱 CURRENCY</h4>
              <EditableText
                value={city.currencyTip}
                onSave={val => updateCity({ currencyTip: val })}
                className="text-sm font-medium text-text-primary leading-snug whitespace-pre-wrap"
                placeholder="e.g. ¥ CURRENCY\n1 USD = 150 JPY"
                multiline
              />
            </div>
          </div>

          {/* Vibe & Must Do */}
          <div>
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5 focus-within:text-accent transition-colors">
              <span className="text-[#E27D60]">✨</span> VIBE & MUST DO
            </h4>
            <EditableText
              value={city.mustDo}
              onSave={val => updateCity({ mustDo: val })}
              className="text-sm text-text-secondary leading-relaxed"
              placeholder="Neon lights, ancient temples..."
              multiline
            />
          </div>

          {/* Saved Pins */}
          <div className="pt-2 border-t border-border/50">
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5 focus-within:text-accent transition-colors">
              <span className="text-danger">📍</span> SAVED PINS
            </h4>
            <div className="space-y-3 mb-3">
              {(city.savedPins || []).map(pin => (
                <div key={pin.id} className="group flex items-start gap-3">
                  <div className="w-8 h-8 rounded bg-bg-secondary border border-border flex items-center justify-center shrink-0 text-sm">
                    {pin.emoji || '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <EditableText
                      value={pin.name}
                      onSave={val => {
                        const updatedPins = city.savedPins.map(p => p.id === pin.id ? { ...p, name: val } : p)
                        updateCity({ savedPins: updatedPins })
                      }}
                      className="text-sm font-semibold text-text-primary block truncate"
                      placeholder="Location name..."
                    />
                    <EditableText
                      value={pin.notes}
                      onSave={val => {
                        const updatedPins = city.savedPins.map(p => p.id === pin.id ? { ...p, notes: val } : p)
                        updateCity({ savedPins: updatedPins })
                      }}
                      className="text-xs text-text-muted block mt-0.5"
                      placeholder="Why save this?"
                      multiline
                    />
                  </div>
                  <button
                    onClick={() => {
                      const updatedPins = city.savedPins.filter(p => p.id !== pin.id)
                      updateCity({ savedPins: updatedPins })
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger text-lg px-2 shrink-0 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <EditableText
              value=""
              onSave={val => {
                if (!val.trim()) return;
                import('../../utils/helpers').then(({ generateId }) => {
                  const newPin = { id: generateId(), name: val, notes: '', emoji: '📌' }
                  updateCity({ savedPins: [...(city.savedPins || []), newPin] })
                })
              }}
              className="text-sm text-text-muted hover:text-text-secondary transition-colors italic block w-full outline-none"
              placeholder="+ Drop a map link or add place"
              clearOnSave
            />
          </div>
        </div>
      )}
    </Card>
  )
}

function AddCityForm({ onAdd, onCancel }) {
  const [cityData, setCityData] = useState({ city: '', country: '', flag: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!cityData.city.trim()) return
    // Resolve to get best country + flag before adding
    const resolved = resolveCity(cityData.city, cityData.country, cityData.flag)
    onAdd(resolved)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-2 items-end">
          {/* Flag preview */}
          <div className="flex items-center justify-center w-10 h-10 text-2xl mt-auto mb-0.5">
            {cityData.flag || <span className="text-text-muted text-base">📍</span>}
          </div>

          {/* City autocomplete */}
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-text-muted block mb-1">City</label>
            <CityCombobox
              value={cityData.city}
              country={cityData.country}
              flag={cityData.flag}
              onChange={updates => setCityData(prev => ({ ...prev, ...updates }))}
              placeholder="e.g., Bangkok"
              autoFocus
            />
          </div>

          {/* Country — auto-filled by CityCombobox, still manually editable */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-text-muted block mb-1">Country</label>
            <input
              value={cityData.country}
              onChange={e => setCityData(prev => ({ ...prev, country: e.target.value }))}
              placeholder="e.g., Thailand"
              className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          </div>

          <div className="flex gap-2 items-end">
            <Button type="submit" size="md">
              Add
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
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
        <Button size="sm" onClick={() => setAdding(true)}>
          + Add City
        </Button>
      </div>

      {adding && (
        <AddCityForm
          onAdd={data => {
            dispatch({ type: ACTIONS.ADD_CITY, payload: data })
            setAdding(false)
          }}
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
