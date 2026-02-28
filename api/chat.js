// api/chat.js
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

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
        const { messages, data } = await req.json()
        const systemPrompt = data?.systemPrompt || "You are Wanda, a travel assistant."

        const result = await streamText({
            model: google('gemini-2.0-flash', {
                apiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY
            }),
            system: systemPrompt,
            messages: messages,
        })

        return result.toDataStreamResponse({ headers: CORS_HEADERS })

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        })
    }
}
