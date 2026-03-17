import { useState, useRef, useEffect, useCallback } from 'react'
import { auth } from '../firebase/config'

const TTS_URL = 'https://wanderplan-rust.vercel.app/api/tts'
const MAX_TTS_SENTENCES = 3

function truncateForSpeech(text) {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || []
  if (sentences.length <= MAX_TTS_SENTENCES) return text
  return sentences.slice(0, MAX_TTS_SENTENCES).join('').trim()
}

const isSTTSupported =
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

// Tiny silent MP3 — played on new Audio elements during user gestures to
// "activate" them on iOS Safari. iOS requires audio.play() to be called
// synchronously within a user gesture before async playback is allowed.
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsgU291bmQgRWZmZWN0cyBMaWJyYXJ5//uQwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA//////////////////////////////////////////////////////////////////8AAAA5TFNBTUU9My45OXIxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

// Activate an Audio element by playing a silent clip during a user gesture.
// Once activated, the element can be play()d asynchronously (e.g. after a fetch).
function activateAudio(audio) {
  audio.src = SILENT_MP3
  audio.volume = 0
  const p = audio.play()
  if (p) p.then(() => { audio.pause(); audio.src = ''; audio.volume = 1 }).catch(() => { audio.volume = 1 })
}

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  // Pre-activated Audio element waiting to be used for the next TTS response.
  // Created and activated during each mic button press (user gesture) so that
  // speak() can call play() on it asynchronously after the TTS fetch completes.
  const nextTTSAudioRef = useRef(null)
  // Currently playing TTS audio element
  const playbackRef = useRef(null)
  const isModeRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const sttRetryCountRef = useRef(0)

  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

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

    // Watchdog: if iOS recognition hangs silently for 10s, reset state
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
      if (!isModeRef.current) return
      const final = finalTranscriptRef.current.trim()
      if (final) {
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      clearWatchdog()
      const ignorable = event.error === 'no-speech' || event.error === 'aborted'
      if (!ignorable) console.warn('[useWalkieTalkie] STT error:', event.error)
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
        console.warn('[useWalkieTalkie] TTS failed:', res.status)
        setIsSpeaking(false)
        return
      }

      const { audioContent, mimeType } = await res.json()
      if (!audioContent) {
        console.warn('[useWalkieTalkie] Empty audioContent')
        setIsSpeaking(false)
        return
      }

      const binary = atob(audioContent)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
      const blobUrl = URL.createObjectURL(blob)

      // Use the pre-activated Audio element that was created during the mic button
      // press (user gesture). This is the ONLY way to play audio asynchronously on
      // iOS Safari — the element must have been play()d once during a user gesture.
      const audio = nextTTSAudioRef.current
      nextTTSAudioRef.current = null

      if (!audio) {
        console.warn('[useWalkieTalkie] No pre-activated audio element — mic was not tapped')
        URL.revokeObjectURL(blobUrl)
        setIsSpeaking(false)
        return
      }

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
          console.warn('[useWalkieTalkie] Play rejected:', err.name, err.message)
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
  }, [])

  const toggleWalkieTalkieMode = useCallback(() => {
    setIsWalkieTalkieMode(prev => {
      if (prev) {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
        }
        stopAudio()
        // Discard any unused pre-activated audio
        if (nextTTSAudioRef.current) {
          nextTTSAudioRef.current.pause()
          nextTTSAudioRef.current = null
        }
        setIsListening(false)
        setIsSpeaking(false)
        setTranscript('')
        isModeRef.current = false
      } else {
        isModeRef.current = true
      }
      return !prev
    })
  }, [stopAudio])

  // Called directly from the mic button click — this IS a synchronous user gesture.
  // We pre-create and activate a fresh Audio element here so speak() can use it
  // asynchronously after the TTS fetch, bypassing iOS's user-gesture requirement.
  const startListeningFromGesture = useCallback(() => {
    // Interrupt any in-progress TTS (barge-in support)
    stopAudio()
    setIsSpeaking(false)

    // Discard any stale pre-activated element from a previous tap
    if (nextTTSAudioRef.current) {
      nextTTSAudioRef.current.pause()
      nextTTSAudioRef.current = null
    }

    // Start recognition FIRST — before any audio output — so iOS audio session
    // is in record mode when the mic opens. Playing the silent MP3 afterward
    // avoids a conflict where audio playback interrupts mic initialization.
    startListening()

    // Pre-activate a fresh Audio element for the upcoming TTS response.
    // Happens after startListening() so the silent MP3 doesn't compete with
    // mic startup for the iOS audio session.
    const ttsAudio = new Audio()
    activateAudio(ttsAudio)
    nextTTSAudioRef.current = ttsAudio
  }, [startListening, stopAudio])

  useEffect(() => {
    return () => {
      isModeRef.current = false
      try { recognitionRef.current?.abort() } catch (_) {}
      stopAudio()
      if (nextTTSAudioRef.current) {
        nextTTSAudioRef.current.pause()
        nextTTSAudioRef.current = null
      }
    }
  }, [stopAudio])

  return {
    isWalkieTalkieMode,
    isListening,
    isSpeaking,
    transcript,
    isSTTSupported,
    toggleWalkieTalkieMode,
    startListening: startListeningFromGesture,
    stopListening,
    speak,
  }
}
