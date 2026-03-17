// api/tts.js — Gemini TTS proxy (Chirp HD voices, free via GEMINI_API_KEY)
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

const rateLimitMap = new Map() // uid → timestamp[]
const RATE_LIMIT = 30
const WINDOW_MS = 60_000

// Voice options: Aoede (warm female), Kore (bright female), Puck (friendly male),
// Charon (calm male), Fenrir (expressive male), Zephyr, Orbit, etc.
const VOICE_NAME = 'Aoede'

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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'TTS not configured' })
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: VOICE_NAME },
              },
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[tts] Gemini TTS error:', err)
      return res.status(502).json({ error: 'TTS service error' })
    }

    const data = await response.json()
    const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData
    if (!inlineData?.data) {
      console.error('[tts] No audio data in response:', JSON.stringify(data))
      return res.status(502).json({ error: 'No audio returned' })
    }

    return res.status(200).json({
      audioContent: inlineData.data,
      mimeType: inlineData.mimeType || 'audio/wav',
    })
  } catch (err) {
    console.error('[tts] Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
