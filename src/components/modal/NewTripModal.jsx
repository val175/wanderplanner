import { useState, useMemo, useEffect, useRef } from 'react'
import Modal from '../shared/Modal'
import DatePicker from '../shared/DatePicker'
import Select, { SelectItem } from '../shared/Select'
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
import { GLOBAL_CATEGORIES } from '../../constants/categories'

const TOTAL_STEPS = 4

const DEFAULT_BUDGET_CATEGORIES = GLOBAL_CATEGORIES.map(c => ({
  name: c.label,
  emoji: c.emoji
}))

/* ─────────────────── Mode Chooser ─────────────────── */
function ModeChooser({ onSelect }) {
  const options = [
    {
      id: 'magic',
      icon: '✨',
      title: 'Magic Import',
      description: 'Paste a travel blog or guide link — we\'ll build your trip from it.',
      accent: false,
    },
    {
      id: 'manual',
      icon: '✏️',
      title: 'Manual',
      description: 'Build your trip step by step with full control.',
      accent: false,
    },
    {
      id: 'wanda',
      icon: '🪄',
      title: 'Ask Wanda',
      description: 'Let Wanda ask you smart questions and generate your full trip plan.',
      accent: true,
    },
  ]

  return (
    <div className="px-6 pt-4 pb-6 space-y-3 animate-fade-in">
      <div className="text-center mb-5">
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Plan a new trip</h2>
        <p className="text-sm text-text-muted">How would you like to get started?</p>
      </div>
      {options.map(opt => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={`w-full flex items-center gap-4 p-4 rounded-[var(--radius-lg)] border text-left transition-all duration-150
            ${opt.accent
              ? 'border-accent/30 bg-accent-muted/10 hover:border-accent/60 hover:bg-accent-muted/20'
              : 'border-border hover:border-accent/30 hover:bg-bg-hover'
            }`}
        >
          <span className="text-2xl w-10 h-10 flex items-center justify-center rounded-[var(--radius-md)] bg-bg-secondary border border-border shrink-0">
            {opt.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${opt.accent ? 'text-accent' : 'text-text-primary'}`}>{opt.title}</p>
            <p className="text-xs text-text-muted mt-0.5 leading-snug">{opt.description}</p>
          </div>
          <svg className="text-text-muted shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      ))}
    </div>
  )
}

/* ─────────────────── Magic Import Flow ─────────────────── */
function MagicImportFlow({ onPlanReady, onBack }) {
  const [importUrl, setImportUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

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
      let token = ''
      if (auth.currentUser) token = await auth.currentUser.getIdToken()
      const res = await fetch('https://wanderplan-rust.vercel.app/api/extract-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ url: importUrl })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to extract trip data')
      if (data.success && data.data) {
        onPlanReady(data.data)
      }
    } catch (err) {
      setImportError(err.message)
    } finally {
      setIsImporting(false)
    }
  }

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
    <div className="px-6 pt-4 pb-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack}
          className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <h2 className="font-heading font-semibold text-xl text-text-primary">✨ Magic Import</h2>
          <p className="text-sm text-text-muted">Paste a travel blog URL and we'll draft your trip.</p>
        </div>
      </div>

      <div className="p-4 bg-accent-muted/20 border border-accent/20 rounded-[var(--radius-lg)]">
        <p className="text-xs text-text-muted mb-3">Works great with Nomadic Matt, The Blonde Abroad, Travel + Leisure, and more.</p>
        <div className="flex gap-2">
          <input
            type="url"
            value={importUrl}
            onChange={e => setImportUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            placeholder="e.g. nomadicmatt.com/japan-itinerary"
            autoFocus
            className="flex-1 px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || !importUrl}
            className="px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-50 transition-colors shrink-0 flex items-center gap-2"
          >
            Generate
          </button>
        </div>
        {importError && <p className="text-xs text-danger mt-2">{importError}</p>}
      </div>
    </div>
  )
}

/* ─────────────────── Ask Wanda Flow ─────────────────── */
const WANDA_QUESTIONS = [
  { key: 'name_and_destinations', text: "Hi! I'm Wanda 🪄 Let's plan your trip! First — what should we call it, and where are you headed?" },
  { key: 'dates', text: "Wonderful! When are you traveling? Exact dates or a rough timeframe like 'end of April for 10 days' both work." },
  { key: 'travelers', text: "How many people are going on this trip?" },
  { key: 'trip_style', text: "What's the vibe? (e.g. adventure, relaxation, food & culture, family-friendly — or a mix!)" },
  { key: 'budget', text: "What's your rough budget and preferred currency? (e.g. 'around $3000 USD total' or '₱150,000')" },
  { key: 'special_requirements', text: "Any must-dos or special requirements? Dietary needs, places you definitely want to visit, things to avoid — anything goes!" },
]

function WandaChatFlow({ onPlanReady, onBack }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: WANDA_QUESTIONS[0].text }])
  const [input, setInput] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [gatheredInfo, setGatheredInfo] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateButton, setShowGenerateButton] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating, showGenerateButton])

  const handleSend = (e) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return

    const currentQuestion = WANDA_QUESTIONS[questionIndex]
    const newGatheredInfo = { ...gatheredInfo, [currentQuestion.key]: trimmed }
    const nextIndex = questionIndex + 1

    setMessages(m => [...m, { role: 'user', content: trimmed }])
    setInput('')
    setGatheredInfo(newGatheredInfo)
    setQuestionIndex(nextIndex)

    if (nextIndex < WANDA_QUESTIONS.length) {
      setTimeout(() => {
        setMessages(m => [...m, { role: 'assistant', content: WANDA_QUESTIONS[nextIndex].text }])
      }, 300)
    } else {
      setTimeout(() => {
        setMessages(m => [...m, {
          role: 'assistant',
          content: "Perfect, I have everything I need! Tap the button below and I'll put together your complete trip plan. ✨"
        }])
        setShowGenerateButton(true)
      }, 300)
    }
  }

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setShowGenerateButton(false)
    setGenerateError('')
    setMessages(m => [...m, { role: 'assistant', content: 'Working my magic... give me a moment! 🪄' }])

    try {
      let token = ''
      if (auth.currentUser) token = await auth.currentUser.getIdToken()
      const res = await fetch('https://wanderplan-rust.vercel.app/api/wanda-plan-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ gatheredInfo })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate plan')
      onPlanReady(data.data)
    } catch (err) {
      const errMsg = `Sorry, something went wrong: ${err.message}. Want to try again?`
      setMessages(m => [...m, { role: 'assistant', content: errMsg }])
      setGenerateError(err.message)
      setShowGenerateButton(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const allQuestionsAnswered = questionIndex >= WANDA_QUESTIONS.length
  const showInput = !allQuestionsAnswered && !isGenerating

  return (
    <div className="flex flex-col h-[500px] animate-fade-in">
      {/* Header */}
      <div className="px-6 pt-4 pb-3 border-b border-border flex items-center gap-3 shrink-0">
        <button type="button" onClick={onBack}
          className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-text-primary">🪄 Ask Wanda</span>
        <span className="text-xs text-text-muted ml-auto">{Math.min(questionIndex, WANDA_QUESTIONS.length)}/{WANDA_QUESTIONS.length} answered</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="text-base shrink-0 mb-0.5">🪄</span>
            )}
            <div className={`max-w-[82%] text-sm rounded-[var(--radius-lg)] px-3.5 py-2.5 leading-relaxed
              ${msg.role === 'user'
                ? 'bg-accent/15 text-text-primary rounded-br-sm'
                : 'bg-bg-secondary border border-border text-text-primary rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-end gap-2 justify-start">
            <span className="text-base shrink-0 mb-0.5">🪄</span>
            <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] rounded-bl-sm px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {showGenerateButton && !isGenerating && (
          <div className="flex justify-center pt-2">
            <Button size="md" onClick={handleGeneratePlan}>
              🪄 Generate My Trip Plan
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {showInput && (
        <form onSubmit={handleSend} className="border-t border-border px-4 py-3 flex gap-2 shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your answer…"
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted px-1"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-40 transition-colors shrink-0"
          >
            Send
          </button>
        </form>
      )}
    </div>
  )
}

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
  const { profiles, currentUserProfile } = useProfiles()

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
      if (id === currentUserProfile?.uid) return f
      const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
      return { ...f, travelerIds: next, travelers: Math.max(next.length, 1) }
    })
  }

  const allTravelers = [
    ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid, isMe: true }] : []),
    ...profiles,
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Name your adventure</h2>
        <p className="text-sm text-text-muted font-medium">What should we call this trip?</p>
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

      {/* Emoji Picker */}
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

      {/* Travelers */}
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
        <h2 className="font-heading font-semibold text-xl text-text-primary mb-1">Set your budget</h2>
        <p className="text-sm text-text-muted font-medium">Optional. You can always add this later.</p>
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
                  <input type="number" min="0" value={cat.min || ''}
                    onChange={e => handleCategoryUpdate(i, 'min', e.target.value)}
                    placeholder="Min"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">{symbol}</span>
                  <input type="number" min="0" value={cat.max || ''}
                    onChange={e => handleCategoryUpdate(i, 'max', e.target.value)}
                    placeholder="Max"
                    className="w-full pl-7 pr-2 py-1.5 bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary text-sm text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
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

          {/* Packing List (only shown when Wanda or import populates it) */}
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

