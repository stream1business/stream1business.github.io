/**
 * Personality / behaviour tuning for NOVA.
 *
 * Everything the animation layer needs to feel a certain way is pulled from
 * this object rather than hardcoded in components, so behaviour can be tuned
 * (or later exposed in a settings UI) without touching rendering code.
 */
export interface PersonalityConfig {
  name: string
  /** Seconds per full ring revolution while idle. */
  baseRotationSpeed: number
  /** Rotation-speed multiplier applied while actively speaking. */
  activeRotationMultiplier: number
  /** Rotation-speed multiplier applied while thinking. */
  thinkingRotationMultiplier: number
  /** 0..1 — how strongly volume drives the ring's scale pulse. */
  pulseSensitivity: number
  /** 0..1 — how strongly volume drives glow blur + opacity. */
  glowSensitivity: number
  /** Seconds per idle "breathing" cycle. */
  idlePulseSpeed: number
  /** Which theme in theme.config.ts to render with. */
  colorTheme: string
  /** Exponential-moving-average factor for the audio signal, 0..1. */
  smoothingFactor: number
  /** Default orb diameter in CSS pixels (scalable via settings). */
  orbDiameter: number
  /** Raw-volume threshold above which onset detection can fire, 0..1. */
  onsetThreshold: number
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
  orbDiameter: 560,
  onsetThreshold: 0.18
}
