// api/extract.js
import { generateObject } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { url, activeTrip } = await req.json()
    const tripCurrency = activeTrip?.currency || 'USD'
    const tripLocation = activeTrip?.name || 'the selected destination'
    const tripCities = activeTrip?.cities?.map(c => c.city).join(', ') || ''

    const { object } = await generateObject({
      model: google('gemini-2.0-flash', {
        structuredOutputs: true,
        apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY 
      }),
      tools: {
        googleSearch: {
          description: 'Used to search the web for listing details, locations, and prices.',
          parameters: z.object({
            query: z.string().description('The search query (e.g. the listing ID or name and city).'),
          }),
          execute: async () => ({}) // The SDK handles the actual search internally for Google Search tool
        },
      },
      // Note: For Google Search tool in AI SDK, we often use the standard google('gemini-1.5-pro') style
      // but let's stick to the prompt-based grounding if the tool isn't 100% supported in generateObject yet
      system: `You are Wanda, a travel assistant. You extract structured data from URLs for a "Voting Room".
      
      CRITICAL: You must accurately identify the location. The user is currently planning a trip to: ${tripLocation} (${tripCities}).
      If the link is a hotel or activity, it is HIGHLY LIKELY to be in or near these cities.
      
      DO NOT HALLUCINATE. If you see an Airbnb link, search for the room ID to find the REAL city.
      DO NOT GUESS "Rome" or "Amsterdam" as a default. If unknown, use the trip location: ${tripLocation}.`,
      
      prompt: `Extract details from this URL: ${url}
      
      Rules:
      1. Identify if it is lodging, an activity, food, or other.
      2. Find a name and very short catchy description.
      3. Format the price in ${tripCurrency}.
      4. Use a relevant emoji.
      5. Identify the source (e.g. Airbnb, Viator, Booking.com, TikTok).`,
      
      schema: z.object({
        title: z.string().describe('Short descriptive title of the place/activity'),
        type: z.enum(['lodging', 'activity', 'food', 'other']),
        priceDetails: z.string().describe(`Price string formatted in ${tripCurrency}`),
        description: z.string().describe('1-2 sentence catchy description'),
        emoji: z.string().describe('A single relevant emoji'),
        sourceName: z.string().describe('The name of the website/source')
      }),
    })

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Extraction Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
