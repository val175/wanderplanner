// api/resolve-location.js
import { generateObject } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = {
    runtime: 'edge',
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: getCorsHeaders(req) })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: getCorsHeaders(req) })
    }

    try {
        const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
        try {
            await verifyFirebaseToken(authHeader)
        } catch (authError) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        const { query, cityHint } = await req.json()
        if (!query) {
            return new Response(JSON.stringify({ error: 'Query is required' }), {
                status: 400,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        const geminiKey = process.env.GEMINI_API_KEY
        if (!geminiKey) {
            return new Response(JSON.stringify({ error: 'AI provider not configured' }), {
                status: 500,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        const google = createGoogleGenerativeAI({ apiKey: geminiKey })
        const model = google('gemini-3.1-flash-lite-preview')

        // Phase 1: AI extraction/cleaning
        const { object: extracted } = await generateObject({
            model,
            schema: z.object({
                placeName: z.string().describe('The clean, specific name of the location (e.g. "Sagrada Família")'),
                address: z.string().optional().describe('The street address or neighborhood'),
                searchQuery: z.string().describe('A refined query for geocoding (e.g. "Sagrada Família, Barcelona")'),
            }),
            prompt: `Extract location details from this trip intent: "${query}". 
            Context: The traveler is currently in or visiting ${cityHint || 'multiple cities'}.
            If it's a URL, infer the place name from it. Return a clean object.`
        })

        // Phase 2: Geocoding (Mapbox)
        const mapboxPrefix = "pk.eyJ"
        const mapboxToken = process.env.VITE_MAPBOX_PART2 ? `${mapboxPrefix}${process.env.VITE_MAPBOX_PART2}` : null

        let coordinates = { lat: 0, lng: 0 }
        let photoUrl = ''
        let mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(extracted.searchQuery)}`

        if (mapboxToken) {
            try {
                const mbRes = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(extracted.searchQuery)}&access_token=${mapboxToken}&limit=1`)
                if (mbRes.ok) {
                    const mbData = await mbRes.json()
                    const feature = mbData.features?.[0]
                    if (feature) {
                        coordinates = {
                            lng: feature.geometry.coordinates[0],
                            lat: feature.geometry.coordinates[1]
                        }
                        // Use Mapbox Static Tiles for a tiny thumbnail if no high-res photo available
                        photoUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+cc402e(${coordinates.lng},${coordinates.lat})/${coordinates.lng},${coordinates.lat},14/60x60@2x?access_token=${mapboxToken}`
                    }
                }
            } catch (e) {
                console.warn('Mapbox Geocoding failed:', e.message)
            }
        }

        return new Response(JSON.stringify({
            placeName: extracted.placeName,
            coordinates,
            placeId: '', // Would need Places API for this
            photoUrl,
            mapUrl,
            verified: coordinates.lat !== 0
        }), {
            status: 200,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('[resolve-location] Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
    }
}
