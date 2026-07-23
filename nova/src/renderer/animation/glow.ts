import type { AssistantState, AudioLevels } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

/** A resolved set of glow values the renderer/text can consume directly. */
export interface GlowValues {
  /** Overall glow intensity, 0..1. */
  intensity: number
  /** Outer blur radius in px for text/ring glow. */
  blur: number
  /** Opacity of the outer glow layer, 0..1. */
  opacity: number
  /** Ring stroke brightness multiplier, ~0.4..1. */
  brightness: number
}

const IDLE_INTENSITY = 0.4

/**
 * Compute glow values from the current audio + state.
 *
 * Silence settles to a low idle pulse (slow sine). Active speech drives the
 * glow up to ~2x radius. The result is deterministic given its inputs, so it's
 * cheap to call every frame.
 *
 * @param time   monotonically increasing seconds (for the idle sine)
 */
export function computeGlow(
  state: AssistantState,
  audio: AudioLevels,
  config: PersonalityConfig,
  glowMaster: number,
  time: number
): GlowValues {
  // Slow ambient breathing used whenever there's little/no voice energy.
  const idlePhase = (time / config.idlePulseSpeed) * Math.PI * 2
  const idlePulse = (Math.sin(idlePhase) + 1) / 2 // 0..1

  let intensity: number

  switch (state) {
    case 'idle':
      intensity = IDLE_INTENSITY * (0.7 + 0.3 * idlePulse)
      break

    case 'listening':
      // Dim, with a subtle shimmer layered on the idle pulse.
      intensity = IDLE_INTENSITY * (0.8 + 0.2 * idlePulse) + audio.smoothedVolume * 0.2
      break

    case 'speaking': {
      // Full reactive glow driven by smoothed volume.
      const voice = audio.smoothedVolume * config.glowSensitivity
      intensity = Math.min(1, IDLE_INTENSITY + voice * 1.5)
      break
    }

    case 'thinking': {
      // Steady, confident pulse — faster than idle, independent of mic.
      const think = (Math.sin(time * 2.4) + 1) / 2
      intensity = 0.55 + 0.3 * think
      break
    }

    case 'responding': {
      // Bright, lively — voice-reactive if playback audio is wired in later.
      const flow = (Math.sin(time * 3.2) + 1) / 2
      intensity = Math.min(1, 0.65 + 0.25 * flow + audio.smoothedVolume * 0.4)
      break
    }

    default:
      intensity = IDLE_INTENSITY
  }

  intensity = Math.max(0, Math.min(1, intensity * glowMaster))

  // Map intensity → concrete visual params. Blur scales up to ~2x at peak.
  const blur = 14 + intensity * 46 // 14..60px
  const opacity = 0.25 + intensity * 0.65 // 0.25..0.9
  const brightness = 0.4 + intensity * 0.6 // 0.4..1

  return { intensity, blur, opacity, brightness }
}
