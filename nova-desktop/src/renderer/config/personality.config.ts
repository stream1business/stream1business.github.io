/**
 * Personality / behaviour tuning for NOVA.
 *
 * These values are intentionally decoupled from the animation code so the
 * "feel" of the assistant can be tuned without touching the render layer.
 * A future settings panel can persist overrides on top of these defaults.
 */
export interface PersonalityConfig {
  /** Display name shown in the centre of the orb. */
  name: string
  /** Seconds per full revolution while idle. */
  baseRotationSpeed: number
  /** Multiplier applied to rotation speed while actively speaking. */
  activeRotationMultiplier: number
  /** Multiplier applied to rotation speed while thinking. */
  thinkingRotationMultiplier: number
  /** 0–1: how strongly volume affects the ring's scale. */
  pulseSensitivity: number
  /** 0–1: how strongly volume affects glow intensity. */
  glowSensitivity: number
  /** Seconds per idle breathing cycle. */
  idlePulseSpeed: number
  /** Active theme key (see themes.ts). Swappable for future skins. */
  colorTheme: string
  /** Exponential-moving-average factor for smoothing the audio signal (0–1). */
  smoothingFactor: number
  /**
   * Onset sensitivity: how much the raw RMS must exceed the smoothed RMS
   * (as a fraction) to register a syllable "peak". Lower = more sensitive.
   */
  peakThreshold: number
}

export const personalityConfig: PersonalityConfig = {
  name: 'NOVA',
  baseRotationSpeed: 20,
  activeRotationMultiplier: 1.4,
  thinkingRotationMultiplier: 2.2,
  pulseSensitivity: 0.6,
  glowSensitivity: 0.8,
  idlePulseSpeed: 4,
  colorTheme: 'novaDefault',
  smoothingFactor: 0.15,
  peakThreshold: 0.35
}
