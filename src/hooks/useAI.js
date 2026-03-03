/**
 * useAI.js
 * OpenRouter wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */

// All requests go through our Vercel proxy to keep the API key server-side
const PROXY_URL = 'https://wanderplan-rust.vercel.app/api/gemini'

const DEFAULT_MODEL = 'mistralai/mistral-small-3.1-24b-instruct:free'

/**
 * Build a rich system prompt from the active trip.
 * This is what makes the AI feel "trip-aware" instead of generic.
 */
export function buildTripSystemPrompt(trip) {
  if (!trip) {
    return `You are Wanda, a friendly AI travel assistant built into Wanderplan, a trip planning app.
Help users plan trips, suggest activities, recommend restaurants, give packing advice, and optimize itineraries.
Be concise, warm, and practical. Use emojis sparingly. The user hasn't selected a trip yet, so give general travel advice.`
  }

  const cities = trip.cities?.map(c => `${c.flag} ${c.city}, ${c.country}`).join(' → ') || 'Not specified'
  const travelers = trip.travelers || 1
  const startDate = trip.startDate || 'TBD'
  const endDate = trip.endDate || 'TBD'

  const currency = trip.currency || 'PHP'
  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', PHP: '₱', AUD: 'A$', CAD: 'C$', SGD: 'S$', HKD: 'HK$', THB: '฿', IDR: 'Rp', KRW: '₩', MYR: 'RM', VND: '₫', INR: '₹' }
  const sym = currencySymbols[currency] || currency

  const daysCount = trip.itinerary?.length || 0
  const activitiesCount = trip.itinerary?.reduce((sum, d) => sum + (d.activities?.length || 0), 0) || 0

  const budgetSummary = trip.budget?.length
    ? trip.budget.map(b => `${b.emoji || ''} ${b.name}: ${sym}${b.max} budget (${sym}${b.actual || 0} spent)`).join(', ')
    : 'No budget set'

  const totalBudget = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0

  const bookings = trip.bookings || []
  const confirmedBookings = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length
  const pendingBookings = bookings.filter(b => b.status !== 'booked').length

  const todos = trip.todos || []
  const doneTodos = todos.filter(t => t.done).length

  const packingList = trip.packingList || []
  const packed = packingList.filter(p => p.packed).length

  const itinerarySummary = trip.itinerary?.slice(0, 5).map(d =>
    `Day ${d.dayNumber} (${d.location || 'location TBD'}): ${d.activities?.map(a => a.name).join(', ') || 'no activities yet'}`
  ).join('\n') || 'No itinerary yet'

  return `You are Wanda, a friendly AI travel assistant built into Wanderplan.
You are helping plan this specific trip:

🌍 TRIP: "${trip.name || 'Unnamed Trip'}" ${trip.emoji || '✈️'}
📍 Route: ${cities}
📅 Dates: ${startDate} → ${endDate} (${daysCount} days planned)
👥 Travelers: ${travelers}

💰 BUDGET (currency: ${currency}):
${budgetSummary}
Total: ${sym}${totalBudget} budget, ${sym}${totalSpent} spent, ${sym}${totalBudget - totalSpent} remaining

✈️ BOOKINGS: ${confirmedBookings} confirmed, ${pendingBookings} pending
✅ TODOS: ${doneTodos}/${todos.length} done
🧳 PACKING: ${packed}/${packingList.length} packed

📋 ITINERARY PREVIEW:
${itinerarySummary}

Your role:
- Give specific, actionable advice tailored to THIS trip's cities, budget, and timeline
- Be concise — 2-4 sentences per response unless the user asks for a detailed list
- ALWAYS use ${currency} (${sym}) when discussing money — NEVER use any other currency symbol
- Use emojis sparingly (1-2 per response max)
- When suggesting activities, consider the budget remaining (${sym}${totalBudget - totalSpent})
- If the user asks to "optimize" or "improve" something, give concrete suggestions
- Be warm and conversational, like a knowledgeable travel-savvy friend`
}

/**
 * Low-level helper: POST to the proxy in OpenAI format, return response text.
 */
