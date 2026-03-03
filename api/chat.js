// api/chat.js
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://planner.vlbonite.co',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    'Access-Control-Allow-Credentials': 'true',
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
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

        // Try Gemini first (gemini-2.0-flash-lite: 30 RPM free tier)
        if (geminiKey) {
            try {
                const gemini = createOpenAI({
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
                    apiKey: geminiKey,
                })
                const result = await streamText({
                    model: gemini('gemini-2.0-flash-lite'),
                    system: systemPrompt,
                    messages: modelMessages,
                })
                return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
            } catch (e) {
                console.log('[chat] Gemini failed, falling back to OpenRouter:', e.message)
            }
        }

        // OpenRouter fallback
        if (openrouterKey) {
            const openrouter = createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: openrouterKey,
            })
            const result = await streamText({
                model: openrouter('mistralai/mistral-small-3.1-24b-instruct:free'),
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