/* ─────────────────── Main Modal Component ─────────────────── */
export default function NewTripModal({ isOpen, onClose }) {
  const { dispatch, showToast } = useTripContext()
  const { currentUserProfile, resolveProfile, profiles } = useProfiles()
  const [mode, setMode] = useState('chooser')
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => getInitialForm())

  function getInitialForm() {
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
      packingList: [],
    }
  }

  useEffect(() => {
    const myId = currentUserProfile?.uid
    if (!myId) return
    setForm(f => {
      if (f.travelerIds.includes(myId)) return f
      return { ...f, travelerIds: [myId, ...f.travelerIds] }
    })
  }, [currentUserProfile?.uid])

  const handleClose = () => {
    setMode('chooser')
    setStep(1)
    setForm(getInitialForm())
    onClose()
  }

  // Shared handler: called by MagicImportFlow and WandaChatFlow after AI generates trip data
  const handlePlanReady = (tripData) => {
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
        : f.itinerary || [],
      packingList: tripData.packingList?.length > 0
        ? tripData.packingList.map(p => ({ ...p, selected: true }))
        : f.packingList || [],
    }))
    setMode('manual')
    setStep(4)
  }

  const canProceed = useMemo(() => {
    if (step === 1) return form.name.trim().length > 0
    if (step === 2) return form.destinations.some(d => d.city.trim().length > 0)
    return true
  }, [step, form])

  const handleCreate = () => {
    const destinations = form.destinations
      .filter(d => d.city.trim() && d.selected !== false)
      .map(d => resolveCity(d.city, d.country, d.flag))

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

    const importedPacking = (form.packingList || [])
      .filter(p => p.selected !== false && p.name)
      .map((p, idx) => ({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + idx,
        name: p.name,
        section: p.section || 'Misc',
        packed: false,
      }))

    const memberIds = Array.from(new Set([
      currentUserProfile?.uid,
      ...(form.travelerIds || []).map(tid => resolveProfile(tid)?.uid).filter(Boolean)
    ])).filter(Boolean)

    const allAvailableProfiles = [
      ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid }] : []),
      ...profiles,
    ]
    const travelersSnapshot = (form.travelerIds || [])
      .map(tid => allAvailableProfiles.find(p => p.id === tid || p.uid === tid))
      .filter(Boolean)
      .map(p => ({ id: p.id || p.uid, uid: p.uid || p.id, name: p.name, photo: p.photo || null, customPhoto: p.customPhoto || null }))

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
      packingList: importedPacking,
    })

    dispatch({ type: ACTIONS.ADD_TRIP, payload: newTrip })
    showToast(`"${newTrip.name}" created! Let's plan this trip. 🗺️`)
    handleClose()
  }

  const maxWidth = mode === 'wanda' ? 'max-w-xl' : 'max-w-lg'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth={maxWidth}>
      <div className={mode === 'wanda' ? '' : 'px-6 pt-6 pb-2'}>
        <button type="button" onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Chooser mode */}
        {mode === 'chooser' && <ModeChooser onSelect={setMode} />}

        {/* Magic Import mode */}
        {mode === 'magic' && (
          <MagicImportFlow
            onPlanReady={handlePlanReady}
            onBack={() => setMode('chooser')}
          />
        )}

        {/* Ask Wanda mode */}
        {mode === 'wanda' && (
          <WandaChatFlow
            onPlanReady={handlePlanReady}
            onBack={() => setMode('chooser')}
          />
        )}

        {/* Manual mode — full 4-step wizard */}
        {mode === 'manual' && (
          <>
            <StepIndicator currentStep={step} />
            <div className="min-h-[320px]">
              {step === 1 && <StepBasics form={form} setForm={setForm} />}
              {step === 2 && <StepDestinations form={form} setForm={setForm} />}
              {step === 3 && <StepBudget form={form} setForm={setForm} />}
              {step === 4 && <StepReview form={form} setForm={setForm} />}
            </div>
          </>
        )}
      </div>

      {/* Footer — only for manual mode */}
      {mode === 'manual' && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-border mt-2">
          <div>
            {step > 1 ? (
              <Button variant="ghost" size="md" onClick={() => setStep(s => s - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="md" onClick={() => setMode('chooser')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Options
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
      )}
    </Modal>
  )
}
