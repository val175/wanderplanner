/**
 * useAI.js
 * OpenRouter wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */
import { auth } from '../firebase/config'

// All requests go through our Vercel proxy to keep the API key server-side
const API_BASE = import.meta.env.VITE_API_BASE || ''
const PROXY_URL = `${API_BASE}/api/gemini`

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
- Be warm and conversational, like a knowledgeable travel-savvy friend
- ALWAYS write a text reply alongside any tool calls — never call a tool without also sending a conversational message

🔧 TOOL: add_to_packing_list
Call proactively (alongside your text) when the user asks what to pack, or when you mention destination-specific items.
Rules: Call ONCE per item with a single item name string. Never pass arrays. Call up to 3 times per response.
Example — for a rainy trip, make 3 separate calls:
  call 1: { item: "Rain jacket", section: "Clothing", emoji: "🧥" }
  call 2: { item: "Compact umbrella", section: "Misc", emoji: "☂️" }
  call 3: { item: "Waterproof bag", section: "Misc", emoji: "🎒" }
Do not call it for universally obvious items like "clothes" or "shoes".

🔧 TOOL: add_idea_to_voting_room
Call proactively when the user asks for recommendations on what to do, where to stay, or where to eat.
Rules: Call ONCE per idea with individual fields. Never pass arrays. Call up to 3 times per response.
Example — for Kyoto recommendations, make 3 separate calls:
  call 1: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail through thousands of torii", emoji: "⛩️", priceDetails: "Free" }
  call 2: { title: "Arashiyama Bamboo Grove", type: "activity", description: "Iconic bamboo forest walk in western Kyoto", emoji: "🎋", priceDetails: "Free" }
  call 3: { title: "Nishiki Market", type: "food", description: "Street food and local snacks in narrow arcade", emoji: "🍜", priceDetails: "~$15/person" }
Do not call it for generic suggestions like "find a hotel" — only specific named places.`
}

/**
 * Low-level helper: POST to the proxy in OpenAI format, return response text.
 */
async function callProxy(messages, opts = {}) {
  let token = '';
  try {
    if (auth.currentUser) token = await auth.currentUser.getIdToken();
  } catch (e) { console.warn("Failed to get auth token", e); }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({
      model: opts.model || DEFAULT_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.max_tokens ?? 512,
      ...(opts.jsonMode && { response_format: { type: 'json_object' } }),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || err?.error?.message || `AI proxy error ${res.status}`)
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

export async function generateCityGuide(city, trip) {
  try {
    let token = '';
    if (auth.currentUser) token = await auth.currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/api/cities/auto-fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ city: city.city, country: city.country }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to generate city guide:", error)
    throw new Error("Failed to load city guide data")
  }
}

export async function extractIdeaDetails(url, tripCurrency) {
  try {
    let token = '';
    if (auth.currentUser) token = await auth.currentUser.getIdToken();

    const res = await fetch(`${API_BASE}/api/extract-idea`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
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
