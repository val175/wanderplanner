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

        const openrouter = createOpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        })

        // UIMessage[] has parts:[{type:'text',text}] — flatten to simple {role,content} strings
        const modelMessages = (messages || []).map(m => ({
            role: m.role,
            content: Array.isArray(m.parts)
                ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')
                : (m.content || ''),
        }))

        const result = await streamText({
            model: openrouter('google/gemma-3-27b-it:free'),
            system: systemPrompt,
            messages: modelMessages,
        })

        return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
    }
}
