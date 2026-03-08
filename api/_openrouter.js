// api/_openrouter.js — Unified AI caller: Gemini (primary) + OpenRouter (fallback)
// Google AI Studio free tier (Wanderplanner project):
//   gemini-3.1-flash-lite-preview: 500 RPD — PRIMARY, covers nearly all traffic.
//   gemini-2.5-flash:              20 RPD  — fallback when lite quota is exhausted.
//   gemini-2.0-flash-lite / gemini-2.0-flash both show 0/0 quota — do NOT use.
// OpenRouter free tier: used only when all Gemini providers are exhausted.
//
// LESSON: callOpenRouter() is kept as a backwards-compat alias so extract-*.js
// files don't need to change. It auto-injects GEMINI_API_KEY from process.env.
//
// NOTE: gemini-1.5-flash and gemini-1.5-flash-8b return HTTP 404 via the OpenAI-compat
// endpoint (/v1beta/openai/chat/completions) — only 2.x+ models are exposed there.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const OR_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// Ordered list — Gemini first (primary), OpenRouter second (fallback).
export const PROVIDERS = [
    { model: 'gemini-3.1-flash-lite-preview', endpoint: GEMINI_ENDPOINT, keyType: 'gemini' },
    { model: 'gemini-2.5-flash',              endpoint: GEMINI_ENDPOINT, keyType: 'gemini' },
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
    const errors = []  // collect per-provider errors for diagnosis

    for (const provider of PROVIDERS) {
        if (provider.keyType === 'gemini' && !keys.gemini) {
            errors.push(`${provider.model}: skipped (no GEMINI_API_KEY)`)
            continue
        }
        if (provider.keyType === 'openrouter' && !keys.openrouter) {
            errors.push(`${provider.model}: skipped (no OPENROUTER_API_KEY)`)
            continue
        }

        const res = await fetch(provider.endpoint, {
            method: 'POST',
            headers: buildHeaders(provider, keys),
            body: JSON.stringify({ ...body, model: provider.model }),
        })

        if (res.status === 429 || res.status === 404) {
            const msg = `${provider.model}: HTTP ${res.status}`
            console.log(`[ai] ${msg}, trying next...`)
            errors.push(msg)
            continue
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            const detail = err?.error?.message || err?.message || JSON.stringify(err)
            const msg = `${provider.model}: HTTP ${res.status} — ${detail}`
            console.error(`[ai] ${msg}`)
            errors.push(msg)
            continue
        }

        const data = await res.json()
        if (!data.choices?.length) {
            const errMsg = data.error?.message || 'No choices in response'
            const msg = `${provider.model}: 200 but no choices — ${errMsg}`
            console.log(`[ai] ${msg}, trying next...`)
            errors.push(msg)
            continue
        }

        console.log(`[ai] success with ${provider.model}`)
        return data
    }

    throw new Error(`All AI models unavailable. Details: ${errors.join(' | ')}`)
}

/**
 * Backwards-compat alias — existing extract-*.js files call
 * callOpenRouter(process.env.OPENROUTER_API_KEY, body) unchanged.
 * This alias injects GEMINI_API_KEY automatically so Gemini is tried first.
 */
export function callOpenRouter(openrouterKey, body) {
    return callAI({ gemini: process.env.GEMINI_API_KEY, openrouter: openrouterKey }, body)
}
