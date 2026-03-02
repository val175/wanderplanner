// api/_openrouter.js — shared OpenRouter caller with model fallback chain.
// Free models have per-model rate limit buckets, so on 429 we try the next
// model automatically. 404 = model not found, also skip to next.
// OpenRouter also returns HTTP 200 with an error body (e.g. "No endpoints found")
// when all providers for a model are offline — we detect that via missing `choices`.
export const FALLBACK_MODELS = [
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
]

const OR_HEADERS = (apiKey) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://planner.vlbonite.co',
    'X-Title': 'Wanderplan',
})

/**
 * Call OpenRouter with automatic fallback across free models.
 * Skips to next model on:
 *   - 429 (rate limited)
 *   - 404 (model not found)
 *   - 200 with no choices (e.g. "No endpoints found" in body)
 * @param {string} apiKey - OPENROUTER_API_KEY
 * @param {object} body   - OpenAI-format request body (without `model`)
 * @returns {Promise<object>} Parsed response JSON with choices
 */
export async function callOpenRouter(apiKey, body) {
    for (const model of FALLBACK_MODELS) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: OR_HEADERS(apiKey),
            body: JSON.stringify({ ...body, model }),
        })

        if (res.status === 429 || res.status === 404) {
            console.log(`[openrouter] ${model} skipped (HTTP ${res.status}), trying next...`)
            continue
        }

        if (!res.ok) throw new Error(`OpenRouter error ${res.status}`)

        const data = await res.json()

        // OpenRouter may return 200 with an error body instead of choices
        // (e.g. "No endpoints found for this model")
        if (!data.choices?.length) {
            const errMsg = data.error?.message || 'No choices in response'
            console.log(`[openrouter] ${model} no valid response: ${errMsg}, trying next...`)
            continue
        }

        return data
    }

    throw new Error('All AI models unavailable. Please try again in a moment.')
}
