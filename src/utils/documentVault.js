import { generateId } from './helpers'
import { auth } from '../firebase/config'

async function getAuthHeaders() {
  try {
    const token = await auth.currentUser?.getIdToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'application/json', 'text/markdown; charset=utf-8'])

function safeFileName(name = 'document') {
  return String(name || 'document')
    .trim()
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'document'
}

export function inferDocumentKind(mimeType = '', name = '') {
  const lower = String(mimeType || '').toLowerCase()
  const lowerName = String(name || '').toLowerCase()
  if (lower.startsWith('image/')) return 'image'
  if (lower === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf'
  if (TEXT_MIME_TYPES.has(lower) || lower.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.json')) {
    return 'text'
  }
  return 'file'
}

export function inferDocumentCategory({ sourceTab, sourceEntityType, kind, name = '' } = {}) {
  if (sourceTab === 'budget' || sourceEntityType === 'expense') return 'receipt'
  if (sourceTab === 'bookings' || sourceEntityType === 'booking') return 'booking'
  if (sourceTab === 'voting' || sourceEntityType === 'idea') return 'idea'
  if (sourceTab === 'itinerary') return 'itinerary'
  if (kind === 'pdf' || kind === 'image') return 'travel-doc'
  if (String(name).toLowerCase().includes('receipt')) return 'receipt'
  return 'import'
}

export function inferTitle(name = 'Document') {
  return String(name)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Document'
}

export function textToBlob(text, mimeType = 'text/plain') {
  return new Blob([text], { type: mimeType })
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',')
  const mimeMatch = header?.match(/data:([^;]+);base64/i)
  const mimeType = mimeMatch?.[1] || 'application/octet-stream'
  const bytes = atob(base64 || '')
  const array = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i)
  return new Blob([array], { type: mimeType })
}

export async function compressImageFile(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })

  const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0, width, height)

  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality))
  return {
    blob: blob || file,
    mimeType,
    width,
    height,
    previewDataUrl: canvas.toDataURL(mimeType, quality),
  }
}

async function readTextFallback(file) {
  try {
    return await file.text()
  } catch {
    return ''
  }
}

export async function prepareDocumentForStorage(file, options = {}) {
  const kind = inferDocumentKind(file?.type, file?.name)
  if (kind === 'image') {
    const compressed = await compressImageFile(file, options.image || {})
    return {
      storageFile: compressed.blob,
      mimeType: compressed.mimeType,
      previewDataUrl: compressed.previewDataUrl,
      kind,
      sizeBytes: compressed.blob.size,
    }
  }

  if (kind === 'text') {
    const text = await readTextFallback(file)
    return {
      storageFile: file,
      mimeType: file.type || 'text/plain',
      previewDataUrl: '',
      kind,
      text,
      sizeBytes: file.size,
    }
  }

  return {
    storageFile: file,
    mimeType: file.type || (kind === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    previewDataUrl: '',
    kind,
    sizeBytes: file.size,
  }
}

function normalizeLinkedEntities(entities = []) {
  return entities
    .map(entity => {
      if (!entity) return null
      if (typeof entity === 'string') return { type: 'unknown', id: entity }
      if (!entity.id) return null
      return {
        type: entity.type || entity.entityType || 'unknown',
        id: entity.id,
        label: entity.label || entity.name || '',
      }
    })
    .filter(Boolean)
}

export async function uploadDocumentToStorage({
  file,
  prepared = null,
  tripId,
  title,
  category,
  sourceTab,
  sourceEntityType,
  sourceEntityId,
  uploadedBy,
  parsedSummary = '',
  previewText = '',
  linkedEntities = [],
  kind: kindOverride = null,
  forceOriginal = false,
  imageOptions = {},
}) {
  if (!file) throw new Error('No file provided')
  if (!tripId) throw new Error('Missing tripId')

  const finalPrepared = prepared || (forceOriginal
    ? {
        storageFile: file,
        mimeType: file.type || 'application/octet-stream',
        previewDataUrl: '',
        kind: inferDocumentKind(file.type, file.name),
        sizeBytes: file.size,
      }
    : await prepareDocumentForStorage(file, { image: imageOptions }))

  const docId = generateId()
  const fileName = safeFileName(file.name || `${title || 'document'}.${finalPrepared.kind === 'text' ? 'txt' : finalPrepared.kind === 'pdf' ? 'pdf' : 'bin'}`)
  
  const formData = new FormData()
  formData.append('file', finalPrepared.storageFile, fileName)
  formData.append('tripId', tripId)
  formData.append('docId', docId)

  const apiUrl = import.meta.env.VITE_STORAGE_API_URL || 'http://localhost:3001'
  const response = await fetch(`${apiUrl}/upload`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to upload document')
  }

  const result = await response.json()
  const downloadUrl = result.file.url
  const storagePath = result.file.path

  return {
    id: docId,
    tripId,
    title: title || inferTitle(file.name),
    kind: kindOverride || finalPrepared.kind,
    category: category || inferDocumentCategory({ sourceTab, sourceEntityType, kind: finalPrepared.kind, name: file.name }),
    mimeType: finalPrepared.mimeType,
    storagePath,
    downloadUrl,
    previewUrl: finalPrepared.kind === 'image' ? downloadUrl : downloadUrl,
    previewText: previewText || finalPrepared.text || '',
    parsedSummary,
    sourceTab: sourceTab || 'documents',
    sourceEntityType: sourceEntityType || '',
    sourceEntityId: sourceEntityId || '',
    uploadedBy: uploadedBy || '',
    sizeBytes: finalPrepared.sizeBytes ?? file.size ?? 0,
    fileName,
    createdAt: new Date().toISOString(),
    linkedEntities: normalizeLinkedEntities(linkedEntities),
  }
}

export async function deleteDocumentFromStorage(storagePath) {
  if (!storagePath) return
  const apiUrl = import.meta.env.VITE_STORAGE_API_URL || 'http://localhost:3001'
  try {
    const response = await fetch(`${apiUrl}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ path: storagePath }),
    })
    
    if (!response.ok) {
      console.error('Failed to delete from storage API', await response.text())
    }
  } catch (error) {
    console.error('Network error during file deletion', error)
  }
}

export function getDocumentsForTrip(state, tripId) {
  if (!tripId) return {}
  return state.documentsByTrip?.[tripId] || {}
}
