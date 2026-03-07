import { useState } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import CityCombobox, { resolveCity } from '../shared/CityCombobox'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { generateCityGuide } from '../../hooks/useAI'
import { triggerHaptic } from '../../utils/haptics'

function InlineAddRow({ onAdd }) {
  const [cityData, setCityData] = useState({ city: '', country: '', flag: '' })

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!cityData.city.trim()) return
    const resolved = resolveCity(cityData.city, cityData.country, cityData.flag)
    onAdd(resolved)
    setCityData({ city: '', country: '', flag: '' })
  }

  return (
    <tr className="border-t border-border/40 bg-accent/[0.02]">
      <td className="p-2 align-middle w-12 text-center text-2xl">
        {cityData.flag || <span className="text-text-muted text-base">📍</span>}
      </td>
      <td className="p-2 align-middle min-w-[200px]">
        <CityCombobox
          value={cityData.city}
          country={cityData.country}
          flag={cityData.flag}
          onChange={updates => setCityData(prev => ({ ...prev, ...updates }))}
          placeholder="+ Search city..."
        />
      </td>
      <td className="p-2 align-middle max-w-[150px]">
        <input
          value={cityData.country}
          onChange={e => setCityData(prev => ({ ...prev, country: e.target.value }))}
          placeholder="Country"
          className="w-full px-2 py-1.5 text-[13px] bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
        />
      </td>
      <td colSpan={100} className="p-2 align-middle text-xs text-text-muted">
        <div className="flex justify-end pr-2">
          <Button type="button" size="sm" onClick={handleSubmit} disabled={!cityData.city.trim()} className="py-1 px-3 min-h-0 text-xs">
            Add City
          </Button>
        </div>
      </td>
    </tr>
  )
}

function CityRow({ city }) {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const [loading, setLoading] = useState(false)

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  const handleWandaFill = async () => {
    triggerHaptic('medium')
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

  const needsInspiration = !(city.weather || city.currencyTip || city.mustDo)

  return (
    <tr className="group hover:bg-bg-hover transition-colors border-t border-border/20">
      <td className="px-2 py-3 align-middle w-12 text-center text-2xl">
        {city.flag || '📍'}
      </td>
      <td className="px-2 py-3 align-middle w-[250px]">
        <div className="flex flex-col">
          <EditableText
            value={city.city}
            onSave={val => updateCity({ city: val })}
            className="text-[14px] font-semibold text-text-primary truncate block w-full"
            inputClassName="w-full font-semibold"
            placeholder="City name"
            readOnly={isReadOnly}
          />
          <EditableText
            value={city.country}
            onSave={val => updateCity({ country: val })}
            className="text-xs text-text-muted truncate block w-full mt-0.5"
            inputClassName="w-full text-xs"
            placeholder="Country"
            readOnly={isReadOnly}
          />
        </div>
      </td>
      <td className="px-2 py-3 align-middle w-[160px]">
        <EditableText
          value={city.weather}
          onSave={val => updateCity({ weather: val })}
          className="text-[13px] text-text-secondary leading-snug whitespace-pre-wrap min-h-[40px] flex items-center"
          inputClassName="w-full text-[13px]"
          placeholder="e.g. 🌸 MARCH AVG\n14°C / 5°C"
          multiline
          readOnly={isReadOnly}
        />
      </td>
      <td className="px-2 py-3 align-middle w-[160px]">
        <EditableText
          value={city.currencyTip}
          onSave={val => updateCity({ currencyTip: val })}
          className="text-[13px] text-text-secondary leading-snug whitespace-pre-wrap min-h-[40px] flex items-center"
          inputClassName="w-full text-[13px]"
          placeholder="e.g. ¥ CURRENCY\n1 USD = 150 JPY"
          multiline
          readOnly={isReadOnly}
        />
      </td>
      <td className="px-2 py-3 align-middle min-w-[250px]">
        <div className="flex gap-2 items-start justify-between min-h-[40px] group/mustdo">
          <EditableText
            value={city.mustDo}
            onSave={val => updateCity({ mustDo: val })}
            className="text-[13px] text-text-secondary leading-relaxed w-full min-h-[40px]"
            inputClassName="w-full text-[13px]"
            placeholder="Neon lights, ancient temples..."
            multiline
            readOnly={isReadOnly}
          />
          {(!isReadOnly && (!city.mustDo || needsInspiration)) && (
            <button
              onClick={handleWandaFill}
              disabled={loading}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[10px] font-semibold uppercase tracking-wider"
              title="Generate city guide with Wanda"
            >
              {loading ? '...' : '✨ Auto-fill'}
            </button>
          )}
        </div>
      </td>
      {!isReadOnly && (
        <td className="px-2 py-3 align-middle w-10 text-center">
          <button
            onClick={() => {
              triggerHaptic('medium')
              dispatch({ type: ACTIONS.DELETE_CITY, payload: city.id })
            }}
            className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-2"
            title="Remove city"
          >✕</button>
        </td>
      )}
    </tr>
  )
}

export default function CitiesTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  if (!activeTrip) return null

  const cities = activeTrip.cities || []

  return (
    <div className="space-y-6 pb-24 animate-fade-in w-full">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-2xl font-bold text-text-primary">🏙️ Cities</h2>
      </div>

      <Card className="border border-border/50 p-0 overflow-hidden w-full">
        <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-12"></th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[250px]">City</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[160px]">Weather</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-[160px]">Currency</th>
                <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">Vibe & Must Do</th>
                {!isReadOnly && (
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted w-10"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {cities.map(city => (
                <CityRow key={city.id} city={city} />
              ))}
              {!isReadOnly && (
                <InlineAddRow onAdd={data => dispatch({ type: ACTIONS.ADD_CITY, payload: data })} />
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {cities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏙️</p>
          <p className="text-text-muted">No cities added yet.</p>
          <p className="text-text-muted text-sm mt-1">Search and add a destination above.</p>
        </div>
      )}
    </div>
  )
}
