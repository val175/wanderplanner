import { useState, useEffect, useRef } from 'react'
import { useProfiles } from '../../../context/ProfileContext'
import { auth } from '../../../firebase/config'
import AvatarCircle from '../../shared/AvatarCircle'
import Button from '../../shared/Button'

const WANDA_QUESTIONS = [
  { key: 'name_and_destinations', text: "Hi! I'm Wanda 🪄 Let's plan your trip! First — what should we call it, and where are you headed?" },
  { key: 'dates', text: "Wonderful! When are you traveling? Exact dates or a rough timeframe like 'end of April for 10 days' both work." },
  { key: 'travelers', text: "Who's coming along on this trip?" },
  { key: 'trip_style', text: "What's the vibe? Pick as many as you like!" },
  { key: 'budget', text: "What's your rough budget? (in PHP — pick a range or type a custom amount)" },
  { key: 'special_requirements', text: "Any must-dos or special requirements? Dietary needs, places you definitely want to visit, things to avoid — anything goes!" },
]
const TRAVELERS_Q_INDEX = 2
const VIBE_Q_INDEX = 3
const BUDGET_Q_INDEX = 4

const VIBE_OPTIONS = [
  { id: 'adventure', label: 'Adventure', emoji: '🏔️' },
  { id: 'relaxation', label: 'Relaxation', emoji: '🛁' },
  { id: 'food', label: 'Food & Culture', emoji: '🍜' },
  { id: 'family', label: 'Family-friendly', emoji: '👨‍👩‍👧' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🎵' },
  { id: 'history', label: 'History & Art', emoji: '🏛️' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'beach', label: 'Beach & Water', emoji: '🤿' },
]

const BUDGET_OPTIONS = [
  { id: 'b1', label: 'Under ₱50,000', value: 'under ₱50,000 PHP' },
  { id: 'b2', label: '₱50,000 – ₱100,000', value: 'around ₱50,000–₱100,000 PHP' },
  { id: 'b3', label: '₱100,000 – ₱150,000', value: 'around ₱100,000–₱150,000 PHP' },
  { id: 'b4', label: '₱150,000 – ₱300,000', value: 'around ₱150,000–₱300,000 PHP' },
  { id: 'b5', label: '₱300,000+', value: 'over ₱300,000 PHP' },
  { id: 'custom', label: '✏️ Custom…', value: null },
]

export default function WandaChatFlow({ onPlanReady, onBack }) {
  const { profiles, currentUserProfile } = useProfiles()
  const [messages, setMessages] = useState([{ role: 'assistant', content: WANDA_QUESTIONS[0].text }])
  const [input, setInput] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [gatheredInfo, setGatheredInfo] = useState({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateButton, setShowGenerateButton] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [selectedTravelerIds, setSelectedTravelerIds] = useState(
    () => currentUserProfile?.uid ? [currentUserProfile.uid] : []
  )
  const [selectedVibes, setSelectedVibes] = useState([])
  const [selectedBudgetId, setSelectedBudgetId] = useState(null)
  const [customBudget, setCustomBudget] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (currentUserProfile?.uid) {
      setSelectedTravelerIds(ids => ids.includes(currentUserProfile.uid) ? ids : [currentUserProfile.uid, ...ids])
    }
  }, [currentUserProfile?.uid])

  const allTravelers = [
    ...(currentUserProfile ? [{ ...currentUserProfile, id: currentUserProfile.uid, isMe: true }] : []),
    ...profiles,
  ]

  const toggleWandaTraveler = (id) => {
    if (id === currentUserProfile?.uid) return
    setSelectedTravelerIds(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    )
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating, showGenerateButton])

  const advanceQuestion = (answerText, newGatheredInfo) => {
    const nextIndex = questionIndex + 1
    setGatheredInfo(newGatheredInfo)
    setQuestionIndex(nextIndex)
    if (nextIndex < WANDA_QUESTIONS.length) {
      setTimeout(() => {
        setMessages(m => [...m, { role: 'assistant', content: WANDA_QUESTIONS[nextIndex].text }])
      }, 300)
    } else {
      setTimeout(() => {
        setMessages(m => [...m, {
          role: 'assistant',
          content: "Perfect, I have everything I need! Tap the button below and I'll put together your complete trip plan. ✨"
        }])
        setShowGenerateButton(true)
      }, 300)
    }
  }

  const handleSend = (e) => {
    e?.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    const currentQuestion = WANDA_QUESTIONS[questionIndex]
    const newGatheredInfo = { ...gatheredInfo, [currentQuestion.key]: trimmed }
    setMessages(m => [...m, { role: 'user', content: trimmed }])
    setInput('')
    advanceQuestion(trimmed, newGatheredInfo)
  }

  const handleTravelersConfirm = () => {
    const names = allTravelers
      .filter(t => selectedTravelerIds.includes(t.id))
      .map(t => t.isMe ? (t.name || 'Me') : t.name)
    const answerText = names.length > 0
      ? names.join(', ')
      : `${selectedTravelerIds.length} traveler${selectedTravelerIds.length !== 1 ? 's' : ''}`
    const newGatheredInfo = { ...gatheredInfo, travelers: answerText }
    setMessages(m => [...m, { role: 'user', content: answerText }])
    advanceQuestion(answerText, newGatheredInfo)
  }

  const handleVibesConfirm = () => {
    if (selectedVibes.length === 0) return
    const labels = VIBE_OPTIONS.filter(v => selectedVibes.includes(v.id)).map(v => `${v.emoji} ${v.label}`)
    const answerText = labels.join(', ')
    const newGatheredInfo = { ...gatheredInfo, trip_style: answerText }
    setMessages(m => [...m, { role: 'user', content: answerText }])
    advanceQuestion(answerText, newGatheredInfo)
  }

  const handleBudgetConfirm = () => {
    const option = BUDGET_OPTIONS.find(o => o.id === selectedBudgetId)
    if (!option) return
    const answerText = option.value ?? customBudget.trim()
    if (!answerText) return
    const newGatheredInfo = { ...gatheredInfo, budget: answerText }
    setMessages(m => [...m, { role: 'user', content: answerText }])
    advanceQuestion(answerText, newGatheredInfo)
  }

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setShowGenerateButton(false)
    setGenerateError('')
    setMessages(m => [...m, { role: 'assistant', content: 'Working my magic... give me a moment! 🪄' }])

    try {
      let token = ''
      if (auth.currentUser) token = await auth.currentUser.getIdToken()
      const res = await fetch('https://wanderplan-rust.vercel.app/api/wanda-plan-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ gatheredInfo })
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate plan')
      onPlanReady(data.data, { travelerIds: selectedTravelerIds })
    } catch (err) {
      const errMsg = `Sorry, something went wrong: ${err.message}. Want to try again?`
      setMessages(m => [...m, { role: 'assistant', content: errMsg }])
      setGenerateError(err.message)
      setShowGenerateButton(true)
    } finally {
      setIsGenerating(false)
    }
  }

  const allQuestionsAnswered = questionIndex >= WANDA_QUESTIONS.length
  const isTravelersQuestion = questionIndex === TRAVELERS_Q_INDEX
  const isVibeQuestion = questionIndex === VIBE_Q_INDEX
  const isBudgetQuestion = questionIndex === BUDGET_Q_INDEX
  const isPickerQuestion = isTravelersQuestion || isVibeQuestion || isBudgetQuestion
  const showInput = !allQuestionsAnswered && !isGenerating && !isPickerQuestion
  const showTravelerPicker = isTravelersQuestion && !isGenerating
  const showVibePicker = isVibeQuestion && !isGenerating
  const showBudgetPicker = isBudgetQuestion && !isGenerating
  const isCustomBudget = selectedBudgetId === 'custom'

  return (
    <div className="flex flex-col h-[500px] animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 pr-10 border-b border-border flex items-center gap-3 shrink-0">
        <button type="button" onClick={onBack}
          className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-text-primary">🪄 Ask Wanda</span>
        <span className="text-xs text-text-muted ml-auto">{Math.min(questionIndex, WANDA_QUESTIONS.length)}/{WANDA_QUESTIONS.length} answered</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <span className="text-base shrink-0 mb-0.5">🪄</span>
            )}
            <div className={`max-w-[82%] text-sm rounded-[var(--radius-lg)] px-3.5 py-2.5 leading-relaxed
              ${msg.role === 'user'
                ? 'bg-accent/15 text-text-primary rounded-br-sm'
                : 'bg-bg-secondary border border-border text-text-primary rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-end gap-2 justify-start">
            <span className="text-base shrink-0 mb-0.5">🪄</span>
            <div className="bg-bg-secondary border border-border rounded-[var(--radius-lg)] rounded-bl-sm px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {showGenerateButton && !isGenerating && (
          <div className="flex justify-center pt-2">
            <Button size="md" onClick={handleGeneratePlan}>
              🪄 Generate My Trip Plan
            </Button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Traveler picker */}
      {showTravelerPicker && (
        <div className="border-t border-border px-4 py-3 shrink-0 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {allTravelers.map(t => {
              const isSelected = selectedTravelerIds.includes(t.id)
              const isMe = t.isMe
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleWandaTraveler(t.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-primary'
                    }
                    ${isMe ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <AvatarCircle profile={t} size={18} />
                  <span>{isMe ? (t.name || 'Me') : t.name}</span>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
            {allTravelers.length === 0 && (
              <p className="text-xs text-text-muted">No saved travelers. Just you!</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleTravelersConfirm}
            className="w-full px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] transition-colors"
          >
            Confirm — {selectedTravelerIds.length} traveler{selectedTravelerIds.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Vibe picker */}
      {showVibePicker && (
        <div className="border-t border-border px-4 py-3 shrink-0 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {VIBE_OPTIONS.map(v => {
              const isSelected = selectedVibes.includes(v.id)
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVibes(vs => vs.includes(v.id) ? vs.filter(x => x !== v.id) : [...vs, v.id])}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-pointer
                    ${isSelected
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-primary'
                    }`}
                >
                  <span>{v.emoji}</span>
                  <span>{v.label}</span>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={handleVibesConfirm}
            disabled={selectedVibes.length === 0}
            className="w-full px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] transition-colors disabled:opacity-40"
          >
            Confirm{selectedVibes.length > 0 ? ` — ${selectedVibes.length} selected` : ''}
          </button>
        </div>
      )}

      {/* Budget picker */}
      {showBudgetPicker && (
        <div className="border-t border-border px-4 py-3 shrink-0 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {BUDGET_OPTIONS.map(opt => {
              const isSelected = selectedBudgetId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setSelectedBudgetId(opt.id); if (opt.id !== 'custom') setCustomBudget('') }}
                  className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all cursor-pointer
                    ${isSelected
                      ? 'bg-accent/15 border-accent/40 text-accent'
                      : 'bg-bg-secondary border-border text-text-muted hover:border-accent/30 hover:text-text-primary'
                    }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {isCustomBudget && (
            <input
              type="text"
              value={customBudget}
              onChange={e => setCustomBudget(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBudgetConfirm()}
              placeholder="e.g. around $3,000 USD or ₱200,000"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-bg-input border border-border rounded-[var(--radius-md)] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          )}
          <button
            type="button"
            onClick={handleBudgetConfirm}
            disabled={!selectedBudgetId || (isCustomBudget && !customBudget.trim())}
            className="w-full px-3 py-1.5 text-xs font-semibold bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] transition-colors disabled:opacity-40"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Text input */}
      {showInput && (
        <form onSubmit={handleSend} className="border-t border-border px-4 py-3 flex gap-2 shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your answer…"
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm text-text-primary placeholder:text-text-muted px-1"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover text-text-inverse rounded-[var(--radius-md)] disabled:opacity-40 transition-colors shrink-0"
          >
            Send
          </button>
        </form>
      )}
    </div>
  )
}
