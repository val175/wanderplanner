// api/chat.js
import { streamText, tool } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { verifyFirebaseToken } from './_auth.js'
import { CORS_HEADERS } from './_cors.js'

// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
}

const WANDA_TOOLS = {
    add_to_packing_list: tool({
        description: [
            'Add ONE specific packing item to the trip packing list.',
            'IMPORTANT: Call this tool once per individual item — never use arrays, never group items.',
            'Correct: { item: "Rain jacket", section: "Clothing", emoji: "🧥" }',
            'Correct: { item: "Compact umbrella", section: "Misc", emoji: "☂️" }',
            'Call up to 3 times per response for different individual items.',
        ].join(' '),
        parameters: z.object({
            item:    z.string().describe('Name of a single packing item as a plain string, e.g. "Rain jacket". Never an array.'),
            section: z.enum(['Documents', 'Clothing', 'Toiletries', 'Electronics', 'Health', 'Misc']).describe('Packing section for this item'),
            emoji:   z.string().describe('One emoji character for this item, e.g. "🧥"'),
        }),
    }),
    add_idea_to_voting_room: tool({
        description: [
            'Add ONE travel recommendation to the trip voting room.',
            'IMPORTANT: Call once per idea — never group multiple ideas in one call.',
            'Correct: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail", emoji: "⛩️", priceDetails: "Free" }',
            'Correct: { title: "The Peninsula Hotel", type: "lodging", description: "Luxury hotel in city center", emoji: "🏨", priceDetails: "~$300/night" }',
            'Call up to 3 times per response for different recommendations.',
        ].join(' '),
        parameters: z.object({
            title:        z.string().describe('Name of the place or activity, e.g. "Fushimi Inari Hike". Plain string, not an array.'),
            type:         z.enum(['lodging', 'activity', 'food', 'transport', 'shopping', 'other']).describe('Category of the idea'),
            description:  z.string().describe('One sentence describing why this is worth considering'),
            emoji:        z.string().describe('One relevant emoji character, e.g. "⛩️"'),
            priceDetails: z.string().describe('Estimated cost as a plain string, e.g. "~$50/person", "Free", or "TBD"'),
        }),
    }),
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
        // Authenticate the request
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        const userPayload = await verifyFirebaseToken(authHeader)
        if (!userPayload) {
            return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
        }
        const { messages, systemPrompt: clientPrompt } = await req.json()
        const systemPrompt = clientPrompt || "You are Wanda, a friendly travel planning assistant."

        const modelMessages = (messages || []).map(m => ({
            role: m.role,
            content: Array.isArray(m.parts)
                ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')
                : (m.content || ''),
        }))

        const geminiKey = process.env.GEMINI_API_KEY
        const openrouterKey = process.env.OPENROUTER_API_KEY

        // Native @ai-sdk/google provider handles Gemini's streaming format correctly,
        // including tool call chunks (no missing-index Zod errors like the compat endpoint)
        if (geminiKey) {
            const google = createGoogleGenerativeAI({ apiKey: geminiKey })
            for (const modelId of ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash']) {
                try {
                    const result = await streamText({
                        model: google(modelId),
                        system: systemPrompt,
                        messages: modelMessages,
                        tools: WANDA_TOOLS,
                    })
                    return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
                } catch (e) {
                    console.warn(`[chat] ${modelId} failed, trying next:`, e.message)
                }
            }
        }

        // OpenRouter fallback
        if (openrouterKey) {
            const openrouter = createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: openrouterKey,
            })
            const result = await streamText({
                model: openrouter.chat('mistralai/mistral-small-3.1-24b-instruct:free'),
                system: systemPrompt,
                messages: modelMessages,
                tools: WANDA_TOOLS,
            })
            return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
        }

        return new Response(JSON.stringify({ error: 'No AI providers configured' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
    }
}
