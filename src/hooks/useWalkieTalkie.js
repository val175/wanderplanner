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

// Tiny silent MP3 — used to unlock audio on iOS during a user gesture.
// iOS Safari only allows audio playback if an element was first played during a
// synchronous user gesture. We "prime" a persistent unlock element this way.
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsgU291bmQgRWZmZWN0cyBMaWJyYXJ5//uQwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TFNBTUU9My45OXIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  // Persistent element used ONLY for iOS audio unlock — never used for TTS playback
  const unlockRef = useRef(null)
  // Current TTS playback element — replaced on each speak() call, no state reuse
  const playbackRef = useRef(null)
  const isModeRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const sttRetryCountRef = useRef(0)

  // Keep isModeRef in sync with state
  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

  // Get or create the persistent unlock-only Audio element
  const getUnlockAudio = useCallback(() => {
    if (!unlockRef.current) {
      unlockRef.current = new Audio()
      unlockRef.current.preload = 'none'
    }
    return unlockRef.current
  }, [])

  // Unlock iOS audio by playing a silent clip during a user gesture.
  // Must be called synchronously from a click/tap handler.
  const unlockAudio = useCallback(() => {
    const audio = getUnlockAudio()
    audio.src = SILENT_MP3
    audio.load()
    audio.volume = 0
    const p = audio.play()
    if (p) p.then(() => { audio.pause(); audio.volume = 1 }).catch(() => { audio.volume = 1 })
  }, [getUnlockAudio])

  // Stop any in-progress TTS playback
  const stopAudio = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.onended = null
      playbackRef.current.onerror = null
      playbackRef.current.pause()
      playbackRef.current = null
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

    // Watchdog: if iOS recognition hangs (no onend/onerror for 10s), reset state
    let watchdog = setTimeout(() => {
      if (recognitionRef.current === recognition) {
        try { recognition.abort() } catch (_) {}
        setIsListening(false)
      }
    }, 10000)
    const clearWatchdog = () => { clearTimeout(watchdog); watchdog = null }

    recognition.onresult = (event) => {
      clearWatchdog()
      sttRetryCountRef.current = 0
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
      clearWatchdog()
      setIsListening(false)
      if (!isModeRef.current) return  // mode turned off while recognizing — discard transcript
      const final = finalTranscriptRef.current.trim()
      if (final) {
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      clearWatchdog()
      // 'aborted' = intentional stop (or race from previous session's abort); never retry
      const ignorable = event.error === 'no-speech' || event.error === 'aborted'
      if (!ignorable) {
        console.warn('[useWalkieTalkie] STT error:', event.error)
      }
      setIsListening(false)
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
        return
      }

      const { audioContent, mimeType } = await res.json()
      if (!audioContent) {
        console.warn('[useWalkieTalkie] Empty audioContent')
        setIsSpeaking(false)
        return
      }

      // Build a blob URL and play it on a FRESH Audio element each time.
      // Using a fresh element avoids all iOS state-reuse / GC bugs that occur
      // when the same element is reused across multiple TTS responses.
      // iOS unlocks audio at the page level after the first user gesture, so
      // new Audio() instances play freely without needing per-element activation.
      const binary = atob(audioContent)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(blob)

      const audio = new Audio()
      playbackRef.current = audio
      audio.src = blobUrl
      audio.volume = 1

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
      }
      audio.onerror = () => {
        console.warn('[useWalkieTalkie] Audio playback error code:', audio.error?.code, audio.error?.message)
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
      }

      const playPromise = audio.play()
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[useWalkieTalkie] Play promise rejected:', err)
          URL.revokeObjectURL(blobUrl)
          setIsSpeaking(false)
        })
      }
    } catch (err) {
      console.error('[useWalkieTalkie] speak error:', err)
      setIsSpeaking(false)
    }
  }, [stopAudio])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
    // Do NOT set isListening(false) here — onend is the single source of truth.
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
