import { useCallback, useEffect, useRef, useState } from 'react'
import type { AssistantState } from '@shared/types'
import { useNovaStore } from '../state/store'
import { audioService } from './audioService'

/**
 * React hook that wires the AudioService into the store and derives the
 * user-driven assistant states (`listening` / `speaking`) from live audio.
 *
 * It intentionally does NOT own the `thinking` / `responding` states — those
 * are driven by the assistant service — so the audio layer and the response
 * pipeline stay independent.
 */
export function useMicAnalyser(): {
  micActive: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => void
  toggle: () => Promise<void>
} {
  const setAudioLevels = useNovaStore((s) => s.setAudioLevels)
  const setMicActive = useNovaStore((s) => s.setMicActive)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const assistantState = useNovaStore((s) => s.assistantState)
  const micActive = useNovaStore((s) => s.micActive)

  const [error, setError] = useState<string | null>(null)
  // Track the last time we heard speech so we can fall back to "listening".
  const lastSpeechAt = useRef(0)
  const stateRef = useRef<AssistantState>(assistantState)
  stateRef.current = assistantState

  const start = useCallback(async () => {
    setError(null)
    try {
      await audioService.start((levels) => {
        setAudioLevels(levels)

        // Only the audio layer arbitrates listening <-> speaking. It must not
        // clobber assistant-owned states (thinking / responding).
        const owned = stateRef.current === 'listening' || stateRef.current === 'speaking'
        if (!owned) return

        const speaking = levels.volume > 0.04 || levels.onset
        const now = performance.now()
        if (speaking) {
          lastSpeechAt.current = now
          if (stateRef.current !== 'speaking') setAssistantState('speaking')
        } else if (now - lastSpeechAt.current > 600 && stateRef.current !== 'listening') {
          setAssistantState('listening')
        }
      })
      setMicActive(true)
      setAssistantState('listening')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Microphone access was denied.'
      setError(message)
      setMicActive(false)
    }
  }, [setAudioLevels, setMicActive, setAssistantState])

  const stop = useCallback(() => {
    audioService.stop()
    setMicActive(false)
    setAudioLevels({ volume: 0, rawVolume: 0, onset: false, brightness: 0 })
    if (stateRef.current === 'listening' || stateRef.current === 'speaking') {
      setAssistantState('idle')
    }
  }, [setAudioLevels, setMicActive, setAssistantState])

  const toggle = useCallback(async () => {
    if (audioService.isActive) stop()
    else await start()
  }, [start, stop])

  // Clean up the mic when the component tree unmounts.
  useEffect(() => {
    return () => {
      if (audioService.isActive) audioService.stop()
    }
  }, [])

  return { micActive, error, start, stop, toggle }
}
