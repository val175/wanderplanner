import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = { runtime: 'edge' }

const ActivitySchema = z.object({
  time: z.string().describe('HH:mm format e.g. 09:00'),
  duration: z.number().describe('Duration in minutes'),
  endTime: z.string().describe('HH:mm calculated from time + duration'),
  category: z.enum(['lodging', 'flight', 'food', 'activity', 'transport', 'shopping', 'concert', 'other']),
  name: z.string(),
  emoji: z.string().describe('Single relevant emoji'),
  location: z.string().describe('Specific venue or area'),
  estCost: z.string().describe('e.g. ₱500 or empty string'),
  transit: z.string().describe('e.g. 15 mins to next spot or empty'),
  transitEmoji: z.string().describe('e.g. 🚕, 🚇, 🚶, ✈️'),
  notes: z.string().describe('Tips or context, can be empty'),
})

const WandaPlanSchema = z.object({
  name: z.string().describe('Clean, fun trip name'),
  emoji: z.string().describe('Single relevant emoji for the trip'),
  startDate: z.string().describe('ISO date YYYY-MM-DD or empty string'),
  endDate: z.string().describe('ISO date YYYY-MM-DD or empty string'),
  currency: z.string().describe('3-letter currency code e.g. PHP, USD, THB'),
  destinations: z.array(z.object({
    city: z.string(),
    country: z.string(),
    flag: z.string().describe('Single flag emoji'),
  })),
  budgetCategories: z.array(z.object({
    name: z.string(),
    emoji: z.string(),
    min: z.number(),
    max: z.number(),
  })).describe('Realistic budget breakdown distributed across categories'),
  todos: z.array(z.object({
    text: z.string().describe('Specific pre-trip task'),
    category: z.string().describe('e.g. Admin, Finances, Tech, Health, Packing'),
  })).describe('8-12 practical pre-trip tasks'),
  packingList: z.array(z.object({
    name: z.string().describe('Item name'),
    section: z.string().describe('Documents, Clothing, Tech, Toiletries, or Misc'),
  })).describe('10-15 packing items appropriate for destination and trip style'),
  itinerary: z.array(z.object({
    dayNumber: z.number(),
    date: z.string().describe('ISO date YYYY-MM-DD or empty'),
    location: z.string().describe('Main area or city for the day'),
    activities: z.array(ActivitySchema).describe('3-5 activities per day'),
  })),
})

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: getCorsHeaders(req) })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    await verifyFirebaseToken(authHeader)

    const { gatheredInfo } = await req.json()
    if (!gatheredInfo) {
      return new Response(JSON.stringify({ error: 'gatheredInfo required' }), {
        status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
    const today = new Date().toISOString().split('T')[0]

    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite'),
      schema: WandaPlanSchema,
      temperature: 0.1,
      maxTokens: 2500,
      prompt: `You are Wanderplan's expert AI trip planner. A traveler has answered a series of questions about their upcoming trip. Create a complete, detailed trip plan based on their answers.

TODAY'S DATE: ${today}

TRAVELER'S INPUTS:
- Trip name / destinations: ${gatheredInfo.name_and_destinations || 'Not specified'}
- Dates / duration: ${gatheredInfo.dates || 'Not specified'}
- Number of travelers: ${gatheredInfo.travelers || 'Not specified'}
- Trip style / interests: ${gatheredInfo.trip_style || 'Not specified'}
- Budget range: ${gatheredInfo.budget || 'Not specified'}
- Special requirements / must-dos: ${gatheredInfo.special_requirements || 'None'}

INSTRUCTIONS:
1. Extract a clean, fun trip name from the traveler's input (e.g. "10 Days in Japan with Mia").
2. Create a day-by-day itinerary with 3-5 activities per day. Each activity must have time (HH:mm), duration (minutes), endTime (HH:mm), name, emoji, location, category, and realistic estCost.
3. Generate 8-12 practical pre-trip to-do tasks (visas, bookings, insurance, currency, etc.) with categories like Admin, Finances, Tech, Health.
4. Generate 10-15 packing items appropriate for the destination, duration, and trip style. Organize into sections: Documents, Clothing, Tech, Toiletries, Misc.
5. Create a realistic budget breakdown across categories (Flights, Accommodation, Food, Activities, Transport, etc.). Distribute the traveler's stated budget realistically if given.
6. Infer ISO dates (YYYY-MM-DD) from the traveler's date description relative to today (${today}). If you can't determine specific dates, use empty strings.
7. Use the 3-letter currency code matching the traveler's stated currency (default PHP if not specified).
8. Choose a single relevant emoji for the trip.
9. For each destination, include the country name and appropriate flag emoji.

CRITICAL: You must return ONLY valid JSON matching the exact schema provided. Do not include any conversational filler.`,
    })

    return new Response(JSON.stringify({ success: true, data: object }), {
      status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
}
