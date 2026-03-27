// api/wanda-live-key.js — Returns GEMINI_API_KEY to authenticated users for Gemini Live WebSocket
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = { runtime: 'edge' }

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

  return new Response(JSON.stringify({ apiKey }), {
    status: 200,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}
