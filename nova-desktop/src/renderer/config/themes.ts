/**
 * Theming system for NOVA.
 *
 * Colours and typography live here rather than in components so new "skins"
 * can be added as additional entries in the `themes` map (or loaded from
 * JSON at runtime) without touching the render layer.
 */
export interface NovaTheme {
  key: string
  label: string
  /** Cool edge of the ring gradient. */
  coolEdge: string
  /** Warm edge of the ring gradient. */
  warmEdge: string
  /** Deep shadow used in braid/strand shading. */
  deepShadow: string
  /** White-hot core of the text/ring glow. */
  glowCore: string
  /** Outer, cooler tail of the glow. */
  glowEdge: string
  /** Particle base colour. */
  particle: string
  /** Angle (deg) of the text fill gradient. */
  textGradientAngle: number
  /** Display font stack. */
  fontFamily: string
  /** Letter spacing for the wordmark. */
  letterSpacing: string
}

export const themes: Record<string, NovaTheme> = {
  novaDefault: {
    key: 'novaDefault',
    label: 'NOVA Default',
    coolEdge: '#2DE1C2',
    warmEdge: '#8A4FFF',
    deepShadow: '#120826',
    glowCore: '#FFFFFF',
    glowEdge: '#B58CFF',
    particle: '#FFFFFF',
    textGradientAngle: 135,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif",
    letterSpacing: '0.15em'
  },
  emberForge: {
    key: 'emberForge',
    label: 'Ember Forge',
    coolEdge: '#FFB347',
    warmEdge: '#FF3D6E',
    deepShadow: '#260812',
    glowCore: '#FFFFFF',
    glowEdge: '#FFB199',
    particle: '#FFE9D6',
    textGradientAngle: 135,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif",
    letterSpacing: '0.15em'
  },
  arcticPulse: {
    key: 'arcticPulse',
    label: 'Arctic Pulse',
    coolEdge: '#7FE7FF',
    warmEdge: '#3A6BFF',
    deepShadow: '#04122B',
    glowCore: '#FFFFFF',
    glowEdge: '#9FD8FF',
    particle: '#EAF6FF',
    textGradientAngle: 135,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif",
    letterSpacing: '0.15em'
  }
}

export function getTheme(key: string): NovaTheme {
  return themes[key] ?? themes.novaDefault
}
