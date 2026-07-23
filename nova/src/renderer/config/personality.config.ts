/**
 * Personality / behavior tuning for NOVA.
 *
 * These values are intentionally decoupled from the animation code so behavior
 * can be re-tuned without touching a single component. Add new fields here and
 * read them from the animation calculators in /animation.
 */
export interface PersonalityConfig {
  name: string
  /** Seconds per revolution while idle. */
  baseRotationSpeed: number
  /** Rotation speed multiplier applied while actively speaking / thinking. */
  activeRotationMultiplier: number
  /** 0-1 — how strongly volume affects ring scale (pulse). */
  pulseSensitivity: number
  /** 0-1 — how strongly volume affects glow intensity. */
  glowSensitivity: number
  /** Seconds per idle breathing cycle. */
  idlePulseSpeed: number
  /** Theme id (see themes.ts). */
  colorTheme: string
  /** Exponential-moving-average smoothing factor for the audio signal, 0-1. */
  smoothingFactor: number
  /** Threshold (0-1) above the running average that counts as a speech onset. */
  onsetThreshold: number
  /** Maximum extra scale applied on a pulse peak (e.g. 0.08 => up to 108%). */
  maxPulseScale: number
}

export const personalityConfig: PersonalityConfig = {
  name: 'NOVA',
  baseRotationSpeed: 20,
  activeRotationMultiplier: 1.4,
  pulseSensitivity: 0.6,
  glowSensitivity: 0.8,
  idlePulseSpeed: 4,
  colorTheme: 'novaDefault',
  smoothingFactor: 0.15,
  onsetThreshold: 0.06,
  maxPulseScale: 0.08
}
