import React from 'react';
import { useChat } from '@ai-sdk/react';

export default function AIAssistant() {
  // We initialize with an empty string to prevent .trim() from ever hitting 'undefined'
  const { messages, input = '', setInput, handleInputChange, handleSubmit, isLoading } = useChat({
    initialInput: '',
  });

  // Explicitly ensuring we have a string for the disabled check
  const safeInput = input || '';

  const handlePillClick = (text) => {
    setInput(text);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Suggestion Pills */}
      <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar border-b">
        {["💰 Help with budget", "📅 Optimize itinerary", "📍 Find hidden gems"].map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handlePillClick(text)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full border border-gray-200 text-sm hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            {text}
          </button>
        ))}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <input
            value={safeInput}
            onChange={handleInputChange}
            placeholder="Ask Wanda anything..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <button
            type="submit"
            disabled={isLoading || safeInput.trim().length === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
