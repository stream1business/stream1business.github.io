import type { AssistantState, AudioLevels } from '@shared/types'
import { personalityConfig } from '../config/personality.config'

/**
 * Ring rotation + pulse maths, kept separate from glow so rotation (rotate)
 * and pulse (scale) can be tuned — and composed as independent transforms —
 * without interfering with one another.
 */

/** Degrees-per-second baseline spin (clockwise). */
export function baseRotationDegPerSec(): number {
  return 360 / personalityConfig.baseRotationSpeed
}

/**
 * Rotation speed for the current state. Speaking & thinking spin faster.
 */
export function rotationDegPerSec(state: AssistantState): number {
  const base = baseRotationDegPerSec()
  switch (state) {
    case 'speaking':
    case 'thinking':
    case 'responding':
      return base * personalityConfig.activeRotationMultiplier
    default:
      return base
  }
}

/**
 * Target scale for the ring given the current volume/onset. A detected onset
 * (syllable peak) pushes the target toward the max; Framer Motion's spring is
 * what gives the springy "breathing" recoil back to 1.0.
 */
export function pulseTargetScale(levels: AudioLevels, state: AssistantState): number {
  if (state !== 'speaking' && state !== 'responding') return 1

  const { pulseSensitivity, maxPulseScale } = personalityConfig
  const volumeComponent = pulseSensitivity * levels.volume
  const onsetKick = levels.onset ? 1 : 0.35
  const extra = maxPulseScale * onsetKick * (0.4 + 0.6 * volumeComponent)
  return 1 + clamp(extra, 0, maxPulseScale)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
