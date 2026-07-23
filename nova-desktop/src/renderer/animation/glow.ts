import type { AssistantState, AudioLevels } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

/**
 * Pure functions that translate audio + state into visual parameters.
 * Keeping these side-effect free makes them trivial to unit-test and lets the
 * Ring/GlowText components stay declarative.
 */

export interface GlowParams {
  /** Overall glow intensity, 0–1. */
  intensity: number
  /** Blur radius in px for the outer glow. */
  blur: number
  /** Opacity of glow/ring elements, 0–1. */
  opacity: number
}

/** Baseline opacity per state (before audio modulation). */
const STATE_BASE_OPACITY: Record<AssistantState, number> = {
  idle: 0.4,
  listening: 0.5,
  speaking: 0.7,
  thinking: 0.65,
  responding: 0.7
}

/**
 * Compute the glow parameters for the current frame.
 *
 * @param levels  Latest audio measurements.
 * @param state   Current assistant state.
 * @param cfg     Personality tuning.
 * @param time    Elapsed time in seconds (for idle sine breathing).
 */
export function computeGlow(
  levels: AudioLevels,
  state: AssistantState,
  cfg: PersonalityConfig,
  time: number
): GlowParams {
  const base = STATE_BASE_OPACITY[state]

  // Slow idle breathing: a gentle sine over `idlePulseSpeed` seconds.
  const idlePulse = 0.5 + 0.5 * Math.sin((time / cfg.idlePulseSpeed) * Math.PI * 2)

  let intensity: number
  switch (state) {
    case 'idle':
      intensity = 0.15 + idlePulse * 0.2
      break
    case 'listening':
      // Subtle shimmer layered on a dim base.
      intensity = 0.25 + idlePulse * 0.1 + levels.rms * 0.2
      break
    case 'thinking': {
      // Steady, faster pulse independent of the mic.
      const steady = 0.5 + 0.5 * Math.sin((time / 1.2) * Math.PI * 2)
      intensity = 0.4 + steady * 0.35
      break
    }
    case 'responding': {
      // Flowing pulse, brighter than thinking.
      const flow = 0.5 + 0.5 * Math.sin((time / 0.9) * Math.PI * 2)
      intensity = 0.5 + flow * 0.4
      break
    }
    case 'speaking':
    default:
      // Voice-reactive: RMS drives the glow, sensitivity-scaled.
      intensity = Math.min(1, 0.3 + levels.rms * cfg.glowSensitivity * 2.2)
      break
  }

  // Glow radius grows up to ~2x with intensity.
  const blur = 12 + intensity * 48
  const opacity = Math.min(1, base + intensity * 0.5)

  return { intensity, blur, opacity }
}

/**
 * Compute the ring scale for the current frame.
 * Baseline is 1.0; syllable peaks kick it toward `peakScale`, and sustained
 * volume adds a small steady swell. The caller feeds this into a Framer
 * Motion spring so the spring physics provide the natural "breathing" recoil.
 */
export function computeTargetScale(
  levels: AudioLevels,
  state: AssistantState,
  cfg: PersonalityConfig
): number {
  if (state === 'idle') return 1
  const swell = levels.rms * cfg.pulseSensitivity * 0.05
  const kick = levels.peak ? 0.08 * cfg.pulseSensitivity + 0.02 : 0
  return 1 + swell + kick
}
