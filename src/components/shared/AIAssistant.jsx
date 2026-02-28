import React from 'react';
import { useChat } from '@ai-sdk/react'; // This is the correct, modern import
import { Send, Sparkles } from 'lucide-react';

export default function AIAssistant() {
  const { messages, input, handleInputChange, handleSubmit, setInput, isLoading } = useChat({
    api: '/api/chat',
    initialInput: '',
  });

  const safeInput = input || '';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Pills */}
      <div className="flex gap-2 p-4 overflow-x-auto border-b">
        {["💰 Help with budget", "📅 Optimize itinerary"].map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setInput(text)}
            className="px-3 py-1 text-sm border rounded-full hover:bg-gray-50 flex-shrink-0"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-[85%] ${m.role === 'user' ? 'bg-[#DE7A5E] text-white shadow-sm' : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2 bg-white">
        <input
          value={safeInput}
          onChange={handleInputChange}
          placeholder="Ask Wanda..."
          className="flex-1 border border-gray-200 p-2 rounded-xl outline-none focus:ring-2 focus:ring-[#DE7A5E]/20 focus:border-[#DE7A5E] text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !safeInput.trim()}
          className="bg-[#DE7A5E] text-white px-4 py-2 rounded-xl disabled:bg-gray-300 transition-colors shadow-sm flex items-center justify-center min-w-[50px]"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  );
}
