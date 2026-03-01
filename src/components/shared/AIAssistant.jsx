import React, { useState, useRef, useEffect, useContext } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, X, Sparkles } from 'lucide-react';
import { TripContext } from '../../context/TripContext';
import { buildTripSystemPrompt } from '../../hooks/useAI';

// Transport is created once. Its body option is a function (Resolvable<object>)
// so it gets called fresh on every send, reading the latest system prompt from the ref.
// This avoids both stale closures AND the need to recreate the transport on re-renders.
let _systemPromptRef = buildTripSystemPrompt(null);

const chatTransport = new DefaultChatTransport({
  api: 'https://wanderplan-rust.vercel.app/api/chat',
  body: () => ({ systemPrompt: _systemPromptRef }),
});

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  const { activeTrip } = useContext(TripContext);

  // Keep the module-level prompt ref in sync with the current trip
  useEffect(() => {
    _systemPromptRef = buildTripSystemPrompt(activeTrip);
  }, [activeTrip]);

  const { messages, sendMessage, status, error } = useChat({
    transport: chatTransport,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handlePillClick = (text) => {
    setInput(text);
  };

  return (
    <>
      {/* Floating chat panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '360px',
            height: '480px',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🪄</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                  Wanda
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                  {activeTrip ? `Knows your ${activeTrip.name} trip` : 'AI travel assistant'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '6px',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Suggestion pills */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              overflowX: 'auto',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            {['💰 Help with budget', '📅 Optimize itinerary', '🏨 Hotel tips', '✈️ Packing list'].map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => handlePillClick(text)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  borderRadius: '9999px',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {text}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {messages.length === 0 && !error && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                {activeTrip
                  ? `Hi! I know all about your ${activeTrip.name} trip — ask me anything!`
                  : "Hi! I'm Wanda, your AI travel assistant. Select a trip and I'll know all about it!"}
              </p>
            )}
            {error && (
              <p style={{ color: '#e53e3e', fontSize: '12px', textAlign: 'center', padding: '8px', background: '#fff5f5', borderRadius: '8px' }}>
                ⚠️ {error.message || 'Something went wrong. Please try again.'}
              </p>
            )}
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '12px',
                    maxWidth: '85%',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    ...(m.role === 'user'
                      ? { background: 'var(--color-accent)', color: '#fff' }
                      : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }
                    ),
                  }}
                >
                  {m.parts
                    ? m.parts.filter(p => p.type === 'text').map((p, i) => <span key={i}>{p.text}</span>)
                    : m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '8px',
              padding: '10px 12px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Wanda..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: 'none',
                background: isLoading || !input.trim() ? 'var(--color-bg-hover)' : 'var(--color-accent)',
                color: isLoading || !input.trim() ? 'var(--color-text-muted)' : '#fff',
                cursor: isLoading || !input.trim() ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '40px',
                flexShrink: 0,
              }}
            >
              {isLoading ? (
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <Send size={14} />
              )}
            </button>
          </form>
        </div>
      )}

      {/* Floating pill trigger */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 18px',
          borderRadius: '9999px',
          border: 'none',
          background: 'var(--color-accent)',
          color: '#fff',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(217, 119, 87, 0.35)',
          zIndex: 50,
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 119, 87, 0.45)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(217, 119, 87, 0.35)';
        }}
      >
        <Sparkles size={16} />
        Ask Wanda
      </button>
    </>
  );
}
