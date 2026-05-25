/**
 * useAI.js
 * Gemini wrapper for Wanderplan.
 * Builds a trip-aware system prompt from the active trip's state,
 * so every response is grounded in the user's actual trip data.
 */
import { auth } from '../firebase/config'
import { getEffectiveStatus } from '../utils/tripStatus'
import { getDayLocationMap } from '../utils/tripGeo'

// All AI/API requests go to the Vercel deployment (absolute URL required — frontend is on Hostinger)
const VERCEL_API = 'https://wanderplan-rust.vercel.app'
const PROXY_URL = `${VERCEL_API}/api/gemini`

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'

/**
 * Build a trip-aware system prompt scoped to the user's active tab.
 * Only the context relevant to the current tab is injected, keeping
 * token usage proportional to what the user actually needs.
 */
export function buildTripSystemPrompt(trip, activeTab = 'overview') {
  if (!trip) {
    return `You are Wanda — a warm, witty travel companion built into Wanderplan, a trip planning app. You've mentally been everywhere, but you never brag. You give advice the way a well-traveled friend would: honest, practical, occasionally cheeky. You get excited about good food and hidden gems. You never sound like a brochure.
Help users plan trips, suggest activities, recommend restaurants, give packing advice, and optimize itineraries.
Be concise and practical. Use emojis sparingly. The user hasn't selected a trip yet, so give general travel advice.`
  }

  const today = new Date().toISOString().split('T')[0]
  const tripStatus = getEffectiveStatus(trip)
  const cities = trip.cities?.map(c => `${c.flag} ${c.city}, ${c.country}`).join(' → ') || 'Not specified'
  const travelers = trip.travelers || 1
  const startDate = trip.startDate || 'TBD'
  const endDate = trip.endDate || 'TBD'

  const currency = trip.currency || 'PHP'
  const currencySymbols = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', PHP: '₱', AUD: 'A$', CAD: 'C$', SGD: 'S$', HKD: 'HK$', THB: '฿', IDR: 'Rp', KRW: '₩', MYR: 'RM', VND: '₫', INR: '₹' }
  const sym = currencySymbols[currency] || currency

  const daysCount = trip.itinerary?.length || 0
  const totalBudget = trip.budget?.reduce((s, b) => s + (b.max || 0), 0) || 0
  const totalSpent = trip.budget?.reduce((s, b) => s + (b.actual || 0), 0) || 0

  const bookings = trip.bookings || []
  const confirmedBookings = bookings.filter(b => b.status === 'booked' || b.status === 'confirmed').length
  const pendingBookings = bookings.filter(b => b.status !== 'booked').length

  const todos = trip.todos || []
  const doneTodos = todos.filter(t => t.done).length

  const packingList = trip.packingList || []
  const packed = packingList.filter(p => p.packed).length

  // ── Tab-specific context (computed only for the active tab) ───────────────
  let tabContext = ''

  if (activeTab === 'budget') {
    const cats = trip.budget || []
    if (cats.length) {
      const sorted = [...cats].sort((a, b) => (b.actual || 0) - (a.actual || 0))
      const lines = sorted.map(b => `${b.emoji || ''} ${b.name}: ${sym}${b.max} budget, ${sym}${b.actual || 0} spent`)
      tabContext = `\n\n💰 BUDGET BREAKDOWN:\n${lines.join('\n')}`
    }
  } else if (activeTab === 'itinerary' || activeTab === 'cities') {
    const itinerary = trip.itinerary || []
    const itinerarySummary = (() => {
      if (!itinerary.length) return 'No itinerary yet'
      const todayStr = new Date().toISOString().split('T')[0]
      let pivot = itinerary.findIndex(d => d.date >= todayStr)
      if (pivot === -1) pivot = itinerary.length - 1
      const past = itinerary.slice(0, pivot)
      const focus = itinerary.slice(pivot, pivot + 3)
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
    const dayLocationTable = (() => {
      if (!itinerary.length) return 'No itinerary yet'
      const locationMap = getDayLocationMap(trip)
      return itinerary.map(d => {
        const entry = locationMap.get(d.id)
        if (!entry) return null
        const dateStr = d.date
          ? new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
          : ''
        const transitTag = entry.isTransit ? ' [transit]' : ''
        return `Day ${d.dayNumber}${dateStr ? ` (${dateStr})` : ''}: ${entry.label} ${entry.flag}${transitTag}`
      }).filter(Boolean).join('\n')
    })()
    tabContext = `\n\n📋 ITINERARY PREVIEW:\n${itinerarySummary}\n\n📍 DAY-BY-DAY LOCATIONS:\n${dayLocationTable}`
  } else if (activeTab === 'voting') {
    const votingIdeas = (trip.ideas || []).slice(0, 20)
    const votingContext = votingIdeas.length
      ? votingIdeas.map(i => `${i.emoji || ''} ${i.title} (${i.type}${i.priceDetails ? ', ' + i.priceDetails : ''})`).join(' | ')
      : 'No ideas yet'
    tabContext = `\n\n🗳️ VOTING ROOM (${votingIdeas.length} ideas):\n${votingContext}`
  } else if (activeTab === 'packing') {
    const sections = {}
    packingList.forEach(item => {
      const s = item.section || 'Misc'
      if (!sections[s]) sections[s] = { total: 0, packed: 0 }
      sections[s].total++
      if (item.packed) sections[s].packed++
    })
    const sectionLines = Object.entries(sections).map(([s, v]) => `${s}: ${v.packed}/${v.total}`)
    if (sectionLines.length) tabContext = `\n\n🧳 PACKING BY SECTION: ${sectionLines.join(', ')}`
  } else if (activeTab === 'todo') {
    const pending = todos.filter(t => !t.done).map(t => `• ${t.text}`).join('\n')
    tabContext = pending ? `\n\n✅ PENDING TODOS:\n${pending}` : '\n\n✅ TODOS: All complete!'
  } else {
    // overview / other: include a brief upcoming-days snapshot for location context
    const itinerary = trip.itinerary || []
    if (itinerary.length) {
      const todayStr = new Date().toISOString().split('T')[0]
      let pivot = itinerary.findIndex(d => d.date >= todayStr)
      if (pivot === -1) pivot = itinerary.length - 1
      const focus = itinerary.slice(pivot, pivot + 2)
      const lines = focus.map(d =>
        `Day ${d.dayNumber} (${d.location || 'TBD'}): ${d.activities?.map(a => a.name).slice(0, 3).join(', ') || 'no activities'}`
      )
      tabContext = `\n\n📋 UPCOMING DAYS:\n${lines.join('\n')}`
    }
  }

  const itineraryTabInstructions = (activeTab === 'itinerary' || activeTab === 'cities') ? `
- ALWAYS check the DAY-BY-DAY LOCATIONS table before suggesting activities — only suggest things in the city the user is actually in on that day.
- If the user asks about a place that doesn't match the day's expected location, flag it: "⚠️ Note: Day X is in [expected city], but [place] is in [other city] — did you mean a different day?"
- When calling generate_day_itinerary, use the location from the DAY-BY-DAY LOCATIONS table, not a guess.` : ''

  return `You are Wanda — a warm, witty travel companion built into Wanderplan. You've mentally been everywhere, but you never brag. You give advice the way a well-traveled friend would: honest, practical, occasionally cheeky. You get excited about good food and hidden gems. You never sound like a brochure.
You are helping plan this specific trip:

🌍 TRIP: "${trip.name || 'Unnamed Trip'}" ${trip.emoji || '✈️'}
📍 Route: ${cities}
📅 Dates: ${startDate} → ${endDate} (${daysCount} days planned)
📍 Status: ${tripStatus.toUpperCase()} as of ${today}
👥 Travelers: ${travelers}

💰 Budget: ${sym}${totalBudget} total, ${sym}${totalSpent} spent, ${sym}${totalBudget - totalSpent} remaining (${currency})
✈️ Bookings: ${confirmedBookings} confirmed, ${pendingBookings} pending
✅ Todos: ${doneTodos}/${todos.length} done
🧳 Packing: ${packed}/${packingList.length} packed
🔍 Active tab: ${activeTab}${tabContext}

Your role:
- ALWAYS answer the user's question directly and thoroughly in your text response.
- Your text reply is MANDATORY and must be your primary focus.
- Tool calls are OPTIONAL supporting additions. Never call a tool as a replacement for a textual answer.
- DO NOT audit the trip (budget, bookings, todos, packing) unless explicitly requested.
- Give specific, actionable advice tailored to THIS trip's cities, budget, and timeline.
- Be concise — 2-4 sentences per response unless the user asks for a detailed list.
- ALWAYS use ${currency} (${sym}) when discussing money — NEVER use any other currency symbol.
- Use emojis sparingly (1-2 per response max).
- ALWAYS write a full, helpful text reply alongside any tool calls.
- If the trip is ongoing, speak in present tense and do not describe it as "soon" or "upcoming".
- If live weather context is present, use it directly for weather questions.
- If no live weather context is available, give a best-effort seasonal estimate. Do not claim live weather access unless a weather tool is explicitly provided.${itineraryTabInstructions}

🔧 TOOL: generate_day_itinerary
Call ONLY after answering why this plan is good. Include 3–6 activities in chronological order with realistic times. Target the correct dayNumber and use the city from the DAY-BY-DAY LOCATIONS table if available.
Example for "Plan my Day 3 in Kyoto": { dayNumber: 3, location: "Kyoto, Japan", activities: [{ name: "Morning at Fushimi Inari", emoji: "⛩️", time: "08:00", endTime: "10:00", duration: 120, category: "sightseeing" }, ...] }

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
 * Exported as callAI for components that need JSON mode or custom opts.
 */
export async function callAI(messages, opts = {}) {
  return callProxy(messages, opts)
}

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
