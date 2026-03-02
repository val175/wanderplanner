// api/_openrouter.js — shared OpenRouter caller with model fallback chain.
// Free models have per-model rate limit buckets, so on 429 we try the next
// model automatically. Each model has its own independent limit counter.
export const FALLBACK_MODELS = [
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.1-8b-instruct:free',
]

const OR_HEADERS = (apiKey) => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://planner.vlbonite.co',
    'X-Title': 'Wanderplan',
})

/**
 * Call OpenRouter with automatic fallback across free models on 429.
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

        if (res.status === 429) {
            console.log(`[openrouter] ${model} rate limited, trying next...`)
            continue
        }

        if (!res.ok) throw new Error(`OpenRouter error ${res.status}`)
        return await res.json()
    }

    throw new Error('OpenRouter error 429: all models rate limited')
}
