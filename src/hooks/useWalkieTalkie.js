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
  if (p) p.then(() => { audio.pause(); audio.src = ''; audio.volume = 1 }).catch(err => { console.warn('[WT] activateAudio play rejected:', err.name, err.message); audio.volume = 1 })
}

// Max number of auto-retries after an iOS session-conflict abort.
// Each retry waits RETRY_DELAY_MS, covering the ~15-20s iOS deactivation window.
const MAX_STT_RETRIES = 12
const RETRY_DELAY_MS = 2000

export function useWalkieTalkie({ onTranscriptReady }) {
  const [isWalkieTalkieMode, setIsWalkieTalkieMode] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMicPreparing, setIsMicPreparing] = useState(false)
  const [transcript, setTranscript] = useState('')

  const recognitionRef = useRef(null)
  // Pre-activated Audio element waiting to be used for the next TTS response.
  const nextTTSAudioRef = useRef(null)
  // Currently playing TTS audio element
  const playbackRef = useRef(null)
  const isModeRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const sttRetryCountRef = useRef(0)
  // Timestamp of when the last TTS audio ended
  const lastTTSEndTimeRef = useRef(0)
  // Pending handle for a delayed recognition.start() (retry timeout)
  const retryTimeoutRef = useRef(null)
  // Self-ref so onerror retry can call the latest startListening without stale closure
  const startListeningRef = useRef(null)

  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

  const cancelRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  const stopAudio = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.onended = null
      playbackRef.current.onerror = null
      playbackRef.current.pause()
      playbackRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSTTSupported || !isModeRef.current) {
      console.log('[WT] startListening blocked — isSTTSupported:', isSTTSupported, 'isModeRef:', isModeRef.current)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognitionRef.current = recognition
    finalTranscriptRef.current = ''
    const startedAt = Date.now()

    // Watchdog: if iOS recognition hangs silently for 10s, reset state
    let watchdog = setTimeout(() => {
      if (recognitionRef.current === recognition) {
        console.warn('[WT] watchdog fired — recognition got no events for 10s')
        try { recognition.abort() } catch (_) {}
        setIsListening(false)
        setIsMicPreparing(false)
        sttRetryCountRef.current = 0
      }
    }, 10000)
    const clearWatchdog = () => { clearTimeout(watchdog); watchdog = null }

    recognition.onresult = (event) => {
      clearWatchdog()
      // First speech detected — session is fully open, clear preparing state
      setIsMicPreparing(false)
      sttRetryCountRef.current = 0
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      if (final) {
        finalTranscriptRef.current = final
        console.log('[WT] onresult FINAL:', final)
      } else {
        console.log('[WT] onresult interim:', interim)
      }
      setTranscript(finalTranscriptRef.current || interim)
    }

    recognition.onend = () => {
      clearWatchdog()
      const final = finalTranscriptRef.current.trim()
      console.log('[WT] onend — final transcript:', final ? `"${final}"` : '(empty)')
      // Only clear UI if we're not in a retry loop (retries keep isListening=true)
      if (sttRetryCountRef.current === 0) {
        setIsListening(false)
        setIsMicPreparing(false)
      }
      if (!isModeRef.current) return
      if (final) {
        sttRetryCountRef.current = 0
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      clearWatchdog()
      const msSinceStart = Date.now() - startedAt

      // Detect iOS audio session conflict: abort within 8s without any speech
      // detected. The iOS session takes 15-20s to fully deactivate after TTS.
      // Auto-retry every 2s so the user doesn't have to keep tapping.
      const isSessionConflict = event.error === 'aborted' && msSinceStart < 8000
      if (isSessionConflict && isModeRef.current && sttRetryCountRef.current < MAX_STT_RETRIES) {
        sttRetryCountRef.current++
        console.log(`[WT] session conflict abort (${msSinceStart}ms) — retrying in ${RETRY_DELAY_MS}ms (${sttRetryCountRef.current}/${MAX_STT_RETRIES})`)
        setIsMicPreparing(true)
        // isListening stays true — mic button remains active (tap to cancel)

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null
          if (!isModeRef.current) {
            setIsListening(false)
            setIsMicPreparing(false)
            sttRetryCountRef.current = 0
            return
          }
          // Probe getUserMedia before each retry to nudge iOS session transition
          if (navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
              .then(stream => {
                stream.getTracks().forEach(t => t.stop())
                console.log(`[WT] retry ${sttRetryCountRef.current}: getUserMedia probe OK`)
                startListeningRef.current?.()
              })
              .catch(err => {
                console.warn(`[WT] retry ${sttRetryCountRef.current}: getUserMedia failed (${err.name}) — trying directly`)
                startListeningRef.current?.()
              })
          } else {
            startListeningRef.current?.()
          }
        }, RETRY_DELAY_MS)
        return
      }

      // Non-retriable error or max retries reached
      sttRetryCountRef.current = 0
      setIsListening(false)
      setIsMicPreparing(false)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[WT] onerror:', event.error, `(${msSinceStart}ms)`, '(unexpected)')
      } else {
        console.log('[WT] onerror:', event.error, `(${msSinceStart}ms)`, isSessionConflict ? '— max retries reached' : '(ignorable)')
      }
    }

    console.log('[WT] recognition.start() called')
    recognition.start()
    setIsListening(true)
  }, [onTranscriptReady])

  // Keep ref in sync so retry callbacks always call the latest version
  useEffect(() => { startListeningRef.current = startListening }, [startListening])

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
        lastTTSEndTimeRef.current = Date.now()
        console.log('[WT] TTS audio ended naturally — stamped lastTTSEndTime')
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
    cancelRetry()
    sttRetryCountRef.current = 0
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
    setIsListening(false)
    setIsMicPreparing(false)
  }, [cancelRetry])

  const toggleWalkieTalkieMode = useCallback(() => {
    setIsWalkieTalkieMode(prev => {
      if (prev) {
        cancelRetry()
        sttRetryCountRef.current = 0
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (_) {}
        }
        stopAudio()
        if (nextTTSAudioRef.current) {
          nextTTSAudioRef.current.pause()
          nextTTSAudioRef.current = null
        }
        setIsListening(false)
        setIsSpeaking(false)
        setIsMicPreparing(false)
        setTranscript('')
        isModeRef.current = false
      } else {
        isModeRef.current = true
      }
      return !prev
    })
  }, [stopAudio, cancelRetry])

  // Called directly from the mic button click — this IS a synchronous user gesture.
  // We pre-create and activate a fresh Audio element here so speak() can use it
  // asynchronously after the TTS fetch, bypassing iOS's user-gesture requirement.
  const startListeningFromGesture = useCallback(() => {
    // Interrupt any in-progress TTS (barge-in support)
    stopAudio()
    setIsSpeaking(false)

    // Cancel any pending retry from a previous attempt
    cancelRetry()
    sttRetryCountRef.current = 0

    // Discard any stale pre-activated element from a previous tap
    if (nextTTSAudioRef.current) {
      nextTTSAudioRef.current.pause()
      nextTTSAudioRef.current = null
    }

    // Pre-activate a fresh Audio element for the upcoming TTS response.
    // MUST be synchronous in the user gesture — activates the element so
    // speak() can call play() on it asynchronously after the TTS fetch.
    const ttsAudio = new Audio()
    activateAudio(ttsAudio)
    nextTTSAudioRef.current = ttsAudio

    // Show listening UI immediately for instant tap feedback.
    setIsListening(true)
    setIsMicPreparing(false)

    // getUserMedia probe (stop immediately) to nudge iOS session transition.
    // If the session is still locked after TTS, the first recognition attempt
    // will get an 'aborted' error and the auto-retry loop kicks in.
    if (lastTTSEndTimeRef.current > 0 && navigator.mediaDevices?.getUserMedia) {
      const msSinceLastTTS = Date.now() - lastTTSEndTimeRef.current
      console.log(`[WT] mic tap — ${msSinceLastTTS}ms since last TTS — probing session`)
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          stream.getTracks().forEach(t => t.stop())
          if (isModeRef.current) startListening()
        })
        .catch(err => {
          console.warn('[WT] getUserMedia probe failed:', err.name, '— starting directly')
          if (isModeRef.current) startListening()
        })
    } else {
      console.log('[WT] mic tap — no prior TTS, starting recognition directly')
      startListening()
    }
  }, [startListening, stopAudio, cancelRetry])

  useEffect(() => {
    return () => {
      isModeRef.current = false
      cancelRetry()
      sttRetryCountRef.current = 0
      try { recognitionRef.current?.abort() } catch (_) {}
      stopAudio()
      if (nextTTSAudioRef.current) {
        nextTTSAudioRef.current.pause()
        nextTTSAudioRef.current = null
      }
    }
  }, [stopAudio, cancelRetry])

  return {
    isWalkieTalkieMode,
    isListening,
    isSpeaking,
    isMicPreparing,
    transcript,
    isSTTSupported,
    toggleWalkieTalkieMode,
    startListening: startListeningFromGesture,
    stopListening,
    speak,
  }
}
