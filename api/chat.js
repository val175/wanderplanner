// api/chat.js
import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'
const rateLimitMap = new Map() // uid → timestamp[]
const RATE_LIMIT = 10
const WINDOW_MS = 60_000


// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
}

const WANDA_TOOLS = {
    add_to_packing_list: tool({
        description: [
            'Add ONE specific packing item to the trip packing list as a supporting addition to your text answer.',
            'IMPORTANT: You MUST answer the user\'s question in text first. This tool is only for adding items you mentioned.',
            'Call once per individual item — never use arrays, never group items.',
            'Correct: { item: "Rain jacket", section: "Clothing", emoji: "🧥" }',
            'Correct: { item: "Compact umbrella", section: "Misc", emoji: "☂️" }',
            'Call up to 3 times per response for different individual items.',
        ].join(' '),
        parameters: z.object({
            item: z.string().describe('Name of a single packing item as a plain string, e.g. "Rain jacket". Never an array.'),
            section: z.enum(['Documents', 'Clothing', 'Toiletries', 'Electronics', 'Health', 'Misc']).describe('Packing section for this item'),
            emoji: z.string().describe('One emoji character for this item, e.g. "🧥"'),
        }),
    }),
    add_idea_to_voting_room: tool({
        description: [
            'Add ONE travel recommendation to the trip voting room as a supporting addition to your text answer.',
            'IMPORTANT: You MUST answer the user\'s question or provide recommendations in text first. This tool is only for adding places you mentioned.',
            'Call once per idea — never group multiple ideas in one call.',
            'Correct: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail", emoji: "⛩️", priceDetails: "Free" }',
            'Correct: { title: "The Peninsula Hotel", type: "lodging", description: "Luxury hotel in city center", emoji: "🏨", priceDetails: "~$300/night" }',
            'Call up to 3 times per response for different recommendations.',
        ].join(' '),
        parameters: z.object({
            title: z.string().describe('Name of the place or activity, e.g. "Fushimi Inari Hike". Plain string, not an array.'),
            type: z.enum(['lodging', 'activity', 'food', 'transport', 'shopping', 'other']).describe('Category of the idea'),
            description: z.string().describe('One sentence describing why this is worth considering'),
            emoji: z.string().describe('One relevant emoji character, e.g. "⛩️"'),
            priceDetails: z.string().describe('Estimated cost as a plain string, e.g. "~$50/person", "Free", or "TBD"'),
        }),
    }),
    generate_day_itinerary: tool({
        description: [
            'Generate a full day itinerary plan for one trip day.',
            'Call when the user asks to "plan my day", "create a schedule for Day X", "fill in Day N", or "what should I do in [city]".',
            'Produce 3-6 time-slotted activities in chronological order. The user will confirm before they are added.',
            'IMPORTANT: You MUST explicitly return an `endTime` for every generated event.',
            'IMPORTANT: Check the existing schedule context for the day to avoid generating overlapping times with existing activities.',
        ].join(' '),
        parameters: z.object({
            dayNumber: z.number().describe('The trip day number (1-based integer) this plan targets, e.g. 3 for "Day 3".'),
            location: z.string().describe('City or area for this day, e.g. "Kyoto, Japan".'),
            activities: z.array(z.object({
                name: z.string().describe('Activity name, e.g. "Visit Fushimi Inari Shrine".'),
                emoji: z.string().describe('One emoji for this activity.'),
                time: z.string().describe('Start time in 24-hour HH:MM format, e.g. "09:00".'),
                endTime: z.string().describe('End time in 24-hour HH:MM format, e.g. "10:30". MUST not overlap with other events.'),
                duration: z.number().describe('Duration in minutes, e.g. 90.'),
                category: z.enum(['food', 'sightseeing', 'transport', 'accommodation', 'shopping', 'activity', 'other']),
                notes: z.string().optional().describe('Optional brief tip for this activity.'),
            })).describe('3-6 activities in chronological order.'),
        }),
    }),
    add_budget_alert: tool({
        description: [
            'Add a persistent budget alert to the trip Overview attention items.',
            'Call ONLY when the user explicitly performs a "Budget Check" or asks weight/pace questions.',
            'DO NOT use this tool for general travel advice unless the budget risk is critical.',
            'Call once per distinct issue (up to 3 per response).',
        ].join(' '),
        parameters: z.object({
            title: z.string().describe('Short alert title, e.g. "Accommodation over budget".'),
            message: z.string().describe('1-2 sentences explaining the issue and a concrete suggestion.'),
            severity: z.enum(['warning', 'danger', 'info']).describe('danger=over budget, warning=approaching limit, info=tip.'),
            emoji: z.string().describe('One emoji for this alert, e.g. "💸".'),
        }),
    }),
    recommend_from_voting_room: tool({
        description: [
            'Synthesize the trip voting room ideas and recommend the best 2-4 picks, one per category.',
            'Call when the user asks to "Pick Winners", "narrow down options", or "which should we choose".',
            'Call ONCE. Wanda must also write a full text recommendation alongside this call.',
        ].join(' '),
        parameters: z.object({
            picks: z.array(z.object({
                title: z.string(),
                type: z.string(),
                emoji: z.string(),
                reason: z.string().describe('1 sentence why this is the best pick in its category'),
            })).describe('2-4 best ideas, one per category (lodging, activity, food, etc.)'),
        }),
    }),
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: getCorsHeaders(req) })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
    }

    try {
        // Authenticate the request
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        let userPayload
        try {
            userPayload = await verifyFirebaseToken(authHeader)
        } catch (authError) {
            console.warn('[chat] Auth failed:', authError.message)
            return new Response(JSON.stringify({ error: authError.message }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        const uid = userPayload.uid
        const now = Date.now()
        const hits = (rateLimitMap.get(uid) || []).filter(t => now - t < WINDOW_MS)
        if (hits.length >= RATE_LIMIT) {
          return new Response(JSON.stringify({ error: 'Too many requests. Please wait a moment.' }), {
            status: 429,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          })
        }
        rateLimitMap.set(uid, [...hits, now])

        if (!userPayload) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }
        const { messages, systemPrompt: clientPrompt, weatherContext } = await req.json()
        const systemPrompt = [
            clientPrompt || "You are Wanda, a friendly travel planning assistant.",
            weatherContext ? `LIVE WEATHER CONTEXT:\n${weatherContext}` : '',
        ].filter(Boolean).join('\n\n')

        // convertToModelMessages correctly serializes tool-call and tool-result parts
        // from the AI SDK's UIMessage format. The previous manual mapping was text-only,
        // which caused assistant messages that only called a tool (e.g. generate_day_itinerary)
        // to appear blank in history, making the model re-fire the tool on every follow-up.
        const modelMessages = await convertToModelMessages(messages || [], {
            tools: WANDA_TOOLS,
            ignoreIncompleteToolCalls: true,
        })

        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) {
            return new Response(JSON.stringify({ error: 'Gemini API key is missing' }), {
                status: 500,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        const google = createGoogleGenerativeAI({
            apiKey: geminiKey,
        })
        const result = await streamText({
            model: google('gemini-3.1-flash-lite-preview'),
            system: systemPrompt,
            messages: modelMessages,
            tools: WANDA_TOOLS,
        })
        return result.toUIMessageStreamResponse({ headers: getCorsHeaders(req) })

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
    }
}
