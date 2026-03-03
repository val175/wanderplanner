// api/_openrouter.js — Unified AI caller: Gemini (primary) + OpenRouter (fallback)
// Google AI Studio free tier: gemini-2.0-flash-lite (30 RPM), gemini-2.0-flash (15 RPM)
// OpenRouter free tier: used only when all Gemini providers are exhausted.
//
// LESSON: callOpenRouter() is kept as a backwards-compat alias so extract-*.js
// files don't need to change. It auto-injects GEMINI_API_KEY from process.env.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Ordered list — Gemini first (primary), OpenRouter second (fallback).
export const PROVIDERS = [
    { model: 'gemini-2.0-flash-lite', endpoint: GEMINI_ENDPOINT, keyType: 'gemini' },
    { model: 'gemini-2.0-flash',      endpoint: GEMINI_ENDPOINT, keyType: 'gemini' },
    { model: 'mistralai/mistral-small-3.1-24b-instruct:free', endpoint: OR_ENDPOINT, keyType: 'openrouter' },
    { model: 'google/gemma-3-27b-it:free',                    endpoint: OR_ENDPOINT, keyType: 'openrouter' },
    { model: 'meta-llama/llama-3.3-70b-instruct:free',        endpoint: OR_ENDPOINT, keyType: 'openrouter' },
]

// Kept for any code that reads the model name list
export const FALLBACK_MODELS = PROVIDERS.map(p => p.model)

function buildHeaders(provider, keys) {
    const apiKey = provider.keyType === 'gemini' ? keys.gemini : keys.openrouter
    const h = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
    if (provider.keyType === 'openrouter') {
        h['HTTP-Referer'] = 'https://planner.vlbonite.co'
        h['X-Title'] = 'Wanderplan'
    }
    return h
}

/**
 * Call AI providers with automatic fallback: Gemini first, then OpenRouter.
 * @param {{ gemini: string, openrouter: string }} keys
 * @param {object} body  OpenAI-format request body (without `model`)
 * @returns {Promise<object>} Parsed response with choices
 */
export async function callAI(keys, body) {
    for (const provider of PROVIDERS) {
        if (provider.keyType === 'gemini' && !keys.gemini) continue
        if (provider.keyType === 'openrouter' && !keys.openrouter) continue

        const res = await fetch(provider.endpoint, {
            method: 'POST',
            headers: buildHeaders(provider, keys),
            body: JSON.stringify({ ...body, model: provider.model }),
        })

        if (res.status === 429 || res.status === 404) {
            console.log(`[ai] ${provider.model} skipped (HTTP ${res.status}), trying next...`)
            continue
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            console.error(`[ai] ${provider.model} error (HTTP ${res.status}):`, err)
            continue
        }

        const data = await res.json()
        if (!data.choices?.length) {
            const errMsg = data.error?.message || 'No choices in response'
            console.log(`[ai] ${provider.model} no valid response: ${errMsg}, trying next...`)
            continue
        }

        console.log(`[ai] success with ${provider.model}`)
        return data
    }

    throw new Error('All AI models unavailable. Please try again in a moment.')
}

/**
 * Backwards-compat alias — existing extract-*.js files call
 * callOpenRouter(process.env.OPENROUTER_API_KEY, body) unchanged.
 * This alias injects GEMINI_API_KEY automatically so Gemini is tried first.
 */
export function callOpenRouter(openrouterKey, body) {
    return callAI({ gemini: process.env.GEMINI_API_KEY, openrouter: openrouterKey }, body)
}
