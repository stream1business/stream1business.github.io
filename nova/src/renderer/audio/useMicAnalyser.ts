import { useEffect, useRef } from 'react'
import { AudioService } from './audioService'
import { useNovaStore, novaSnapshot } from '@renderer/state/store'
import type { AssistantState } from '@shared/types'

/**
 * Drives the audio analysis loop and pushes results into the store.
 *
 * Responsibilities:
 *  - starts/stops the {@link AudioService} in response to `settings.micEnabled`
 *  - runs a single requestAnimationFrame loop that samples the mic and writes
 *    `audioLevels` into the store every frame
 *  - derives the coarse assistant state from the audio (listening ↔ speaking).
 *    `thinking` / `responding` are set explicitly elsewhere (e.g. by the
 *    assistant service) and are left untouched here.
 *
 * The animation/render layer only ever reads the store, so swapping in a real
 * voice pipeline later means changing this hook — not the visuals.
 */
export function useMicAnalyser(): void {
  const micEnabled = useNovaStore((s) => s.settings.micEnabled)
  const serviceRef = useRef<AudioService | null>(null)
  const rafRef = useRef<number | null>(null)
  // How long since we last heard speech, for the listening⇄speaking hysteresis.
  const silenceFramesRef = useRef(0)

  // Keep audio options in sync with the personality config live.
  const smoothingFactor = useNovaStore((s) => s.personality.smoothingFactor)
  const onsetSensitivity = useNovaStore((s) => s.personality.onsetSensitivity)

  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new AudioService({ smoothingFactor, onsetSensitivity })
    } else {
      serviceRef.current.updateOptions({ smoothingFactor, onsetSensitivity })
    }
  }, [smoothingFactor, onsetSensitivity])

  useEffect(() => {
    const service = serviceRef.current!
    let cancelled = false

    const setAudioLevels = useNovaStore.getState().setAudioLevels
    const setAssistantState = useNovaStore.getState().setAssistantState

    const SPEAK_THRESHOLD = 0.14
    const SILENCE_HANGOVER = 45 // frames (~0.75s at 60fps) before dropping to listening

    const loop = (): void => {
      if (cancelled) return
      const levels = service.sample()
      setAudioLevels(levels)

      // Only arbitrate between listening/speaking here; never override the
      // explicit thinking/responding states set by the assistant pipeline.
      const current: AssistantState = novaSnapshot().assistantState
      if (current === 'listening' || current === 'speaking') {
        if (levels.smoothedVolume > SPEAK_THRESHOLD) {
          silenceFramesRef.current = 0
          if (current !== 'speaking') setAssistantState('speaking')
        } else {
          silenceFramesRef.current += 1
          if (current !== 'listening' && silenceFramesRef.current > SILENCE_HANGOVER) {
            setAssistantState('listening')
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    const enable = async (): Promise<void> => {
      try {
        await service.start()
        if (cancelled) {
          await service.stop()
          return
        }
        setAssistantState('listening')
        rafRef.current = requestAnimationFrame(loop)
      } catch (err) {
        console.error('[NOVA] Microphone unavailable:', err)
        useNovaStore.getState().updateSettings({ micEnabled: false })
        setAssistantState('idle')
      }
    }

    const disable = async (): Promise<void> => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      await service.stop()
      // Keep the visual decay-to-idle loop alive briefly so the glow settles.
      setAssistantState('idle')
      const settle = (): void => {
        if (cancelled || service.active) return
        setAudioLevels(service.sample())
        if (novaSnapshot().audioLevels.smoothedVolume > 0.01) {
          requestAnimationFrame(settle)
        }
      }
      requestAnimationFrame(settle)
    }

    if (micEnabled) void enable()
    else void disable()

    return () => {
      cancelled = true
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [micEnabled])

  // Final unmount cleanup — fully release the mic.
  useEffect(() => {
    return () => {
      void serviceRef.current?.stop()
    }
  }, [])
}
