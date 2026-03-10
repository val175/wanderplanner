// api/gemini.js — AI proxy for frontend Wanda chat calls
// Keeps its own inline provider loop — never delegates to callAI — so req.body
// handling is explicit and safe. (Delegating caused the Antigravity 500 bug.)
import { PROVIDERS } from './_openrouter.js'
import { verifyFirebaseToken } from './_auth.js'

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        try {
            await verifyFirebaseToken(authHeader);
        } catch (authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const geminiKey = process.env.GEMINI_API_KEY
        const openrouterKey = process.env.OPENROUTER_API_KEY

        if (!geminiKey && !openrouterKey) {
            console.error('No AI API keys configured')
            return res.status(500).json({ error: 'Server misconfiguration: No AI API keys.' })
        }

        for (const provider of PROVIDERS) {
            const apiKey = provider.keyType === 'gemini' ? geminiKey : openrouterKey
            if (!apiKey) continue  // skip providers whose key isn't configured

            const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            if (provider.keyType === 'openrouter') {
                headers['HTTP-Referer'] = 'https://planner.vlbonite.co'
                headers['X-Title'] = 'Wanderplan'
            }

            const response = await fetch(provider.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...req.body, model: provider.model }),
            })

            if (response.status === 429 || response.status === 404) {
                console.log(`[gemini-proxy] ${provider.model} skipped (${response.status})`)
                continue
            }

            if (!response.ok) {
                console.error(`[gemini-proxy] ${provider.model} non-ok (${response.status})`)
                continue
            }

            const data = await response.json()
            if (!data.choices?.length) {
                const errMsg = data.error?.message || 'No choices'
                console.log(`[gemini-proxy] ${provider.model} no valid response: ${errMsg}`)
                continue
            }

            return res.status(200).json(data)
        }

        return res.status(429).json({ error: 'All AI models unavailable. Please try again in a moment.' })
    } catch (error) {
        console.error('AI Proxy Error:', error)
        return res.status(500).json({ error: error.message || 'AI generation failed' })
    }
}
