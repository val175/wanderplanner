// api/chat.js
import { streamText } from 'ai'
import { google } from '@ai-sdk/google'

// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
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

        return result.toDataStreamResponse()

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
}
