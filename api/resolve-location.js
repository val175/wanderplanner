// api/resolve-location.js
import { generateText, stepCountIs } from 'ai'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { verifyFirebaseToken } from './_auth.js'
import { getCorsHeaders } from './_cors.js'

export const config = {
    runtime: 'edge',
}

const mapboxPrefix = 'pk.eyJ'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const locationCache = new Map()
const inflightRequests = new Map()
const MAPBOX_SUGGEST_ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_ENDPOINT = 'https://api.mapbox.com/search/searchbox/v1/retrieve'

const toNullableNumber = (value) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string') {
        const normalized = value.replace(/[^0-9.-]/g, '')
        if (!normalized) return null
        const parsed = Number(normalized)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

const toNullableBoolean = (value) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
        if (/^(true|yes|open|open now)$/i.test(value.trim())) return true
        if (/^(false|no|closed|closed now)$/i.test(value.trim())) return false
    }
    return null
}

const normalizeLabel = (value) => (value || '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
const tokenizeQuery = (value) => normalizeLabel(value).split(/[\s,]+/).filter(Boolean)

function normalizeCountryCode(country) {
    if (!country) return null
    const trimmed = country.toString().trim()
    if (!trimmed) return null
    if (/^[A-Z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
    return null
}

function buildSearchCandidates(query, cityHint) {
    const candidates = []
    const trimmedQuery = (query || '').toString().trim()
    const trimmedCity = (cityHint || '').toString().trim()

    if (trimmedQuery && trimmedCity) {
        candidates.push(`${trimmedQuery} ${trimmedCity}`)
    }

    if (trimmedQuery) candidates.push(trimmedQuery)
    if (trimmedCity) candidates.push(trimmedCity)

    return [...new Set(candidates.map(normalizeLabel).filter(Boolean))]
}

function scoreSuggestion(query, suggestion) {
    const qTokens = tokenizeQuery(query)
    if (qTokens.length === 0) return 0
    const label = normalizeLabel([
        suggestion?.name,
        suggestion?.place_name,
        suggestion?.place_formatted,
        suggestion?.full_address,
        suggestion?.properties?.name,
        suggestion?.properties?.full_address,
    ].filter(Boolean).join(' '))

    let score = 0
    for (const token of qTokens) {
        if (label.includes(token)) score += 1
    }
    if (label.includes(normalizeLabel(query))) score += qTokens.length
    return score
}

function isValidCoordinates(coordinates) {
    return Boolean(
        coordinates
        && Number.isFinite(coordinates.lat)
        && Number.isFinite(coordinates.lng)
        && !(coordinates.lat === 0 && coordinates.lng === 0)
    )
}

const locationWorkerSchema = z.object({
    placeName: z.string().min(1),
    address: z.string().optional().nullable(),
    searchQuery: z.string().optional().nullable(),
    rating: z.preprocess(toNullableNumber, z.number().nullable()).optional().nullable(),
    reviewCount: z.preprocess(toNullableNumber, z.number().int().nullable()).optional().nullable(),
    openingHours: z.string().optional().nullable(),
    isOpenNow: z.preprocess(toNullableBoolean, z.boolean().nullable()).optional().nullable(),
    website: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    placeId: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
})

function normalizeKey(query, cityHint, countryCodes = []) {
    const normalizedCountries = [...new Set((Array.isArray(countryCodes) ? countryCodes : [countryCodes])
        .map(normalizeCountryCode)
        .filter(Boolean))]
        .sort()
        .join(',')

    return [query, cityHint, normalizedCountries]
        .map(part => (part || '').toString().trim().toLowerCase().replace(/\s+/g, ' '))
        .join('||')
}

function stripJson(text) {
    if (!text) return ''
    return text
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
}

function extractSourceLinks(sources, groundingMetadata) {
    const links = new Set()

    for (const source of sources || []) {
        if (source?.url) links.add(source.url)
    }

    const chunks = groundingMetadata?.groundingChunks || []
    for (const chunk of chunks) {
        if (chunk?.maps?.uri) links.add(chunk.maps.uri)
        if (chunk?.web?.uri) links.add(chunk.web.uri)
        if (chunk?.url?.uri) links.add(chunk.url.uri)
    }

    return [...links].filter(Boolean)
}

function getMapboxToken() {
    return process.env.VITE_MAPBOX_PART2 ? `${mapboxPrefix}${process.env.VITE_MAPBOX_PART2}` : null
}

async function geocodeCoordinates(searchQuery) {
    const mapboxToken = getMapboxToken()
    if (!mapboxToken || !searchQuery) {
        return { coordinates: null, photoUrl: '' }
    }

    try {
        const mbRes = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(searchQuery)}&access_token=${mapboxToken}&limit=1`)
        if (!mbRes.ok) {
            return { coordinates: null, photoUrl: '' }
        }

        const mbData = await mbRes.json()
        const feature = mbData.features?.[0]
        if (!feature) {
            return { coordinates: null, photoUrl: '' }
        }

        const coordinates = {
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
        }

        return {
            coordinates,
            photoUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+cc402e(${coordinates.lng},${coordinates.lat})/${coordinates.lng},${coordinates.lat},14/60x60@2x?access_token=${mapboxToken}`,
        }
    } catch (error) {
        console.warn('Mapbox geocoding failed:', error.message)
        return { coordinates: null, photoUrl: '' }
    }
}

async function geocodeCoordinatesWithNominatim(searchQuery, countryCodes = []) {
    const trimmedQuery = (searchQuery || '').toString().trim()
    if (!trimmedQuery) {
        return { coordinates: null, photoUrl: '' }
    }

    try {
        const params = new URLSearchParams({
            q: trimmedQuery,
            format: 'jsonv2',
            addressdetails: '1',
            namedetails: '1',
            limit: '5',
        })

        const codes = [...new Set((Array.isArray(countryCodes) ? countryCodes : [countryCodes])
            .map(normalizeCountryCode)
            .filter(Boolean))]
        if (codes.length > 0) {
            params.set('countrycodes', codes.map(code => code.toLowerCase()).join(','))
        }

        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            headers: {
                'Accept-Language': 'en',
                'User-Agent': 'Wanderplan/1.0 (+https://wanderplan-rust.vercel.app)',
            },
        })

        if (!res.ok) {
            return { coordinates: null, photoUrl: '' }
        }

        const results = await res.json()
        const match = results?.[0]
        if (!match) {
            return { coordinates: null, photoUrl: '' }
        }

        const coordinates = {
            lng: Number(match.lon),
            lat: Number(match.lat),
        }

        if (!isValidCoordinates(coordinates)) {
            return { coordinates: null, photoUrl: '' }
        }

        return {
            coordinates,
            photoUrl: '',
            placeName: match.name || match.namedetails?.name || match.display_name || trimmedQuery,
            address: match.display_name || match.name || trimmedQuery,
            placeId: match.place_id ? `nominatim:${match.place_id}` : null,
            source: 'nominatim',
        }
    } catch (error) {
        console.warn('Nominatim geocoding failed:', error.message)
        return { coordinates: null, photoUrl: '' }
    }
}

