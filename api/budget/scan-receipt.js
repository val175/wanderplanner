import { generateObject } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from '../_auth.js'
import { CORS_HEADERS } from '../_cors.js'

const receiptSchema = z.object({
    currency: z.string().describe('The overarching 3-letter currency code, e.g., JPY, PHP, USD'),
    items: z.array(z.object({
        description: z.string().describe('The specific line item name'),
        amount: z.number().describe('The cost of this specific item'),
        category: z.enum(['Food', 'Transport', 'Lodging', 'Activities', 'Shopping', 'Misc']).describe('The most logical category for this item'),
    })),
})

export default async function handler(req, res) {
    // Standard CORS block for Express-style handler
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        res.setHeader(key, value)
    })

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    try {
        const authHeader = req.headers.authorization || req.headers['authorization']
        const userPayload = await verifyFirebaseToken(authHeader)
        if (!userPayload) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const { imageBase64 } = req.body
        if (!imageBase64) {
            return res.status(400).json({ error: 'Missing image data' })
        }

        const google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
        })

        const { object } = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: receiptSchema,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract every individual line item from this receipt. Do not just extract the total. For each item, provide the exact name, the specific cost, and infer the logical category. Also extract the overarching 3-letter currency code.' },
                        { type: 'image', image: imageBase64 },
                    ],
                },
            ],
        })

        return res.status(200).json(object)

    } catch (error) {
        console.error('Scan Error:', error)
        return res.status(500).json({ error: error.message || 'Failed to scan receipt' })
    }
}
