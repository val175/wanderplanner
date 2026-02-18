import Card from '../shared/Card'
import EditableText from '../shared/EditableText'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'

function CityCard({ city }) {
  const { dispatch } = useTripContext()

  const updateCity = (updates) => {
    dispatch({ type: ACTIONS.UPDATE_CITY, payload: { id: city.id, updates } })
  }

  return (
    <Card className="animate-fade-in-up">
      {/* City header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-4xl">{city.flag}</span>
        <div>
          <h3 className="font-heading text-xl text-text-primary">{city.city}</h3>
          <p className="text-sm text-text-muted">{city.country}</p>
        </div>
      </div>

      {/* Info sections */}
      <div className="space-y-5">
        {/* Highlights */}
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">✨ Highlights</h4>
          <EditableText
            value={city.highlights}
            onSave={val => updateCity({ highlights: val })}
            className="text-sm text-text-secondary"
            placeholder="What makes this city special?"
          />
        </div>

        {/* Must-Do */}
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">🎯 Must-Do</h4>
          <EditableText
            value={city.mustDo}
            onSave={val => updateCity({ mustDo: val })}
            className="text-sm text-text-secondary"
            placeholder="Can't-miss activities"
          />
        </div>

        {/* Weather */}
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">🌤️ Weather</h4>
          <EditableText
            value={city.weather}
            onSave={val => updateCity({ weather: val })}
            className="text-sm text-text-secondary"
            placeholder="Expected weather during your visit"
          />
        </div>

        {/* Currency Tip */}
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">💱 Currency Tip</h4>
          <EditableText
            value={city.currencyTip}
            onSave={val => updateCity({ currencyTip: val })}
            className="text-sm text-text-secondary"
            placeholder="Local currency and payment tips"
          />
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">📝 Notes</h4>
          <EditableText
            value={city.notes}
            onSave={val => updateCity({ notes: val })}
            className="text-sm text-text-secondary"
            placeholder="Your personal notes for this city..."
            multiline
          />
        </div>
      </div>
    </Card>
  )
}

export default function CitiesTab() {
  const { activeTrip } = useTripContext()
  if (!activeTrip) return null

  const cities = activeTrip.cities || []

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="font-heading text-lg text-text-primary">🏙️ Cities · {cities.length} destinations</h2>

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
          <p className="text-text-muted text-sm mt-1">City info is auto-created when you set up your trip destinations.</p>
        </Card>
      )}
    </div>
  )
}
