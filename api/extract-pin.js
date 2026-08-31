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

// Pull the first http(s) link out of the pasted value — share sheets routinely
// prepend a caption ("Check out this hotel! https://...") which would otherwise
// blow up on `new URL()` and surface as a raw 500.
function extractUrl(raw) {
    if (typeof raw !== 'string') return null
    const match = raw.trim().match(/https?:\/\/[^\s<>"']+/i)
    if (!match) return null
    try {
        const parsed = new URL(match[0].replace(/[.,)\]]+$/, ''))
        return parsed.href
    } catch {
        return null
    }
}

function safeHost(u) {
    try { return new URL(u).hostname.replace('www.', '') } catch { return '' }
}

// Some pages are JS-only shells with an empty <title> and no OG tags — Agoda's
// /sh-app/ share links are the common case. The resolved path is then the only
// readable signal: /fragrance-hotel-emerald-h30150584/hotel/singapore-sg.html
function slugContext(u) {
    let parsed
    try { parsed = new URL(u) } catch { return '' }
    const words = parsed.pathname
        .replace(/\.(html?|php|aspx)$/i, '')
        .split('/')
        .filter(Boolean)
        .flatMap(seg => seg.split(/[-_+.]/))
        .filter(w => w.length > 1 && !/^\d+$/.test(w) && !/^[a-z]\d{3,}$/i.test(w))
    return words.length ? `Page path keywords: ${words.join(' ')}` : ''
}

