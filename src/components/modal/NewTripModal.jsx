import { useState, useMemo } from 'react'
import Modal from '../shared/Modal'
import { useTripContext } from '../../context/TripContext'
import { ACTIONS } from '../../state/tripReducer'
import { TRIP_EMOJIS } from '../../constants/emojis'
import { CURRENCIES } from '../../constants/currencies'
import { createEmptyTrip } from '../../data/defaultTrip'
import { formatDate } from '../../utils/helpers'

const TOTAL_STEPS = 4

const DEFAULT_BUDGET_CATEGORIES = [
  { name: 'Flights', emoji: '✈️' },
  { name: 'Accommodation', emoji: '🏨' },
  { name: 'Food & Dining', emoji: '🍜' },
  { name: 'Activities', emoji: '🎯' },
  { name: 'Transport', emoji: '🚕' },
  { name: 'Shopping', emoji: '🛍️' },
  { name: 'Other', emoji: '📌' },
]

/* ─────────────────── Step Indicator ─────────────────── */

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isCompleted = step < currentStep
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-[2px] rounded-full transition-colors duration-300 ${
                  isCompleted ? 'bg-accent' : 'bg-border'
                }`}
              />
            )}
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                transition-all duration-300
                ${isActive
                  ? 'bg-accent text-text-inverse ring-4 ring-accent/20'
                  : isCompleted
                  ? 'bg-accent text-text-inverse'
                  : 'bg-bg-secondary text-text-muted border border-border'
                }
              `}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────── Step 1: Basics ─────────────────── */

function StepBasics({ form, setForm }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Name your adventure</h2>
        <p className="text-sm text-text-muted">What should we call this trip?</p>
      </div>

      {/* Trip Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Summer in Europe"
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                     transition-colors"
          autoFocus
        />
      </div>

      {/* Emoji Picker */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Emoji</label>
        <div className="grid grid-cols-10 gap-1.5">
          {TRIP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setForm(f => ({ ...f, emoji }))}
              className={`
                w-9 h-9 flex items-center justify-center text-lg rounded-[var(--radius-sm)]
                transition-all duration-150
                ${form.emoji === emoji
                  ? 'bg-accent/15 ring-2 ring-accent scale-110'
                  : 'bg-bg-secondary hover:bg-bg-hover'
                }
              `}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Travelers */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Travelers</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, travelers: Math.max(1, f.travelers - 1) }))}
            disabled={form.travelers <= 1}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)]
                       bg-bg-secondary border border-border text-text-secondary
                       hover:bg-bg-hover hover:border-border-strong
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors text-lg font-medium"
          >
            -
          </button>
          <span className="w-10 text-center text-lg font-heading font-bold text-text-primary">
            {form.travelers}
          </span>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, travelers: Math.min(10, f.travelers + 1) }))}
            disabled={form.travelers >= 10}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)]
                       bg-bg-secondary border border-border text-text-secondary
                       hover:bg-bg-hover hover:border-border-strong
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-colors text-lg font-medium"
          >
            +
          </button>
          <span className="text-sm text-text-muted">
            {form.travelers === 1 ? 'traveler' : 'travelers'}
          </span>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Start Date</label>
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                       text-text-primary
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                       transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">End Date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
            min={form.startDate || undefined}
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                       text-text-primary
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                       transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Step 2: Destinations ─────────────────── */

