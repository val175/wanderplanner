import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Globe, Upload } from 'lucide-react'
import { auth } from '../../../firebase/config'
import { useTripContext } from '../../../context/TripContext'
import { ACTIONS } from '../../../state/tripReducer'
import { CATEGORY_MAP } from '../../../constants/categories'
import { cloneDeep, formatDate, pluralize } from '../../../utils/helpers'
import { triggerHaptic } from '../../../utils/haptics'
import {
  findMatchingDayIndex,
  normalizeImportedDays,
  parseStructuredTextItinerary,
} from '../../../utils/itineraryImport'
import Badge from '../../shared/Badge'
import Button from '../../shared/Button'
import Input from '../../shared/Input'
import Label from '../../shared/Label'
import Modal from '../../shared/Modal'
import { inputSurfaceClass } from '../../shared/surfaceStyles'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'
const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_TEXT_BYTES = 300 * 1024

const LOADING_MESSAGES = [
  'Reading your itinerary...',
  'Mapping out days and times...',
  'Matching stops to your trip...',
]

function isPdfFile(file) {
  if (!file) return false
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
}

function isTextItineraryFile(file) {
  if (!file) return false
  return (
    file.type === 'text/markdown' ||
    file.type === 'text/plain' ||
    /\.(md|markdown|txt)$/i.test(file.name || '')
  )
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsDataURL(file)
  })
}

