// api/extract-pin.js
// Server-side scraper for saved pins in Cities tab.
// Extracts og:title and og:image from a URL, then uses AI to classify
// the pin with a type, emoji, and short description.
import * as cheerio from 'cheerio'
import { verifyFirebaseToken } from './_auth.js'
import { setCorsHeaders } from './_cors.js'
import { callOpenRouter } from './_openrouter.js'

export default async function handler(req, res) {
    setCorsHeaders(res)

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    const authHeader = req.headers.authorization || req.headers.Authorization;
    try {
        await verifyFirebaseToken(authHeader);
    } catch (authError) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { url } = req.body || {}
    if (!url) return res.status(400).json({ error: 'URL is required' })

    // ── 1. Scrape og:title + og:image ─────────────────────────────────────────
    let title = null
    let imageUrl = null

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        }).catch(() => null)

        clearTimeout(timeout)

        if (response && response.ok) {
            const html = await response.text()
            const $ = cheerio.load(html)

            title =
                $('meta[property="og:title"]').attr('content') ||
                $('meta[property="og: title"]').attr('content') ||
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text().trim() ||
                null

            imageUrl =
                $('meta[property="og:image"]').attr('content') ||
                $('meta[property="og: image"]').attr('content') ||
                $('meta[name="twitter:image"]').attr('content') ||
                null
        }

        // ── 1.1 Microlink fallback ───────────────────────────────────────────
        // Many travel sites (Agoda, Expedia, etc.) inject og:image via React/JS at runtime,
        // so static cheerio scraping misses it. Microlink renders with a headless browser.
        if (!imageUrl) {
            try {
                const ml = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                if (ml.ok) {
                    const mlJson = await ml.json();
                    imageUrl = mlJson?.data?.image?.url || mlJson?.data?.logo?.url || null;
                }
            } catch (_) { /* non-fatal */ }
        }
    } catch (error) {
        console.error('[extract-pin] Scrape error:', error.message)
    }

    // ── 2. AI Classification ───────────────────────────────────────────────────
    let aiDetails = { type: 'other', emoji: '📍', description: '' }

    try {
        const aiPrompt = `A user saved this URL as a travel pin: ${url}
Title: "${title || 'Unknown'}"

Based on the URL and title, classify this travel pin and return ONLY valid JSON:
{
  "type": "activity",
  "emoji": "🎯",
  "description": "One concise sentence describing what this place or thing is (max 15 words)."
}

Rules:
- type must be exactly one of: lodging, activity, food, transport, other
- emoji must be a single relevant emoji that best represents the category
- description: 1 concise sentence, max 15 words
Do not wrap in markdown blocks.`

        const aiData = await callOpenRouter(process.env.OPENROUTER_API_KEY, {
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.1,
        })
        const raw = aiData.choices[0].message.content
        const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
        aiDetails = JSON.parse(clean)
    } catch (e) {
        console.warn('[extract-pin] AI classification failed:', e.message)
    }

    return res.status(200).json({
        name: title ? title.substring(0, 100) : null,
        imageUrl: imageUrl || null,
        type: aiDetails.type || 'other',
        emoji: aiDetails.emoji || '📍',
        description: aiDetails.description || '',
    })
}
