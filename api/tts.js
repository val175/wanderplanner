// api/tts.js — Google Cloud TTS proxy (Chirp3-HD voices, FREE tier)
// Free: $0.00 per 1M characters. Requires GOOGLE_TTS_API_KEY (GCP API key
// with Cloud Text-to-Speech API enabled, Application restrictions: None).
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

// Edge runtime = near-zero cold start (same as api/chat.js)
export const config = { runtime: 'edge' }

const VOICE_NAME = 'en-US-Chirp3-HD-Achernar'

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_\n]+)_{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/\p{Extended_Pictographic}/gu, '') // strip emojis
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
  }

  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    try {
      await verifyFirebaseToken(authHeader)
    } catch (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const cleanText = stripMarkdown(text)
    if (!cleanText) {
      return new Response(JSON.stringify({ error: 'No speakable text' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'TTS not configured' }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'TTS service error' }), {
        status: 502,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    if (!data.audioContent) {
      return new Response(JSON.stringify({ error: 'No audio returned' }), {
        status: 502,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ audioContent: data.audioContent, mimeType: 'audio/mpeg' }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[tts] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
}
