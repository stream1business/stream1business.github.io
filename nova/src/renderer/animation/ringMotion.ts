import type { AssistantState, AudioLevels } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

/**
 * Ring motion helpers.
 *
 * Rotation and scale are kept as independent quantities so they can be tuned —
 * and applied as separate CSS transforms — without interfering with each other.
 */

/** Degrees-per-second of clockwise rotation for the current state. */
export function rotationSpeed(
  state: AssistantState,
  config: PersonalityConfig
): number {
  const baseDegPerSec = 360 / config.baseRotationSpeed
  switch (state) {
    case 'speaking':
    case 'responding':
      return baseDegPerSec * config.activeRotationMultiplier
    case 'thinking':
      // Uniform speed-up while processing.
      return baseDegPerSec * (config.activeRotationMultiplier + 0.4)
    default:
      return baseDegPerSec
  }
}

/**
 * Target scale for the ring given the current audio.
 *
 * The baseline is 1.0. Detected onsets (syllable peaks) briefly push the scale
 * toward ~1.08; sustained volume adds a gentle swell. A spring (applied in the
 * component via Framer Motion) turns these targets into natural bounce-back.
 */
export function pulseScale(
  state: AssistantState,
  audio: AudioLevels,
  config: PersonalityConfig
): number {
  const MAX_PULSE = 0.08 // +8%
  switch (state) {
    case 'speaking': {
      const swell = audio.smoothedVolume * config.pulseSensitivity
      const onset = audio.peak ? 1 : 0
      return 1 + MAX_PULSE * Math.min(1, swell + onset)
    }
    case 'responding':
      return 1 + MAX_PULSE * 0.35 * (0.6 + audio.smoothedVolume)
    case 'listening':
      return 1 + MAX_PULSE * 0.1 * audio.smoothedVolume
    default:
      return 1
  }
}

/** Spring config per state, so the "breathing" feel can differ by mode. */
export function pulseSpring(state: AssistantState): {
  stiffness: number
  damping: number
  mass: number
} {
  switch (state) {
    case 'speaking':
      return { stiffness: 320, damping: 18, mass: 0.6 }
    case 'responding':
      return { stiffness: 180, damping: 20, mass: 0.8 }
    default:
      return { stiffness: 120, damping: 22, mass: 1 }
  }
}
