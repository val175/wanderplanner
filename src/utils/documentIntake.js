import { auth } from '../firebase/config'

const VERCEL_API = 'https://wanderplan-rust.vercel.app'

const BOOKING_TYPES = new Set(['flight', 'lodging', 'activity', 'transport', 'concert'])
const EXPENSE_TYPES = new Set(['food', 'shopping'])
const RECEIPT_HINTS = ['receipt', 'invoice', 'bill', 'expense', 'payment', 'voucher']

export async function fileToBase64(file) {
  if (!file) return ''
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function getAuthToken() {
  try {
    return await auth.currentUser?.getIdToken()
  } catch (error) {
    console.warn('[documentIntake] Failed to fetch auth token', error)
    return ''
  }
}

function looksLikeReceipt(data, file) {
  const haystack = [
    data?.title,
    data?.notes,
    file?.name,
  ].filter(Boolean).join(' ').toLowerCase()
  return RECEIPT_HINTS.some(term => haystack.includes(term))
}

export function classifyDocumentWorkflow(data = {}, file) {
  const type = String(data.type || '').toLowerCase()
  if (BOOKING_TYPES.has(type)) return 'booking'
  if (EXPENSE_TYPES.has(type) || looksLikeReceipt(data, file)) return 'expense'
  return 'document'
}

export async function parseDocumentIntake(file, prepared = null) {
  if (!file) throw new Error('No file provided')

  const uploadFile = prepared?.storageFile || file
  const mimeType = prepared?.mimeType || file.type || 'application/octet-stream'
  const token = await getAuthToken()
  const fileBase64 = await fileToBase64(uploadFile)

  const ingestResponse = await fetch(`${VERCEL_API}/api/multimodal-ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ file: fileBase64, mimeType }),
  })

  if (!ingestResponse.ok) {
    const errData = await ingestResponse.json().catch(() => ({}))
    throw new Error(errData.error || `Document parsing failed (${ingestResponse.status})`)
  }

  const ingest = await ingestResponse.json()
  const workflow = classifyDocumentWorkflow(ingest.data || {}, file)

  let receipt = null
  if (workflow === 'expense' && String(mimeType).startsWith('image/')) {
    try {
      const receiptResponse = await fetch(`${VERCEL_API}/api/budget/scan-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ imageBase64: fileBase64 }),
      })

      if (receiptResponse.ok) {
        receipt = await receiptResponse.json()
      }
    } catch (error) {
      console.warn('[documentIntake] Receipt scan fallback failed', error)
    }
  }

  return { ingest, receipt, workflow, fileBase64 }
}
