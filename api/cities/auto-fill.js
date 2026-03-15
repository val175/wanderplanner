import { generateObject } from 'ai'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from '../_auth.js'
import { setCorsHeaders } from '../_cors.js'

export default async function handler(req, res) {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        try {
            await verifyFirebaseToken(authHeader);
        } catch (authError) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { city, country, tripStartDate, tripEndDate } = req.body;
        if (!city) return res.status(400).json({ error: 'City name is required' });

        // Derive travel month(s) from trip dates, fall back to current month
        const tripMonth = (() => {
            if (tripStartDate) {
                const start = new Date(tripStartDate + 'T12:00:00')
                const startMonth = start.toLocaleString('en-US', { month: 'long' })
                if (tripEndDate) {
                    const end = new Date(tripEndDate + 'T12:00:00')
                    const endMonth = end.toLocaleString('en-US', { month: 'long' })
                    return startMonth === endMonth ? startMonth : `${startMonth}–${endMonth}`
                }
                return startMonth
            }
            return new Date().toLocaleString('en-US', { month: 'long' })
        })()

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
                currencyTip: z.string().describe('A simple, rounded conversion rate against PHP (e.g., "1 USD = ₱58" or "1 EUR = ₱62"). ALWAYS use PHP as the target currency. Use the ₱ symbol. Do not include decimals.'),
                language: z.string().describe('primary local language'),
                flagEmoji: z.string().describe('the unicode flag emoji for the destination'),
                weatherTip: z.string().describe(`The typical weather for this city during ${tripMonth}. Format exactly like this example: "🌤️ 18°C / 9°C (${tripMonth})". Always include a relevant weather emoji at the start.`)
            }),
            prompt: `Generate travel details for ${city}${country ? `, ${country}` : ''}. The trip will take place in ${tripMonth}. Base the weather tip on typical historical data for ${tripMonth}. The travelers use PHP (Philippine Peso) as their home currency.`
        })

        return res.status(200).json(object)

    } catch (error) {
        console.error('City Auto-fill Error:', error)
        return res.status(500).json({ error: error.message || 'AI generation failed' })
    }
}
