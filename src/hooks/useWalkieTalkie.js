import { useState, useRef, useEffect, useCallback } from 'react'
import { auth } from '../firebase/config'

const TTS_URL = 'https://wanderplan-rust.vercel.app/api/tts'
const MAX_TTS_SENTENCES = 3

// Speak only the first few sentences — keeps latency low and sounds natural
// when walking around. The full response is still visible in the chat.
function truncateForSpeech(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || []
  if (sentences.length <= MAX_TTS_SENTENCES) return text
  return sentences.slice(0, MAX_TTS_SENTENCES).join('').trim()
}

const isSTTSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

// Tiny silent MP3 — used to unlock the Audio element on iOS during a user gesture.
// iOS Safari only allows audio playback if the element was first played during a
// synchronous user gesture. We "prime" the persistent audio element this way.
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsgU291bmQgRWZmZWN0cyBMaWJyYXJ5//uQwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TFNBTUU9My45OXIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  // One persistent Audio element — unlocked during user gesture, reused for all TTS
  const audioRef = useRef(null)
  const isModeRef = useRef(false)
  const finalTranscriptRef = useRef('')
  // Tracks consecutive STT errors to prevent infinite retry loops on persistent failures
  const sttRetryCountRef = useRef(0)

  // Keep isModeRef in sync with state
  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

  // Get or create the persistent Audio element
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = 'none'
    }
    return audioRef.current
  }, [])

  // Unlock the Audio element on iOS by playing a silent clip during a user gesture.
  // Must be called synchronously from a click/tap handler.
  const unlockAudio = useCallback(() => {
    const audio = getAudio()
    audio.src = SILENT_MP3
    audio.volume = 0
    const p = audio.play()
    if (p) p.then(() => { audio.pause(); audio.volume = 1 }).catch(() => { audio.volume = 1 })
  }, [getAudio])

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.onended = null
      audio.onerror = null
      // Don't null out audioRef — keep the unlocked element alive
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSTTSupported || !isModeRef.current) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''

    recognition.onresult = (event) => {
      sttRetryCountRef.current = 0  // reset retry counter on successful audio capture
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) finalTranscriptRef.current = final
      setTranscript(finalTranscriptRef.current || interim)
    }

    recognition.onend = () => {
      setIsListening(false)
      if (!isModeRef.current) return  // mode turned off while recognizing — discard transcript
      const final = finalTranscriptRef.current.trim()
      if (final) {
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('[useWalkieTalkie] STT error:', event.error)
      }
      setIsListening(false)
      // Auto-retry transient errors (e.g. iOS mic not released yet after abort)
      const fatal = event.error === 'not-allowed' || event.error === 'service-not-allowed'
      if (isModeRef.current && !fatal && sttRetryCountRef.current < 3) {
        sttRetryCountRef.current++
        setTimeout(() => startListening(), 800)
      }
    }

    recognition.start()
    setIsListening(true)
  }, [onTranscriptReady])

  const speak = useCallback(async (text) => {
    if (!text?.trim() || !isModeRef.current) return

    stopAudio()
    setIsSpeaking(true)

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: truncateForSpeech(text) }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => res.status)
        console.warn('[useWalkieTalkie] TTS failed:', res.status, errText)
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
        return
      }

      const { audioContent, mimeType } = await res.json()
      if (!audioContent) {
        console.warn('[useWalkieTalkie] Empty audioContent')
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
        return
      }

      // Build a Blob URL from the base64 audio (more compatible than data URIs on iOS)
      const binary = atob(audioContent)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(blob)

      const audio = getAudio()
      audio.src = blobUrl
      audio.volume = 1

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
      }
      audio.onerror = (e) => {
        console.warn('[useWalkieTalkie] Audio playback error:', e)
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
        if (isModeRef.current) startListening()
      }

      await audio.play()
    } catch (err) {
      console.error('[useWalkieTalkie] speak error:', err)
      setIsSpeaking(false)
      if (isModeRef.current) startListening()
    }
  }, [stopAudio, startListening, getAudio])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
    // Do NOT set isListening(false) here — onend is the single source of truth.
    // Setting it here creates a race: if the user taps Mic again before onend fires,
    // the old onend will stomp setIsListening(false) over the new session's true state.
  }, [])

  const toggleWalkieTalkieMode = useCallback(() => {
    // Unlock audio during this user gesture (critical for iOS Safari)
    unlockAudio()

    setIsWalkieTalkieMode(prev => {
      if (prev) {
        // Turning off — clean up
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
        }
        stopAudio()
        setIsListening(false)
        setIsSpeaking(false)
        setTranscript('')
        isModeRef.current = false
      } else {
        isModeRef.current = true
      }
      return !prev
    })
  }, [unlockAudio, stopAudio])

  // Also unlock audio when user taps the mic button — belt and suspenders for iOS
  const startListeningFromGesture = useCallback(() => {
    unlockAudio()
    startListening()
  }, [unlockAudio, startListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isModeRef.current = false
      try { recognitionRef.current?.abort() } catch (_) {}
      stopAudio()
    }
  }, [stopAudio])

  return {
    isWalkieTalkieMode,
    isListening,
    isSpeaking,
    transcript,
    isSTTSupported,
    toggleWalkieTalkieMode,
    startListening: startListeningFromGesture, // always unlocks audio first
    stopListening,
    speak,
  }
}