async function resolveExactFeature({ query, cityHint, countryCodes }) {
    const mapboxToken = getMapboxToken()
    if (!query) return null

    const countries = [...new Set((Array.isArray(countryCodes) ? countryCodes : [countryCodes])
        .map(normalizeCountryCode)
        .filter(Boolean))]
    const candidates = buildSearchCandidates(query, cityHint)

    for (const candidate of candidates) {
        const nominatim = await geocodeCoordinatesWithNominatim(candidate, countries)
        if (nominatim.coordinates) {
            return {
                ...nominatim,
                searchQuery: candidate,
                exactMatch: true,
            }
        }

        if (!mapboxToken) continue

        const params = new URLSearchParams({
            q: candidate,
            access_token: mapboxToken,
            limit: '10',
            types: 'poi,address,place',
            session_token: `resolve-${Date.now().toString(36)}`,
        })
        if (countries.length > 0) {
            params.set('country', countries.join(','))
        }

        const res = await fetch(`${MAPBOX_SUGGEST_ENDPOINT}?${params.toString()}`)
        if (!res.ok) continue

        const data = await res.json()
        const suggestions = data.suggestions || data.features || []
        const best = [...suggestions]
            .sort((a, b) => scoreSuggestion(candidate, b) - scoreSuggestion(candidate, a))[0]

        const bestScore = scoreSuggestion(candidate, best)
        if (!best || bestScore < Math.max(2, Math.ceil(tokenizeQuery(query).length * 0.75))) {
            continue
        }

        const mapboxId = best.mapbox_id || best.properties?.mapbox_id || best.id
        if (!mapboxId) continue

        const retrieveRes = await fetch(`${MAPBOX_RETRIEVE_ENDPOINT}/${encodeURIComponent(mapboxId)}?${new URLSearchParams({
            access_token: mapboxToken,
            session_token: `resolve-${Date.now().toString(36)}`,
        }).toString()}`)
        if (!retrieveRes.ok) continue

        const retrieveData = await retrieveRes.json()
        const feature = retrieveData.features?.[0]
        const coordinates = feature?.geometry?.coordinates
        if (!Array.isArray(coordinates) || coordinates.length < 2) continue

        const result = {
            placeName: feature?.properties?.name || feature?.name || best.name || query,
            address: feature?.properties?.full_address || feature?.full_address || best.full_address || '',
            searchQuery: candidate,
            coordinates: {
                lng: coordinates[0],
                lat: coordinates[1],
            },
            placeId: mapboxId,
            sourceLinks: [],
            verified: true,
            exactMatch: true,
        }

        if (isValidCoordinates(result.coordinates)) {
            return result
        }
    }

    return null
}

