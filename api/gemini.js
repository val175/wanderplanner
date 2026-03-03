// api/gemini.js — OpenRouter proxy for frontend AI calls
// Accepts OpenAI-format request bodies and forwards to OpenRouter,
// keeping the API key server-side.
//
// Includes a model fallback chain: free models have per-model rate limits,
// so on 429 we try the next model in the list (each has its own bucket).
import { callOpenRouter } from './_openrouter.js'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (!apiKey) {
            console.error("OPENROUTER_API_KEY missing in Vercel environment variables")
            return res.status(500).json({ error: 'Server misconfiguration: AI API key missing.' })
        }

        const requested = req.body?.model
        const data = await callOpenRouter(apiKey, req.body, requested)

        return res.status(200).json(data)
    } catch (error) {
        console.error('AI Proxy Error:', error)
        const status = error.message.includes('rate limited') ? 429 : 500
        return res.status(status).json({ error: error.message || 'Internal Server Error' })
    }
}
