// api/extract-pin.js
// TikTok video link extractor using the free oEmbed API + Vercel AI SDK (Gemini 3.1 Flash Lite).
// Step 1: Fetch title + thumbnail from TikTok's oEmbed endpoint (no auth required).
// Step 2: Use generateObject to parse the caption into a structured travel idea card.
import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
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

        // ── Step 1: Fetch TikTok oEmbed ───────────────────────────────────────────
        const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
        if (!oembedRes.ok) throw new Error(`TikTok oEmbed failed with status ${oembedRes.status}`)
        const { title, thumbnail_url } = await oembedRes.json()

        // ── Step 2: AI Parse via Vercel AI SDK + Gemini 3.1 Flash Lite ───────────
        const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
        const { object } = await generateObject({
            model: google('gemini-3.1-flash-lite-preview'),
            schema: z.object({
                title: z.string().describe('Clean, catchy name for the location or travel idea'),
                category: z.string().describe('One of: Food, Activity, Nightlife, Stay, Shopping, Other'),
                location: z.string().describe('City or neighborhood extracted from the caption'),
                vibe: z.string().describe('1-2 word mood descriptor, e.g. "Aesthetic", "High-Energy", "Chill"'),
            }),
            prompt: `Extract travel idea details from this TikTok video caption: "${title}"`,
        })

        return res.status(200).json({ ...object, url, thumbnail_url })
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
}
