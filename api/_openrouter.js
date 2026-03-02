// api/_openrouter.js — shared OpenRouter caller with model fallback chain.
// Free models have per-model rate limit buckets, so on 429 we try the next
// model automatically. 404 = wrong model ID, also skip to next.
export const FALLBACK_MODELS = [
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
    'google/gemma-2-9b-it:free',
]

const OR_HEADERS = (apiKey) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://planner.vlbonite.co',
    'X-Title': 'Wanderplan',
})

/**
 * Call OpenRouter with automatic fallback across free models.
 * Skips a model on 429 (rate limited) or 404 (model not found).
 * @param {string} apiKey - OPENROUTER_API_KEY
 * @param {object} body   - OpenAI-format request body (without `model`)
 * @returns {Promise<object>} Parsed response JSON
 */
export async function callOpenRouter(apiKey, body) {
    for (const model of FALLBACK_MODELS) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: OR_HEADERS(apiKey),
            body: JSON.stringify({ ...body, model }),
        })

        if (res.status === 429 || res.status === 404) {
            console.log(`[openrouter] ${model} skipped (${res.status}), trying next...`)
            continue
        }

        if (!res.ok) throw new Error(`OpenRouter error ${res.status}`)
        return await res.json()
    }

    throw new Error('All AI models unavailable. Please try again in a moment.')
}
