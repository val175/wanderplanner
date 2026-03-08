// api/chat.js
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { verifyFirebaseToken } from './_auth.js'
import { CORS_HEADERS } from './_cors.js'

// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
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

        // Try Gemini — flash-lite first (500 RPD), then flash (20 RPD) as safety net
        if (geminiKey) {
            const gemini = createOpenAI({
                baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
                apiKey: geminiKey,
            })
            for (const modelId of ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash']) {
                try {
                    const result = await streamText({
                        model: gemini.chat(modelId),
                        system: systemPrompt,
                        messages: modelMessages,
                    })
                    return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
                } catch (e) {
                    console.log(`[chat] ${modelId} failed, trying next:`, e.message)
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
