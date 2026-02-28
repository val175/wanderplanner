import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { useTripContext } from '../../context/TripContext'
import { buildTripSystemPrompt } from '../../hooks/useAI'

export default function AIAssistant() {
  const { activeTrip } = useTripContext()
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef(null)

  const SUGGESTIONS = [
    "💰 Help with budget",
    "📅 Optimize itinerary",
    "📍 Find hidden gems",
    "🚗 Transport tips",
    "🍽️ Food recommendations"
  ]

  const systemPrompt = buildTripSystemPrompt(activeTrip)

  // useChat completely replaces manual fetch, loading, and message array logic
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
    body: {
      data: { systemPrompt }
    }
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Floating FAB
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-gray-900 bg-white border border-gray-200 shadow-lg hover:scale-105 transition-transform"
      >
        <span>✨</span> Ask Wanda
      </button>
    )
  }

  // Open Chat UI
  return (
    <div className="fixed bottom-24 right-8 z-40 w-[400px] bg-white/90 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl flex flex-col h-[500px] overflow-hidden">

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🪄</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Wanda</p>
            <p className="text-[10px] text-gray-500 leading-tight">
              {activeTrip ? `Assisting with ${activeTrip.name}` : 'AI travel assistant'}
            </p>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-[#DE7A5E] text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Pills */}
      {!isLoading && messages.length === 0 && (
        <div className="px-3 pt-2 bg-white">
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => append?.({ role: 'user', content: s })}
                className="whitespace-nowrap px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 bg-white flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your trip..."
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#DE7A5E]/50"
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !(input || '').trim()} className="px-4 py-2 bg-[#DE7A5E] disabled:bg-[#DE7A5E]/50 text-white rounded-xl text-sm font-medium transition-colors">
          Send
        </button>
      </form>
    </div>
  )
}
