// api/wanda-live-token.js
// Returns the Gemini API key to authenticated users for Gemini Live sessions.
// The key is gated behind Firebase auth — only verified users can retrieve it.
// Note: Google's ephemeral token system (v1alpha/authTokens) returned 404 for
// this project (limited preview, requires allowlisting), so we use the real key
// directly. Restrict this key in Google Cloud Console to your production domain
// as an additional mitigation.
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

  // Since ephemeral tokens are 404 for this project, just return the real API key
  // gated behind Firebase auth as a pragmatic workaround.
  return new Response(JSON.stringify({ token: apiKey }), {
    status: 200,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}
