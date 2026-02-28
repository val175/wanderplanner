import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Send } from 'lucide-react';

export default function AIAssistant() {
  const [input, setInput] = useState('');

  // @ai-sdk/react@3.x useChat API: sendMessage(text), status, messages
  const { messages, sendMessage, status } = useChat({
    api: 'https://wanderplan-rust.vercel.app/api/chat',
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage(text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-card)' }}>
      {/* Pills */}
      <div className="flex gap-2 p-4 overflow-x-auto" style={{ borderBottom: '1px solid var(--color-border)' }}>
        {["💰 Help with budget", "📅 Optimize itinerary"].map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setInput(text)}
            className="px-3 py-1 text-sm rounded-full flex-shrink-0 transition-colors"
            style={{
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {text}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="p-3 rounded-lg max-w-[85%] text-sm"
              style={m.role === 'user'
                ? { background: 'var(--color-accent)', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }
              }
            >
              {m.parts
                ? m.parts.filter(p => p.type === 'text').map((p, i) => <span key={i}>{p.text}</span>)
                : m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 flex gap-2" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask Wanda..."
          className="flex-1 p-2 rounded-xl outline-none text-sm transition-colors"
          style={{
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--color-border)'}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 rounded-xl transition-colors flex items-center justify-center min-w-[50px]"
          style={{
            background: isLoading || !input.trim() ? 'var(--color-bg-hover)' : 'var(--color-accent)',
            color: isLoading || !input.trim() ? 'var(--color-text-muted)' : '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  );
}
