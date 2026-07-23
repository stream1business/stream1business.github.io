import { useCallback, useEffect, useRef } from 'react'
import { AudioEngine } from './analyser'
import { useNovaStore } from '@renderer/state/store'
import type { AudioLevels } from '@shared/types'

/**
 * React hook that owns the microphone lifecycle and pumps {@link AudioLevels}
 * into the store on every animation frame.
 *
 * The hook derives a coarse state-machine transition from the audio itself
 * (silence → `listening`, voice → `speaking`) but only while NOVA isn't busy
 * `thinking` or `responding`, which are driven externally by the assistant
 * service. This keeps the state machine centralised and predictable.
 */
export function useMicrophone(): {
  enable: () => Promise<void>
  disable: () => Promise<void>
} {
  const engineRef = useRef<AudioEngine | null>(null)
  const rafRef = useRef<number | null>(null)
  const silenceFramesRef = useRef(0)

  const setAudioLevels = useNovaStore((s) => s.setAudioLevels)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const smoothingFactor = useNovaStore((s) => s.personality.smoothingFactor)
  const peakThreshold = useNovaStore((s) => s.personality.peakThreshold)

  // Keep the engine's tuning in sync with live personality edits.
  useEffect(() => {
    engineRef.current?.setOptions({ smoothingFactor, peakThreshold })
  }, [smoothingFactor, peakThreshold])

  const loop = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return

    const levels: AudioLevels = engine.sample()
    setAudioLevels(levels)

    // Voice-activity → coarse state transitions, but never override the
    // assistant-driven `thinking` / `responding` states.
    const current = useNovaStore.getState().assistantState
    if (current !== 'thinking' && current !== 'responding') {
      if (levels.rawRms > 0.08) {
        silenceFramesRef.current = 0
        if (current !== 'speaking') setAssistantState('speaking')
      } else {
        silenceFramesRef.current++
        // ~0.5s of quiet before dropping back to listening
        if (silenceFramesRef.current > 30 && current === 'speaking') {
          setAssistantState('listening')
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [setAudioLevels, setAssistantState])

  const enable = useCallback(async () => {
    if (engineRef.current?.isRunning) return
    const engine = new AudioEngine({ smoothingFactor, peakThreshold })
    engineRef.current = engine
    try {
      await engine.start()
      useNovaStore.getState().updateSettings({ micEnabled: true })
      setAssistantState('listening')
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      // Permission denied or no device — fall back to idle ambient pulse.
      console.error('[NOVA] microphone unavailable:', err)
      engineRef.current = null
      useNovaStore.getState().updateSettings({ micEnabled: false })
      setAssistantState('idle')
    }
  }, [loop, smoothingFactor, peakThreshold, setAssistantState])

  const disable = useCallback(async () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    await engineRef.current?.stop()
    engineRef.current = null
    useNovaStore.getState().updateSettings({ micEnabled: false })
    setAudioLevels({ rms: 0, rawRms: 0, peak: false, bands: { low: 0, mid: 0, high: 0 } })
    setAssistantState('idle')
  }, [setAudioLevels, setAssistantState])

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      void engineRef.current?.stop()
    }
  }, [])

  return { enable, disable }
}
