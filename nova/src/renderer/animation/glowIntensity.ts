import type { AssistantState, AudioLevels } from '@shared/types'
import { personalityConfig } from '../config/personality.config'

/**
 * Pure functions that turn (audio levels + state + time) into glow numbers.
 * No React, no DOM — trivially unit-testable and reusable by canvas or CSS.
 */

export interface GlowOutput {
  /** 0..1 master intensity — multiply into opacity. */
  intensity: number
  /** Outer blur radius in px for the text/ring glow. */
  blur: number
  /** Overall element opacity, 0..1. */
  opacity: number
}

/** Slow idle sine used when there is no voice input. */
export function idlePulse(timeMs: number): number {
  const period = personalityConfig.idlePulseSpeed * 1000
  // 0..1, gentle breathing.
  return 0.5 + 0.5 * Math.sin((timeMs / period) * Math.PI * 2)
}

/**
 * Compute the glow for the current frame.
 *
 * @param levels  live audio measurements
 * @param state   current assistant state
 * @param timeMs  performance.now() timestamp for time-based idle pulsing
 */
export function computeGlow(
  levels: AudioLevels,
  state: AssistantState,
  timeMs: number
): GlowOutput {
  const idle = idlePulse(timeMs)

  let intensity: number
  switch (state) {
    case 'idle':
      // Dim ambient breath only.
      intensity = 0.25 + 0.15 * idle
      break
    case 'listening':
      // Dim, with a subtle shimmer riding on top of the idle pulse.
      intensity = 0.4 + 0.1 * idle + 0.2 * levels.volume
      break
    case 'speaking': {
      // Full reactive glow driven by smoothed volume.
      const reactive = personalityConfig.glowSensitivity * levels.volume
      intensity = 0.55 + 1.1 * reactive
      break
    }
    case 'thinking':
      // Steady, moderately bright pulse (faster than idle).
      intensity = 0.55 + 0.25 * (0.5 + 0.5 * Math.sin((timeMs / 700) * Math.PI))
      break
    case 'responding':
      // Bright and lively while NOVA "speaks".
      intensity = 0.7 + 0.25 * (0.5 + 0.5 * Math.sin((timeMs / 500) * Math.PI))
      break
    default:
      intensity = 0.3
  }

  intensity = clamp01(intensity)

  // Base blur ~18px, up to ~2x on peaks (spec: glow radius increases up to 2x).
  const blur = 18 + intensity * 34
  const opacity = 0.35 + 0.65 * intensity

  return { intensity, blur, opacity }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}