// Microlink sometimes echoes the redirect target back as the "title" (AppsFlyer
// onelink query strings, for one). That is worse than no context at all, because
// it beats the URL-only fallback and poisons the prompt.
function looksLikeJunkTitle(s) {
    if (!s) return true
    const t = String(s).trim()
    return /^https?:\/\//i.test(t) || /%3a%2f%2f|[?&][a-z_]+=/i.test(t)
}

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const authHeader = req.headers.authorization || req.headers.Authorization
    try {
        await verifyFirebaseToken(authHeader)
    } catch {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
        const url = extractUrl((req.body || {}).url)
        if (!url) {
            return res.status(400).json({ error: 'That doesn\'t look like a link. Paste a URL starting with http:// or https://' })
        }

        let contextText = ''
        let thumbnail_url = null
        let sourceName = 'Link'
        let resolvedUrl = url

        const SOCIAL_DOMAINS = {
            'facebook.com': 'Facebook', 'fb.com': 'Facebook',
            'instagram.com': 'Instagram', 'twitter.com': 'Twitter', 'x.com': 'Twitter',
            'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'threads.net': 'Threads',
            'tiktok.com': 'TikTok'
        }
        const host = new URL(url).hostname.replace('www.', '')
        const socialPlatform = Object.entries(SOCIAL_DOMAINS).find(([domain]) => host === domain || host.endsWith('.' + domain))?.[1]

        if (socialPlatform) {
            sourceName = socialPlatform
            const parts = new URL(url).pathname.split('/').filter(Boolean)
            let handle = ''
            if (host.includes('tiktok.com')) {
                handle = parts.find(p => p.startsWith('@'))?.replace('@', '') || parts[0] || ''
            } else if (host.includes('instagram.com')) {
                handle = parts.find(p => !['p', 'reels', 'stories'].includes(p)) || ''
            } else {
                handle = parts[0] || ''
            }
            if (handle.startsWith('@')) handle = handle.slice(1)

            let socialContext = `${socialPlatform} Handle: @${handle}`

            // Attempt 1: TikTok oEmbed (special case)
            if (socialPlatform === 'TikTok') {
                try {
                    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
                    if (oembedRes.ok) {
                        const oembed = await oembedRes.json()
                        socialContext = `Title: ${oembed.title}\nAuthor: ${oembed.author_name}\nHandle: @${handle}`
                        thumbnail_url = oembed.thumbnail_url || null
                    }
                } catch (_) {}
            }

            // Attempt 2: Microlink (Universal Social Scraper)
            if (!thumbnail_url || socialContext.length < 50) {
                try {
                    const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
                    if (ml.ok) {
                        const mlData = (await ml.json()).data || {}
                        socialContext = [
                            mlData.title ? `Title: ${mlData.title}` : '',
                            mlData.description ? `Bio/Description: ${mlData.description}` : '',
                            `Handle: @${handle}`,
                            `Site: ${socialPlatform}`
                        ].filter(Boolean).join('\n')
                        if (!thumbnail_url) thumbnail_url = mlData.image?.url || mlData.logo?.url || null
                    }
                } catch (_) {}
            }
            contextText = socialContext
        } else {
            // ── Branch B: Generic URL — TripAdvisor, Airbnb, Booking.com, blogs, etc. ─
            // Attempt 1: direct scrape with browser-like headers
            try {
                const htmlRes = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' })
                resolvedUrl = htmlRes.url || url
                if (htmlRes.ok) {
                    const html = await htmlRes.text()
                    const $ = cheerio.load(html)
                    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
                    const ogDesc = $('meta[property="og:description"]').attr('content')
                        || $('meta[name="description"]').attr('content') || ''
                    const ogImage = $('meta[property="og:image"]').attr('content')
                        || $('meta[property="og: image"]').attr('content')
                        || $('meta[name="twitter:image"]').attr('content') || ''
                    const pageTitle = $('title').text().trim() || ''
                    contextText = [ogTitle || pageTitle, ogDesc].filter(Boolean).join('\n')
                    thumbnail_url = ogImage || null
                }
            } catch (_) { }

            // Attempt 2: Microlink fallback
            if (!contextText || !thumbnail_url) {
                try {
                    const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(resolvedUrl)}`)
                    if (ml.ok) {
                        const mlData = (await ml.json()).data || {}
                        const mlTitle = looksLikeJunkTitle(mlData.title) ? '' : mlData.title
                        if (!contextText) contextText = [mlTitle, mlData.description].filter(Boolean).join('\n')
                        if (!thumbnail_url) thumbnail_url = mlData.image?.url || null
                    }
                } catch (_) { }
            }

            // Attempt 3: fall back to the resolved URL's slug, then the URL itself
            if (!contextText) contextText = slugContext(resolvedUrl) || resolvedUrl

            // Infer source name from the resolved hostname (short links redirect
            // off their own domain, so the original host can be misleading)
            try {
                const finalHost = safeHost(resolvedUrl) || host
                if (finalHost.includes('tripadvisor')) sourceName = 'TripAdvisor'
                else if (finalHost.includes('airbnb')) sourceName = 'Airbnb'
                else if (finalHost.includes('booking.com')) sourceName = 'Booking.com'
                else if (finalHost.includes('agoda')) sourceName = 'Agoda'
                else {
                    const name = finalHost.split('.')[0]
                    sourceName = name.charAt(0).toUpperCase() + name.slice(1)
                }
            } catch (_) { }
        }

        // ── AI Standardisation via Gemini (Native SDK) ───────────────────────────
        const google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
        })
        const { object } = await generateObject({
            model: google('gemini-3.1-flash-lite'),
            schema: z.object({
                title: z.string().describe('Clean, catchy name for the location or travel idea'),
                category: z.string().describe('One of: Food, Activity, Nightlife, Lodging, Transport, Shopping, Other'),
                location: z.string().describe('City or neighborhood extracted from the context'),
                vibe: z.string().describe('1-2 word mood descriptor, e.g. "Aesthetic", "High-Energy", "Relaxing"'),
                estimatedCost: z.string().describe('Price estimate. Format: "₱XXX/person" or "₱XXX/night" or "Free". ALWAYS use the ₱ symbol.'),
            }),
            prompt: `You are Wanda, a travel expert. Extract travel idea details from this content:

CONTENT:
${contextText}

URL: ${resolvedUrl}

RULES:
1. Use the ₱ (Pesos) symbol for estimatedCost. Format: "₱500 - ₱1000/person" or "₱3000/night".
2. If the content is sparse (e.g. just a social handle), use your INTERNAL KNOWLEDGE about the business or location to make a realistic market-rate estimate.
3. BE SPECIFIC & ACCURATE: Perform a mental lookup of the specific business if possible (e.g., "Fatwave Surf Resort", "Hostel Arcajoo").
   - Acknowledge their actual known rates (e.g., Fatwave is ₱3000-₱7000/night, ArcaJoo is ₱900-₱1500).
   - Do NOT use wide category ranges if you recognize the specific business name.
   - If you don't know the specific business, make a realistic estimate based on the location: a Hotel in the PH is ₱2500-₱6000, a Hostel is ₱800-₱1500, a Meal is ₱300-₱800.
   - NEVER guess ₱50-₱150 for lodging.
4. If exact prices aren't found, append " (est.)" to your estimate.
5. The CONTENT may be thin or missing. In that case read the URL itself — booking
   sites encode the business and city in the path (e.g.
   "/fragrance-hotel-emerald-h30150584/hotel/singapore-sg.html" is Fragrance Hotel
   Emerald in Singapore). Never output a raw URL, slug, or ID as the title.`,
        })

        return res.status(200).json({ ...object, url, thumbnail_url, sourceName })
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}
