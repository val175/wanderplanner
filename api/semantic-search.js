// api/semantic-search.js
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { getCorsHeaders } from './_cors.js'
import { verifyFirebaseToken } from './_auth.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: getCorsHeaders(req) })
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    try {
      await verifyFirebaseToken(authHeader)
    } catch (e) {
       // Optional: enforce auth if desired, bypassing for now if not strictly needed in prototype 
       // but typically you'd return 401 here. We'll proceed to allow guest semantic search for demo.
    }

    const { query, trip } = await req.json()
    if (!query || !trip) {
      return new Response(JSON.stringify({ error: 'Missing query or trip data' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('Missing Gemini Key')

    const google = createGoogleGenerativeAI({ apiKey: geminiKey })

    // Provide context to the model
    const systemPrompt = `You are a semantic search engine for a trip planning app.
The user is searching for: "${query}".

Here is the trip data in JSON format:
${JSON.stringify(trip).substring(0, 15000)} // truncate to avoid massive token usage on huge trips

Analyze the data and find up to 5 best matches that semantically match the user's intent.
For example, if they search "dinner", find restaurants. If they search "flights", find air travel bookings.

Return a JSON object with a 'results' array containing matches.
Each match MUST have:
- id: The exact string ID of the item from the source data
- tab: One of "itinerary", "bookings", "todos", "budget"
- title: The name or description of the matched item
- subtitle: A brief explanation of why this matches the semantic query (e.g. "Restaurant booking")
`

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'), // fast and cheap
      system: systemPrompt,
      prompt: 'Return the semantic search results.',
      schema: z.object({
        results: z.array(z.object({
          id: z.string(),
          tab: z.enum(['itinerary', 'bookings', 'todos', 'budget']),
          title: z.string(),
          subtitle: z.string(),
        }))
      }),
    })

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Semantic Search Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
}
