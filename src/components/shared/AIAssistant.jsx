import React, { useState, useRef, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { PanelRightClose, PanelRightOpen, Send, X } from 'lucide-react';
import { auth } from '../../firebase/config';
import { TripContext } from '../../context/TripContext';
import { buildTripSystemPrompt } from '../../hooks/useAI';
import { generateId } from '../../utils/helpers';
import { ACTIONS } from '../../state/tripReducer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { hapticSelection } from '../../utils/haptics';

let _systemPromptRef = buildTripSystemPrompt(null);

const chatTransport = new DefaultChatTransport({
  api: 'https://wanderplan-rust.vercel.app/api/chat',
  body: () => ({ systemPrompt: _systemPromptRef }),
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

const PILLS = [
  { emoji: '🗓️', label: 'Plan my day' },
  { emoji: '💸', label: 'Budget check' },
  { emoji: '💰', label: 'Budget tips' },
  { emoji: '📅', label: 'Optimize itinerary' },
  { emoji: '🏨', label: 'Hotel tips' },
  { emoji: '🍜', label: 'Food spots' },
  { emoji: '✈️', label: 'Packing list' },
  { emoji: '🚗', label: 'Getting around' },
  { emoji: '🏆', label: 'Pick Winners' },
];

const MAGIC_SPELLS = [
  'Abracadabra!', 'Alakazam!', 'Hocus Pocus!',
  'Expecto Patronum!', 'Alohomora!', 'Wingardium Leviosa!',
  'Bibbidi-Bobbidi-Boo!', 'Azarath Metrion Zinthos!'
];

const PILL_INSTRUCTION_MARKER = '\n\n[INSTRUCTION]:\n';

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

      const timer = setTimeout(() => {
        setDisplayed(content.slice(0, displayed.length + charsToAdd));
      }, 15);
      
      return () => clearTimeout(timer);
    }
  }, [content, displayed, isStreaming]);

  return <span>{displayed}</span>;
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
          const content = textParts.map(p => p.text).join('').trim() || m.content || '';
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
        setCurrentSpellIndex(prev => (prev + 1) % MAGIC_SPELLS.length);
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

  useEffect(() => {
    if (effectiveOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, effectiveOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (effectiveOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [effectiveOpen]);

  // ── Generic pill base ────────────────────────────────────────────────────────
  // Handles shared logic: done state, styling, addToolResult, toast + undo.
  // Tool-specific wrappers (PackingPill, VotingPill) map inv.input → these props.
  const ActionPill = ({ inv, toolName, emoji, label, onConfirm, onUndo, toastLabel }) => {
    const [localDone, setLocalDone] = useState(false)
    const done = localDone || inv.state === 'output-available'
    if (!label) return null

    const canAct = !!activeTrip && !done

    const handleClick = () => {
      if (!canAct) return
      const newId = generateId()
      onConfirm(newId)
      try { addToolResult({ tool: toolName, toolCallId: inv.toolCallId, output: 'added' }) } catch { }
      showToast(`${emoji || '🪄'} ${label} ${toastLabel}`, {
        undo: () => onUndo(newId),
      })
      setLocalDone(true)
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
        } ${canAct ? 'hover:bg-bg-hover' : 'opacity-50'}`}
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
        onConfirm={newId => dispatch({
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
          },
        })}
        onUndo={newId => dispatch({ type: ACTIONS.DELETE_IDEA, payload: newId })}
        toastLabel="added to voting room"
      />
    )
  }

  // ── Itinerary day plan pill ───────────────────────────────────────────────────
  const ItineraryPill = ({ inv }) => {
    const { dayNumber, location, activities = [] } = inv.input || {}
    const [localDone, setLocalDone] = useState(false)
    const done = localDone || inv.state === 'output-available'
    if (!activities.length) return null
    const canAct = !!activeTrip && !done
    const handleClick = () => {
      if (!canAct) return
      dispatch({ type: ACTIONS.BATCH_ADD_ACTIVITIES, payload: { dayNumber, location, activities } })
      try { addToolResult({ tool: 'generate_day_itinerary', toolCallId: inv.toolCallId, output: 'added' }) } catch { }
      showToast(`🗓️ Day ${dayNumber} plan added — ${activities.length} activities`)
      setLocalDone(true)
    }
    return (
      <button onClick={handleClick} disabled={!canAct} title={!activeTrip ? 'Select a trip first' : undefined}
        className={`mt-1 inline-flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-semibold transition-colors ${done ? 'text-success' : 'text-text-secondary hover:text-text-primary'} ${canAct ? 'hover:bg-bg-hover' : 'opacity-50'}`}>
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
        {messages.length === 0 && !error && (
          <div className="text-center py-5 px-3">
            <div className="text-2xl mb-2">🪄</div>
            <p className="text-text-secondary text-sm leading-relaxed m-0">
              {activeTrip
                ? <>Hi! I know all about your <strong>{activeTrip.name}</strong> trip — ask me anything!</>
                : <>Hi! I'm <span className="wanda-serif">Wanda</span>, your AI travel assistant. Select a trip and I'll know all about it!</>}
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
                className={`text-sm leading-relaxed max-w-[82%] whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-bg-secondary text-text-primary rounded-[var(--radius-md)] px-3 py-2'
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
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <div className="text-sm wanda-wiggle-slow">🪄</div>
            <div className="italic text-[11px] text-accent/80 animate-pulse font-medium">
              {MAGIC_SPELLS[currentSpellIndex]}
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
          {PILLS.map(({ emoji, label }) => (
            <button
              key={label}
              type="button"
              className="text-left text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-[var(--radius-sm)] px-2 py-1 transition-colors"
              onClick={() => handlePillClick(`${emoji} ${label}`)}
            >
              <span className="mr-2">{emoji}</span>
              {label}
            </button>
          ))}
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
          className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted px-1"
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
          <button
            onClick={() => {
              if (isMobile) {
                setIsOpen(o => !o)
              } else {
                dispatch({ type: ACTIONS.SET_AI_OPEN, payload: !desktopOpen })
              }
            }}
            aria-label="Open Wanda"
            className="h-14 w-14 rounded-full border border-accent bg-accent text-text-inverse flex items-center justify-center text-xl transition-colors hover:bg-accent-hover shadow-none"
          >
            <span className="wanda-wiggle">🪄</span>
          </button>
        </div>
      )}
    </>
  );
}
