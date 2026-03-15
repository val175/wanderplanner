import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = { runtime: 'edge' }

const TripSchema = z.object({
  name: z.string(),
  emoji: z.string(),
  startDate: z.string().describe('ISO date YYYY-MM-DD or empty string'),
  endDate: z.string().describe('ISO date YYYY-MM-DD or empty string'),
  currency: z.string().describe('3-letter currency code e.g. PHP, USD'),
  destinations: z.array(z.object({
    city: z.string(),
    country: z.string(),
    flag: z.string().describe('Single flag emoji'),
  })),
  budgetCategories: z.array(z.object({
    name: z.string(),
    emoji: z.string(),
    max: z.number(),
  })).describe('Infer budget categories from description; omit if no budget info'),
})

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    await verifyFirebaseToken(authHeader)

    const { description } = await req.json()
    if (!description?.trim()) {
      return new Response(JSON.stringify({ error: 'Description required' }), {
        status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite-preview'),
      schema: TripSchema,
      prompt: `Extract trip details from this description. Today's date is ${new Date().toISOString().split('T')[0]}. Description: "${description}"`,
    })

    return new Response(JSON.stringify({ success: true, data: object }), {
      status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
}