export default function ImportItineraryModal({ isOpen, onClose }) {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const baseId = useId()
  const fileInputRef = useRef(null)
  const reviewHeadingRef = useRef(null)
  const urlInputRef = useRef(null)
  const pasteInputRef = useRef(null)

  const [step, setStep] = useState('input') // 'input' | 'review'
  const [sourceType, setSourceType] = useState('file') // 'file' | 'paste' | 'url'
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileText, setFileText] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [isExtracting, setIsExtracting] = useState(false)
  const [loadingIdx, setLoadingIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const [reviewDays, setReviewDays] = useState([])
  const [expandedDays, setExpandedDays] = useState({})
  const [mergeMode, setMergeMode] = useState('merge')
  const [extractionSource, setExtractionSource] = useState('ai') // 'ai' | 'local'

  const existingItinerary = activeTrip?.itinerary || []
  const hasExistingDays = existingItinerary.length > 0

  useEffect(() => {
    if (!isExtracting) {
      setLoadingIdx(0)
      return
    }
    const timer = setInterval(() => {
      setLoadingIdx(i => (i + 1) % LOADING_MESSAGES.length)
    }, 2400)
    return () => clearInterval(timer)
  }, [isExtracting])

  useEffect(() => {
    if (step === 'review') {
      requestAnimationFrame(() => reviewHeadingRef.current?.focus())
    }
  }, [step])

  const resetState = () => {
    setStep('input')
    setSourceType('file')
    setSelectedFile(null)
    setFileText('')
    setPastedText('')
    setImportUrl('')
    setIsDragging(false)
    setIsExtracting(false)
    setErrorMsg('')
    setReviewDays([])
    setExpandedDays({})
    setMergeMode('merge')
    setExtractionSource('ai')
  }

  const handleClose = () => {
    if (isExtracting) return
    resetState()
    onClose()
  }

  const handlePickedFile = async (file) => {
    if (!file) return
    setErrorMsg('')

    if (isPdfFile(file)) {
      if (file.size > MAX_PDF_BYTES) {
        setErrorMsg('PDF files must be 10 MB or smaller.')
        return
      }
      setSelectedFile(file)
      setFileText('')
      return
    }

    if (isTextItineraryFile(file)) {
      if (file.size > MAX_TEXT_BYTES) {
        setErrorMsg('Text/Markdown files must be 300 KB or smaller.')
        return
      }
      try {
        const text = await file.text()
        if (!text.trim()) {
          setErrorMsg('That file appears to be empty.')
          return
        }
        setSelectedFile(file)
        setFileText(text)
      } catch {
        setErrorMsg('Could not read that file. Try pasting its contents instead.')
      }
      return
    }

    setErrorMsg('Unsupported file type. Upload a .md, .txt, or .pdf itinerary.')
  }

  const enterReview = (rawDays, sourceKind) => {
    const normalized = normalizeImportedDays(rawDays, activeTrip)
    if (normalized.length === 0) {
      setErrorMsg('No day-by-day activities were found in that itinerary.')
      return
    }
    const expanded = {}
    normalized.forEach((d, idx) => {
      if (idx < 2 || normalized.length <= 4) expanded[d.id] = true
    })
    setReviewDays(normalized)
    setExpandedDays(expanded)
    setExtractionSource(sourceKind)
    setMergeMode(hasExistingDays ? 'merge' : 'replace')
    setStep('review')
  }

  const handleExtractSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (sourceType === 'file' && !selectedFile) {
      setErrorMsg('Select a .md, .txt, or .pdf itinerary file first.')
      return
    }
    if (sourceType === 'paste' && !pastedText.trim()) {
      setErrorMsg('Paste your itinerary text or Markdown first.')
      pasteInputRef.current?.focus()
      return
    }
    if (sourceType === 'url') {
      const trimmedUrl = importUrl.trim()
      if (!trimmedUrl) {
        setErrorMsg('Enter an itinerary or travel blog URL first.')
        urlInputRef.current?.focus()
        return
      }
      try {
        const parsed = new URL(trimmedUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setErrorMsg('URL must start with http:// or https://.')
          urlInputRef.current?.focus()
          return
        }
      } catch {
        setErrorMsg('Enter a valid URL (for example, https://example.com/itinerary).')
        urlInputRef.current?.focus()
        return
      }
    }

    setIsExtracting(true)
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : ''
      const tripContext = {
        name: activeTrip?.name || '',
        startDate: activeTrip?.startDate || '',
        endDate: activeTrip?.endDate || '',
        currency: activeTrip?.currency || 'PHP',
        cities: (activeTrip?.cities || []).map(c => c.city).filter(Boolean),
        existingDaysCount: existingItinerary.length,
      }

      if (sourceType === 'file' && isPdfFile(selectedFile)) {
        const base64 = await readFileAsBase64(selectedFile)
        const res = await fetch(`${VERCEL_API}/api/extract-trip-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ file: base64 }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data?.data?.itinerary) {
          throw new Error(data.error || 'Could not extract itinerary from that PDF.')
        }
        enterReview(data.data.itinerary, 'ai')
        return
      }

      const textPayload = sourceType === 'file' ? fileText : (sourceType === 'paste' ? pastedText : '')
      const urlPayload = sourceType === 'url' ? importUrl.trim() : ''

      let aiError = null
      try {
        const res = await fetch(`${VERCEL_API}/api/extract-itinerary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            ...(textPayload ? { text: textPayload } : { url: urlPayload }),
            filename: selectedFile?.name || '',
            tripContext,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && Array.isArray(data?.data?.days) && data.data.days.length > 0) {
          enterReview(data.data.days, 'ai')
          return
        }
        aiError = new Error(data.error || `Extraction failed (${res.status})`)
      } catch (err) {
        aiError = err
      }

      // Deterministic Markdown/text fallback if AI endpoint is unavailable or un-deployed locally
      if (textPayload) {
        const parsedDays = parseStructuredTextItinerary(textPayload, tripContext)
        if (parsedDays.length > 0) {
          enterReview(parsedDays, 'local')
          return
        }
      }

      throw aiError || new Error('Could not extract days and activities from that source.')
    } catch (err) {
      setErrorMsg(err.message || 'Import failed. Please check your source and try again.')
    } finally {
      setIsExtracting(false)
    }
  }

  const selectionStats = useMemo(() => {
    const activeDays = reviewDays.filter(d => d.selected)
    let activities = 0
    let matchedDays = 0
    activeDays.forEach(d => {
      const selectedActs = d.activities.filter(a => a.selected)
      if (selectedActs.length > 0 || d.notes) {
        activities += selectedActs.length
        if (findMatchingDayIndex(existingItinerary, d) >= 0) matchedDays += 1
      }
    })
    return {
      days: activeDays.length,
      activities,
      matchedDays,
      newDays: Math.max(0, activeDays.length - matchedDays),
    }
  }, [reviewDays, existingItinerary])

  const toggleDaySelected = (dayId) => {
    setReviewDays(prev => prev.map(d => {
      if (d.id !== dayId) return d
      const next = !d.selected
      return {
        ...d,
        selected: next,
        activities: d.activities.map(a => ({ ...a, selected: next })),
      }
    }))
  }

  const updateDayLocation = (dayId, location) => {
    setReviewDays(prev => prev.map(d => (d.id === dayId ? { ...d, location } : d)))
  }

  const toggleActivitySelected = (dayId, actId) => {
    setReviewDays(prev => prev.map(d => {
      if (d.id !== dayId) return d
      const activities = d.activities.map(a => (a.id === actId ? { ...a, selected: !a.selected } : a))
      const anySelected = activities.some(a => a.selected)
      return { ...d, selected: anySelected, activities }
    }))
  }

  const updateActivityField = (dayId, actId, field, value) => {
    setReviewDays(prev => prev.map(d => {
      if (d.id !== dayId) return d
      return {
        ...d,
        activities: d.activities.map(a => (a.id === actId ? { ...a, [field]: value } : a)),
      }
    }))
  }

  const toggleExpandDay = (dayId) => {
    setExpandedDays(prev => ({ ...prev, [dayId]: !prev[dayId] }))
  }

  const handleConfirmImport = (e) => {
    e.preventDefault()
    if (selectionStats.activities === 0 && selectionStats.days === 0) {
      setErrorMsg('Select at least one day or activity to import.')
      return
    }

    const previousItinerary = cloneDeep(existingItinerary)
    dispatch({
      type: ACTIONS.IMPORT_ITINERARY,
      payload: { days: reviewDays, mode: mergeMode },
    })
    triggerHaptic('medium')
    handleClose()

    showToast?.(
      `Imported ${selectionStats.activities} ${pluralize(selectionStats.activities, 'activity', 'activities')} across ${selectionStats.days} ${pluralize(selectionStats.days, 'day')}`,
      'success',
      {
        label: 'Undo',
        onClick: () => {
          dispatch({ type: ACTIONS.RESTORE_ITINERARY, payload: { itinerary: previousItinerary } })
          showToast?.('Itinerary import undone', 'info')
        },
      }
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth={step === 'review' ? 'max-w-2xl' : 'max-w-lg'}
      closeOnOutsideClick={!isExtracting && step !== 'review'}
      title="Import Itinerary"
      description={
        step === 'input'
          ? 'Bring in a schedule from a Markdown, text, or PDF file, pasted notes, or a travel blog link.'
          : 'Review, edit, and choose how to merge these days into your trip.'
      }
    >
      {isExtracting ? (
        <div role="status" className="px-6 py-12 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-[var(--radius-pill)] bg-accent/10 border border-accent/20 flex items-center justify-center text-2xl animate-pulse">
            ✨
          </div>
          <div className="space-y-1.5 w-full max-w-xs">
            <p className="font-heading font-semibold text-base text-text-primary">
              {LOADING_MESSAGES[loadingIdx]}
            </p>
            <p className="text-xs text-text-muted">
              Extracting days, times, and stops for review.
            </p>
            <progress
              aria-label="Extracting itinerary"
              className="w-full h-1.5 mt-2 accent-[var(--color-accent)] rounded-[var(--radius-pill)] overflow-hidden"
            />
          </div>
        </div>
      ) : step === 'input' ? (
        <form onSubmit={handleExtractSubmit} className="px-6 pt-3 pb-6 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Import source
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'file', label: 'File (.md, .pdf)', icon: Upload },
                { id: 'paste', label: 'Paste text', icon: FileText },
                { id: 'url', label: 'Web URL', icon: Globe },
              ].map(({ id, label, icon: Icon }) => {
                const inputId = `${baseId}-src-${id}`
                const active = sourceType === id
                return (
                  <label
                    key={id}
                    htmlFor={inputId}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-[var(--radius-md)] border text-xs font-semibold cursor-pointer transition-colors min-h-[44px]
                      ${active
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-bg-secondary border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`${baseId}-source`}
                      value={id}
                      checked={active}
                      onChange={() => {
                        setSourceType(id)
                        setErrorMsg('')
                      }}
                      className="sr-only"
                    />
                    <Icon size={14} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {sourceType === 'file' && (
            <div className="space-y-2">
              <Label className="block">Itinerary file</Label>
              <input
                ref={fileInputRef}
                id={`${baseId}-file`}
                name="itineraryFile"
                type="file"
                accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handlePickedFile(file)
                }}
                className="sr-only"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) void handlePickedFile(file)
                }}
                className={`rounded-[var(--radius-md)] border border-dashed p-5 text-center transition-colors
                  ${isDragging
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg-secondary/50 hover:border-border-strong'
                  }`}
              >
                <Upload size={20} className="mx-auto text-text-muted mb-2" aria-hidden="true" />
                {selectedFile ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-text-primary break-all">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Ready to extract
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change file
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null)
                          setFileText('')
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-text-secondary">
                      Drop a <span className="font-semibold text-text-primary">.md</span>, <span className="font-semibold text-text-primary">.txt</span>, or <span className="font-semibold text-text-primary">.pdf</span> file here
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-xs text-text-muted">
                Works with Markdown itineraries, Notion/ChatGPT exports, and PDF schedules.
              </p>
            </div>
          )}

          {sourceType === 'paste' && (
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-paste`} className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                Itinerary text or Markdown
              </label>
              <p id={`${baseId}-paste-hint`} className="text-xs text-text-muted">
                Paste a day-by-day schedule from Markdown, Notes, Google Docs, or AI chat.
              </p>
              <textarea
                ref={pasteInputRef}
                id={`${baseId}-paste`}
                name="itineraryText"
                rows={8}
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                aria-describedby={`${baseId}-paste-hint`}
                placeholder={'### Day 1 · Sat, Nov 14 · Arrival\n- **5:00 PM** Land at Changi\n- **8:30 PM** Dinner at LeVeL33'}
                className={`${inputSurfaceClass} font-mono text-xs leading-relaxed min-h-[180px] resize-y`}
              />
            </div>
          )}

          {sourceType === 'url' && (
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-url`} className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                Itinerary or travel blog URL
              </label>
              <p id={`${baseId}-url-hint`} className="text-xs text-text-muted">
                Paste a public travel guide or blog post URL with a day-by-day breakdown.
              </p>
              <Input
                ref={urlInputRef}
                id={`${baseId}-url`}
                name="itineraryUrl"
                type="url"
                value={importUrl}
                onChange={(e) => {
                  setImportUrl(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                aria-describedby={`${baseId}-url-hint`}
                placeholder="https://example.com/7-day-tokyo-itinerary"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
              />
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-[var(--radius-md)] bg-danger/10 border border-danger/20 text-xs text-danger font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="secondary" size="md" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Preview Itinerary
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleConfirmImport} className="px-6 pt-3 pb-6 space-y-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3
              ref={reviewHeadingRef}
              tabIndex={-1}
              className="font-heading font-semibold text-base text-text-primary focus:outline-none"
            >
              {selectionStats.days} {pluralize(selectionStats.days, 'day')} · {selectionStats.activities} {pluralize(selectionStats.activities, 'activity', 'activities')} selected
            </h3>
            <Badge tone={extractionSource === 'ai' ? 'accent' : 'neutral'}>
              {extractionSource === 'ai' ? '✨ Extracted by Wanda AI' : '📝 Parsed from Markdown'}
            </Badge>
          </div>

          {hasExistingDays && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                How to apply to this trip
              </legend>
              <div className="space-y-2">
                {[
                  {
                    id: 'merge',
                    title: 'Merge into matching days',
                    detail: selectionStats.matchedDays > 0
                      ? `Combines into ${selectionStats.matchedDays} matching ${pluralize(selectionStats.matchedDays, 'day')} and adds ${selectionStats.newDays} new ${pluralize(selectionStats.newDays, 'day')} (skips exact duplicates).`
                      : 'Matches by date or day number and keeps existing activities.',
                  },
                  {
                    id: 'replace',
                    title: 'Replace existing itinerary',
                    detail: `Replaces your current ${existingItinerary.length} ${pluralize(existingItinerary.length, 'day')} with this plan (can be undone from the toast).`,
                  },
                  {
                    id: 'append',
                    title: `Append after Day ${existingItinerary.length}`,
                    detail: 'Keeps your current schedule untouched and adds these days at the end.',
                  },
                ].map(opt => {
                  const optId = `${baseId}-mode-${opt.id}`
                  const selected = mergeMode === opt.id
                  return (
                    <label
                      key={opt.id}
                      htmlFor={optId}
                      className={`flex items-start gap-3 p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors
                        ${selected
                          ? 'bg-accent/10 border-accent/40'
                          : 'bg-bg-secondary/50 border-border hover:bg-bg-hover'
                        }`}
                    >
                      <input
                        id={optId}
                        type="radio"
                        name={`${baseId}-merge-mode`}
                        value={opt.id}
                        checked={selected}
                        onChange={() => setMergeMode(opt.id)}
                        className="mt-0.5 accent-[var(--color-accent)]"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-text-primary">{opt.title}</span>
                        <span className="block text-xs text-text-muted mt-0.5">{opt.detail}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          <div className="space-y-2.5 max-h-[42vh] overflow-y-auto pr-1 custom-scrollbar">
            {reviewDays.map((day) => {
              const isExpanded = !!expandedDays[day.id]
              const matchIdx = findMatchingDayIndex(existingItinerary, day)
              const selectedCount = day.activities.filter(a => a.selected).length
              const panelId = `${baseId}-day-panel-${day.id}`

              return (
                <div
                  key={day.id}
                  className={`rounded-[var(--radius-md)] border transition-colors ${
                    day.selected ? 'border-border bg-bg-card' : 'border-border/60 bg-bg-secondary/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 p-3">
                    <input
                      type="checkbox"
                      aria-label={`Include Day ${day.dayNumber}`}
                      checked={day.selected}
                      onChange={() => toggleDaySelected(day.id)}
                      className="accent-[var(--color-accent)] w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary shrink-0">
                        Day {day.dayNumber}
                      </span>
                      {day.date && (
                        <Badge tone="neutral">{formatDate(day.date, 'long')}</Badge>
                      )}
                      {hasExistingDays && mergeMode === 'merge' && (
                        <Badge tone={matchIdx >= 0 ? 'info' : 'success'}>
                          {matchIdx >= 0 ? `Merges into Day ${existingItinerary[matchIdx].dayNumber}` : 'New day'}
                        </Badge>
                      )}
                      <Input
                        size="sm"
                        aria-label={`Day ${day.dayNumber} city or area`}
                        value={day.location}
                        onChange={(e) => updateDayLocation(day.id, e.target.value)}
                        placeholder="City or area"
                        className="max-w-[180px]"
                      />
                    </div>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      onClick={() => toggleExpandDay(day.id)}
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
                    >
                      <span>{selectedCount}/{day.activities.length}</span>
                      {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div id={panelId} className="border-t border-border px-3 py-2 space-y-2 bg-bg-secondary/30">
                      {day.activities.map((act) => {
                        const cat = CATEGORY_MAP[act.category] || CATEGORY_MAP.other
                        return (
                          <div
                            key={act.id}
                            className={`flex items-start gap-2.5 p-2 rounded-[var(--radius-sm)] border border-border/60 bg-bg-card ${
                              act.selected ? '' : 'opacity-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Include ${act.name}`}
                              checked={act.selected}
                              onChange={() => toggleActivitySelected(day.id, act.id)}
                              className="mt-2 accent-[var(--color-accent)] w-4 h-4 shrink-0"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <Input
                                  size="sm"
                                  aria-label={`Time for ${act.name}`}
                                  value={act.time}
                                  onChange={(e) => updateActivityField(day.id, act.id, 'time', e.target.value)}
                                  placeholder="HH:mm"
                                  className="w-20 shrink-0 tabular-nums"
                                />
                                <Input
                                  size="sm"
                                  aria-label="Activity name"
                                  value={act.name}
                                  onChange={(e) => updateActivityField(day.id, act.id, 'name', e.target.value)}
                                  className="flex-1 min-w-0 font-medium"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
                                <Badge tone="neutral">{act.emoji || cat.emoji} {cat.label}</Badge>
                                {act.estCost && <Badge tone="warning">{act.estCost}</Badge>}
                                {act.location && <span className="truncate max-w-[220px]">📍 {act.location}</span>}
                                {act.notes && <span className="truncate max-w-full">{act.notes}</span>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {day.notes && (
                        <p className="text-xs text-text-muted px-1 pt-1">
                          Day notes: {day.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {errorMsg && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 rounded-[var(--radius-md)] bg-danger/10 border border-danger/20 text-xs text-danger font-medium"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => {
                setErrorMsg('')
                setStep('input')
              }}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="md" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={selectionStats.activities === 0 && selectionStats.days === 0}
              >
                {mergeMode === 'replace' ? 'Replace Itinerary' : `Import ${selectionStats.activities} ${pluralize(selectionStats.activities, 'Activity', 'Activities')}`}
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}
