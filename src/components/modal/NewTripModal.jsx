import { useState, useMemo, useEffect } from 'react'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { GLOBAL_CATEGORIES } from '../../constants/categories'
import { createEmptyTrip } from '../../data/defaultTrip'
import { resolveCity } from '../shared/CityCombobox'
import MagicImportFlow from './newtrip/MagicImportFlow'
import WandaChatFlow from './newtrip/WandaChatFlow'
import StepBasics from './newtrip/StepBasics'
import StepDestinations from './newtrip/StepDestinations'
import StepBudget from './newtrip/StepBudget'
import StepReview from './newtrip/StepReview'
import { uploadDocumentToStorage } from '../../utils/documentVault'

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
      sourceImport: null,
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

  const handlePlanReady = (tripData, extra = {}) => {
    setForm(f => ({
      ...f,
      name: tripData.name || f.name,
      ...(extra.travelerIds !== undefined && {
        travelerIds: extra.travelerIds,
        travelers: Math.max(extra.travelerIds.length, 1),
      }),
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
      sourceImport: extra.sourceUrl ? {
        url: extra.sourceUrl,
        snapshot: JSON.stringify(tripData, null, 2),
        title: tripData.name || f.name || 'Imported trip',
      } : f.sourceImport,
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
    if (form.sourceImport?.snapshot || form.sourceImport?.url) {
      void (async () => {
        try {
          const blob = new Blob([
            `Source URL: ${form.sourceImport.url || ''}\n\n${form.sourceImport.snapshot || ''}`,
          ], { type: 'text/plain' })
          const sourceFile = new File([blob], `${newTrip.name || 'trip'}-source.txt`, { type: 'text/plain' })
          const docRecord = await uploadDocumentToStorage({
            file: sourceFile,
            prepared: {
              storageFile: blob,
              mimeType: 'text/plain',
              kind: 'text',
              previewDataUrl: '',
              text: form.sourceImport.snapshot || form.sourceImport.url || '',
              sizeBytes: blob.size,
            },
            tripId: newTrip.id,
            title: `${newTrip.name || 'Trip'} source`,
            category: 'import',
            sourceTab: 'documents',
            sourceEntityType: 'trip-import',
            sourceEntityId: newTrip.id,
            uploadedBy: currentUserProfile?.uid || currentUserProfile?.id || '',
            previewText: form.sourceImport.snapshot || form.sourceImport.url || '',
            parsedSummary: `Imported from ${form.sourceImport.url || 'trip import'}`,
          })
          dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: docRecord })
        } catch (err) {
          console.warn('[NewTripModal] Failed to store import source:', err)
        }
      })()
    }
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

        {mode === 'chooser' && <ModeChooser onSelect={setMode} />}

        {mode === 'magic' && (
          <MagicImportFlow
            onPlanReady={handlePlanReady}
            onBack={() => setMode('chooser')}
          />
        )}

        {mode === 'wanda' && (
          <WandaChatFlow
            onPlanReady={handlePlanReady}
            onBack={() => setMode('chooser')}
          />
        )}

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
