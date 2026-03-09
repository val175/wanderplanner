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

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        const userPayload = await verifyFirebaseToken(authHeader)
        if (!userPayload) {
            return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
        }

        const { image } = await req.json()
        if (!image) {
            return new Response('Missing image data', { status: 400, headers: CORS_HEADERS })
        }

        const google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
        })

        const { object } = await generateObject({
            model: google('gemini-3.1-flash-lite-preview'),
            schema: receiptSchema,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Extract every individual line item from this receipt. Do not just extract the total. For each item, provide the exact name, the specific cost, and infer the logical category. Also extract the overarching 3-letter currency code.' },
                        { type: 'image', image: image },
                    ],
                },
            ],
        })

        return new Response(JSON.stringify(object), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Scan Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
    }
}
