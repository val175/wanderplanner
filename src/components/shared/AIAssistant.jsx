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
  { emoji: '💰', label: 'Budget tips' },
  { emoji: '📅', label: 'Optimize itinerary' },
  { emoji: '🏨', label: 'Hotel tips' },
  { emoji: '🍜', label: 'Food spots' },
  { emoji: '✈️', label: 'Packing list' },
  { emoji: '🚗', label: 'Getting around' },
];

const MAGIC_SPELLS = [
  'Abracadabra!', 'Alakazam!', 'Hocus Pocus!',
  'Expecto Patronum!', 'Alohomora!', 'Wingardium Leviosa!',
  'Bibbidi-Bobbidi-Boo!', 'Azarath Metrion Zinthos!'
];

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [currentSpellIndex, setCurrentSpellIndex] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const { state, activeTrip, dispatch, showToast } = useContext(TripContext);

  useEffect(() => {
    _systemPromptRef = buildTripSystemPrompt(activeTrip);
  }, [activeTrip]);

  const { messages, sendMessage, status, error, addToolResult } = useChat({
    transport: chatTransport,
  });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handlePillClick = (label) => {
    if (isLoading) return;
    
    // Convert generic pill clicks into explicit, tool-forcing prompts for the AI,
    // but the displayed text in the chat bubble remains just the label.
    let systemInstruction = label;
    if (label.includes('Food spots')) {
      systemInstruction = `${label}\nPlease recommend 3 specific food spots in our destination. IMPORTANT: For EACH spot, you MUST call the "add_idea_to_voting_room" tool. Do not just list them in text.`;
    } else if (label.includes('Hotel tips')) {
      systemInstruction = `${label}\nPlease recommend 3 specific hotels/lodging options. IMPORTANT: For EACH option, you MUST call the "add_idea_to_voting_room" tool. Do not just list them in text.`;
    } else if (label.includes('Packing list')) {
      systemInstruction = `${label}\nPlease recommend 3 specific packing items based on our destination/dates. IMPORTANT: For EACH item, you MUST call the "add_to_packing_list" tool. Do not just list them in text.`;
    }
    
    // Send the detailed prompt to the API, but keep the UI clean
    sendMessage({ text: systemInstruction });
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
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-base bg-bg-secondary">
            🪄
          </div>
          <div>
            <div className="font-semibold text-sm text-text-primary tracking-[-0.01em]">
              Wanda
            </div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {activeTrip ? `Knows your ${activeTrip.name} trip` : 'AI travel assistant'}
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
                : "Hi! I'm Wanda, your AI travel assistant. Select a trip and I'll know all about it!"}
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
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
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
                  if (m.role === 'user' && textContent.includes('\\nMenu Instruction:')) {
                    textContent = textContent.split('\\n')[0];
                  } else if (m.role === 'user' && textContent.includes('\nPlease recommend')) {
                    textContent = textContent.split('\n')[0];
                  } else if (m.role === 'user' && textContent.includes('\nIMPORTANT:')) {
                    textContent = textContent.split('\n')[0];
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
                  return m.parts ? textParts.map((p, i) => <span key={i}>{p.text}</span>) : m.content
                })()}
              </div>
            </div>

            {/* Action pills — both tools handled; type is 'tool-{name}' in ai@6 */}
            {m.role === 'assistant' && m.parts
              ?.filter(p =>
                (p.type === 'tool-add_to_packing_list' || p.type === 'tool-add_idea_to_voting_room')
                && p.state !== 'input-streaming'
              )
              .map(p => p.type === 'tool-add_to_packing_list'
                ? <PackingPill key={p.toolCallId} inv={p} />
                : <VotingPill key={p.toolCallId} inv={p} />
              )
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
              Chat with Wanda
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
