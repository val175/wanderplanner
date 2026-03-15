/**
 * useAI.js
 * OpenRouter wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */
import { auth } from '../firebase/config'

// All AI/API requests go to the Vercel deployment (absolute URL required — frontend is on Hostinger)
const VERCEL_API = 'https://wanderplan-rust.vercel.app'
const PROXY_URL = `${VERCEL_API}/api/gemini`

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

  const budgetSummary = (() => {
    const cats = trip.budget || []
    if (!cats.length) return 'No budget set'
    const sorted = [...cats].sort((a, b) => (b.actual || 0) - (a.actual || 0))
    const shown = sorted.slice(0, 4)
    const rest = sorted.slice(4)
    const lines = shown.map(b => `${b.emoji || ''} ${b.name}: ${sym}${b.max} (${sym}${b.actual || 0} spent)`)
    if (rest.length) lines.push(`+ ${rest.length} more categories (${sym}${rest.reduce((s, b) => s + (b.max || 0), 0)} total)`)
    return lines.join(', ')
  })()

  const totalBudget = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0

  const bookings = trip.bookings || []
  const confirmedBookings = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length
  const pendingBookings = bookings.filter(b => b.status !== 'booked').length

  const todos = trip.todos || []
  const doneTodos = todos.filter(t => t.done).length

  const packingList = trip.packingList || []
  const packed = packingList.filter(p => p.packed).length

  const votingIdeas = (trip.ideas || []).slice(0, 20)
  const votingContext = votingIdeas.length
    ? votingIdeas.map(i => `${i.emoji || ''} ${i.title} (${i.type}${i.priceDetails ? ', ' + i.priceDetails : ''})`).join(' | ')
    : 'No ideas yet'

  const itinerarySummary = (() => {
    const itinerary = trip.itinerary || []
    if (!itinerary.length) return 'No itinerary yet'

    // Find "current" day index by matching today's date, or default to day 0
    const todayStr = new Date().toISOString().split('T')[0]
    let pivot = itinerary.findIndex(d => d.date >= todayStr)
    if (pivot === -1) pivot = itinerary.length - 1

    const past = itinerary.slice(0, pivot)
    const focus = itinerary.slice(pivot, pivot + 3)  // current + next 2 days
    const future = itinerary.slice(pivot + 3)

    const lines = []
    if (past.length) {
      const locs = [...new Set(past.map(d => d.location).filter(Boolean))]
      lines.push(`Days 1–${past.length} (completed): ${locs.join(' → ') || 'various locations'}`)
    }
    focus.forEach(d =>
      lines.push(`Day ${d.dayNumber} (${d.location || 'TBD'}): ${d.activities?.map(a => a.name).join(', ') || 'no activities yet'}`)
    )
    if (future.length) lines.push(`+ ${future.length} more days planned ahead`)
    return lines.join('\n')
  })()

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
🗳️ VOTING ROOM (${votingIdeas.length} ideas): ${votingContext}

📋 ITINERARY PREVIEW:
${itinerarySummary}

Your role:
- ALWAYS answer the user's question directly and thoroughly in your text response.
- Your text reply is MANDATORY and must be your primary focus.
- Tool calls are OPTIONAL supporting additions. Never call a tool as a replacement for a textual answer.
- Give specific, actionable advice tailored to THIS trip's cities, budget, and timeline
- Be concise — 2-4 sentences per response unless the user asks for a detailed list
- ALWAYS use ${currency} (${sym}) when discussing money — NEVER use any other currency symbol
- Use emojis sparingly (1-2 per response max)
- When suggesting activities, consider the budget remaining (${sym}${totalBudget - totalSpent})
- If the user asks to "optimize" or "improve" something, give concrete suggestions
- Be warm and conversational, like a knowledgeable travel-savvy friend
- ALWAYS write a full, helpful text reply alongside any tool calls.

🔧 TOOL: generate_day_itinerary
Call ONLY after answering why this plan is good. Include 3–6 activities in chronological order with realistic times. Match the trip's cities and dates. Target the correct dayNumber from the itinerary preview above.
Example for "Plan my Day 3 in Kyoto": { dayNumber: 3, location: "Kyoto, Japan", activities: [{ name: "Morning at Fushimi Inari", emoji: "⛩️", time: "08:00", duration: 120, category: "sightseeing" }, ...] }

🔧 TOOL: add_budget_alert
Call proactively when flagging a category overrun, spending risk, or cost-saving tip mentioned in your text. Call once per distinct issue, up to 3 per response.
Severity: "danger" = over budget, "warning" = approaching limit, "info" = suggestion.
Example: { title: "Hotels over budget", message: "Spent 120% of lodging budget. Try moving 1 night to a cheaper option.", severity: "danger", emoji: "🏨" }

🔧 TOOL: add_to_packing_list
Call as a supporting addition when you mention destination-specific items in your answer.
Rules: Call ONCE per item with a single item name string. Never pass arrays. Call up to 3 times per response.
Example — for a rainy trip, make 3 separate calls:
  call 1: { item: "Rain jacket", section: "Clothing", emoji: "🧥" }
  call 2: { item: "Compact umbrella", section: "Misc", emoji: "☂️" }
  call 3: { item: "Waterproof bag", section: "Misc", emoji: "🎒" }
Do not call it for universally obvious items like "clothes" or "shoes".

🔧 TOOL: add_idea_to_voting_room
Call as a supporting addition when you recommend specific places or activities in your answer.
Rules: Call ONCE per idea with individual fields. Never pass arrays. Call up to 3 times per response.
Example — for Kyoto recommendations, make 3 separate calls:
  call 1: { title: "Fushimi Inari Hike", type: "activity", description: "Famous torii gate trail through thousands of torii", emoji: "⛩️", priceDetails: "Free" }
  call 2: { title: "Arashiyama Bamboo Grove", type: "activity", description: "Iconic bamboo forest walk in western Kyoto", emoji: "🎋", priceDetails: "Free" }
  call 3: { title: "Nishiki Market", type: "food", description: "Street food and local snacks in narrow arcade", emoji: "🍜", priceDetails: "~$15/person" }
Do not call it for generic suggestions like "find a hotel" — only specific named places.

🔧 TOOL: recommend_from_voting_room
Call when asked to "Pick Winners" or choose the best idea. Analyze the VOTING ROOM above.
Call ONCE with picks array. Each pick: best of its type with a 1-sentence reason.
Example: { picks: [{ title: "The Peninsula Hotel", type: "lodging", emoji: "🏨", reason: "Best value in lodging — under budget with strong reviews" }] }`
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

    const res = await fetch(`${VERCEL_API}/api/cities/auto-fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ city: city.city, country: city.country, tripStartDate: trip?.startDate, tripEndDate: trip?.endDate }),
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

    const res = await fetch(`${VERCEL_API}/api/extract-idea`, {
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
