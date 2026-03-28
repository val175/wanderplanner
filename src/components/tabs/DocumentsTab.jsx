import { useMemo, useRef, useState } from 'react'
import TabHeader from '../common/TabHeader'
import Card from '../shared/Card'
import Button from '../shared/Button'
import Modal from '../shared/Modal'
import EmptyState from '../shared/EmptyState'
import Select, { SelectItem } from '../shared/Select'
import { useTripContext } from '../../context/TripContext'
import { useProfiles } from '../../context/ProfileContext'
import { ACTIONS } from '../../state/tripReducer'
import { getDocumentsForTrip, uploadDocumentToStorage, deleteDocumentFromStorage } from '../../utils/documentVault'
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
  const { state, activeTrip, dispatch, isReadOnly } = useTripContext()
  const { currentUserProfile } = useProfiles()
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
      const uploaded = await uploadDocumentToStorage({
        file,
        tripId: activeTrip.id,
        title: file.name.replace(/\.[^.]+$/, ''),
        sourceTab: 'documents',
        sourceEntityType: 'manual',
        uploadedBy: currentUserProfile?.uid || currentUserProfile?.id || '',
      })
      dispatch({ type: ACTIONS.ADD_DOCUMENT, payload: uploaded })
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
