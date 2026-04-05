import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Modal from '../shared/Modal'
import Button from '../shared/Button'
import Select, { SelectItem } from '../shared/Select'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import { generateId } from '../../utils/helpers'
import { prepareDocumentForStorage, uploadDocumentToStorage } from '../../utils/documentVault'
import { auth } from '../../firebase/config'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'

const LOADING_MESSAGES = [
  'Reading your booking...',
  'Extracting details with AI...',
  'Parsing dates and amounts...',
  'Almost there...',
]

const inputCls = 'w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors'

export default function AddBookingModal({ isOpen, onClose, initialCategory }) {
  const { activeTrip, dispatch, showToast } = useTripContext()
  const { currentUserProfile } = useProfiles()
  const actorId = currentUserProfile?.uid || currentUserProfile?.id

  const [mode, setMode] = useState('input') // 'input' | 'processing' | 'review'
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    category: initialCategory || BOOKING_CATEGORIES[0].id,
    estimatedCost: '',
  })

  const [reviewForm, setReviewForm] = useState(null)
  const [pendingUpload, setPendingUpload] = useState(null)

  useEffect(() => {
    if (isOpen) {
      setMode('input')
      setForm({ name: '', category: initialCategory || BOOKING_CATEGORIES[0].id, estimatedCost: '' })
      setReviewForm(null)
      setPendingUpload(null)
      setError(null)
      setLoadingMsgIdx(0)
    }
  }, [isOpen, initialCategory])

  useEffect(() => {
    if (mode !== 'processing') return
    const id = setInterval(() => {
      setLoadingMsgIdx(i => (i + 1) % LOADING_MESSAGES.length)
    }, 2500)
    return () => clearInterval(id)
  }, [mode])

  const processFile = useCallback(async (file) => {
    setMode('processing')
    setError(null)
    try {
      const prepared = await prepareDocumentForStorage(file, {
        image: { maxEdge: 1600, quality: 0.84 },
      })

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(prepared.storageFile)
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
      })

      let token = ''
      try {
        if (auth.currentUser) token = await auth.currentUser.getIdToken()
      } catch {}

      const res = await fetch(`${VERCEL_API}/api/multimodal-ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ file: base64, mimeType: file.type }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to process file (${res.status})`)
      }

      const { data, vector } = await res.json()

      setPendingUpload({
        prepared,
        vector,
        uploadedBy: auth.currentUser?.uid || '',
        documentTitle: data.title || (file.name ? `Booking: ${file.name}` : 'New Booking'),
      })

      setReviewForm({
        name: data.title || '',
        category: data.type || BOOKING_CATEGORIES[0].id,
        startDate: data.date ? data.date.split('T')[0] : '',
        confirmationNumber: data.confirmationNumber || '',
        amountPaid: typeof data.amountPaid === 'number' ? data.amountPaid : (Number(data.amountPaid) || 0),
        location: data.location || '',
        status: data.status || 'confirmed',
        notes: data.notes || '',
        providerLink: data.providerLink || '',
      })

      setMode('review')
    } catch (err) {
      setError(err.message)
      setMode('input')
    }
  }, [])

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.[0]) processFile(acceptedFiles[0])
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: mode === 'processing',
  })

  const handleManualAdd = () => {
    if (!form.name.trim()) return
    dispatch({
      type: ACTIONS.ADD_BOOKING,
      payload: {
        name: form.name.trim(),
        category: form.category,
        amountPaid: Number(form.estimatedCost) || 0,
        status: 'to_book',
        confirmationNumber: '',
        providerLink: '',
        location: '',
        actorId,
      },
    })
    showToast(`"${form.name.trim()}" added!`)
    onClose()
  }

  const handleReviewAdd = async () => {
    const bookingId = generateId()
    const { prepared, vector, uploadedBy, documentTitle } = pendingUpload

    let documentRecord = null
    try {
      documentRecord = await uploadDocumentToStorage({
        file: prepared.storageFile,
        prepared,
        tripId: activeTrip.id,
        title: documentTitle,
        category: reviewForm.category || 'booking',
        sourceTab: 'bookings',
        sourceEntityType: 'booking',
        sourceEntityId: bookingId,
        uploadedBy,
        parsedSummary: [
          reviewForm.name ? `Title: ${reviewForm.name}` : '',
          reviewForm.location ? `Location: ${reviewForm.location}` : '',
          reviewForm.startDate ? `Date: ${reviewForm.startDate}` : '',
          reviewForm.confirmationNumber ? `Confirmation: ${reviewForm.confirmationNumber}` : '',
        ].filter(Boolean).join('\n'),
        linkedEntities: [{ type: 'booking', id: bookingId, label: documentTitle }],
      })
      dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: documentRecord })
    } catch (err) {
      console.warn('[AddBookingModal] Document upload failed, adding booking without attachment', err)
    }

    dispatch({
      type: ACTIONS.ADD_BOOKING,
      payload: {
        id: bookingId,
        name: reviewForm.name || documentTitle,
        category: reviewForm.category || 'custom',
        startDate: reviewForm.startDate,
        location: reviewForm.location,
        confirmationNumber: reviewForm.confirmationNumber,
        amountPaid: Number(reviewForm.amountPaid) || 0,
        status: reviewForm.status || 'confirmed',
        notes: reviewForm.notes,
        providerLink: reviewForm.providerLink || null,
        ...(documentRecord && {
          documentIds: [documentRecord.id],
          attachments: [{
            id: documentRecord.id,
            documentId: documentRecord.id,
            name: documentRecord.title,
            type: documentRecord.mimeType,
            url: documentRecord.downloadUrl,
            previewUrl: documentRecord.previewUrl,
            dateAdded: documentRecord.createdAt,
          }],
        }),
        vector,
        actorId,
      },
    })

    showToast(`"${reviewForm.name || documentTitle}" added! ✨`)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Booking">
      <div className="p-6 space-y-5">

        {/* ── PROCESSING ── */}
        {mode === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-fade-in text-center">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-accent/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xl animate-pulse">🪄</span>
            </div>
            <div>
              <p className="font-heading font-semibold text-text-primary">
                {LOADING_MESSAGES[loadingMsgIdx]}
              </p>
              <p className="text-xs text-text-muted mt-1">This usually takes a few seconds.</p>
            </div>
          </div>
        )}

        {/* ── INPUT ── */}
        {mode === 'input' && (
          <div className="space-y-4 animate-fade-in">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                relative flex flex-col items-center justify-center gap-2 p-5 text-center
                border-2 border-dashed rounded-[var(--radius-lg)] cursor-pointer transition-all duration-200
                ${isDragActive
                  ? 'bg-accent/5 border-accent scale-[1.01]'
                  : 'bg-bg-secondary/30 border-border/60 hover:bg-bg-secondary/60 hover:border-border'}
              `}
            >
              <input {...getInputProps()} />
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-transform duration-200
                ${isDragActive ? 'scale-110 bg-accent text-white' : 'bg-bg-card border border-border'}`}
              >
                {isDragActive ? '✨' : '🪄'}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {isDragActive ? 'Drop it here!' : 'Upload a confirmation'}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  PDF, image, or screenshot — AI will extract all fields
                </p>
              </div>
              <span className="text-xs text-accent font-medium underline underline-offset-2">
                or click to browse
              </span>
            </div>

            {error && (
              <p className="text-xs text-danger text-center animate-fade-in">{error}</p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-text-muted font-medium">or fill manually</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Manual fields */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Booking Name
              </label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
                placeholder="e.g. Flight to Tokyo"
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Category
                </label>
                <Select
                  value={form.category}
                  onValueChange={v => setForm(p => ({ ...p, category: v }))}
                >
                  {BOOKING_CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Est. Cost
                </label>
                <input
                  type="number"
                  value={form.estimatedCost}
                  onChange={e => setForm(p => ({ ...p, estimatedCost: e.target.value }))}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleManualAdd} disabled={!form.name.trim()}>
                Add Booking
              </Button>
            </div>
          </div>
        )}

        {/* ── REVIEW ── */}
        {mode === 'review' && reviewForm && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-accent/5 border border-accent/20">
              <span className="text-base">✨</span>
              <p className="text-xs text-accent font-medium">
                AI extracted these details — review and edit before saving.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Booking Name
              </label>
              <input
                value={reviewForm.name}
                onChange={e => setReviewForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Category
                </label>
                <Select
                  value={reviewForm.category}
                  onValueChange={v => setReviewForm(p => ({ ...p, category: v }))}
                >
                  {BOOKING_CATEGORIES.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Status
                </label>
                <Select
                  value={reviewForm.status}
                  onValueChange={v => setReviewForm(p => ({ ...p, status: v }))}
                >
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="to_book">To Book</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Date
                </label>
                <input
                  type="date"
                  value={reviewForm.startDate}
                  onChange={e => setReviewForm(p => ({ ...p, startDate: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Amount
                </label>
                <input
                  type="number"
                  value={reviewForm.amountPaid}
                  onChange={e => setReviewForm(p => ({ ...p, amountPaid: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Confirmation #
                </label>
                <input
                  value={reviewForm.confirmationNumber}
                  onChange={e => setReviewForm(p => ({ ...p, confirmationNumber: e.target.value }))}
                  placeholder="e.g. ABC123"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Location
                </label>
                <input
                  value={reviewForm.location}
                  onChange={e => setReviewForm(p => ({ ...p, location: e.target.value }))}
                  placeholder="e.g. Narita Airport"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-2 border-t border-border">
              <Button variant="secondary" onClick={() => setMode('input')}>
                ← Re-upload
              </Button>
              <Button onClick={handleReviewAdd}>
                Add Booking
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
