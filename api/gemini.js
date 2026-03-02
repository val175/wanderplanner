// api/gemini.js — OpenRouter proxy for frontend AI calls
// Accepts OpenAI-format request bodies and forwards to OpenRouter,
// keeping the API key server-side.
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

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://planner.vlbonite.co',
                'X-Title': 'Wanderplan',
            },
            body: JSON.stringify(req.body),
        })

        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            return res.status(response.status).json(err)
        }

        return res.status(200).json(await response.json())
    } catch (error) {
        console.error('AI Proxy Error:', error)
        return res.status(500).json({ error: error.message || 'Internal Server Error' })
    }
}