function StepDestinations({ form, setForm }) {
  const handleAdd = () => {
    setForm(f => ({
      ...f,
      destinations: [...f.destinations, { city: '', country: '', flag: '' }],
    }))
  }

  const handleUpdate = (index, field, value) => {
    setForm(f => {
      const updated = [...f.destinations]
      updated[index] = { ...updated[index], [field]: value }
      return { ...f, destinations: updated }
    })
  }

  const handleRemove = (index) => {
    if (form.destinations.length <= 1) return
    setForm(f => ({
      ...f,
      destinations: f.destinations.filter((_, i) => i !== index),
    }))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Where are you going?</h2>
        <p className="text-sm text-text-muted">Add your destinations in order of visit.</p>
      </div>

      <div className="space-y-3">
        {form.destinations.map((dest, index) => (
          <div
            key={index}
            className="flex items-start gap-3 p-3 bg-bg-secondary border border-border rounded-[var(--radius-md)] group"
          >
            {/* Destination number */}
            <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5">
              {index + 1}
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3">
              <input
                type="text"
                value={dest.city}
                onChange={e => handleUpdate(index, 'city', e.target.value)}
                placeholder="City"
                className="px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                           text-text-primary placeholder:text-text-muted text-sm
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                           transition-colors"
              />
              <input
                type="text"
                value={dest.country}
                onChange={e => handleUpdate(index, 'country', e.target.value)}
                placeholder="Country"
                className="px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                           text-text-primary placeholder:text-text-muted text-sm
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                           transition-colors"
              />
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemove(index)}
              disabled={form.destinations.length <= 1}
              className="p-1.5 rounded-[var(--radius-sm)] text-text-muted
                         hover:text-danger hover:bg-danger/10
                         disabled:opacity-0 disabled:pointer-events-none
                         transition-all shrink-0 mt-0.5"
              aria-label="Remove destination"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5
                   border border-dashed border-border-strong rounded-[var(--radius-md)]
                   text-sm text-text-muted font-medium
                   hover:text-accent hover:border-accent/40 hover:bg-accent-muted/20
                   transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Destination
      </button>
    </div>
  )
}

/* ─────────────────── Step 3: Budget ─────────────────── */

function StepBudget({ form, setForm }) {
  const handleCurrencyChange = (code) => {
    setForm(f => ({ ...f, currency: code }))
  }

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
        <h2 className="font-heading text-xl text-text-primary mb-1">Set your budget</h2>
        <p className="text-sm text-text-muted">Optional. You can always add this later.</p>
      </div>

      {/* Currency Selector */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
        <select
          value={form.currency}
          onChange={e => handleCurrencyChange(e.target.value)}
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                     text-text-primary
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                     transition-colors appearance-none cursor-pointer"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Budget Categories */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Budget Categories</label>
        <div className="space-y-2">
          {form.budgetCategories.map((cat, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 bg-bg-secondary border border-border rounded-[var(--radius-sm)]"
            >
              <span className="text-base w-6 text-center shrink-0">{cat.emoji}</span>
              <span className="text-sm text-text-secondary w-28 shrink-0 truncate">{cat.name}</span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input
                    type="number"
                    min="0"
                    value={cat.min || ''}
                    onChange={e => handleCategoryUpdate(i, 'min', e.target.value)}
                    placeholder="Min"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)]
                               text-text-primary text-sm text-right
                               focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                               transition-colors"
                  />
                </div>
                <span className="text-text-muted text-xs">to</span>
                <div className="flex-1 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input
                    type="number"
                    min="0"
                    value={cat.max || ''}
                    onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                    placeholder="Max"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)]
                               text-text-primary text-sm text-right
                               focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20
                               transition-colors"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget total */}
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

/* ─────────────────── Step 4: Review ─────────────────── */

function StepReview({ form }) {
  const currencyObj = CURRENCIES.find(c => c.code === form.currency)
  const symbol = currencyObj ? currencyObj.symbol : form.currency

  const totalMin = form.budgetCategories.reduce((s, c) => s + (c.min || 0), 0)
  const totalMax = form.budgetCategories.reduce((s, c) => s + (c.max || 0), 0)

  const validDests = form.destinations.filter(d => d.city.trim())

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Review your trip</h2>
        <p className="text-sm text-text-muted">Everything look good? You can edit details later.</p>
      </div>

      {/* Trip card preview */}
      <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{form.emoji}</span>
            <div>
              <h3 className="font-heading text-lg font-bold text-text-primary">
                {form.name || 'Untitled Trip'}
              </h3>
              <p className="text-sm text-text-muted">
                {form.travelers} {form.travelers === 1 ? 'traveler' : 'travelers'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Dates */}
          {(form.startDate || form.endDate) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Dates</p>
              <p className="text-sm text-text-primary">
                {form.startDate ? formatDate(form.startDate) : 'TBD'}
                {' '}&mdash;{' '}
                {form.endDate ? formatDate(form.endDate) : 'TBD'}
              </p>
            </div>
          )}

          {/* Destinations */}
          {validDests.length > 0 && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1.5">Destinations</p>
              <div className="flex flex-wrap gap-1.5">
                {validDests.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-bg-hover rounded-[var(--radius-pill)] text-text-secondary"
                  >
                    {d.flag || '📍'} {d.city}{d.country ? `, ${d.country}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Budget */}
          {(totalMin > 0 || totalMax > 0) && (
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1">Budget</p>
              <p className="text-sm text-text-primary">
                {symbol}{totalMin.toLocaleString()} – {symbol}{totalMax.toLocaleString()} {form.currency}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {form.budgetCategories.filter(c => c.min > 0 || c.max > 0).map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs text-text-muted"
                  >
                    {c.emoji} {c.name}
                    {i < form.budgetCategories.filter(bc => bc.min > 0 || bc.max > 0).length - 1 && (
                      <span className="text-border ml-1">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Main Modal Component ─────────────────── */

export default function NewTripModal({ isOpen, onClose }) {
  const { dispatch, showToast } = useTripContext()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => getInitialForm())

  function getInitialForm() {
    return {
      name: '',
      emoji: '✈️',
      travelers: 1,
      startDate: '',
      endDate: '',
      destinations: [{ city: '', country: '', flag: '' }],
      currency: 'PHP',
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({
        ...c,
        min: 0,
        max: 0,
      })),
    }
  }

  // Reset form whenever modal opens
  const handleClose = () => {
    setStep(1)
    setForm(getInitialForm())
    onClose()
  }

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return form.name.trim().length > 0
      case 2:
        return form.destinations.some(d => d.city.trim().length > 0)
      case 3:
        return true // budget is optional
      case 4:
        return true
      default:
        return false
    }
  }, [step, form])

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(s => s - 1)
    }
  }

  const handleSkipBudget = () => {
    setForm(f => ({
      ...f,
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, min: 0, max: 0 })),
    }))
    setStep(4)
  }

  const handleCreate = () => {
    // Build destinations with flag lookup
    const COUNTRY_FLAGS_MAP = {
      'Philippines': '🇵🇭', 'Singapore': '🇸🇬', 'Thailand': '🇹🇭', 'Malaysia': '🇲🇾',
      'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
      'Taiwan': '🇹🇼', 'Cambodia': '🇰🇭', 'Myanmar': '🇲🇲', 'Laos': '🇱🇦',
      'India': '🇮🇳', 'China': '🇨🇳', 'Hong Kong': '🇭🇰', 'Australia': '🇦🇺',
      'New Zealand': '🇳🇿', 'USA': '🇺🇸', 'UK': '🇬🇧', 'France': '🇫🇷',
      'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Germany': '🇩🇪', 'Netherlands': '🇳🇱',
      'Greece': '🇬🇷', 'Turkey': '🇹🇷', 'UAE': '🇦🇪', 'Mexico': '🇲🇽',
      'Brazil': '🇧🇷', 'Canada': '🇨🇦',
    }

    const destinations = form.destinations
      .filter(d => d.city.trim())
      .map(d => ({
        city: d.city.trim(),
        country: d.country.trim(),
        flag: COUNTRY_FLAGS_MAP[d.country.trim()] || '🌍',
      }))

    const budgetItems = form.budgetCategories
      .filter(c => c.min > 0 || c.max > 0)
      .map(c => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: c.name,
        emoji: c.emoji,
        min: c.min,
        max: c.max,
        actual: 0,
      }))

    const newTrip = createEmptyTrip({
      name: form.name.trim() || 'New Trip',
      emoji: form.emoji,
      travelers: form.travelers,
      startDate: form.startDate,
      endDate: form.endDate,
      destinations,
      currency: form.currency,
      budget: budgetItems,
    })

    dispatch({ type: ACTIONS.ADD_TRIP, payload: newTrip })
    showToast(`"${newTrip.name}" created! Let's plan this trip.`)
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-lg">
      <div className="px-6 pt-6 pb-2">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)]
                     text-text-muted hover:text-text-primary hover:bg-bg-hover
                     transition-colors z-10"
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Step content */}
        <div className="min-h-[320px]">
          {step === 1 && <StepBasics form={form} setForm={setForm} />}
          {step === 2 && <StepDestinations form={form} setForm={setForm} />}
          {step === 3 && <StepBudget form={form} setForm={setForm} />}
          {step === 4 && <StepReview form={form} />}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-2">
        <div>
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-secondary
                         hover:text-text-primary hover:bg-bg-hover rounded-[var(--radius-md)]
                         transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Skip button on budget step */}
          {step === 3 && (
            <button
              type="button"
              onClick={handleSkipBudget}
              className="px-4 py-2 text-sm font-medium text-text-muted
                         hover:text-text-secondary hover:bg-bg-hover rounded-[var(--radius-md)]
                         transition-colors"
            >
              Skip
            </button>
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium
                         bg-accent hover:bg-accent-hover text-text-inverse
                         rounded-[var(--radius-md)]
                         
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-200"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold
                         bg-accent hover:bg-accent-hover text-text-inverse
                         rounded-[var(--radius-md)]
                         
                         transition-all duration-200 active:scale-[0.98]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Trip
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
