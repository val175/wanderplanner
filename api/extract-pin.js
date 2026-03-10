// api/extract-pin.js
// Unified idea extractor — smart routes between TikTok oEmbed and generic HTML scraping,
// then standardises both via Gemini generateObject (Vercel AI SDK).
// Fallback chain for generic URLs: full scrape → Microlink → URL-only inference.
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import * as cheerio from 'cheerio'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'

// Mimic a real browser to avoid bot-blocking on travel sites
const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Referer': 'https://www.google.com/',
}

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

        // ── Branch B: Generic URL — TripAdvisor, Airbnb, Booking.com, blogs, etc. ─
        } else {
            // Attempt 1: direct scrape with browser-like headers
            try {
                const htmlRes = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' })
                if (htmlRes.ok) {
                    const html = await htmlRes.text()
                    const $ = cheerio.load(html)
                    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
                    const ogDesc = $('meta[property="og:description"]').attr('content')
                        || $('meta[name="description"]').attr('content') || ''
                    // TripAdvisor uses "og: image" with a space — handle both forms
                    const ogImage = $('meta[property="og:image"]').attr('content')
                        || $('meta[property="og: image"]').attr('content')
                        || $('meta[name="twitter:image"]').attr('content') || ''
                    const pageTitle = $('title').text().trim() || ''
                    contextText = [ogTitle || pageTitle, ogDesc].filter(Boolean).join('\n')
                    thumbnail_url = ogImage || null
                }
            } catch (_) { /* non-fatal — fall through to Microlink */ }

            // Attempt 2: Microlink for JS-rendered sites (Agoda, Booking.com, etc.)
            // Also fills in thumbnail when direct scrape got text but no image
            if (!contextText || !thumbnail_url) {
                try {
                    const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
                    if (ml.ok) {
                        const mlData = (await ml.json()).data || {}
                        if (!contextText) {
                            contextText = [mlData.title, mlData.description].filter(Boolean).join('\n')
                        }
                        if (!thumbnail_url) {
                            thumbnail_url = mlData.image?.url || null
                        }
                    }
                } catch (_) { /* non-fatal */ }
            }

            // Attempt 3: URL-only fallback — AI can still infer from the URL structure
            if (!contextText) contextText = url

            // Infer source name from hostname
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

        // ── AI Standardisation via Gemini ─────────────────────────────────────────
        const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
        const { object } = await generateObject({
            model: google('gemini-2.0-flash-lite'),
            schema: z.object({
                title: z.string().describe('Clean, catchy name for the location or travel idea'),
                category: z.string().describe('One of: Food, Activity, Nightlife, Lodging, Transport, Shopping, Other'),
                location: z.string().describe('City or neighborhood extracted from the context'),
                vibe: z.string().describe('1-2 word mood descriptor, e.g. "Aesthetic", "High-Energy", "Relaxing"'),
                estimatedCost: z.string().describe('Price estimate. Use exact price if visible in content. Otherwise make a realistic market-rate estimate and append " (est.)". Format: "20 - 50/person" or "500/night" or "Free". NEVER leave blank.'),
            }),
            prompt: `Extract travel idea details from this web content:\n\n${contextText}`,
        })

        return res.status(200).json({ ...object, url, thumbnail_url, sourceName })
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}
