// api/chat.js
import { streamText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

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
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
        const { messages, systemPrompt: clientPrompt } = await req.json()
        const systemPrompt = clientPrompt || "You are Wanda, a friendly travel planning assistant."

        // createGoogleGenerativeAI lets us supply GEMINI_API_KEY explicitly;
        // the default google() export reads GOOGLE_GENERATIVE_AI_API_KEY instead
        const google = createGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
        })

        // UIMessage[] has parts:[{type:'text',text}] — flatten to simple {role,content} strings
        // that streamText's ModelMessage schema definitely accepts
        const modelMessages = (messages || []).map(m => ({
            role: m.role,
            content: Array.isArray(m.parts)
                ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')
                : (m.content || ''),
        }))

        const result = await streamText({
            model: google('gemini-2.0-flash'),
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
