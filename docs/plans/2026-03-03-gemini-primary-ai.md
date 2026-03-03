# Gemini-Primary AI with OpenRouter Fallback — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace OpenRouter-only AI calls with Google AI Studio (Gemini) as primary provider and OpenRouter free models as fallback.

**Architecture:** A unified `PROVIDERS` array in `_openrouter.js` lists Gemini models first (via Google's OpenAI-compatible endpoint), then OpenRouter free models. A backwards-compat `callOpenRouter` alias means the 3 extract endpoints need zero changes. `gemini.js` keeps its own inline loop (never delegates, Antigravity's lesson). `chat.js` tries Gemini via `createOpenAI` baseURL swap, catches errors, falls back to OpenRouter.

**Tech Stack:** Google AI Studio REST API (OpenAI-compat endpoint), `@ai-sdk/openai` for streaming in `chat.js`, Vercel serverless (Node.js runtime for extract/gemini, Edge runtime for chat).

**Key insight:** `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` accepts identical OpenAI-format request/response bodies — no parsing changes needed anywhere.

**Free tier limits (Gemini AI Studio):**
- `gemini-2.0-flash-lite`: 30 RPM, 1500 RPD
- `gemini-2.0-flash`: 15 RPM, 1500 RPD

---

## Task 1: Rewrite `api/_openrouter.js`

**Files:**
- Modify: `api/_openrouter.js`

**What to write:**

```js
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
```

**Step 1:** Replace the full contents of `api/_openrouter.js` with the above.

**Step 2:** Verify no syntax errors
```bash
node --input-type=module < api/_openrouter.js 2>&1 || echo "syntax ok"
```

**Step 3:** Commit
```bash
git add api/_openrouter.js
git commit -m "feat: unified AI provider list — Gemini primary, OpenRouter fallback"
```

---

## Task 2: Update `api/gemini.js`

**Files:**
- Modify: `api/gemini.js`

**What to write** — keep the inline loop (never delegate to callAI — Antigravity lesson), import `PROVIDERS` instead of `FALLBACK_MODELS`, route each call to the right endpoint with the right key:

```js
// api/gemini.js — AI proxy for frontend Wanda chat calls
// Keeps its own inline provider loop — never delegates to callAI — so req.body
// handling is explicit and safe. (Delegating caused the Antigravity 500 bug.)
import { PROVIDERS } from './_openrouter.js'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

    try {
        const geminiKey = process.env.GEMINI_API_KEY
        const openrouterKey = process.env.OPENROUTER_API_KEY

        if (!geminiKey && !openrouterKey) {
            console.error('No AI API keys configured')
            return res.status(500).json({ error: 'Server misconfiguration: No AI API keys.' })
        }

        for (const provider of PROVIDERS) {
            const apiKey = provider.keyType === 'gemini' ? geminiKey : openrouterKey
            if (!apiKey) continue  // skip providers whose key isn't configured

            const headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
            if (provider.keyType === 'openrouter') {
                headers['HTTP-Referer'] = 'https://planner.vlbonite.co'
                headers['X-Title'] = 'Wanderplan'
            }

            const response = await fetch(provider.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...req.body, model: provider.model }),
            })

            if (response.status === 429 || response.status === 404) {
                console.log(`[gemini-proxy] ${provider.model} skipped (${response.status})`)
                continue
            }

            if (!response.ok) {
                console.error(`[gemini-proxy] ${provider.model} non-ok (${response.status})`)
                continue
            }

            const data = await response.json()
            if (!data.choices?.length) {
                const errMsg = data.error?.message || 'No choices'
                console.log(`[gemini-proxy] ${provider.model} no valid response: ${errMsg}`)
                continue
            }

            return res.status(200).json(data)
        }

        return res.status(429).json({ error: 'All AI models unavailable. Please try again in a moment.' })
    } catch (error) {
        console.error('AI Proxy Error:', error)
        return res.status(500).json({ error: error.message || 'Internal Server Error' })
    }
}
```

**Step 1:** Replace full contents of `api/gemini.js` with the above.

**Step 2:** Commit
```bash
git add api/gemini.js
git commit -m "feat: gemini proxy tries Gemini AI Studio first, OpenRouter fallback"
```

---

## Task 3: Update `api/chat.js`

**Files:**
- Modify: `api/chat.js`

**What to write** — swap `createOpenAI` base URL to Google's endpoint, add try/catch fallback to OpenRouter:

```js
// api/chat.js
import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// THIS IS THE MAGIC LINE: Bypasses the 10s timeout on Vercel Hobby tier
export const config = {
    runtime: 'edge',
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': 'https://planner.vlbonite.co',
    'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
    'Access-Control-Allow-Credentials': 'true',
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS })
    }
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS })
    }

    try {
        const { messages, systemPrompt: clientPrompt } = await req.json()
        const systemPrompt = clientPrompt || "You are Wanda, a friendly travel planning assistant."

        const modelMessages = (messages || []).map(m => ({
            role: m.role,
            content: Array.isArray(m.parts)
                ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n')
                : (m.content || ''),
        }))

        const geminiKey = process.env.GEMINI_API_KEY
        const openrouterKey = process.env.OPENROUTER_API_KEY

        // Try Gemini first (gemini-2.0-flash-lite: 30 RPM free tier)
        if (geminiKey) {
            try {
                const gemini = createOpenAI({
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
                    apiKey: geminiKey,
                })
                const result = await streamText({
                    model: gemini('gemini-2.0-flash-lite'),
                    system: systemPrompt,
                    messages: modelMessages,
                })
                return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
            } catch (e) {
                console.log('[chat] Gemini failed, falling back to OpenRouter:', e.message)
            }
        }

        // OpenRouter fallback
        if (openrouterKey) {
            const openrouter = createOpenAI({
                baseURL: 'https://openrouter.ai/api/v1',
                apiKey: openrouterKey,
            })
            const result = await streamText({
                model: openrouter('mistralai/mistral-small-3.1-24b-instruct:free'),
                system: systemPrompt,
                messages: modelMessages,
            })
            return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })
        }

        return new Response(JSON.stringify({ error: 'No AI providers configured' }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error('Streaming Error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
    }
}
```

**Step 1:** Replace full contents of `api/chat.js` with the above.

**Step 2:** Commit
```bash
git add api/chat.js
git commit -m "feat: chat streaming uses Gemini AI Studio primary, OpenRouter fallback"
```

---

## Task 4: Add `GEMINI_API_KEY` to Vercel

**This step is manual — the user must do it.**

1. Go to [vercel.com/val175/wanderplanner/settings/environment-variables](https://vercel.com/val175/wanderplanner/settings/environment-variables)
2. Add `GEMINI_API_KEY` = your Google AI Studio key (from [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
3. Make sure `OPENROUTER_API_KEY` is still set (for fallback)
4. Redeploy (or it picks up on next push)

**Free models to use (no `limit:0` error):**
- `gemini-2.0-flash-lite` ✓ 30 RPM free
- `gemini-2.0-flash` ✓ 15 RPM free
- **NOT** `gemini-2.5-pro-exp-03-25` ✗ paid only (the `limit:0` culprit)

---

## Task 5: Final push and verify

```bash
git push
```

Wait ~60s for Vercel to deploy, then test:
- Voting room card extractor (extract-idea) → should succeed
- Wanda chat → should use Gemini (check Vercel logs for `[ai] success with gemini-2.0-flash-lite`)
- Magic Import → should succeed
