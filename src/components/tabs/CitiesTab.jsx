import { useState } from 'react'
import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import CityCombobox, { resolveCity } from '../shared/CityCombobox'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { generateCityGuide } from '../../hooks/useAI'
import { triggerHaptic } from '../../utils/haptics'

function TopAddCityForm({ onAdd, onCancel }) {
  const [cityData, setCityData] = useState({ city: '', country: '', flag: '' })

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!cityData.city.trim()) return
    const resolved = resolveCity(cityData.city, cityData.country, cityData.flag)
    onAdd(resolved)
    setCityData({ city: '', country: '', flag: '' })
  }

  return (
    <div className="w-full sm:w-[70%] max-w-[600px] animate-fade-in bg-bg-card rounded-[var(--radius-lg)] border border-border p-1.5 flex items-center gap-2">
      <div className="flex items-center justify-center w-8 h-8 text-xl shrink-0">
        {cityData.flag || <span className="text-text-muted text-base">📍</span>}
      </div>
      <div className="flex-1 min-w-[140px]">
        <CityCombobox
          value={cityData.city}
          country={cityData.country}
          flag={cityData.flag}
          onChange={updates => setCityData(prev => ({ ...prev, ...updates }))}
          placeholder="+ Search city..."
          autoFocus
        />
      </div>
      <div className="w-[100px] sm:w-[130px] shrink-0">
        <input
          value={cityData.country}
          onChange={e => setCityData(prev => ({ ...prev, country: e.target.value }))}
          placeholder="Country"
          className="w-full px-2 py-1.5 text-[13px] bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <Button type="button" size="sm" onClick={handleSubmit} disabled={!cityData.city.trim()} className="px-4 shrink-0">
        Add
      </Button>
      <button type="button" onClick={onCancel} className="px-2 text-text-muted hover:text-text-primary transition-colors shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

function CityRow({ city }) {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  const handleWandaFill = async () => {
    triggerHaptic('medium')
    setLoading(true)
    try {
      const data = await generateCityGuide(city, activeTrip)

      const updates = {
        mustDo: `${data.description}\n\n${data.highlights.map(h => `• ${h}`).join('\n')}`,
        currencyTip: `💱 ${data.currencyCode} (${data.currencyName})`,
        flag: data.flagEmoji || city.flag,
        // Since we purged Open-Meteo, we can set a reminder to check weather
        weather: `🌤️ Check local forecast (Primary: ${data.language})`
      }

      updateCity(updates)
    } catch (e) {
      console.error(e)
      dispatch({ type: ACTIONS.SHOW_TOAST, payload: { message: "Wanda couldn't generate the guide right now.", type: 'error' } })
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    if (isReadOnly) return
    e.preventDefault()
    setDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    let parsed
    try { parsed = JSON.parse(raw) } catch { return }
    const { type, cityId } = parsed
    if (type !== 'city') return
    const cities = activeTrip.cities || []
    const fromIndex = cities.findIndex(c => c.id === cityId)
    const toIndex = cities.findIndex(c => c.id === city.id)
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      dispatch({ type: ACTIONS.REORDER_CITIES, payload: { fromIndex, toIndex } })
    }
  }

  const needsInspiration = !(city.weather || city.currencyTip || city.mustDo)

  return (
    <tr
      className={`group hover:bg-bg-hover transition-colors border-t border-border/20 ${dragOver && !isReadOnly ? 'ring-2 ring-inset ring-accent' : ''}`}
      draggable={!isReadOnly}
      onDragStart={e => {
        if (isReadOnly) return
        e.stopPropagation()
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'city', cityId: city.id }))
      }}
      onDragOver={e => {
        if (isReadOnly) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
      onDrop={handleDrop}
    >
      {!isReadOnly && (
        <td className="px-1 py-3 align-middle text-center w-6 shrink-0">
          <div className="city-drag-handle cursor-grab active:cursor-grabbing text-text-muted opacity-20 hover:opacity-100 transition-opacity select-none">
            ⠿
          </div>
        </td>
      )}
      <td className="px-2 py-3 align-middle text-center text-2xl" style={{ width: '48px' }}>
        {city.flag || '📍'}
      </td>
      <td className="px-2 py-3 align-middle" style={{ width: '22%' }}>
        <div className="flex flex-col pr-2">
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
      <td className="px-2 py-3 align-middle" style={{ width: '18%' }}>
        <EditableText
          value={city.weather}
          onSave={val => updateCity({ weather: val })}
          className="text-[13px] text-text-secondary leading-snug whitespace-pre-wrap min-h-[40px] flex items-center pr-2"
          inputClassName="w-full text-[13px]"
          placeholder="e.g. 14°C / 5°C"
          multiline
          readOnly={isReadOnly}
        />
      </td>
      <td className="px-2 py-3 align-middle" style={{ width: '18%' }}>
        {(() => {
          const isPHP = city.currencyCode === 'PHP' || city.country?.toLowerCase().includes('philippines')
          const displayValue = isPHP
            ? '💱 Uses PHP'
            : (city.currencyTip || '💱 Exchange rate unavailable')

          return (
            <EditableText
              value={city.currencyTip}
              displayValue={displayValue}
              onSave={val => updateCity({ currencyTip: val })}
              className="text-sm text-text-primary font-heading leading-snug whitespace-pre-wrap min-h-[40px] flex items-center pr-2"
              inputClassName="w-full text-sm font-heading"
              placeholder="e.g. 1 USD = 150 JPY"
              multiline
              readOnly={isReadOnly}
            />
          )
        })()}
      </td>
      <td className="px-2 py-3 align-middle" style={{ width: '28%' }}>
        <EditableText
          value={city.mustDo}
          onSave={val => updateCity({ mustDo: val })}
          className="text-[13px] text-text-secondary leading-relaxed w-full min-h-[40px] pr-2"
          inputClassName="w-full text-[13px]"
          placeholder="Neon lights, ancient temples..."
          multiline
          readOnly={isReadOnly}
        />
      </td>
      <td className="px-2 py-3 align-middle text-right" style={{ width: '110px' }}>
        {!isReadOnly && (!city.mustDo || needsInspiration) && (
          <button
            onClick={handleWandaFill}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1 px-1.5 py-1.5 rounded bg-accent/10 text-accent font-semibold hover:bg-accent/20 transition-colors text-[10px] uppercase tracking-widest disabled:opacity-50"
            title="Generate city guide with Wanda"
          >
            {loading ? '...' : '✨ Auto-fill'}
          </button>
        )}
      </td>
      {!isReadOnly && (
        <td className="px-2 py-3 align-middle text-center w-10 shrink-0">
          <button
            onClick={() => {
              triggerHaptic('medium')
              dispatch({ type: ACTIONS.DELETE_CITY, payload: city.id })
            }}
            className="text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-2"
            title="Delete City"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      )}
    </tr>
  )
}

