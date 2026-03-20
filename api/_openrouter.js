// api/_openrouter.js — Gemini-only AI caller for all non-grounding text tasks.
// Google AI Studio free tier (Wanderplanner project):
//   gemini-3.1-flash-lite-preview: primary model for all non-grounding AI.
//
// NOTE: This file keeps the historical callOpenRouter() alias so existing
// extract-*.js callers do not need to change. The implementation no longer
// falls back to OpenRouter or Gemini 2.5 models.

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

// Single-provider list — Gemini 3.1 Flash Lite only.
export const PROVIDERS = [
    { model: 'gemini-3.1-flash-lite-preview', endpoint: GEMINI_ENDPOINT, keyType: 'gemini' },
]

// Kept for any code that reads the model name list
export const FALLBACK_MODELS = PROVIDERS.map(p => p.model)

function buildHeaders(provider, keys) {
    return {
        'Authorization': `Bearer ${keys.gemini}`,
        'Content-Type': 'application/json',
    }
}

/**
 * Call the Gemini provider for non-grounding text tasks.
 * @param {{ gemini: string }} keys
 * @param {object} body  OpenAI-format request body (without `model`)
 * @returns {Promise<object>} Parsed response with choices
 */
export async function callAI(keys, body) {
    const errors = []  // collect errors for diagnosis

    for (const provider of PROVIDERS) {
        if (provider.keyType === 'gemini' && !keys.gemini) {
            errors.push(`${provider.model}: skipped (no GEMINI_API_KEY)`)
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
 * Backwards-compat alias — existing extract-*.js files call this helper.
 * Gemini API key is used directly.
 */
export function callOpenRouter(body) {
    return callAI({ gemini: process.env.GEMINI_API_KEY }, body)
}
