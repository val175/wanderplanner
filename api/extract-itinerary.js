import * as cheerio from 'cheerio'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

const MAX_TEXT_CHARS = 45000
const MAX_SCRAPE_CHARS = 24000

const ActivitySchema = z.object({
  time: z.string().describe('24-hour HH:mm format e.g. 09:00 or 17:30, or empty string if unspecified/relative like Evening'),
  duration: z.number().describe('Estimated duration in minutes, e.g. 60, 90, 120'),
  endTime: z.string().describe('24-hour HH:mm calculated from time + duration, or empty string if time is empty'),
  category: z.enum(['lodging', 'flight', 'food', 'activity', 'transport', 'shopping', 'concert', 'other']),
  name: z.string().describe('Concise, scannable activity title (3-8 words)'),
  emoji: z.string().describe('Single relevant emoji'),
  location: z.string().describe('Specific venue, landmark, neighborhood, or route if mentioned, else empty string'),
  estCost: z.string().describe('Cost string with currency symbol if mentioned, e.g. S$46 or ₱12,000, else empty string'),
  transit: z.string().describe('How to get there or transit note if mentioned, else empty string'),
  transitEmoji: z.string().describe('Single transit emoji e.g. 🚕, 🚇, 🚶, ✈️, 🚌'),
  notes: z.string().describe('Extra details, booking tips, meal ideas, or context not captured in name'),
})

const ItineraryExtractSchema = z.object({
  days: z.array(z.object({
    dayNumber: z.number().describe('1-based day index (or 0 if explicitly Day 0)'),
    date: z.string().describe('ISO YYYY-MM-DD date if inferable from document or trip context, else empty string'),
    location: z.string().describe('Primary city/area for the day, e.g. Singapore or Kuala Lumpur'),
    emoji: z.string().describe('Single semantic emoji for the day'),
    notes: z.string().describe('Day theme, rain backup, or general day-level note if any, else empty string'),
    activities: z.array(ActivitySchema).describe('All scheduled stops/activities for this day in chronological order'),
  })),
})

/**
 * Fetches a travel blog / itinerary webpage and preserves full day-by-day text.
 */
async function scrapeItineraryUrl(rawUrl) {
  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('Please enter a valid http:// or https:// URL.')
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.')
  }

  const response = await fetch(parsedUrl.toString(), {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${response.status})`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || ''
  $('script, style, noscript, nav, header, footer, aside, iframe, .ad, .advertisement, .comments, .sidebar, .related-posts, .newsletter').remove()

  const chunks = []
  if (title) chunks.push(`# ${title}`)

  $('h1, h2, h3, h4, p, li, tr').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    if (!text || text.length < 2) return
    const tag = el.tagName?.toLowerCase()
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      chunks.push(`\n## ${text}`)
    } else if (tag === 'li') {
      chunks.push(`- ${text}`)
    } else {
      chunks.push(text)
    }
  })

  const combined = chunks.join('\n').slice(0, MAX_SCRAPE_CHARS).trim()
  if (!combined) {
    throw new Error('Could not extract readable itinerary text from that URL.')
  }
  return combined
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization
    try {
      await verifyFirebaseToken(authHeader)
    } catch {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { text, url, filename, tripContext } = req.body || {}
    if (!text?.trim() && !url?.trim()) {
      return res.status(400).json({ error: 'Provide itinerary text, a Markdown/text file, or a URL.' })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return res.status(500).json({ error: 'Server misconfiguration: AI API key missing.' })
    }

    const sourceContent = text?.trim()
      ? text.trim().slice(0, MAX_TEXT_CHARS)
      : await scrapeItineraryUrl(url.trim())

    const ctx = tripContext || {}
    const citiesLabel = Array.isArray(ctx.cities) && ctx.cities.length > 0
      ? ctx.cities.join(', ')
      : 'Not specified'

    const google = createGoogleGenerativeAI({ apiKey: geminiKey })
    const { object } = await generateObject({
      model: google('gemini-3.1-flash-lite'),
      schema: ItineraryExtractSchema,
      temperature: 0.1,
      maxOutputTokens: 8192,
      prompt: `You are Wanderplan's itinerary extraction engine. Extract the day-by-day schedule from the provided itinerary text into structured days and activities for an EXISTING trip.

EXISTING TRIP CONTEXT:
- Trip name: ${ctx.name || 'Not specified'}
- Trip dates: ${ctx.startDate || '?'} to ${ctx.endDate || '?'}
- Cities/stops: ${citiesLabel}
- Home currency: ${ctx.currency || 'PHP'}
- Source filename: ${filename || (url ? url : 'Pasted itinerary')}

EXTRACTION RULES:
1. Extract EVERY day present in the itinerary in chronological order. Do not skip days or merge distinct activities.
2. Within each day, extract EVERY scheduled stop/activity/meal/transit item.
3. Keep each activity "name" short and scannable (e.g. "Juli's Birthday Dinner at LeVeL33", "Gardens by the Bay: Cloud Forest & Flower Dome", "My Chemical Romance Concert"), and put extra tips, booking notes, or transit advice into "notes" and "transit".
4. Convert times to 24-hour "HH:mm" when a clock time is given (e.g. "5:00 PM" -> "17:00", "8:30 AM" -> "08:30"). For vague times like "Evening" without a clock time, set time="" (or infer sequentially if clear) and mention it in notes.
5. Estimate realistic "duration" in minutes (e.g., 60 for quick stops, 90 for meals, 120–180 for museums/parks/concerts) and compute "endTime" when "time" is present.
6. Infer dates (YYYY-MM-DD) using the document's dates and the existing trip's startDate/year (${ctx.startDate || 'unknown'}).
7. Ignore trailing non-itinerary summary/budget/sources/reference tables (such as "Cost overview", "Unit prices", "Already booked", "Sources") as separate days — though if a day-specific rain backup applies to a day, you may include it in that day's "notes".
8. Pick the closest category from: lodging, flight, food, activity, transport, shopping, concert, other.

ITINERARY SOURCE:
---
${sourceContent}
---`,
    })

    if (!object?.days?.length) {
      return res.status(422).json({ error: 'No day-by-day itinerary items could be found in that source.' })
    }

    return res.status(200).json({
      success: true,
      data: {
        days: object.days,
      },
    })
  } catch (error) {
    console.error('[extract-itinerary] Error:', error)
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract itinerary.',
    })
  }
}
