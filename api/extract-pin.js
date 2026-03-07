// api/extract-pin.js
// Lightweight server-side scraper for saved pins in Cities tab.
// Extracts og:title and og:image from a URL using cheerio (no CORS issues).
import * as cheerio from 'cheerio'
import { verifyFirebaseToken } from './_auth.js'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

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

        if (!response || !response.ok) {
            return res.status(200).json({ name: null, imageUrl: null })
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').text().trim() ||
            null

        const imageUrl =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            null

        return res.status(200).json({
            name: title ? title.substring(0, 100) : null,
            imageUrl: imageUrl || null,
        })
    } catch (error) {
        console.error('[extract-pin] Error:', error.message)
        return res.status(200).json({ name: null, imageUrl: null })
    }
}