export default function CitiesTab() {
  const { activeTrip, dispatch, isReadOnly } = useTripContext()
  const [adding, setAdding] = useState(false)
  if (!activeTrip) return null

  const cities = activeTrip.cities || []

  return (
    <div className="space-y-6 pb-24 animate-fade-in w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <h2 className="font-heading text-2xl font-semibold text-text-primary shrink-0">🏙️ Cities</h2>

        {!isReadOnly && (
          <div className="flex justify-end flex-1 w-full relative">
            {!adding ? (
              <Button size="sm" onClick={() => setAdding(true)}>
                + Add City
              </Button>
            ) : (
              <TopAddCityForm
                onAdd={data => {
                  dispatch({ type: ACTIONS.ADD_CITY, payload: data })
                  setAdding(false)
                }}
                onCancel={() => setAdding(false)}
              />
            )}
          </div>
        )}
      </div>

      <Card className="border border-border/50 p-0 overflow-hidden w-full max-w-full">
        <div className="w-full overflow-x-auto overflow-y-visible scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[850px] text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {!isReadOnly && (
                  <th className="px-1 py-2 w-6 shrink-0"></th>
                )}
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted" style={{ width: '48px' }}></th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted" style={{ width: '22%' }}>City</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted" style={{ width: '18%' }}>Weather</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted" style={{ width: '18%' }}>Currency</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted" style={{ width: '28%' }}>Vibe & Must Do</th>
                <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted text-center" style={{ width: '110px' }}>Action</th>
                {!isReadOnly && (
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted w-10 shrink-0"></th>
                )}
              </tr>
            </thead>
            <tbody>
              {cities.map(city => (
                <CityRow key={city.id} city={city} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {cities.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏙️</p>
          <p className="text-text-muted">No cities added yet.</p>
          <p className="text-text-muted text-sm mt-1">Click "+ Add City" to add a destination.</p>
        </div>
      )}
    </div>
  )
}