async function callProxy(messages, opts = {}) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.max_tokens ?? 512,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `AI proxy error ${res.status}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('No response from AI')
  return text
}

/**
 * Send a message to the AI with full conversation history.
 * @param {string} systemPrompt - The trip-aware system prompt
 * @param {Array<{role: 'user'|'model', text: string}>} history - Prior messages
 * @param {string} userMessage - The new user message
 * @returns {Promise<string>} The AI's reply text
 */
export async function sendMessage(systemPrompt, history, userMessage) {
  const messages = [
    { role: 'system', content: systemPrompt },
    // Gemini used 'model' for assistant turns; OpenAI uses 'assistant'
    ...history.map(msg => ({ role: msg.role === 'model' ? 'assistant' : msg.role, content: msg.text })),
    { role: 'user', content: userMessage },
  ]
  return callProxy(messages, { temperature: 0.8, max_tokens: 512 })
}

/**
 * Generate an auto-filled city guide (Weather, Currency, Must-Do).
 */
export async function generateCityGuide(city, trip) {
  const prompt = `
You are Wanda, a travel assistant.
The user is traveling to: ${city.city}, ${city.country}.
Trip Dates: ${trip.startDate || 'Unknown'} to ${trip.endDate || 'Unknown'}.
Trip Currency: ${trip.currency || 'USD'}.

Please generate a quick travel guide for this city.
Return ONLY a valid JSON object with the following exact keys and format:

{
  "weather": "🌸 MARCH AVG\\n14°C / 5°C",
  "currencyTip": "¥ CURRENCY\\n1 USD = 150 JPY",
  "mustDo": "Neon lights, ancient temples, and the best food in the world. Don't miss the Shibuya Scramble, teamLab Planets, and eating ramen in Shinjuku."
}

Rules:
1. "weather": Based on the trip dates (or general averages if unknown), give a 2-line summary. Line 1: Emoji, Month, "AVG". Line 2: High/Low temp.
2. "currencyTip": 2-line summary. Line 1: Currency Symbol and "CURRENCY". Line 2: Exchange rate from ${trip.currency || 'USD'} to local.
3. "mustDo": A punchy, 2-to-3 sentence summary of the "Vibe & Must Do" highlights of the city.
4. DO NOT wrap the output in markdown code blocks like \`\`\`json. Output raw JSON only.
  `

  const messages = [
    { role: 'system', content: 'You are Wanda, a travel assistant built into Wanderplan.' },
    { role: 'user', content: prompt },
  ]

  const text = await callProxy(messages, { temperature: 0.7, max_tokens: 256 })
  const clean = text.replace(/^```json/m, '').replace(/^```/m, '').trim()
  try {
    return JSON.parse(clean)
  } catch (e) {
    console.error("Failed to parse city guide JSON:", clean)
    throw new Error("Invalid format returned from AI")
  }
}

/**
 * Generate a pin's name and emoji given a raw URL.
 */
export async function generatePinFromUrl(url) {
  const prompt = `
A user pasted this URL into their travel planner:
${url}

Figure out the real name of the place, restaurant, landmark, or link title.
Pick ONE single emoji that best categorizes it (e.g. 🍜 for ramen, 🏨 for hotel, 🏛️ for museum, ✈️ for airport, etc.). If it's just a generic link, use 🔗.

Return ONLY a valid JSON object with the exact keys:
{
  "name": "Ichiran Shibuya",
  "emoji": "🍜"
}

DO NOT wrap the output in markdown code blocks like \`\`\`json. Output raw JSON only.
  `

  const messages = [
    { role: 'system', content: 'You are Wanda, a travel assistant built into Wanderplan.' },
    { role: 'user', content: prompt },
  ]

  const text = await callProxy(messages, { temperature: 0.2, max_tokens: 64 })
  const clean = text.replace(/^```json/m, '').replace(/^```/m, '').trim()
  try {
    return JSON.parse(clean)
  } catch (e) {
    console.error("Failed to parse pin JSON:", clean)
    throw new Error("Invalid format returned from AI")
  }
}

export async function extractIdeaDetails(url, tripCurrency) {
  try {
    const res = await fetch('https://wanderplan-rust.vercel.app/api/extract-idea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, currency: tripCurrency }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error("Failed to parse Idea extraction:", error);
    throw new Error("Failed to extract details from this link.");
  }
}
