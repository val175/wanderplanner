// api/extract-pin.js
// Unified idea extractor — smart routes between TikTok oEmbed and generic HTML scraping,
// then standardises both via Gemini generateObject (Vercel AI SDK).
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import * as cheerio from 'cheerio'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

export default async function handler(req, res) {
    setCorsHeaders(res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const authHeader = req.headers.authorization || req.headers.Authorization
    try {
        await verifyFirebaseToken(authHeader)
    } catch {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const { url } = req.body || {}
        if (!url) return res.status(400).json({ error: 'URL is required' })

        let contextText = ''
        let thumbnail_url = null
        let sourceName = 'Link'

        // ── Branch A: TikTok oEmbed ───────────────────────────────────────────────
        if (url.includes('tiktok.com')) {
            const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
            if (!oembedRes.ok) throw new Error(`TikTok oEmbed failed with status ${oembedRes.status}`)
            const oembed = await oembedRes.json()
            contextText = oembed.title || ''
            thumbnail_url = oembed.thumbnail_url || null
            sourceName = 'TikTok'

        // ── Branch B: Generic URL — TripAdvisor, Airbnb, blogs, etc. ─────────────
        } else {
            const htmlRes = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wanderplan/1.0)' },
                redirect: 'follow',
            })
            if (!htmlRes.ok) throw new Error(`Could not fetch URL (status ${htmlRes.status})`)
            const html = await htmlRes.text()
            const $ = cheerio.load(html)

            const ogTitle = $('meta[property="og:title"]').attr('content') || ''
            const ogDesc = $('meta[property="og:description"]').attr('content') || ''
            const ogImage = $('meta[property="og:image"]').attr('content') || ''
            const pageTitle = $('title').text().trim() || ''

            contextText = [ogTitle || pageTitle, ogDesc].filter(Boolean).join('\n')
            thumbnail_url = ogImage || null

            try {
                const host = new URL(url).hostname.replace('www.', '')
                if (host.includes('tripadvisor')) sourceName = 'TripAdvisor'
                else if (host.includes('airbnb')) sourceName = 'Airbnb'
                else if (host.includes('booking.com')) sourceName = 'Booking.com'
                else if (host.includes('agoda')) sourceName = 'Agoda'
                else if (host.includes('klook')) sourceName = 'Klook'
                else if (host.includes('viator')) sourceName = 'Viator'
                else {
                    const name = host.split('.')[0]
                    sourceName = name.charAt(0).toUpperCase() + name.slice(1)
                }
            } catch (_) {}
        }

        if (!contextText) throw new Error('Could not extract content from this link.')

        // ── AI Standardisation via Gemini ─────────────────────────────────────────
        const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
        const { object } = await generateObject({
            model: google('gemini-3.1-flash-lite-preview'),
            schema: z.object({
                title: z.string().describe('Clean, catchy name for the location or travel idea'),
                category: z.string().describe('One of: Food, Activity, Nightlife, Lodging, Transport, Shopping, Other'),
                location: z.string().describe('City or neighborhood extracted from the context'),
                vibe: z.string().describe('1-2 word mood descriptor, e.g. "Aesthetic", "High-Energy", "Relaxing"'),
                estimatedCost: z.string().optional().describe('Estimated cost if mentioned or inferable. Format: "20 - 50/PERSON" or "Free/TOTAL". Numbers only, no currency symbol.'),
            }),
            prompt: `Extract travel idea details from this web content:\n\n${contextText}`,
        })

        return res.status(200).json({ ...object, url, thumbnail_url, sourceName })
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}
