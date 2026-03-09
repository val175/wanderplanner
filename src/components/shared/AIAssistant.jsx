import React, { useState, useRef, useEffect, useContext } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, X, Sparkles } from 'lucide-react';
import { auth } from '../../firebase/config';
import { TripContext } from '../../context/TripContext';
import { buildTripSystemPrompt } from '../../hooks/useAI';
import { generateId } from '../../utils/helpers';
import { ACTIONS } from '../../state/tripReducer';
import { useMediaQuery } from '../../hooks/useMediaQuery';

let _systemPromptRef = buildTripSystemPrompt(null);

const chatTransport = new DefaultChatTransport({
  api: 'https://wanderplan-rust.vercel.app/api/chat',
  body: () => ({ systemPrompt: _systemPromptRef }),
  fetch: async (url, options) => {
    let token = '';
    if (auth.currentUser) {
      try { token = await auth.currentUser.getIdToken(); } catch (e) { console.warn(e); }
    }
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(url, { ...options, headers });
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

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const { activeTrip, dispatch, showToast } = useContext(TripContext);

  useEffect(() => {
    _systemPromptRef = buildTripSystemPrompt(activeTrip);
  }, [activeTrip]);

  const { messages, sendMessage, status, error, addToolResult } = useChat({
    transport: chatTransport,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('toggle-wanda-mobile', handleToggle);
    return () => window.removeEventListener('toggle-wanda-mobile', handleToggle);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handlePillClick = (text) => {
    if (isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const showPills = messages.length === 0 && !isLoading;
  const isMobile = useMediaQuery('(max-width: 767px)');

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
      try { addToolResult({ tool: toolName, toolCallId: inv.toolCallId, output: 'added' }) } catch {}
      showToast(`${emoji || '✨'} ${label} ${toastLabel}`, {
        undo: () => onUndo(newId),
      })
      setLocalDone(true)
    }

    return (
      <button
        onClick={handleClick}
        disabled={!canAct}
        title={!activeTrip ? 'Select a trip first' : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          marginTop: '6px',
          borderRadius: '9999px',
          border: `1px solid ${done ? 'var(--color-success, #22c55e)' : 'var(--color-accent)'}`,
          background: done ? 'rgba(34,197,94,0.08)' : 'transparent',
          color: done ? 'var(--color-success, #22c55e)' : 'var(--color-accent)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: canAct ? 'pointer' : 'default',
          opacity: !activeTrip ? 0.45 : 1,
          transition: 'all 0.15s',
          letterSpacing: '-0.01em',
        }}
      >
        <span style={{ fontSize: '14px' }}>{done ? '✅' : (emoji || '✨')}</span>
        <span>{done ? 'Added' : `Add ${label}`}</span>
        {!done && <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: '2px' }}>+</span>}
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
            emoji: emoji || '✨',
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

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div
          className={`${isMobile ? 'fixed inset-0 z-[100] rounded-none' : 'fixed bottom-[80px] right-[24px] w-[360px] max-h-[520px] rounded-[20px] border border-[var(--color-border)] shadow-[0_12px_40px_rgba(0,0,0,0.13),0_2px_8px_rgba(0,0,0,0.06)]'}`}
          style={{
            background: 'var(--color-bg-card)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 100,
            animation: 'wanda-pop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <style>{`
            @keyframes wanda-pop {
              from { opacity: 0; transform: translateY(10px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
            .wanda-pill {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              padding: 5px 12px;
              font-size: 12px;
              font-weight: 500;
              border-radius: 9999px;
              border: 1px solid var(--color-border);
              background: var(--color-bg-secondary);
              color: var(--color-text-secondary);
              cursor: pointer;
              transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.1s;
              white-space: nowrap;
              line-height: 1.4;
            }
            .wanda-pill:hover {
              background: var(--color-bg-hover);
              border-color: var(--color-accent);
              color: var(--color-accent);
              transform: translateY(-1px);
            }
            .wanda-pill:active { transform: scale(0.97); }
            .wanda-msg-scroll::-webkit-scrollbar { width: 4px; }
            .wanda-msg-scroll::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
          `}</style>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 36, height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--color-accent) 0%, #e8a87c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '17px',
                flexShrink: 0,
              }}>
                🪄
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
                  Wanda
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {activeTrip ? `Knows your ${activeTrip.name} trip` : 'AI travel assistant'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'var(--color-bg-hover)',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28, height: 28,
                borderRadius: '8px',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div
            className="wanda-msg-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 14px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.length === 0 && !error && (
              <div style={{ textAlign: 'center', padding: '20px 8px 12px' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>✨</div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                  {activeTrip
                    ? <>Hi! I know all about your <strong>{activeTrip.name}</strong> trip — ask me anything!</>
                    : "Hi! I'm Wanda, your AI travel assistant. Select a trip and I'll know all about it!"}
                </p>
              </div>
            )}

            {error && (
              <p style={{ color: 'var(--color-danger)', fontSize: '12px', textAlign: 'center', padding: '8px 12px', background: 'rgba(var(--color-danger-rgb, 220,53,69), 0.06)', borderRadius: '10px' }}>
                ⚠️ {error.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
                  {m.role === 'assistant' && (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-accent) 0%, #e8a87c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0, marginRight: '8px', marginTop: '2px' }}>
                      🪄
                    </div>
                  )}
                  <div
                    style={{
                      padding: '9px 13px',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      maxWidth: '82%',
                      fontSize: '13px',
                      lineHeight: '1.55',
                      whiteSpace: 'pre-wrap',
                      ...(m.role === 'user'
                        ? { background: 'var(--color-accent)', color: '#fff' }
                        : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }
                      ),
                    }}
                  >
                    {m.parts
                      ? m.parts.filter(p => p.type === 'text').map((p, i) => <span key={i}>{p.text}</span>)
                      : m.content}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-accent) 0%, #e8a87c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>🪄</div>
                <div style={{ padding: '8px 13px', borderRadius: '4px 16px 16px 16px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-text-muted)', display: 'inline-block', animation: `wanda-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
                <style>{`@keyframes wanda-dot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Floating pills — only shown when conversation is empty */}
          {showPills && (
            <div style={{
              padding: '4px 14px 10px',
              flexShrink: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}>
              {PILLS.map(({ emoji, label }) => (
                <button
                  key={label}
                  type="button"
                  className="wanda-pill"
                  onClick={() => handlePillClick(`${emoji} ${label}`)}
                >
                  <span>{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '8px',
              padding: isMobile ? '10px 12px calc(10px + env(safe-area-inset-bottom))' : '10px 12px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Wanda..."
              style={{
                flex: 1,
                padding: '9px 14px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                padding: '9px 13px',
                borderRadius: '12px',
                border: 'none',
                background: isLoading || !input.trim() ? 'var(--color-bg-hover)' : 'var(--color-accent)',
                color: isLoading || !input.trim() ? 'var(--color-text-muted)' : '#fff',
                cursor: isLoading || !input.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating trigger button - Hidden on mobile as it's in BottomNav */}
      {!isMobile && (
        <button
          onClick={() => setIsOpen(o => !o)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 20px',
            borderRadius: '9999px',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 18px rgba(217, 119, 87, 0.38)',
            zIndex: 50,
            transition: 'transform 0.15s, box-shadow 0.15s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(217, 119, 87, 0.48)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 18px rgba(217, 119, 87, 0.38)';
          }}
        >
          <Sparkles size={15} />
          Ask Wanda
        </button>
      )}
    </>
  );
}
