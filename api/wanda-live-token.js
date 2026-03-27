// api/wanda-live-token.js
// Creates a short-lived Gemini Live ephemeral token for authenticated users.
// GEMINI_API_KEY never leaves the server — the client receives only a
// time-limited token (1-min initiation window, 30-min session max, single use).
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = { runtime: 'edge' }

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-dialog'
const GEMINI_AUTH_TOKENS_URL = 'https://generativelanguage.googleapis.com/v1alpha/authTokens'

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) })
  }
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
  try {
    await verifyFirebaseToken(authHeader)
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }

  try {
    const now = Date.now()
    const res = await fetch(GEMINI_AUTH_TOKENS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        uses: 1,
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: `models/${LIVE_MODEL}`,
          config: {
            responseModalities: ['AUDIO'],
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[wanda-live-token] Gemini token API error:', err)
      return new Response(JSON.stringify({ error: 'Token creation failed' }), {
        status: 502,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const data = await res.json()
    // data.name = "auth_tokens/<hash>" — this is the ephemeral token value
    return new Response(JSON.stringify({ token: data.name }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[wanda-live-token] Unexpected error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
}
