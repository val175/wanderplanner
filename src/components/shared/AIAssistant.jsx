import React, { useState, useRef, useEffect, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { createPortal } from 'react-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { PanelRightClose, PanelRightOpen, Send, X } from 'lucide-react';
import { auth } from '../../firebase/config';
import { TripContext } from '../../context/TripContext';
import { buildTripSystemPrompt } from '../../hooks/useAI';
import { getEffectiveStatus } from '../../utils/tripStatus';
import { generateId } from '../../utils/helpers';
import { ACTIONS } from '../../state/tripReducer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { hapticSelection } from '../../utils/haptics';
import { buildTripCountryCodes } from '../../utils/tripGeo';
import { useLiveWeatherContext } from '../../hooks/useLiveWeatherContext';
import { wandaRuntime } from '../../utils/wandaRuntime';

let _systemPromptRef = buildTripSystemPrompt(null);

const chatTransport = new DefaultChatTransport({
  api: 'https://wanderplan-rust.vercel.app/api/chat',
  body: () => ({
    systemPrompt: _systemPromptRef,
    weatherContext: wandaRuntime.weatherContext,
    activeTab: wandaRuntime.activeTab,
    selectedMapPoint: wandaRuntime.selectedMapPoint,
    uiContext: wandaRuntime.uiContext,
  }),
  fetch: async (url, options) => {
    try {
      let token = '';
      if (auth.currentUser) {
        try { token = await auth.currentUser.getIdToken(); } catch (e) { console.warn("[Wanda] Token error:", e); }
      }
      const headers = new Headers(options.headers || {});
      headers.set('Content-Type', 'application/json');
      if (token) headers.set('Authorization', `Bearer ${token}`);

      const response = await fetch(url, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit', // Standard for cross-site API unless using cookies
      });

      if (!response.ok) {
        // Log details to help user debug on device
        console.error(`[Wanda] HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (err) {
      console.error("[Wanda] Fetch crash:", err);
      throw err;
    }
  }
});

// Pills shown during general planning phase
const PILLS_DEFAULT = [
  { emoji: '🗓️', label: 'Plan my day' },
  { emoji: '🍜', label: 'Food spots' },
  { emoji: '🏨', label: 'Hotel tips' },
  { emoji: '📅', label: 'Optimize itinerary' },
  { emoji: '✈️', label: 'Packing list' },
  { emoji: '💰', label: 'Budget tips' },
  { emoji: '🚗', label: 'Getting around' },
  { emoji: '🏆', label: 'Pick Winners' },
];

// Pills shown when trip is 1-7 days away
const PILLS_PRE_TRIP = [
  { emoji: '✈️', label: 'Packing list' },
  { emoji: '⚡', label: 'Last-minute checklist' },
  { emoji: '💱', label: 'Currency tips' },
  { emoji: '🚗', label: 'Getting around' },
  { emoji: '🏨', label: 'Hotel tips' },
  { emoji: '🍜', label: 'Food spots' },
  { emoji: '💸', label: 'Budget check' },
  { emoji: '🏆', label: 'Pick Winners' },
];

// Pills shown when trip is ongoing
const PILLS_ONGOING = [
  { emoji: '📍', label: "What's nearby?" },
  { emoji: '🌤', label: "Today's weather" },
  { emoji: '🍜', label: 'Food spots' },
  { emoji: '🚗', label: 'Getting around' },
  { emoji: '💸', label: 'Budget check' },
  { emoji: '✈️', label: 'Packing list' },
  { emoji: '🏆', label: 'Pick Winners' },
];

function getLocationSpells(cities) {
  const cityList = Array.isArray(cities) ? cities.filter(Boolean) : (cities ? [cities] : []);
  if (!cityList.length) return [
    'Abracadabra!', 'Alakazam!', 'Hocus Pocus!',
    'Expecto Patronum!', 'Alohomora!', 'Wingardium Leviosa!',
    'Bibbidi-Bobbidi-Boo!', 'Azarath Metrion Zinthos!',
  ];
  const templates = [
    c => `Exploring ${c}...`,
    c => `Scouting ${c}...`,
    c => `Consulting the spirits of ${c}...`,
    c => `Mapping ${c}...`,
    c => `Finding hidden gems in ${c}...`,
    c => `Reading the vibe of ${c}...`,
    c => `Channeling ${c} energy...`,
    c => `Unlocking ${c}...`,
  ];
  return cityList.flatMap(city => templates.map(fn => fn(city)));
}

const PILL_INSTRUCTION_MARKER = '\n\n[INSTRUCTION]:\n';

function cleanPlaceQuery(text) {
  const value = (text || '').toString().trim()
  if (!value) return ''
  return value
    .replace(/^(?:lunch|dinner|breakfast|sunset|sunrise|explore|visit|see|stay|go|head|arrive|tour|walk|discover)\s+at\s+/i, '')
    .replace(/^(?:explore|visit|see|stay at|go to|head to|arrive at|tour|walk(?: around)?|discover)\s+/i, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s+-\s+daytime selection$/i, '')
    .trim()
}

const SmoothStream = ({ content, isStreaming }) => {
  const [displayed, setDisplayed] = useState(isStreaming ? '' : content);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayed(content);
      return;
    }

    if (displayed.length < content.length) {
      const gap = content.length - displayed.length;
      const charsToAdd = gap > 40 ? 3 : 1;
      // Breathe slightly at sentence boundaries for natural cadence
      const isPause = displayed.length > 0 && /[.!?]$/.test(displayed.trimEnd()) && content[displayed.length] === ' ';
      const delay = isPause ? 75 : 15;

      const timer = setTimeout(() => {
        setDisplayed(content.slice(0, displayed.length + charsToAdd));
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [content, displayed, isStreaming]);

  return (
    <div className="wanda-markdown">
      <ReactMarkdown>{displayed}</ReactMarkdown>
    </div>
  );
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [currentSpellIndex, setCurrentSpellIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const prevStatusRef = useRef('ready');
  const prevTripIdRef = useRef(null);
  const sendMessageRef = useRef(null);

  const { state, activeTrip, dispatch, showToast } = useContext(TripContext);
  const tripCountryCodes = buildTripCountryCodes(activeTrip)
  const tripCityHint = activeTrip?.cities?.map(c => c?.city).filter(Boolean).join(', ') || ''
  const weatherContext = useLiveWeatherContext(activeTrip)

  // Trip state helpers for micro interactions
  const tripStatus = activeTrip ? getEffectiveStatus(activeTrip) : null
  const allCities = activeTrip?.cities?.map(c => c.city).filter(Boolean) || []
  const firstCity = allCities[0] || ''
  const firstCityFlag = activeTrip?.cities?.[0]?.flag || ''
  const daysUntilTrip = (() => {
    if (!activeTrip?.startDate) return null
    const diff = Math.ceil((new Date(activeTrip.startDate) - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  })()
  const totalActivities = activeTrip?.itinerary?.reduce((sum, d) => sum + (d.activities?.length || 0), 0) || 0
  const emptyItineraryDays = activeTrip?.itinerary?.filter(d => !d.activities?.length) || []
  const votingIdeasCount = activeTrip?.ideas?.length || 0
  const hasBudgetWarning = activeTrip?.budget?.some(b => b.max > 0 && (b.actual || 0) / b.max >= 0.8) || false
  const showBadge = hasBudgetWarning || (daysUntilTrip !== null && daysUntilTrip <= 2 && daysUntilTrip >= 0) || votingIdeasCount >= 5

  const [showContinuityHint, setShowContinuityHint] = useState(false)
  const lastAutoGreetedRef = useRef(null)

  useEffect(() => {
    wandaRuntime.weatherContext = weatherContext
  }, [weatherContext])

  const resolveWandaLocation = async (query, cityHint = '') => {
    const cleanedQuery = cleanPlaceQuery(query)
    if (!cleanedQuery || !auth.currentUser) return null

    try {
      const token = await auth.currentUser.getIdToken()
      const res = await fetch('https://wanderplan-rust.vercel.app/api/resolve-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          query: cleanedQuery,
          cityHint,
          countryCodes: tripCountryCodes,
        }),
      })

      if (!res.ok) return null
      const locationData = await res.json()
      if (!locationData?.coordinates?.lat || !locationData?.coordinates?.lng) return null

      const resultLabel = `${locationData?.placeName || ''} ${locationData?.address || ''}`.toLowerCase()
      const queryTokens = cleanedQuery.toLowerCase().split(/[\s,]+/).filter(Boolean)
      const strongMatches = queryTokens.filter(token => resultLabel.includes(token)).length
      if (queryTokens.length >= 2 && strongMatches < 2) return null

      return locationData
    } catch (error) {
      console.warn('[Wanda] Location grounding failed:', error?.message || error)
      return null
    }
  }

  useEffect(() => {
    _systemPromptRef = buildTripSystemPrompt(activeTrip);
  }, [activeTrip]);

  const { messages, sendMessage, status, error, addToolResult, setMessages } = useChat({
    transport: chatTransport,
  });
  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  // Load saved conversation when active trip changes
  useEffect(() => {
    if (prevTripIdRef.current === (activeTrip?.id ?? null)) return;
    prevTripIdRef.current = activeTrip?.id ?? null;
    const saved = activeTrip?.wandaConversation || [];
    setMessages(saved.length
      ? saved.map(m => ({ id: m.id, role: m.role, content: m.content, parts: [{ type: 'text', text: m.content }] }))
      : []
    );
  }, [activeTrip?.id]);

  // Save conversation to Firestore after each completed AI response
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === 'streaming' && status === 'ready' && activeTrip && messages.length > 0) {
      const simplified = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => {
          const textParts = m.parts?.filter(p => p.type === 'text') ?? [];
          let content = textParts.map(p => p.text).join('').trim() || m.content || '';
          // For tool-only assistant messages (e.g. generate_day_itinerary with no text),
          // build a readable placeholder so history isn't a blank assistant turn that
          // causes the model to re-fire the tool on the next message.
          if (!content && m.role === 'assistant' && m.parts?.length) {
            const toolParts = m.parts.filter(p => p.type?.startsWith('tool-'));
            if (toolParts.length) {
              const summaries = toolParts.map(p => {
                if (p.type === 'tool-generate_day_itinerary') {
                  const acts = p.input?.activities?.length || 0;
                  return `I've prepared a Day ${p.input?.dayNumber ?? '?'} itinerary plan with ${acts} activities for ${p.input?.location ?? 'the destination'}.`;
                }
                if (p.type === 'tool-add_idea_to_voting_room') return `I've suggested "${p.input?.title}" for the voting room.`;
                if (p.type === 'tool-add_to_packing_list') return `I've added "${p.input?.item}" to your packing list.`;
                if (p.type === 'tool-add_budget_alert') return `I've flagged a budget alert: ${p.input?.title}.`;
                return null;
              }).filter(Boolean);
              content = summaries.join(' ') || 'I used a tool to assist with your request.';
            }
          }
          return { id: m.id, role: m.role, content };
        })
        .slice(-50);
      dispatch({ type: ACTIONS.UPDATE_WANDA_CONVERSATION, payload: simplified });
    }
  }, [status]);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    let interval;
    if (isLoading) {
      interval = setInterval(() => {
        setCurrentSpellIndex(prev => (prev + 1) % getLocationSpells(allCities).length);
      }, 800);
    } else {
      setCurrentSpellIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-wanda-mobile', handleToggle);
    return () => window.removeEventListener('toggle-wanda-mobile', handleToggle);
  }, []);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-wanda', handleOpen);
    return () => window.removeEventListener('open-wanda', handleOpen);
  }, []);

  useEffect(() => {
    const handlePrefill = (e) => {
      // Open on mobile + desktop floating
      setIsOpen(true);
      dispatch({ type: ACTIONS.SET_AI_OPEN, payload: true });
      if (e.detail?.text) sendMessageRef.current?.({ text: e.detail.text });
    };
    window.addEventListener('wanda-prefill', handlePrefill);
    return () => window.removeEventListener('wanda-prefill', handlePrefill);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handlePillClick = (label) => {
    if (isLoading) return;
    
    // Explicit instructions for the AI to use its tools when a pill is clicked.
    // The PILL_INSTRUCTION_MARKER is used to hide this from the user in the UI.
    let instruction = '';
    if (label.includes('Plan my day')) {
      instruction = `Look at our itinerary and find the next day that has few or no activities. Call the "generate_day_itinerary" tool to plan it with 4-5 time-slotted activities appropriate for our destination and budget.`;
    } else if (label.includes('Budget check')) {
      instruction = `Analyze our budget in detail — check each category against its limit and look at our spending pace. For EACH issue you find (overruns, risks, or tips), call the "add_budget_alert" tool (up to 3 calls). Include specific numbers in your text response too.`;
    } else if (label.toLowerCase().includes('food spots near')) {
      instruction = `Look at the activities from the day itinerary you just created. Recommend 3 specific food spots that are near those activity locations. IMPORTANT: For EACH food spot, you MUST call the "add_idea_to_voting_room" tool. Do not just list them in text.`;
    } else if (label.includes('Food spots')) {
      instruction = `Please recommend 3 specific food spots in our destination. IMPORTANT: For EACH spot, you MUST call the "add_idea_to_voting_room" tool. Do not just list them in text.`;
    } else if (label.includes('Hotel tips')) {
      instruction = `Please recommend 3 specific hotels/lodging options. IMPORTANT: For EACH option, you MUST call the "add_idea_to_voting_room" tool. Do not just list them in text.`;
    } else if (label.includes('Packing list')) {
      instruction = `Please recommend 3 specific packing items based on our destination/dates. IMPORTANT: For EACH item, you MUST call the "add_to_packing_list" tool. Do not just list them in text.`;
    } else if (label.includes('Budget tips')) {
      instruction = `Please analyze our budget and give 3 specific tips on where to save or where to spend. Use the "add_idea_to_voting_room" tool if you recommend specific cheaper alternatives/spots.`;
    } else if (label.includes('Optimize itinerary')) {
      instruction = `Please look at our itinerary and suggest 3 improvements or additions. For any specific new place or activity, you MUST call the "add_idea_to_voting_room" tool.`;
    } else if (label.includes('Getting around')) {
      instruction = `Give me 3 specific transport tips for this destination (e.g. local apps, rail passes). If there's a specific service to book, use the "add_idea_to_voting_room" tool.`;
    } else if (label.includes('Pick Winners')) {
      instruction = `Look at the VOTING ROOM ideas in the system context. Call "recommend_from_voting_room" ONCE with the best 2-4 picks (one per category: lodging, activity, food, etc). Also write a conversational summary of your reasoning.`;
    } else if (label.includes("What's nearby?")) {
      instruction = `Recommend 3-4 specific spots or activities that are worth visiting right now given we're actively traveling. For each specific named place, call "add_idea_to_voting_room".`;
    } else if (label.includes("Today's weather")) {
      instruction = `Tell me about today's weather at our current destination and how it should affect our plans. Give specific advice on activities to do or avoid given the conditions.`;
    } else if (label.includes('Currency tips')) {
      instruction = `Give me 3 specific currency and money tips for this destination — best exchange methods, local payment apps, ATM advice, and what to watch out for.`;
    } else if (label.includes('Last-minute checklist')) {
      instruction = `Give me a concise last-minute checklist — what to confirm, book, or prepare in the final days before the trip. For any destination-specific packing items, call "add_to_packing_list".`;
    }
    
    const text = instruction ? `${label}${PILL_INSTRUCTION_MARKER}${instruction}` : label;
    sendMessage({ text });
    setInput('');
  };

  const showPills = messages.length === 0 && !isLoading;

  const isMobile = useMediaQuery('(max-width: 767px)');
  const viewMode = state?.aiViewMode || 'floating';
  const isSidebarMode = !isMobile && viewMode === 'sidebar';
  const desktopOpen = !!state?.aiOpen;
  const effectiveOpen = isMobile ? isOpen : (isSidebarMode ? true : desktopOpen);

  // Trip-phase pill evolution: select the right pill set based on where user is in journey
  const contextualPills = (() => {
    if (!activeTrip) return PILLS_DEFAULT
    if (tripStatus === 'ongoing') return PILLS_ONGOING
    if (daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 7) return PILLS_PRE_TRIP
    return PILLS_DEFAULT
  })()

  // Pulse the wand trigger for planning trips with no itinerary and <14 days to go
  const shouldPulseButton = !effectiveOpen
    && tripStatus === 'planning'
    && totalActivities === 0
    && daysUntilTrip !== null
    && daysUntilTrip <= 14
    && daysUntilTrip >= 0

  useEffect(() => {
    if (effectiveOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, effectiveOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (effectiveOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [effectiveOpen]);

  // Continuity hint — show "Continuing from last chat" when reopening a trip with history
  useEffect(() => {
    if (effectiveOpen && (activeTrip?.wandaConversation?.length || 0) > 0) {
      setShowContinuityHint(true)
      const timer = setTimeout(() => setShowContinuityHint(false), 2500)
      return () => clearTimeout(timer)
    }
    setShowContinuityHint(false)
  }, [effectiveOpen, activeTrip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-greeting for ONGOING trips when Wanda is opened with no conversation
  useEffect(() => {
    if (!effectiveOpen) return
    if (tripStatus !== 'ongoing') return
    if ((activeTrip?.wandaConversation?.length || 0) > 0) return

    const greetKey = `${activeTrip?.id}-${new Date().toDateString()}`
    if (lastAutoGreetedRef.current === greetKey) return
    lastAutoGreetedRef.current = greetKey

    const city = firstCity || 'your destination'
    const flag = firstCityFlag ? ` ${firstCityFlag}` : ''
    const todayStr = new Date().toISOString().split('T')[0]
    const todaysPlan = activeTrip?.itinerary?.find(d => d.date === todayStr)
    const actCount = todaysPlan?.activities?.length || 0
    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

    let greetText = `Good ${timeOfDay}! You're in ${city}${flag}`
    if (weatherContext) {
      const weatherPart = weatherContext.split(': ').slice(1).join(': ')
      if (weatherPart) greetText += ` — ${weatherPart}`
    }
    greetText += actCount > 0
      ? ` You have ${actCount} activit${actCount === 1 ? 'y' : 'ies'} planned today.`
      : ` Nothing scheduled yet today.`
    greetText += ` Need anything?`

    setMessages([{
      id: generateId(),
      role: 'assistant',
      content: greetText,
      parts: [{ type: 'text', text: greetText }],
    }])
  }, [effectiveOpen, activeTrip?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generic pill base ────────────────────────────────────────────────────────
  // Handles shared logic: done state, styling, addToolResult, toast + undo.
  // Tool-specific wrappers (PackingPill, VotingPill) map inv.input → these props.
  const ActionPill = ({ inv, toolName, emoji, label, onConfirm, onUndo, toastLabel }) => {
    const [localDone, setLocalDone] = useState(false)
    const [isWorking, setIsWorking] = useState(false)
    const [isPopping, setIsPopping] = useState(false)
    const done = localDone || inv.state === 'output-available'
    if (!label) return null

    const canAct = !!activeTrip && !done && !isWorking

    const handleClick = async () => {
      if (!canAct) return
      const newId = generateId()
      setIsWorking(true)
      try {
        await onConfirm(newId)
        try { addToolResult({ tool: toolName, toolCallId: inv.toolCallId, output: 'added' }) } catch { }
        showToast(`${emoji || '🪄'} ${label} ${toastLabel}`)
        setIsPopping(true)
        setTimeout(() => setIsPopping(false), 350)
        setLocalDone(true)
      } catch (error) {
        console.warn('[Wanda] Failed to add grounded tool output:', error)
        showToast(`Couldn't add ${label} right now`, 'error')
      } finally {
        setIsWorking(false)
      }
    }

    return (
      <button
        onClick={handleClick}
        disabled={!canAct}
        title={!activeTrip ? 'Select a trip first' : undefined}
        className={`mt-1 inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold transition-colors ${
          done
            ? 'text-success'
            : 'text-text-secondary hover:text-text-primary'
        } ${canAct ? 'hover:bg-bg-hover' : 'opacity-50'} ${isPopping ? 'wanda-pill-pop' : ''}`}
      >
        <span className="text-sm">{done ? '✅' : (emoji || '🪄')}</span>
        <span>{done ? 'Added' : `Add ${label}`}</span>
        {!done && <span className="text-[11px] opacity-60">+</span>}
      </button>
    )
  }

  // ── Packing list pill ────────────────────────────────────────────────────────
  const PackingPill = ({ inv }) => {
    const { item, section, emoji } = inv.input || {}
    return (
      <ActionPill
        inv={inv}
        toolName="add_to_packing_list"
        emoji={emoji || '🧳'}
        label={item}
        onConfirm={newId => dispatch({
          type: ACTIONS.ADD_PACKING_ITEM,
          payload: { id: newId, name: item, section: section || 'Misc' },
        })}
        onUndo={newId => dispatch({ type: ACTIONS.DELETE_PACKING_ITEM, payload: newId })}
        toastLabel="added to packing"
      />
    )
  }

  // ── Voting room pill ─────────────────────────────────────────────────────────
  const VotingPill = ({ inv }) => {
    const { title, type, description, emoji, priceDetails } = inv.input || {}
    return (
      <ActionPill
        inv={inv}
        toolName="add_idea_to_voting_room"
        emoji={emoji || '💡'}
        label={title}
        onConfirm={async newId => {
          const location = await resolveWandaLocation(title, tripCityHint)
          dispatch({
            type: ACTIONS.ADD_IDEA,
            payload: {
              id: newId,
              title,
              type: type || 'other',
              description: description || '',
              emoji: emoji || '🪄',
              priceDetails: priceDetails || 'TBD',
              sourceName: 'Wanda AI',
              proposerId: auth.currentUser?.uid || null,
              url: null,
              imageUrl: null,
              location: location || null,
            },
          })
        }}
        onUndo={newId => dispatch({ type: ACTIONS.DELETE_IDEA, payload: newId })}
        toastLabel="added to voting room"
      />
    )
  }

  // ── Itinerary day plan pill ───────────────────────────────────────────────────
  const ItineraryPill = ({ inv }) => {
    const { dayNumber, location, activities = [] } = inv.input || {}
    const [localDone, setLocalDone] = useState(false)
    const [isPopping, setIsPopping] = useState(false)
    const done = localDone || inv.state === 'output-available'
    if (!activities.length) return null
    const canAct = !!activeTrip && !done
    const activityPreview = activities.map(a => `${a.emoji || '•'} ${a.name}`).join('\n')
    const hoverTitle = !activeTrip
      ? 'Select a trip first'
      : done
        ? undefined
        : activityPreview
    const handleClick = async () => {
      if (!canAct) return
      const groundedActivities = await Promise.all(activities.map(async (activity) => {
        const groundedLocation = await resolveWandaLocation(activity.name, location || tripCityHint)
        return {
          ...activity,
          location: groundedLocation || activity.location || '',
        }
      }))

      dispatch({ type: ACTIONS.BATCH_ADD_ACTIVITIES, payload: { dayNumber, location, activities: groundedActivities } })
      try { addToolResult({ tool: 'generate_day_itinerary', toolCallId: inv.toolCallId, output: 'added' }) } catch { }
      showToast(`🗓️ Day ${dayNumber} plan added — ${activities.length} activities`)
      setIsPopping(true)
      setTimeout(() => setIsPopping(false), 350)
      setLocalDone(true)
    }
    return (
      <button onClick={handleClick} disabled={!canAct} title={hoverTitle}
        className={`mt-1 inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold transition-colors ${done ? 'text-success' : 'text-text-secondary hover:text-text-primary'} ${canAct ? 'hover:bg-bg-hover' : 'opacity-50'} ${isPopping ? 'wanda-pill-pop' : ''}`}>
        <span className="text-sm">{done ? '✅' : '🗓️'}</span>
        <span>{done ? 'Added to itinerary' : `Add Day ${dayNumber} plan (${activities.length} activities)`}</span>
        {!done && <span className="text-[11px] opacity-60">+</span>}
      </button>
    )
  }

  // ── Budget alert pill ─────────────────────────────────────────────────────────
  const BudgetAlertPill = ({ inv }) => {
    const { title, message, severity, emoji } = inv.input || {}
    return (
      <ActionPill
        inv={inv}
        toolName="add_budget_alert"
        emoji={emoji || '💸'}
        label={title}
        onConfirm={() => dispatch({ type: ACTIONS.ADD_WANDA_ALERT, payload: { title, message, severity: severity || 'warning', emoji: emoji || '💸' } })}
        onUndo={() => {}}
        toastLabel="alert saved to Overview"
      />
    )
  }

  const [sidebarSlot, setSidebarSlot] = useState(null);

  useEffect(() => {
    if (!isMobile && isSidebarMode) {
      setSidebarSlot(document.getElementById('wanda-sidebar-slot'));
    } else {
      setSidebarSlot(null);
    }
  }, [isMobile, isSidebarMode]);

  const panel = effectiveOpen ? (
    <div
      className={`${isMobile
        ? 'fixed inset-0 z-[100] rounded-none'
        : isSidebarMode
          ? 'relative h-full w-full rounded-none'
          : 'fixed bottom-[80px] right-[24px] w-[360px] max-h-[520px] rounded-[var(--radius-xl)] border border-border'
        } bg-bg-card shadow-none font-heading text-text-primary flex flex-col overflow-hidden`}
      style={{ zIndex: 100, animation: isSidebarMode ? undefined : 'wanda-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
    >
      <style>{`
        @keyframes wanda-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        .wanda-msg-scroll::-webkit-scrollbar { width: 4px; }
        .wanda-msg-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
        @keyframes wanda-msg-fade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-msg-fade {
          animation: wanda-msg-fade 0.25s ease-out forwards;
        }
        .wanda-markdown p { margin-bottom: 0.75rem; }
        .wanda-markdown p:last-child { margin-bottom: 0; }
        .wanda-markdown ul, .wanda-markdown ol { margin-bottom: 0.75rem; padding-left: 1.25rem; }
        .wanda-markdown li { margin-bottom: 0.25rem; }
        .wanda-markdown strong { font-weight: 700; color: var(--color-accent, inherit); }
        @keyframes wanda-pill-pop {
          0% { transform: scale(1); }
          35% { transform: scale(1.18); }
          65% { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        .wanda-pill-pop { animation: wanda-pill-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes wanda-continuity-fade {
          0% { opacity: 0; transform: translateY(-4px); }
          20% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        .wanda-continuity { animation: wanda-continuity-fade 2.5s ease-in-out forwards; }
        @keyframes wanda-trigger-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(var(--color-accent-rgb, 99 102 241) / 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(var(--color-accent-rgb, 99 102 241) / 0); }
        }
        .wanda-trigger-pulse { animation: wanda-trigger-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-bg-secondary">
            🪄
          </div>
          <div>
            <div className="wanda-serif text-sm text-text-primary tracking-[-0.01em]">
              Wanda
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <button
              onClick={() => {
                hapticSelection()
                const nextMode = viewMode === 'sidebar' ? 'floating' : 'sidebar'
                dispatch({
                  type: ACTIONS.SET_AI_VIEW_MODE,
                  payload: nextMode,
                })
                dispatch({
                  type: ACTIONS.SET_AI_OPEN,
                  payload: true,
                })
              }}
              className="w-7 h-7 rounded-[var(--radius-sm)] border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors flex items-center justify-center"
              aria-label={viewMode === 'sidebar' ? 'Switch to floating mode' : 'Switch to sidebar mode'}
              title={viewMode === 'sidebar' ? 'Floating mode' : 'Sidebar mode'}
            >
              {viewMode === 'sidebar' ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          )}
          {!isSidebarMode && (
            <button
              onClick={() => {
                if (isMobile) {
                  setIsOpen(false)
                } else {
                  dispatch({ type: ACTIONS.SET_AI_OPEN, payload: false })
                }
              }}
              className="w-7 h-7 rounded-[var(--radius-sm)] border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover flex items-center justify-center transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="wanda-msg-scroll"
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {/* Continuity hint — fades in/out when reopening a trip with chat history */}
        {showContinuityHint && (
          <div className="wanda-continuity text-center text-[11px] text-text-muted py-1 flex-shrink-0">
            ↩ Continuing from your last chat...
          </div>
        )}

        {messages.length === 0 && !error && (
          <div className="text-center py-5 px-3">
            <div className="text-2xl mb-2">🪄</div>
            <p className="text-text-secondary text-sm leading-relaxed m-0">
              {!activeTrip ? (
                <>Hi! I'm <span className="wanda-serif">Wanda</span>, your AI travel assistant. Select a trip and I'll know all about it!</>
              ) : tripStatus === 'ongoing' ? (
                <>You're in <strong>{firstCity || activeTrip.name}</strong> {firstCityFlag} right now — need recommendations?</>
              ) : tripStatus === 'completed' ? (
                <>What a trip! Ask me anything, or let's start planning the next one.</>
              ) : daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 3 ? (
                <><strong>{activeTrip.name}</strong> {activeTrip.emoji || '✈️'} starts in {daysUntilTrip === 0 ? 'today!' : `${daysUntilTrip} day${daysUntilTrip === 1 ? '' : 's'}!`} Last-minute questions? I'm here.</>
              ) : daysUntilTrip !== null && daysUntilTrip >= 0 && daysUntilTrip <= 7 ? (
                <><strong>{firstCity || activeTrip.name}</strong> {firstCityFlag} in {daysUntilTrip} days — things are getting close! What do you need?</>
              ) : daysUntilTrip !== null && daysUntilTrip > 7 ? (
                <>{firstCityFlag || '✈️'} <strong>{firstCity || activeTrip.name}</strong> in {daysUntilTrip} days.{totalActivities === 0 ? ' Your itinerary is empty — want me to start building it?' : emptyItineraryDays.length > 0 ? ` Day${emptyItineraryDays.length > 1 ? 's' : ''} ${emptyItineraryDays.slice(0, 3).map(d => d.dayNumber).join(', ')} ${emptyItineraryDays.length > 1 ? 'have' : 'has'} no activities yet.` : ' Ask me anything!'}</>
              ) : (
                <>Hi! I know all about your <strong>{activeTrip.name}</strong> trip — ask me anything!</>
              )}
            </p>
          </div>
        )}

        {error && (
          <p className="text-danger text-xs text-center px-3 py-2 bg-danger/10 rounded-[var(--radius-sm)]">
            ⚠️ {error.message || 'Something went wrong. Please try again.'}
          </p>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={`flex flex-col animate-msg-fade ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="mr-2 mt-0.5 text-sm">🪄</div>
              )}
              <div
                className={`text-sm leading-relaxed max-w-[82%] ${
                  m.role === 'user'
                    ? 'bg-bg-secondary text-text-primary rounded-[var(--radius-md)] px-3 py-2 whitespace-pre-wrap'
                    : 'text-text-primary'
                }`}
              >
                {(() => {
                  const textParts = m.parts?.filter(p => p.type === 'text') ?? []
                  let textContent = textParts.map(p => p.text).join('').trim()

                  // Hide system instructions from the UI for pill clicks
                  if (m.role === 'user' && textContent.includes(PILL_INSTRUCTION_MARKER)) {
                    textContent = textContent.split(PILL_INSTRUCTION_MARKER)[0];
                  } else if (m.role === 'user' && textContent.includes('\\nMenu Instruction:')) {
                    textContent = textContent.split('\\n')[0];
                  } else if (m.role === 'user' && textContent.includes('\nPlease recommend')) {
                    textContent = textContent.split('\n')[0];
                  } else if (m.role === 'user' && textContent.includes('\nIMPORTANT:')) {
                    textContent = textContent.split('\n')[0];
                  }

                  if (m.parts && textContent) {
                    const isLastMessage = m.id === messages[messages.length - 1].id;
                    const isCurrentlyStreaming = status === 'streaming' && isLastMessage && m.role === 'assistant';
                    
                    return <SmoothStream content={textContent} isStreaming={isCurrentlyStreaming} />;
                  }
                  
                  if (m.parts && !textContent) {
                    // Gemini sometimes omits text when calling tools — build context from tool inputs
                    const votingParts = m.parts.filter(p => p.type === 'tool-add_idea_to_voting_room' && p.input?.title)
                    const packingParts = m.parts.filter(p => p.type === 'tool-add_to_packing_list' && p.input?.item)
                    if (votingParts.length) {
                      const names = votingParts.map(p => `${p.input.emoji || '📍'} ${p.input.title}`).join(', ')
                      return <span>Here are some recommendations: {names}. Tap a pill below to add to your voting room!</span>
                    }
                    if (packingParts.length) {
                      const names = packingParts.map(p => `${p.input.emoji || '🧳'} ${p.input.item}`).join(', ')
                      return <span>Here are some packing suggestions: {names}. Tap to add!</span>
                    }
                  }

                  // For older messages or fallbacks
                  let fallbackContent = m.content || ''
                  if (m.role === 'user' && fallbackContent.includes(PILL_INSTRUCTION_MARKER)) {
                    fallbackContent = fallbackContent.split(PILL_INSTRUCTION_MARKER)[0];
                  }
                  return fallbackContent
                })()}
              </div>
            </div>

            {/* Action pills — all four tools */}
            {m.role === 'assistant' && m.parts
              ?.filter(p =>
                ['tool-add_to_packing_list', 'tool-add_idea_to_voting_room', 'tool-generate_day_itinerary', 'tool-add_budget_alert'].includes(p.type)
                && p.state !== 'input-streaming'
              )
              .map(p => {
                if (p.type === 'tool-add_to_packing_list') return <PackingPill key={p.toolCallId} inv={p} />
                if (p.type === 'tool-add_idea_to_voting_room') return <VotingPill key={p.toolCallId} inv={p} />
                if (p.type === 'tool-generate_day_itinerary') return <ItineraryPill key={p.toolCallId} inv={p} />
                return <BudgetAlertPill key={p.toolCallId} inv={p} />
              })
            }

            {/* Smart follow-up pill — appears once after tool calls; hidden if already acted on */}
            {m.role === 'assistant'
              && m.id === messages[messages.length - 1]?.id
              && !isLoading
              && (() => {
                const toolTypes = (m.parts || [])
                  .filter(p => ['tool-generate_day_itinerary', 'tool-add_to_packing_list', 'tool-add_budget_alert'].includes(p.type))
                  .map(p => p.type)
                if (!toolTypes.length) return null
                let followUp = null
                if (toolTypes.includes('tool-generate_day_itinerary')) followUp = { emoji: '🍜', text: 'Find food spots near these locations?' }
                else if (toolTypes.includes('tool-add_to_packing_list')) followUp = { emoji: '✏️', text: 'Anything else to add?' }
                else if (toolTypes.includes('tool-add_budget_alert')) followUp = { emoji: '💡', text: 'Get cost-saving tips?' }
                if (!followUp) return null
                // Don't show if the user's previous message was already this follow-up (prevents loop)
                const prevUserMsg = messages.slice().reverse().find(msg => msg.role === 'user')
                const prevText = prevUserMsg?.parts?.find(p => p.type === 'text')?.text || prevUserMsg?.content || ''
                if (prevText.includes(followUp.text)) return null
                return (
                  <button
                    key="followup"
                    onClick={() => handlePillClick(`${followUp.emoji} ${followUp.text}`)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors border border-border/50"
                  >
                    <span>{followUp.emoji}</span>
                    <span>{followUp.text}</span>
                  </button>
                )
              })()
            }
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="text-sm wanda-wiggle-slow">🪄</div>
            <div className="italic text-[11px] text-accent/80 animate-pulse font-medium">
              {getLocationSpells(allCities)[currentSpellIndex % getLocationSpells(allCities).length]}
            </div>
            <style>{`
              @keyframes wanda-wiggle-fast {
                0% { transform: rotate(0deg); }
                25% { transform: rotate(15deg); }
                50% { transform: rotate(-12deg); }
                75% { transform: rotate(8deg); }
                100% { transform: rotate(0deg); }
              }
              .wanda-wiggle-slow {
                display: inline-block;
                transform-origin: 70% 80%;
                animation: wanda-wiggle-fast 0.6s ease-in-out infinite;
              }
            `}</style>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating pills — only shown when conversation is empty */}
      {showPills && (
        <div className="px-4 pb-3 flex-shrink-0 flex flex-col gap-1">
          {/* Voting room backlog CTA */}
          {votingIdeasCount >= 5 && (
            <button
              type="button"
              className="text-left text-xs text-accent hover:text-accent-hover rounded-[var(--radius-sm)] px-2 py-1 transition-colors bg-accent/5 border border-accent/20 mb-0.5"
              onClick={() => handlePillClick('🏆 Pick Winners')}
            >
              <span className="mr-2">🏆</span>
              Voting room: {votingIdeasCount} ideas — want me to pick the best?
            </button>
          )}
          {contextualPills.map(({ emoji, label }) => {
            const isBudgetPill = label.toLowerCase().includes('budget')
            const budgetTint = isBudgetPill && hasBudgetWarning
            return (
              <button
                key={label}
                type="button"
                className={`text-left text-xs rounded-[var(--radius-sm)] px-2 py-1 transition-colors ${
                  budgetTint
                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
                onClick={() => handlePillClick(`${emoji} ${label}`)}
              >
                <span className="mr-2">{emoji}</span>
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className={`flex gap-2 ${isMobile ? 'px-3 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))]' : 'px-3 py-2'} border-t border-border focus-within:border-accent bg-bg-card flex-shrink-0`}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Wanda..."
          className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-text-muted px-1 text-text-primary"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="h-9 w-9 rounded-[var(--radius-sm)] border border-border bg-bg-secondary text-text-primary flex items-center justify-center hover:bg-bg-hover disabled:opacity-50 transition-colors"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  ) : null

  return (
    <>
      {/* Chat panel */}
      {isSidebarMode ? (sidebarSlot ? createPortal(panel, sidebarSlot) : null) : panel}

      {/* Floating trigger button - Hidden on mobile as it's in BottomNav */}
      {!isMobile && !isSidebarMode && (
        <div className="fixed bottom-[24px] right-[24px] z-50 group">
          <style>{`
            @keyframes wand-wiggle {
              0% { transform: rotate(0deg); }
              25% { transform: rotate(10deg); }
              50% { transform: rotate(-8deg); }
              75% { transform: rotate(6deg); }
              100% { transform: rotate(0deg); }
            }
            .wanda-wiggle {
              display: inline-block;
              transform-origin: 70% 80%;
            }
            .group:hover .wanda-wiggle {
              animation: wand-wiggle 700ms ease-in-out;
            }
          `}</style>
          <div className="pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 scale-95 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:scale-100">
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-bg-card px-5 py-2 text-sm text-text-primary shadow-none whitespace-nowrap">
              Chat with <span className="wanda-serif">Wanda</span>
            </div>
          </div>
          {/* Proactive badge — shows when budget warning, trip imminent, or voting room backlog */}
          {showBadge && (
            <div className="pointer-events-none absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent border-2 border-bg-primary z-10" />
          )}
          <button
            onClick={() => {
              if (isMobile) {
                setIsOpen(o => !o)
              } else {
                dispatch({ type: ACTIONS.SET_AI_OPEN, payload: !desktopOpen })
              }
            }}
            aria-label="Open Wanda"
            className={`h-14 w-14 rounded-full border border-accent bg-accent text-text-inverse flex items-center justify-center text-xl transition-colors hover:bg-accent-hover shadow-none ${shouldPulseButton ? 'wanda-trigger-pulse' : ''}`}
          >
            <span className="wanda-wiggle">🪄</span>
          </button>
        </div>
      )}
    </>
  );
}
