// api/tts.js — Google Cloud TTS proxy (Chirp3-HD voices, FREE tier)
// Free: $0.00 per 1M characters. Requires GOOGLE_TTS_API_KEY (GCP API key
// with Cloud Text-to-Speech API enabled).
//
// Voice options (all free Chirp3-HD): Aoede (warm F), Kore (bright F),
// Puck (friendly M), Charon (calm M), Fenrir (expressive M), Zephyr, Orbit
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

const rateLimitMap = new Map() // uid → timestamp[]
const RATE_LIMIT = 30
const WINDOW_MS = 60_000

const VOICE_NAME = 'en-US-Chirp3-HD-Aoede'

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')              // code blocks
    .replace(/`[^`]+`/g, '')                     // inline code
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')  // bold/italic
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1')    // underscores
    .replace(/^#{1,6}\s+/gm, '')                 // headings
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')        // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // links → display text
    .replace(/^[-*+]\s+/gm, '')                  // unordered lists
    .replace(/^\d+\.\s+/gm, '')                  // ordered lists
    .replace(/^-{3,}$/gm, '')                    // horizontal rules
    .replace(/\n{3,}/g, '\n\n')                  // extra newlines
    .trim()
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    const cors = getCorsHeaders(req)
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    return res.status(200).end()
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const cors = getCorsHeaders(req)
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))

  try {
    // Auth
    const authHeader = req.headers['authorization'] || req.headers['Authorization']
    let userPayload
    try {
      userPayload = await verifyFirebaseToken(authHeader)
    } catch (authError) {
      return res.status(401).json({ error: authError.message })
    }

    // Rate limit
    const uid = userPayload.uid
    const now = Date.now()
    const hits = (rateLimitMap.get(uid) || []).filter(t => now - t < WINDOW_MS)
    if (hits.length >= RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment.' })
    }
    rateLimitMap.set(uid, [...hits, now])

    const { text } = req.body
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing text' })
    }

    const cleanText = stripMarkdown(text)
    if (!cleanText) {
      return res.status(400).json({ error: 'No speakable text' })
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'TTS not configured' })
    }

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: cleanText },
          voice: { languageCode: 'en-US', name: VOICE_NAME },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[tts] Google Cloud TTS error:', err)
      return res.status(502).json({ error: 'TTS service error' })
    }

    const data = await response.json()
    if (!data.audioContent) {
      console.error('[tts] No audioContent in response')
      return res.status(502).json({ error: 'No audio returned' })
    }

    return res.status(200).json({
      audioContent: data.audioContent,
      mimeType: 'audio/mpeg',
    })
  } catch (err) {
    console.error('[tts] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
