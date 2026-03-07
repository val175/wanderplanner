import { useState, useMemo, useEffect } from 'react'
import Modal from '../shared/Modal'
import DatePicker from '../shared/DatePicker'
import CityCombobox, { COUNTRY_FLAGS_MAP, resolveCity } from '../shared/CityCombobox'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { TRIP_EMOJIS } from '../../constants/emojis'
import { CURRENCIES } from '../../constants/currencies'
import { createEmptyTrip } from '../../data/defaultTrip'
import { formatDate } from '../../utils/helpers'
import AvatarCircle from '../shared/AvatarCircle'
import Button from '../shared/Button'
import { auth } from '../../firebase/config'

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
              <div className={`w-8 h-[2px] rounded-full transition-colors duration-300 ${isCompleted ? 'bg-accent' : 'bg-border'}`} />
            )}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300
              ${isActive ? 'bg-accent text-text-inverse ring-4 ring-accent/20'
                : isCompleted ? 'bg-accent text-text-inverse'
                  : 'bg-bg-secondary text-text-muted border border-border'}`}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : step}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────── Step 1: Basics ─────────────────── */
function StepBasics({ form, setForm }) {
  const [customEmoji, setCustomEmoji] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const { profiles, currentUserProfile } = useProfiles()

  const LOADING_MESSAGES = [
    "Reading the travel blog...",
    "Whipping up your itinerary...",
    "Finding the best destinations...",
    "Estimating budget costs...",
    "Packing your bags..."
  ]

  useEffect(() => {
    if (isImporting) {
      const id = setInterval(() => {
        setLoadingMessageIndex(idx => (idx + 1) % LOADING_MESSAGES.length)
      }, 2500)
      return () => clearInterval(id)
    } else {
      setLoadingMessageIndex(0)
    }
  }, [isImporting])

  const handleImport = async () => {
    if (!importUrl) return
    setIsImporting(true)
    setImportError('')
    try {
      let token = '';
      if (auth.currentUser) token = await auth.currentUser.getIdToken();

      const res = await fetch('https://wanderplan-rust.vercel.app/api/extract-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ url: importUrl })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to extract trip data')

      if (data.success && data.data) {
        const tripData = data.data
        setForm(f => ({
          ...f,
          name: tripData.name || f.name,
          emoji: tripData.emoji || f.emoji,
          startDate: tripData.startDate || f.startDate,
          endDate: tripData.endDate || f.endDate,
          currency: tripData.currency || f.currency,
          destinations: tripData.destinations?.length > 0
            ? tripData.destinations.map(d => ({ ...d, selected: true }))
            : f.destinations,
          budgetCategories: tripData.budgetCategories?.length > 0
            ? tripData.budgetCategories.map(c => ({ ...c, selected: true }))
            : f.budgetCategories,
          todos: tripData.todos?.length > 0
            ? tripData.todos.map(t => ({ ...t, selected: true }))
            : f.todos,
          itinerary: tripData.itinerary?.length > 0
            ? tripData.itinerary.map(day => ({
              id: 'day-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '-' + day.dayNumber,
              date: day.date || '',
              dayNumber: day.dayNumber,
              location: day.location || '',
              emoji: '',
              notes: '',
              activities: (day.activities || []).map(a => ({
                id: 'act-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
                time: a.time || '',
                name: a.name || 'Activity',
                emoji: a.emoji || '📌',
                location: a.location || '',
                estCost: a.estCost || '',
                transit: a.transit || '',
                transitEmoji: a.transitEmoji || '🚕',
                notes: a.notes || '',
                done: false
              }))
            }))
            : f.itinerary || []
        }))
        // Automatically skip to the review step (Step 4) so they can see the draft
        setForm(f => ({ ...f, __forceStep: 4 }))
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  const handleCustomEmoji = (val) => {
    const match = val.match(/\p{Emoji}/u)
    if (match) {
      setForm(f => ({ ...f, emoji: match[0] }))
      setCustomEmoji(match[0])
    } else {
      setCustomEmoji(val)
    }
  }

  const toggleTraveler = (id) => {
    setForm(f => {
      const ids = f.travelerIds || []
      // Don't allow de-selecting yourself
      if (id === currentUserProfile?.uid) return f
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
      return { ...f, travelerIds: next, travelers: Math.max(next.length, 1) }
    })
  }

  // All selectable travelers: current user first, then shared profiles
  const allTravelers = [
    ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid, photo: currentUserProfile.customPhoto || currentUserProfile.photo, isMe: true }] : []),
    ...profiles,
  ]

  if (isImporting) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5 animate-fade-in text-center">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
          <span className="text-2xl animate-pulse">✨</span>
        </div>
        <div>
          <h3 className="text-lg font-heading font-semibold text-text-primary mb-1">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </h3>
          <p className="text-sm text-text-muted">This usually takes about 10-15 seconds.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* AI Import Option */}
      <div className="p-4 bg-accent-muted/20 border border-accent/20 rounded-[var(--radius-lg)]">
        <h3 className="font-heading text-sm font-semibold text-accent mb-2 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          Magic Import
        </h3>
        <p className="text-xs text-text-muted mb-3">Paste a travel blog URL and we'll automatically draft your itinerary.</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            placeholder="e.g. nomadicmatt.com/japan-itinerary"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || !importUrl}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-50 transition-colors shrink-0 flex items-center gap-2"
          >
            {isImporting ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : 'Generate'}
          </button>
        </div>
        {importError && <p className="text-xs text-danger mt-2">{importError}</p>}
      </div>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-border"></div>
        <span className="flex-shrink-0 mx-4 text-xs text-text-muted font-medium uppercase tracking-wider">Or create manually</span>
        <div className="flex-grow border-t border-border"></div>
      </div>

      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Name your adventure</h2>
        <p className="text-sm text-text-muted">What should we call this trip?</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Summer in Europe"
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)]
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          autoFocus
        />
      </div>

      {/* Emoji Picker — grid + free-type input */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Trip Emoji</label>
        <div className="grid grid-cols-10 gap-1.5 mb-2">
          {TRIP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { setForm(f => ({ ...f, emoji })); setCustomEmoji('') }}
              className={`w-9 h-9 flex items-center justify-center text-lg rounded-[var(--radius-sm)] transition-all duration-150
                ${form.emoji === emoji && !customEmoji
                  ? 'bg-accent/15 ring-2 ring-accent scale-110'
                  : 'bg-bg-secondary hover:bg-bg-hover'
                }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl w-9 h-9 flex items-center justify-center border border-border rounded-[var(--radius-sm)] bg-bg-secondary">
            {form.emoji}
          </span>
          <input
            type="text"
            value={customEmoji}
            onChange={e => handleCustomEmoji(e.target.value)}
            placeholder="Or type any emoji…"
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)]
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
        </div>
      </div>

      {/* Travelers — avatar picker using allTravelers (current user always first + selected) */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">Wanderers</label>
        <div className="flex flex-wrap gap-2">
          {allTravelers.map(p => {
            const selected = (form.travelerIds || []).includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleTraveler(p.uid || p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] border text-sm transition-all duration-150
                  ${selected
                    ? 'bg-accent/10 border-accent/40 text-text-primary'
                    : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-secondary'
                  }
                  ${p.isMe ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <AvatarCircle profile={p} size={22} />
                <span className="font-medium">{p.isMe ? `${p.name} (you)` : p.name}</span>
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">Start Date</label>
          <DatePicker
            value={form.startDate}
            onChange={val => setForm(f => ({ ...f, startDate: val }))}
            placeholder="Pick a date"
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] hover:border-accent/50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">End Date</label>
          <DatePicker
            value={form.endDate}
            onChange={val => setForm(f => ({ ...f, endDate: val }))}
            min={form.startDate || undefined}
            placeholder="Pick a date"
            className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] hover:border-accent/50"
          />
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Step 2: Destinations ─────────────────── */
function StepDestinations({ form, setForm }) {
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
        <h2 className="font-heading text-xl text-text-primary mb-1">Where are you going?</h2>
        <p className="text-sm text-text-muted">Add your destinations in order of visit.</p>
      </div>

      <div className="space-y-3">
        {form.destinations.map((dest, index) => (
          <div key={index} className="flex items-start gap-2 p-3 bg-bg-secondary border border-border rounded-[var(--radius-md)]">
            {/* Step number */}
            <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold shrink-0 mt-2">
              {index + 1}
            </div>

            {/* Flag preview */}
            <span className="text-xl flex-shrink-0 mt-1.5 w-7 text-center">
              {dest.flag || <span className="text-text-muted text-sm">📍</span>}
            </span>

            {/* City combobox — shared component */}
            <CityCombobox
              value={dest.city}
              country={dest.country}
              flag={dest.flag}
              onChange={updates => handleDestChange(index, updates)}
            />

            {/* Country text input */}
            <input
              type="text"
              value={dest.country}
              onChange={e => handleCountryChange(index, e.target.value)}
              placeholder="Country"
              className="flex-1 px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)]
                         text-text-primary placeholder:text-text-muted text-sm
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
            />

            {/* Remove */}
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

/* ─────────────────── Step 3: Budget ─────────────────── */
function StepBudget({ form, setForm }) {
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

      {/* Currency */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">Currency</label>
        <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
          className="w-full px-3 py-2.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors appearance-none cursor-pointer"
        >
          {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
        </select>
      </div>

      {/* Budget Categories */}
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
                  <input type="number" min="0" value={cat.min || ''}
                    onChange={e => handleCategoryUpdate(i, 'min', e.target.value)}
                    placeholder="Min"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input type="number" min="0" value={cat.max || ''}
                    onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                    placeholder="Max"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-sm)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
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

/* ─────────────────── Step 4: Review ─────────────────── */
function StepReview({ form, setForm }) {
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

  // Group Todos by category
  const todosByCategory = (form.todos || []).reduce((acc, todo, idx) => {
    if (!todo.text) return acc
    const cat = todo.category || 'Tasks'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ ...todo, originalIndex: idx })
    return acc
  }, {})

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading text-xl text-text-primary mb-1">Review your itinerary</h2>
        <p className="text-sm text-text-muted">Uncheck anything you don't want to include in the trip.</p>
      </div>

      <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{form.emoji}</span>
            <div>
              <h3 className="font-heading text-lg font-bold text-text-primary">{form.name || 'Untitled Trip'}</h3>
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
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider font-medium mb-1.5">Dates</p>
            <div className="flex items-center gap-3">
              <DatePicker
                value={form.startDate}
                onChange={val => setForm(f => ({ ...f, startDate: val }))}
                placeholder="Start Date"
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />
              <span className="text-text-muted text-sm px-1">to</span>
              <DatePicker
                value={form.endDate}
                onChange={val => setForm(f => ({ ...f, endDate: val }))}
                min={form.startDate || undefined}
                placeholder="End Date"
                className="w-full px-3 py-2 bg-bg-input border border-border rounded-[var(--radius-sm)] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
          </div>

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
                      {symbol}{c.min.toLocaleString()} – {symbol}{c.max.toLocaleString()}
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
        </div>
      </div>
    </div>
  )
}

/* ─────────────────── Main Modal Component ─────────────────── */
export default function NewTripModal({ isOpen, onClose }) {
  const { dispatch, showToast } = useTripContext()
  const { currentUserProfile, resolveProfile, profiles } = useProfiles()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => getInitialForm())

  function getInitialForm() {
    // Auto-include the current user in the traveler list
    const myId = currentUserProfile?.uid
    return {
      name: '',
      emoji: '✈️',
      travelers: 1,
      travelerIds: myId ? [myId] : [],
      startDate: '',
      endDate: '',
      destinations: [{ city: '', country: '', flag: '', selected: true }],
      currency: 'PHP',
      budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, min: 0, max: 0, selected: true })),
      todos: [],
      itinerary: [],
    }
  }

  // If the modal mounted before currentUserProfile loaded (async Firestore),
  // inject the user's UID into travelerIds as soon as the profile arrives.
  useEffect(() => {
    const myId = currentUserProfile?.uid
    if (!myId) return
    setForm(f => {
      if (f.travelerIds.includes(myId)) return f
      return { ...f, travelerIds: [myId, ...f.travelerIds] }
    })
  }, [currentUserProfile?.uid])

  useEffect(() => {
    if (form.__forceStep) {
      setStep(form.__forceStep)
      setForm(f => {
        const copy = { ...f }
        delete copy.__forceStep
        return copy
      })
    }
  }, [form.__forceStep])

  const handleClose = () => { setStep(1); setForm(getInitialForm()); onClose() }

  const canProceed = useMemo(() => {
    if (step === 1) return form.name.trim().length > 0
    if (step === 2) return form.destinations.some(d => d.city.trim().length > 0)
    return true
  }, [step, form])

  const handleCreate = () => {
    const destinations = form.destinations
      .filter(d => d.city.trim() && d.selected !== false)
      .map(d => resolveCity(d.city, d.country, d.flag))

    // Mirror destinations into CitiesTab city cards (deduplicated by city name)
    const seen = new Map()
    destinations.forEach(d => {
      const key = d.city.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + seen.size,
          city: d.city,
          country: d.country,
          flag: d.flag || '🌍',
          highlights: '',
          mustDo: '',
          weather: '',
          currencyTip: '',
          notes: '',
          savedPins: [],
        })
      }
    })
    const cities = Array.from(seen.values())

    const budgetItems = form.budgetCategories
      .filter(c => (c.min > 0 || c.max > 0) && c.selected !== false)
      .map(c => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: c.name, emoji: c.emoji, min: c.min, max: c.max, actual: 0,
      }))

    const importedTodos = (form.todos || [])
      .filter(t => t.selected !== false && t.text)
      .map((t, idx) => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + idx,
        text: t.text,
        category: t.category || 'Misc',
        done: false,
        priority: 'normal',
        dueDate: ''
      }))

    const memberIds = Array.from(new Set([
      currentUserProfile?.uid,
      ...(form.travelerIds || []).map(tid => resolveProfile(tid)?.uid).filter(Boolean)
    ])).filter(Boolean)

    // Build a snapshot of traveler profiles so TripHeader can show avatars
    // even before the external profiles list loads from Firestore
    const allAvailableProfiles = [
      ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid }] : []),
      ...profiles,
    ]
    const travelersSnapshot = (form.travelerIds || [])
      .map(tid => allAvailableProfiles.find(p => p.id === tid || p.uid === tid))
      .filter(Boolean)
      .map(p => ({ id: p.id || p.uid, uid: p.uid || p.id, name: p.name, photo: p.customPhoto || p.photo || null }))

    const newTrip = createEmptyTrip({
      name: form.name.trim() || 'New Trip',
      emoji: form.emoji,
      travelers: Math.max((form.travelerIds || []).length, 1),
      travelerIds: form.travelerIds || [],
      travelersSnapshot,
      memberIds,
      startDate: form.startDate,
      endDate: form.endDate,
      destinations,
      cities,
      currency: form.currency,
      budget: budgetItems,
      todos: importedTodos,
      itinerary: form.itinerary || [],
    })

    dispatch({ type: ACTIONS.ADD_TRIP, payload: newTrip })
    showToast(`"${newTrip.name}" created! Let's plan this trip. 🗺️`)
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-lg">
      <div className="px-6 pt-6 pb-2">
        <button type="button" onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <StepIndicator currentStep={step} />

        <div className="min-h-[320px]">
          {step === 1 && <StepBasics form={form} setForm={setForm} />}
          {step === 2 && <StepDestinations form={form} setForm={setForm} />}
          {step === 3 && <StepBudget form={form} setForm={setForm} />}
          {step === 4 && <StepReview form={form} setForm={setForm} />}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-2">
        <div>
          {step > 1 && (
            <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step === 3 && (
            <Button variant="ghost" size="md" onClick={() => { setForm(f => ({ ...f, budgetCategories: DEFAULT_BUDGET_CATEGORIES.map(c => ({ ...c, min: 0, max: 0 })) })); setStep(4) }}>
              Skip
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button size="md" onClick={() => setStep(s => s + 1)} disabled={!canProceed}>
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Button>
          ) : (
            <Button size="lg" onClick={handleCreate}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Trip
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
