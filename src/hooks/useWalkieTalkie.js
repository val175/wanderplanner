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
  // Timestamp of when the last TTS audio ended — used to enforce iOS cooldown
  const lastTTSEndTimeRef = useRef(0)
  // Pending handle for a delayed recognition.start() post-TTS
  const listenerDelayTimeoutRef = useRef(null)

  useEffect(() => { isModeRef.current = isWalkieTalkieMode }, [isWalkieTalkieMode])

  const stopAudio = useCallback(() => {
    if (playbackRef.current) {
      playbackRef.current.onended = null
      playbackRef.current.onerror = null
      playbackRef.current.pause()
      playbackRef.current = null
    }
  }, [])

  // probeStream: a live MediaStream from getUserMedia — kept open to hold the iOS
  // audio session in PlayAndRecord mode for the duration of recognition. Stopped
  // in onend/onerror so the session isn't released before speech capture finishes.
  const startListening = useCallback((probeStream = null) => {
    if (!isSTTSupported || !isModeRef.current) {
      console.log('[WT] startListening blocked — isSTTSupported:', isSTTSupported, 'isModeRef:', isModeRef.current)
      if (probeStream) probeStream.getTracks().forEach(t => t.stop())
      return
    }

    const releaseProbe = () => {
      if (probeStream) {
        probeStream.getTracks().forEach(t => t.stop())
        console.log('[WT] probe stream released')
      }
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
      releaseProbe()
      const final = finalTranscriptRef.current.trim()
      console.log('[WT] onend — final transcript:', final ? `"${final}"` : '(empty)')
      setIsListening(false)
      if (!isModeRef.current) return
      if (final) {
        setTranscript('')
        onTranscriptReady(final)
      }
    }

    recognition.onerror = (event) => {
      clearWatchdog()
      releaseProbe()
      const msSinceStart = Date.now() - startedAt
      if (event.error === 'aborted' && msSinceStart < 500) {
        console.warn(`[WT] onerror: aborted ${msSinceStart}ms after start — iOS audio session still locked`)
      } else {
        const ignorable = event.error === 'no-speech' || event.error === 'aborted'
        console.warn('[WT] onerror:', event.error, `(${msSinceStart}ms after start)`, ignorable ? '(ignorable)' : '(unexpected)')
      }
      setIsListening(false)
    }

    console.log('[WT] recognition.start() called')
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
    if (listenerDelayTimeoutRef.current) {
      if (typeof listenerDelayTimeoutRef.current === 'object') {
        listenerDelayTimeoutRef.current.cancel()
      } else {
        clearTimeout(listenerDelayTimeoutRef.current)
      }
      listenerDelayTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (_) {}
    }
  }, [])

  const toggleWalkieTalkieMode = useCallback(() => {
    setIsWalkieTalkieMode(prev => {
      if (prev) {
        if (listenerDelayTimeoutRef.current) {
          if (typeof listenerDelayTimeoutRef.current === 'object') {
            listenerDelayTimeoutRef.current.cancel()
          } else {
            clearTimeout(listenerDelayTimeoutRef.current)
          }
          listenerDelayTimeoutRef.current = null
        }
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

    // Cancel any previously scheduled delayed start or in-flight getUserMedia probe
    if (listenerDelayTimeoutRef.current) {
      if (typeof listenerDelayTimeoutRef.current === 'object') {
        listenerDelayTimeoutRef.current.cancel()
      } else {
        clearTimeout(listenerDelayTimeoutRef.current)
      }
      listenerDelayTimeoutRef.current = null
    }

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

    // stream arg: pass live probe stream through so startListening keeps it open
    const kickoff = (stream = null) => { if (isModeRef.current) startListening(stream) }

    // After TTS playback, iOS holds the AVAudioSession in Playback mode during
    // deactivation. recognition.start() during this window gets immediately aborted
    // (onerror: 'aborted' within <500ms). getUserMedia({ audio: true }) explicitly
    // requests PlayAndRecord mode, forcing iOS to complete the session transition
    // before we call recognition.start(). On iOS with mic permission already granted,
    // getUserMedia does NOT require a user gesture.
    // IMPORTANT: the stream is passed into startListening and kept alive until
    // recognition ends — stopping it immediately would release the session and
    // cause a deferred abort (seen as onerror: aborted ~4s into recognition).
    if (lastTTSEndTimeRef.current > 0 && navigator.mediaDevices?.getUserMedia) {
      const msSinceLastTTS = Date.now() - lastTTSEndTimeRef.current
      console.log(`[WT] mic tap — ${msSinceLastTTS}ms since last TTS — using getUserMedia probe to force audio session transition`)
      // Use listenerDelayTimeoutRef as a "probe in flight" sentinel so that if the
      // user taps again while the probe is pending, the previous probe's kickoff
      // is cancelled before we fire a new one.
      let cancelled = false
      listenerDelayTimeoutRef.current = { cancel: () => { cancelled = true } }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); console.log('[WT] getUserMedia probe superseded — stream released'); return }
          listenerDelayTimeoutRef.current = null
          console.log('[WT] getUserMedia probe OK — passing live stream to recognition')
          kickoff(stream)
        })
        .catch(err => {
          if (cancelled) return
          listenerDelayTimeoutRef.current = null
          console.warn('[WT] getUserMedia probe failed:', err.name, '— trying recognition directly')
          kickoff(null)
        })
    } else {
      console.log('[WT] mic tap — no prior TTS, starting recognition directly')
      kickoff(null)
    }
  }, [startListening, stopAudio])

  useEffect(() => {
    return () => {
      isModeRef.current = false
      if (listenerDelayTimeoutRef.current) {
        if (typeof listenerDelayTimeoutRef.current === 'object') {
          listenerDelayTimeoutRef.current.cancel()
        } else {
          clearTimeout(listenerDelayTimeoutRef.current)
        }
        listenerDelayTimeoutRef.current = null
      }
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
