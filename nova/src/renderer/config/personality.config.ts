/**
 * Personality / behavior configuration for NOVA.
 *
 * All tunable animation and reactivity parameters live here so behavior can be
 * adjusted without touching the animation or rendering code. New "personas" can
 * be created by cloning this object and swapping values.
 */
export interface PersonalityConfig {
  /** Display name rendered in the orb. */
  name: string
  /** Seconds per full revolution while idle. */
  baseRotationSpeed: number
  /** Rotation speed multiplier applied while actively speaking/responding. */
  activeRotationMultiplier: number
  /** 0..1 — how strongly volume affects the ring scale (pulse). */
  pulseSensitivity: number
  /** 0..1 — how strongly volume affects glow radius/opacity. */
  glowSensitivity: number
  /** Seconds per idle breathing cycle (slow sine). */
  idlePulseSpeed: number
  /** Active color theme key (see theme.config.ts). */
  colorTheme: string
  /** Exponential moving-average smoothing factor for the audio signal (0..1). */
  smoothingFactor: number
  /**
   * Onset sensitivity for syllable/peak detection (0..1). Higher = more
   * sensitive, firing pulses on smaller amplitude jumps.
   */
  onsetSensitivity: number
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
  onsetSensitivity: 0.5
}
