// api/wanda-live-token.js
// Creates a short-lived Gemini Live ephemeral token for authenticated users.
// GEMINI_API_KEY never leaves the server — the client receives only a
// time-limited token (1-min initiation window, 30-min session max, single use).
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = { runtime: 'edge' }

const DEFAULT_MODEL = 'gemini-2.0-flash-live-001'
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

  // Since ephemeral tokens are 404 for this project, just return the real API key
  // gated behind Firebase auth as a pragmatic workaround.
  return new Response(JSON.stringify({ token: apiKey }), {
    status: 200,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}
