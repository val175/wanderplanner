import { generateObject } from 'ai'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from '../_auth.js'
import { setCorsHeaders } from '../_cors.js'

export default async function handler(req, res) {
    setCorsHeaders(res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        try {
            await verifyFirebaseToken(authHeader);
        } catch (authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { city, country } = req.body;
        if (!city) return res.status(400).json({ error: 'City name is required' });

        const geminiKey = process.env.GEMINI_API_KEY
        const openrouterKey = process.env.OPENROUTER_API_KEY

        let model;
        if (geminiKey) {
            const google = createGoogleGenerativeAI({
                apiKey: geminiKey,
            })
            model = google('gemini-3.1-flash-lite-preview')
        } else if (openrouterKey) {
            const openrouter = createOpenAI({
                apiKey: openrouterKey,
                baseURL: 'https://openrouter.ai/api/v1'
            })
            model = openrouter('mistralai/mistral-small-24b-instruct-2501')
        }

        if (!model) {
            return res.status(500).json({ error: 'No AI providers configured' });
        }

        const { object } = await generateObject({
            model,
            schema: z.object({
                description: z.string().describe('2-3 engaging sentences about the location'),
                highlights: z.array(z.string()).describe('top 3 things to do'),
                currencyCode: z.string().describe('the 3-letter ISO code like "PHP" or "BRL"'),
                currencyName: z.string().describe('full currency name'),
                language: z.string().describe('primary local language'),
                flagEmoji: z.string().describe('the unicode flag emoji for the destination'),
                weather: z.string().describe('average high/low temperature for the current month, e.g. "MARCH AVG 14°C / 12°C"'),
                exchangeRatePHP: z.string().describe('approximate exchange rate vs PHP, formatted as "1 [LocalCode] = [Amount] PHP"')
            }),
            prompt: `Generate travel details for ${city}${country ? `, ${country}` : ''}. Include historical monthly average weather for the current month.`
        })

        return res.status(200).json(object)

    } catch (error) {
        console.error('City Auto-fill Error:', error)
        return res.status(500).json({ error: error.message || 'AI generation failed' })
    }
}