async function runGroundedWorker({ query, cityHint, geminiKey }) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey })
    const modelIds = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
    const prompt = `Resolve a specific travel place and return ONLY valid JSON.

User query: "${query}"
City context: "${cityHint || 'unknown'}"

Use Google Maps grounding for place facts and Google Search grounding when needed for official site or current public info.
Do not invent facts. If a field is unknown or not confidently supported, return null.

Return an object with exactly these fields:
- placeName: canonical short place name
- address: street address or neighborhood, if known
- searchQuery: a clean Mapbox-friendly search query
- rating: numeric rating, if grounded
- reviewCount: integer review count, if grounded
- openingHours: short human-readable hours text, if grounded
- isOpenNow: boolean if open status is known
- website: official website URL, if known
- phone: public phone number, if known
- placeId: canonical Google Maps place id or null
- summary: one short helpful sentence

Use concise values and no markdown fences.`

    let lastError = null

    for (const modelId of modelIds) {
        try {
            const result = await generateText({
                model: google(modelId),
                tools: {
                    google_maps: google.tools.googleMaps({}),
                    google_search: google.tools.googleSearch({}),
                },
                toolChoice: 'auto',
                stopWhen: stepCountIs(3),
                maxRetries: 1,
                temperature: 0,
                maxOutputTokens: 900,
                prompt,
            })

            const raw = stripJson(result.text)
            const parsed = JSON.parse(raw)
            const workerData = locationWorkerSchema.parse(parsed)
            const sourceLinks = extractSourceLinks(result.sources, result.providerMetadata?.google?.groundingMetadata)

            return {
                ...workerData,
                sourceLinks: [...new Set(sourceLinks)].slice(0, 5),
                groundedModel: modelId,
            }
        } catch (error) {
            lastError = error
            console.warn(`[resolve-location] Grounding worker ${modelId} failed:`, error.message)
        }
    }

    throw lastError || new Error('Grounding worker failed')
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

        const { query, cityHint, countryCodes = [] } = await req.json()
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

        const cacheKey = normalizeKey(query, cityHint, countryCodes)
        const cached = locationCache.get(cacheKey)
        const now = Date.now()
        if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
            return new Response(JSON.stringify({ ...cached.data, cached: true }), {
                status: 200,
                headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
            })
        }

        let promise = inflightRequests.get(cacheKey)
        if (!promise) {
            promise = (async () => {
                const exact = await resolveExactFeature({ query, cityHint, countryCodes })
                const grounded = await runGroundedWorker({ query, cityHint, geminiKey })
                const geocodeCandidates = [
                    exact?.placeName,
                    exact?.address,
                    exact?.searchQuery,
                    grounded?.placeName,
                    grounded?.address,
                    grounded?.searchQuery,
                    query,
                    cityHint,
                ].filter(Boolean)

                let coordinates = exact?.coordinates || null
                let photoUrl = ''

                if (!isValidCoordinates(coordinates)) {
                    for (const candidate of geocodeCandidates) {
                        const nominatim = await geocodeCoordinatesWithNominatim(candidate, countryCodes)
                        if (isValidCoordinates(nominatim.coordinates)) {
                            coordinates = nominatim.coordinates
                            photoUrl = nominatim.photoUrl || ''
                            break
                        }

                        const mapbox = await geocodeCoordinates(candidate)
                        if (isValidCoordinates(mapbox.coordinates)) {
                            coordinates = mapbox.coordinates
                            photoUrl = mapbox.photoUrl || ''
                            break
                        }
                    }
                }

                const hasCoordinates = Boolean(
                    coordinates
                    && Number.isFinite(coordinates.lat)
                    && Number.isFinite(coordinates.lng)
                    && !(coordinates.lat === 0 && coordinates.lng === 0)
                )
                const mapUrl = hasCoordinates
                    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(grounded.searchQuery || grounded.address || grounded.placeName || query)}`
                const result = {
                    placeName: exact?.placeName || grounded.placeName || query,
                    address: exact?.address || grounded.address || '',
                    searchQuery: exact?.searchQuery || grounded.searchQuery || grounded.placeName || query,
                    coordinates,
                    placeId: exact?.placeId || grounded.placeId || '',
                    rating: typeof grounded.rating === 'number' ? grounded.rating : null,
                    reviewCount: typeof grounded.reviewCount === 'number' ? grounded.reviewCount : null,
                    openingHours: grounded.openingHours || '',
                    isOpenNow: typeof grounded.isOpenNow === 'boolean' ? grounded.isOpenNow : null,
                    website: grounded.website || '',
                    phone: grounded.phone || '',
                    summary: grounded.summary || '',
                    photoUrl,
                    mapUrl,
                    sourceLinks: grounded.sourceLinks || [],
                    groundedModel: grounded.groundedModel,
                    groundedAt: new Date().toISOString(),
                    verified: hasCoordinates || exact?.exactMatch === true,
                }
                locationCache.set(cacheKey, { cachedAt: Date.now(), data: result })
                return result
            })().finally(() => {
                inflightRequests.delete(cacheKey)
            })
            inflightRequests.set(cacheKey, promise)
        }

        const enriched = await promise

        return new Response(JSON.stringify(enriched), {
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
