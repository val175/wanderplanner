import { useMemo, useRef, useState } from 'react'
import TabHeader from '../common/TabHeader'
import Card from '../shared/Card'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import EmptyState from '../shared/EmptyState'
import Select, { SelectItem } from '../shared/Select'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { useTripTravelers } from '../../hooks/useTripTravelers'
import { ACTIONS } from '../../state/tripReducer'
import { getDocumentsForTrip, uploadDocumentToStorage, deleteDocumentFromStorage, prepareDocumentForStorage } from '../../utils/documentVault'
import { parseDocumentIntake } from '../../utils/documentIntake'
import { generateId } from '../../utils/helpers'
import { buildSplits } from '../../utils/splitwise'
import { BOOKING_CATEGORIES } from '../../constants/tabs'
import { formatDate } from '../../utils/helpers'
import { hapticImpact } from '../../utils/haptics'

const CATEGORY_LABELS = {
  all: 'All',
  booking: 'Bookings',
  receipt: 'Receipts',
  import: 'Imports',
  itinerary: 'Itinerary',
  idea: 'Ideas',
  'travel-doc': 'Travel Docs',
}

const BOOKING_TYPE_IDS = new Set(BOOKING_CATEGORIES.map(cat => cat.id))

function toBase64Number(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function getTripTravelerIds(activeTrip, travelers) {
  if (Array.isArray(travelers) && travelers.length > 0) {
    return travelers.map(traveler => traveler.id).filter(Boolean)
  }
  return (activeTrip?.travelerIds || []).filter(Boolean)
}

function resolveBookingCategory(type) {
  if (BOOKING_TYPE_IDS.has(type)) return type
  if (type === 'lodging') return 'lodging'
  return 'activity'
}

function resolveExpenseCategory(type, budget = []) {
  const normalized = String(type || '').toLowerCase()
  const directMatch = budget.find(cat =>
    cat.id === normalized ||
    cat.name?.toLowerCase() === normalized
  )
  if (directMatch) return directMatch.name

  const aliases = {
    food: ['food', 'restaurant', 'dining', 'meal'],
    lodging: ['lodging', 'hotel', 'stay'],
    flight: ['flight', 'airfare', 'airline'],
    activity: ['activity', 'tour', 'ticket', 'event'],
    transport: ['transport', 'transfer', 'bus', 'train', 'taxi'],
    shopping: ['shopping', 'retail', 'store'],
    concert: ['concert', 'music', 'show'],
  }

  for (const category of budget) {
    const bucket = aliases[category.id] || []
    if (bucket.some(term => normalized.includes(term))) {
      return category.name
    }
  }

  const other = budget.find(cat => cat.name?.toLowerCase() === 'other')
  return other?.name || budget[0]?.name || 'Other'
}

function buildBookingSummary(data = {}) {
  return [
    data.title ? `Title: ${data.title}` : '',
    data.location ? `Location: ${data.location}` : '',
    data.date ? `Date: ${data.date}` : '',
    data.confirmationNumber ? `Confirmation: ${data.confirmationNumber}` : '',
  ].filter(Boolean).join('\n')
}

function PreviewModal({ doc, isOpen, onClose }) {
  if (!doc) return null

  const isImage = doc.mimeType?.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'
  const isText = doc.mimeType?.startsWith('text/') || doc.kind === 'text' || !!doc.previewText

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={doc.title || 'Document'} maxWidth="max-w-3xl">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-text-muted font-semibold">{doc.category || 'Document'}</p>
            <p className="font-heading font-semibold text-text-primary truncate">{doc.title}</p>
            <p className="text-xs text-text-muted mt-1">{doc.mimeType || 'file'} · {formatDate(doc.createdAt, 'medium')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer')}>
              Download
            </Button>
          </div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-bg-secondary/30 overflow-hidden min-h-[280px]">
          {isImage && (
            <img src={doc.previewUrl || doc.downloadUrl} alt={doc.title} className="w-full h-full object-contain max-h-[70vh]" />
          )}
          {isPdf && (
            <iframe title={doc.title} src={doc.downloadUrl} className="w-full h-[70vh] border-0" />
          )}
          {isText && (
            <pre className="whitespace-pre-wrap p-4 text-sm text-text-primary font-mono leading-relaxed max-h-[70vh] overflow-auto">
              {doc.previewText || doc.parsedSummary || 'No text preview available.'}
            </pre>
          )}
          {!isImage && !isPdf && !isText && (
            <div className="p-6 text-sm text-text-muted">
              No preview available for this file type.
            </div>
          )}
        </div>

        {doc.linkedEntities?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-text-muted font-semibold">Linked to</p>
            <div className="flex flex-wrap gap-2">
              {doc.linkedEntities.map(link => (
                <span key={`${link.type}-${link.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-bg-secondary border border-border text-text-secondary">
                  {link.type}
                  {link.label ? ` · ${link.label}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function DocumentsTab() {
  const { state, activeTrip, dispatch, isReadOnly, showToast } = useTripContext()
  const { currentUserProfile } = useProfiles()
  const travelers = useTripTravelers()
  const fileInputRef = useRef(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedDocId, setSelectedDocId] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  const tripDocs = getDocumentsForTrip(state, activeTrip?.id)
  const docs = useMemo(() => Object.values(tripDocs || {}).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)), [tripDocs])

  const categories = useMemo(() => {
    const set = new Set(['all'])
    docs.forEach(doc => set.add(doc.category || 'import'))
    return Array.from(set)
  }, [docs])

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter(doc => {
      if (filter !== 'all' && (doc.category || 'import') !== filter) return false
      if (!q) return true
      const haystack = [
        doc.title,
        doc.mimeType,
        doc.sourceTab,
        doc.sourceEntityType,
        doc.parsedSummary,
        doc.previewText,
        ...(doc.linkedEntities || []).map(link => `${link.type} ${link.label || ''}`),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [docs, filter, search])

  const selectedDoc = tripDocs?.[selectedDocId] || null

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !activeTrip?.id) return
    setIsUploading(true)
    try {
      const preparedFile = await prepareDocumentForStorage(file, {
        image: { maxEdge: 1600, quality: 0.84 },
      })

      const prepared = await parseDocumentIntake(file, preparedFile).catch(async () => {
        const fallback = await uploadDocumentToStorage({
          file: preparedFile.storageFile,
          prepared: preparedFile,
          tripId: activeTrip.id,
          title: file.name.replace(/\.[^.]+$/, ''),
          sourceTab: 'documents',
          sourceEntityType: 'manual',
          uploadedBy: currentUserProfile?.uid || currentUserProfile?.id || '',
        })
        dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: fallback })
        return null
      })

      if (!prepared) {
        hapticImpact('light')
        return
      }

      const parsed = prepared.ingest?.data || {}
      const parsedTitle = parsed.title || file.name.replace(/\.[^.]+$/, '') || 'Document'
      const parsedType = String(parsed.type || '').toLowerCase()
      const workflow = prepared.workflow
      const uploadedBy = currentUserProfile?.uid || currentUserProfile?.id || ''
      const tripBudget = activeTrip.budget || []
      const travelerIds = getTripTravelerIds(activeTrip, travelers)
      const firstTravelerId = travelerIds[0] || currentUserProfile?.uid || currentUserProfile?.id || ''

      if (workflow === 'booking') {
        const bookingId = generateId()
        const category = resolveBookingCategory(parsedType)
        const bookingRecord = await uploadDocumentToStorage({
          file: preparedFile.storageFile,
          prepared: preparedFile,
          tripId: activeTrip.id,
          title: parsedTitle,
          category: 'booking',
          sourceTab: 'documents',
          sourceEntityType: 'booking',
          sourceEntityId: bookingId,
          uploadedBy,
          parsedSummary: buildBookingSummary(parsed),
          linkedEntities: [{ type: 'booking', id: bookingId, label: parsedTitle }],
        })

        dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: bookingRecord })
        dispatch({
          type: ACTIONS.ADD_BOOKING,
          payload: {
            id: bookingId,
            name: parsedTitle,
            category,
            startDate: parsed.date ? parsed.date.split('T')[0] : '',
            location: parsed.location || '',
            confirmationNumber: parsed.confirmationNumber || '',
            amountPaid: toBase64Number(parsed.amountPaid),
            status: parsed.status || 'confirmed',
            notes: parsed.notes || '',
            providerLink: parsed.providerLink || null,
            documentIds: [bookingRecord.id],
            attachments: [{
              id: bookingRecord.id,
              documentId: bookingRecord.id,
              name: bookingRecord.title,
              type: bookingRecord.mimeType,
              url: bookingRecord.downloadUrl,
              previewUrl: bookingRecord.previewUrl,
              dateAdded: bookingRecord.createdAt,
            }],
            vector: prepared.ingest?.vector || [],
          }
        })

        showToast?.(`"${parsedTitle}" added to Bookings`)
        hapticImpact('light')
        return
      }

      if (workflow === 'expense') {
        const receiptItems = prepared.receipt?.items || []
        const receiptCurrency = String(prepared.receipt?.currency || 'PHP').toUpperCase()
        const conversionRate = receiptCurrency === 'PHP' ? 1 : await (async () => {
          try {
            const rateRes = await fetch(`https://api.exchangerate-api.com/v4/latest/${receiptCurrency}`)
            if (!rateRes.ok) return 1
            const rateData = await rateRes.json()
            return rateData.rates?.PHP || 1
          } catch {
            return 1
          }
        })()

        const hasItemizedReceipt = receiptItems.length > 0
        const itemizedEntries = hasItemizedReceipt
          ? receiptItems.map(item => ({
              id: generateId(),
              description: item.description,
              amount: Number((Number(item.amount || 0) * conversionRate).toFixed(2)),
              category: resolveExpenseCategory(item.category, tripBudget),
              paidBy: firstTravelerId,
              splitBetween: travelerIds,
              splits: buildSplits(Number((Number(item.amount || 0) * conversionRate).toFixed(2)), travelerIds, 'equal'),
              splitMode: 'equal',
            }))
          : []

        const expensePayloads = hasItemizedReceipt
          ? itemizedEntries
          : [{
              id: generateId(),
              description: parsedTitle,
              amount: toBase64Number(parsed.amountPaid) || toBase64Number(parsed.amount),
              category: resolveExpenseCategory(parsedType, tripBudget),
              paidBy: firstTravelerId,
              splitBetween: travelerIds,
              splits: buildSplits(toBase64Number(parsed.amountPaid) || toBase64Number(parsed.amount), travelerIds, 'equal'),
              splitMode: 'equal',
            }]

        const expenseDoc = await uploadDocumentToStorage({
          file: preparedFile.storageFile,
          prepared: preparedFile,
          tripId: activeTrip.id,
          title: parsedTitle,
          category: 'receipt',
          sourceTab: 'documents',
          sourceEntityType: 'receipt',
          sourceEntityId: expensePayloads[0]?.id,
          uploadedBy,
          parsedSummary: hasItemizedReceipt
            ? receiptItems.map(item => `${item.description}: ${item.amount} ${receiptCurrency}`).join('\n')
            : buildBookingSummary(parsed),
          previewText: hasItemizedReceipt
            ? receiptItems.map(item => `${item.description} - ${item.amount} ${receiptCurrency}`).join('\n')
            : '',
          linkedEntities: expensePayloads.map(item => ({ type: 'expense', id: item.id, label: item.description })),
        })

        dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: expenseDoc })

        expensePayloads.forEach(item => {
          dispatch({
            type: ACTIONS.ADD_SPENDING,
            payload: {
              ...item,
              documentId: expenseDoc.id,
            },
          })
        })

        showToast?.(`"${parsedTitle}" added to Budget`)
        hapticImpact('light')
        return
      }

      const uploaded = await uploadDocumentToStorage({
        file: preparedFile.storageFile,
        prepared: preparedFile,
        tripId: activeTrip.id,
        title: parsedTitle,
        sourceTab: 'documents',
        sourceEntityType: 'manual',
        uploadedBy,
        parsedSummary: buildBookingSummary(parsed),
      })
      dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: uploaded })
      showToast?.('Document added to vault')
      hapticImpact('light')
    } catch (err) {
      console.error('[DocumentsTab] Upload failed:', err)
      window.alert(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const handleDelete = async (doc) => {
    if (!doc) return
    const ok = window.confirm(`Delete "${doc.title}" from the vault?`)
    if (!ok) return
    try {
      await deleteDocumentFromStorage(doc.storagePath)
      dispatch({ type: ACTIONS.DELETE_DOCUMENT, payload: { id: doc.id, tripId: doc.tripId } })
    } catch (err) {
      console.error('[DocumentsTab] Delete failed:', err)
      window.alert(err.message || 'Could not delete document')
    }
  }

  const getKindLabel = (doc) => {
    if (doc.kind === 'image') return 'Image'
    if (doc.kind === 'pdf') return 'PDF'
    if (doc.kind === 'text') return 'Text'
    return 'File'
  }

  if (!activeTrip) return null

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      <TabHeader
        leftSlot={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">📄</span>
              <div>
                <p className="font-heading font-semibold text-text-primary">Documents Vault</p>
                <p className="text-xs text-text-muted">{docs.length} file{docs.length === 1 ? '' : 's'} stored for this trip</p>
              </div>
            </div>
          </div>
        }
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search docs..."
              className="w-44 max-w-[45vw] px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            <Select value={filter} onValueChange={setFilter} className="!w-auto min-w-[150px] h-9 text-xs">
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </Select>
            {!isReadOnly && (
              <Button variant="secondary" size="sm" onClick={handleUploadClick} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload File'}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/plain,text/markdown,application/json"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        }
      />

      <PreviewModal
        doc={selectedDoc}
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDocId(null)}
      />

      {filteredDocs.length === 0 ? (
        <Card className="p-0 border-border bg-bg-card">
          <EmptyState
            emoji="🗂️"
            title={docs.length === 0 ? 'No documents yet' : 'No matching documents'}
            subtitle={docs.length === 0 ? 'Upload booking PDFs, receipt images, or trip imports and they will live here.' : 'Try a different search or category filter.'}
            action={!isReadOnly ? <Button onClick={handleUploadClick}>Upload File</Button> : null}
            compact
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocs.map(doc => (
            <Card key={doc.id} className="p-4 border-border bg-bg-card">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-[var(--radius-md)] bg-bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {doc.mimeType?.startsWith('image/') ? (
                    <img src={doc.previewUrl || doc.downloadUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{doc.kind === 'pdf' ? '📕' : doc.kind === 'text' ? '📝' : '📎'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-semibold text-text-primary truncate">{doc.title}</p>
                      <p className="text-xs text-text-muted mt-0.5">{getKindLabel(doc)} · {formatDate(doc.createdAt, 'short')}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 shrink-0">
                      {doc.category || 'import'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-2 max-h-10 overflow-hidden">
                    {doc.parsedSummary || doc.previewText || doc.sourceTab || 'Stored document'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelectedDocId(doc.id)}>Preview</Button>
                <Button size="sm" variant="secondary" onClick={() => window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer')}>Download</Button>
                {!isReadOnly && (
                  <Button size="sm" variant="secondary" onClick={() => handleDelete(doc)}>
                    Delete
                  </Button>
                )}
              </div>

              {doc.linkedEntities?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {doc.linkedEntities.slice(0, 3).map(link => (
                    <span key={`${doc.id}-${link.type}-${link.id}`} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-bg-secondary text-text-muted border border-border">
                      {link.type}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
