import type { AssistantState } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

/**
 * Rotation is kept separate from scale/glow so it can be tuned independently.
 * Returns the angular velocity in degrees-per-second for the current state.
 */
export function rotationSpeedDegPerSec(
  state: AssistantState,
  cfg: PersonalityConfig,
  rms: number
): number {
  const baseDegPerSec = 360 / cfg.baseRotationSpeed // e.g. 18°/s at 20s/rev

  switch (state) {
    case 'thinking':
      return baseDegPerSec * cfg.thinkingRotationMultiplier
    case 'responding':
      return baseDegPerSec * 1.6
    case 'speaking':
      // Speed nudges up with loudness, capped by the active multiplier.
      return baseDegPerSec * (1 + (cfg.activeRotationMultiplier - 1) * Math.min(1, rms * 2))
    case 'listening':
      return baseDegPerSec * 1.05
    case 'idle':
    default:
      return baseDegPerSec
  }
}
