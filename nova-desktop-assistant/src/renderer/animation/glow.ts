import type { AssistantState, AudioLevels } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

export interface GlowState {
  /** Overall glow intensity, 0..1 (drives blur radius + opacity). */
  intensity: number
  /** Blur radius in px for the outer text/ring glow. */
  blur: number
  /** Opacity multiplier for glow layers, 0..1. */
  opacity: number
}

/** Idle breathing curve: a slow sine between ~0.3 and ~0.5. */
export function idlePulse(timeMs: number, periodSeconds: number): number {
  const phase = (timeMs / 1000 / periodSeconds) * Math.PI * 2
  return 0.4 + Math.sin(phase) * 0.1
}

/**
 * Compute the glow for the current frame from state + audio.
 * Pure and deterministic given its inputs, so it's trivial to test and tune.
 */
export function computeGlow(
  state: AssistantState,
  audio: AudioLevels,
  cfg: PersonalityConfig,
  timeMs: number
): GlowState {
  let intensity: number

  switch (state) {
    case 'idle':
      intensity = idlePulse(timeMs, cfg.idlePulseSpeed)
      break
    case 'listening':
      // Dim, with a subtle shimmer riding on the idle breath.
      intensity = 0.4 * (0.85 + Math.sin(timeMs / 260) * 0.15)
      break
    case 'speaking':
      // Volume-reactive, blended over a listening floor.
      intensity = Math.min(1, 0.45 + audio.volume * cfg.glowSensitivity * 1.3)
      break
    case 'thinking':
      // Steady, brighter-than-idle pulse.
      intensity = 0.55 + Math.sin(timeMs / 1000 / (cfg.idlePulseSpeed / 2) * Math.PI * 2) * 0.12
      break
    case 'responding':
      // Bright and lively while NOVA "speaks".
      intensity = 0.7 + Math.sin(timeMs / 220) * 0.18
      break
  }

  intensity = Math.max(0, Math.min(1, intensity))

  // Active states may grow the glow radius up to ~2x the idle radius.
  const baseBlur = 14
  const maxExtra = state === 'speaking' || state === 'responding' ? baseBlur : baseBlur * 0.4
  return {
    intensity,
    blur: baseBlur + intensity * maxExtra,
    opacity: 0.4 + intensity * 0.6
  }
}
