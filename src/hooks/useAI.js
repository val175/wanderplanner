/**
 * useAI.js
 * Gemini 2.0 Flash wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */

// Requests go to our Cloudflare Worker proxy — the Gemini API key
// lives there as an encrypted secret, never in the frontend bundle.
const PROXY_URL = 'https://wanderplan-ai.valentin-bonite.workers.dev/ai'

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

  const daysCount = trip.itinerary?.length || 0
  const activitiesCount = trip.itinerary?.reduce((sum, d) => sum + (d.activities?.length || 0), 0) || 0

  const budgetSummary = trip.budget?.length
    ? trip.budget.map(b => `${b.emoji || ''} ${b.name}: €${b.max} budget (€${b.actual || 0} spent)`).join(', ')
    : 'No budget set'

  const totalBudget = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0

  const bookings = trip.bookings || []
  const confirmedBookings = bookings.filter(b => b.status === 'booked').length
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

💰 BUDGET:
${budgetSummary}
Total: €${totalBudget} budget, €${totalSpent} spent, €${totalBudget - totalSpent} remaining

✈️ BOOKINGS: ${confirmedBookings} confirmed, ${pendingBookings} pending
✅ TODOS: ${doneTodos}/${todos.length} done
🧳 PACKING: ${packed}/${packingList.length} packed

📋 ITINERARY PREVIEW:
${itinerarySummary}

Your role:
- Give specific, actionable advice tailored to THIS trip's cities, budget, and timeline
- Be concise — 2-4 sentences per response unless the user asks for a detailed list
- Use emojis sparingly (1-2 per response max)
- When suggesting activities, consider the budget remaining (€${totalBudget - totalSpent})
- If the user asks to "optimize" or "improve" something, give concrete suggestions
- Be warm and conversational, like a knowledgeable travel-savvy friend`
}

/**
 * Send a message to Gemini with full conversation history.
 * @param {string} systemPrompt - The trip-aware system prompt
 * @param {Array<{role: 'user'|'model', text: string}>} history - Prior messages
 * @param {string} userMessage - The new user message
 * @returns {Promise<string>} The AI's reply text
 */
export async function sendMessage(systemPrompt, history, userMessage) {
  // Gemini uses 'contents' array for history; 'user' and 'model' roles
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: [{ text: userMessage }],
    },
  ]

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 512,
    },
  }

  // Call our Worker proxy — not Gemini directly
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('No response from Gemini')
  return text
}
