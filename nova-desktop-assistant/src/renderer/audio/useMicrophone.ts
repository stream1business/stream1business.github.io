import { useCallback, useEffect, useRef } from 'react'
import { NovaAnalyser } from './analyser'
import { useNovaStore } from '@renderer/state/store'
import type { AssistantState } from '@shared/types'

/**
 * Owns the microphone lifecycle: permission request, `AudioContext`, the
 * analysis RAF loop, and driving the state machine from what it hears.
 *
 * Future voice pipeline hook point — the `MediaStream` captured here is the
 * single source that a speech-to-text service (e.g. Whisper) would consume.
 * Because analysis is isolated in `NovaAnalyser`, wiring STT means tee-ing the
 * same `stream` to another node; none of the animation code changes.
 */
export function useMicrophone(): {
  start: () => Promise<void>
  stop: () => void
} {
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<NovaAnalyser | null>(null)
  // Frames the raw volume has stayed below the speech floor — used to fall
  // back from `speaking` to `listening` without chattering.
  const silentFramesRef = useRef(0)

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void contextRef.current?.close()
    contextRef.current = null
    analyserRef.current = null

    const { setMicActive, setAssistantState, setAudioLevels } = useNovaStore.getState()
    setAudioLevels({ volume: 0, rawVolume: 0, peak: false, bands: { low: 0, mid: 0, high: 0 } })
    setMicActive(false)
    setAssistantState('idle')
  }, [])

  const start = useCallback(async () => {
    if (streamRef.current) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    streamRef.current = stream

    const context = new AudioContext()
    contextRef.current = context
    const source = context.createMediaStreamSource(stream)

    const { settings } = useNovaStore.getState()
    const analyser = new NovaAnalyser(context, source, {
      smoothingFactor: settings.smoothingFactor,
      onsetThreshold: settings.onsetThreshold
    })
    analyserRef.current = analyser

    useNovaStore.getState().setMicActive(true)
    useNovaStore.getState().setAssistantState('listening')

    const SPEECH_FLOOR = 0.12
    const SILENCE_HANGOVER = 30 // ~0.5s at 60fps before dropping to listening

    const loop = (): void => {
      const a = analyserRef.current
      if (!a) return
      // Keep analyser options live with any settings changes.
      const s = useNovaStore.getState()
      a.updateOptions({
        smoothingFactor: s.settings.smoothingFactor,
        onsetThreshold: s.settings.onsetThreshold
      })

      const levels = a.sample()
      s.setAudioLevels(levels)

      // Only auto-drive between the mic-listening states. `thinking` and
      // `responding` are owned by the assistant flow, so don't stomp them.
      const current = s.assistantState
      if (current === 'listening' || current === 'speaking') {
        if (levels.rawVolume > SPEECH_FLOOR) {
          silentFramesRef.current = 0
          if (current !== 'speaking') s.setAssistantState('speaking' as AssistantState)
        } else {
          silentFramesRef.current += 1
          if (current === 'speaking' && silentFramesRef.current > SILENCE_HANGOVER) {
            s.setAssistantState('listening' as AssistantState)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // Clean up on unmount.
  useEffect(() => stop, [stop])

  return { start, stop }
}
