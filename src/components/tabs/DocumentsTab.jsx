import { useMemo, useRef, useState, useEffect } from 'react'
import { Eye, Download, Trash2 } from 'lucide-react'
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

const UPLOAD_MESSAGES = [
  'Uploading file...',
  'Analyzing document...',
  'Classifying contents...',
  'Linking to your trip...',
  'Almost done...',
]

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

  // Budget category IDs are random UUIDs, so match by category name instead.
  // Each entry is [concept, terms[]]. For each budget category, find which group
  // its name belongs to, then check if the expense type matches the same group.
  const aliases = [
    ['flight',    ['flight', 'flights', 'airfare', 'airline']],
    ['food',      ['food', 'restaurant', 'restaurants', 'dining', 'meal']],
    ['lodging',   ['lodging', 'hotel', 'stay', 'accommodation', 'hostel', 'resort']],
    ['activity',  ['activity', 'tour', 'ticket', 'event', 'entrance', 'admission']],
    ['transport', ['transport', 'transfer', 'bus', 'train', 'taxi', 'grab', 'transit']],
    ['shopping',  ['shopping', 'retail', 'store', 'mall']],
    ['concert',   ['concert', 'music', 'show', 'festival', 'gig']],
  ]

  for (const category of budget) {
    const catName = (category.name || '').toLowerCase()
    for (const [, terms] of aliases) {
      if (terms.some(term => catName.includes(term))) {
        if (terms.some(term => normalized.includes(term))) {
          return category.name
        }
        break
      }
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
            <img src={doc.previewUrl || doc.downloadUrl} alt={doc.title} className="w-full h-full object-contain max-h-[70vh]" loading="lazy" />
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
                <span key={`${link.type}-${link.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs bg-bg-secondary border border-border text-text-secondary">
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
  const [uploadMsgIndex, setUploadMsgIndex] = useState(0)

  useEffect(() => {
    if (isUploading) {
      const id = setInterval(() => setUploadMsgIndex(i => (i + 1) % UPLOAD_MESSAGES.length), 2500)
      return () => clearInterval(id)
    } else {
      setUploadMsgIndex(0)
    }
  }, [isUploading])

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
        const amountPaid = toBase64Number(parsed.amountPaid)

        // Determine pax count from AI-extracted passengerCount, clamped to actual traveler count
        const aiPaxCount = Math.max(1, Math.round(Number(parsed.passengerCount) || 0))
        const bookingPaxCount = (aiPaxCount > 1 && aiPaxCount <= travelerIds.length)
          ? aiPaxCount
          : travelerIds.length || 1

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
            amountPaid,
            status: parsed.status || 'confirmed',
            notes: parsed.notes || '',
            providerLink: parsed.providerLink || null,
            travelerIds,
            paxCount: bookingPaxCount,
            seriesId: parsed.groupId || parsed.seriesId || null,
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

        // Also log to the spending log so the Budget tab reflects this cost.
        // Flights, transport and lodging all carry a real monetary cost — split
        // equally among the travelers covered by this booking.
        const BUDGET_BOOKING_TYPES = new Set(['flight', 'lodging', 'transport', 'concert', 'activity'])
        if (amountPaid > 0 && BUDGET_BOOKING_TYPES.has(parsedType)) {
          const splitMembers = travelerIds.slice(0, bookingPaxCount)
          const spendCategory = resolveExpenseCategory(parsedType, tripBudget)
          const expenseId = generateId()
          dispatch({
            type: ACTIONS.ADD_SPENDING,
            payload: {
              id: expenseId,
              description: parsedTitle,
              amount: amountPaid,
              category: spendCategory,
              paidBy: firstTravelerId,
              splitBetween: splitMembers,
              travelerIds: splitMembers,
              paxCount: splitMembers.length,
              splits: buildSplits(amountPaid, splitMembers, 'equal'),
              splitMode: 'equal',
              splitStrategy: 'all',
              source: 'booking',
              bookingId,
              documentId: bookingRecord.id,
              date: parsed.date ? parsed.date.split('T')[0] : new Date().toISOString().slice(0, 10),
            }
          })
        }

        showToast?.(`"${parsedTitle}" added to Bookings & Budget`)
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
              travelerIds,
              paxCount: travelerIds.length || 1,
              splits: buildSplits(Number((Number(item.amount || 0) * conversionRate).toFixed(2)), travelerIds, 'equal'),
              splitMode: 'equal',
              splitStrategy: 'all',
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
              travelerIds,
              paxCount: travelerIds.length || 1,
              splits: buildSplits(toBase64Number(parsed.amountPaid) || toBase64Number(parsed.amount), travelerIds, 'equal'),
              splitMode: 'equal',
              splitStrategy: 'all',
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
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  // Undo-first delete: remove from state immediately, keep the stored file
  // alive for the undo window, and only hard-delete storage once it expires.
  const pendingDeletesRef = useRef(new Map())
  const handleDeleteDoc = (doc) => {
    dispatch({ type: ACTIONS.DELETE_DOCUMENT, payload: { id: doc.id, tripId: doc.tripId } })
    hapticImpact('light')
    const timeoutId = setTimeout(() => {
      pendingDeletesRef.current.delete(doc.id)
      deleteDocumentFromStorage(doc.storagePath)
    }, 6500)
    pendingDeletesRef.current.set(doc.id, timeoutId)
    showToast(`Deleted "${doc.title}"`, 'info', {
      label: 'Undo',
      onClick: () => {
        clearTimeout(pendingDeletesRef.current.get(doc.id))
        pendingDeletesRef.current.delete(doc.id)
        dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: doc })
      },
    })
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
            <Select value={filter} onValueChange={setFilter} className="!w-auto min-w-[150px]" size="sm">
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

      <Modal isOpen={isUploading} onClose={() => {}} title="" maxWidth="max-w-sm">
        <div className="flex flex-col items-center justify-center py-12 px-6 space-y-5 animate-fade-in text-center">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-accent/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-accent rounded-full border-t-transparent animate-spin"></div>
            <span className="text-2xl animate-pulse">📄</span>
          </div>
          <div>
            <h3 className="text-xl font-heading font-semibold text-text-primary mb-1">
              {UPLOAD_MESSAGES[uploadMsgIndex]}
            </h3>
            <p className="text-sm text-text-muted">Hang tight, this usually takes a few seconds.</p>
          </div>
        </div>
      </Modal>

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
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(doc => (
                  <tr key={doc.id} className="border-t border-border hover:bg-bg-hover transition-colors first:border-t-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
                          {doc.mimeType?.startsWith('image/') ? (
                            <img src={doc.previewUrl || doc.downloadUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-base">{doc.kind === 'pdf' ? '📕' : doc.kind === 'text' ? '📝' : '📎'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-heading font-semibold text-sm text-text-primary truncate max-w-[180px] sm:max-w-[260px]">{doc.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{getKindLabel(doc)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {doc.category === 'booking' ? (
                        <button
                          onClick={() => dispatch({ type: ACTIONS.SET_TAB, payload: 'bookings' })}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer"
                          title="Go to Bookings"
                        >
                          {doc.category}
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-pill)] text-xs font-semibold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
                          {doc.category || 'import'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted hidden md:table-cell whitespace-nowrap">
                      {formatDate(doc.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-text-muted hover:text-accent transition-colors" title="Preview" onClick={() => setSelectedDocId(doc.id)}>
                          <Eye size={15} />
                        </button>
                        <button className="p-1.5 text-text-muted hover:text-accent transition-colors" title="Download" onClick={() => window.open(doc.downloadUrl, '_blank', 'noopener,noreferrer')}>
                          <Download size={15} />
                        </button>
                        {!isReadOnly && (
                          <button className="p-1.5 text-text-muted hover:text-danger transition-colors" title="Delete" onClick={() => handleDeleteDoc(doc)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  )
}
