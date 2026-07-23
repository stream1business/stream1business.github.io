/**
 * Swappable colour + type themes ("skins") for NOVA.
 *
 * Themes are plain data so new skins can be dropped in as TS/JSON without any
 * change to the rendering components. The active theme is selected by
 * `personalityConfig.colorTheme`.
 */
export interface NovaTheme {
  id: string
  label: string
  /** Cool edge of the ring gradient. */
  coolEdge: string
  /** Warm edge of the ring gradient. */
  warmEdge: string
  /** Deep braid-shadow colour. */
  deepShadow: string
  /** White-hot glow core. */
  glowCore: string
  /** Outer glow tint the core fades into. */
  glowEdge: string
  /** Particle colour (opacity is varied at draw time). */
  particle: string
  /** Angle, in degrees, of the text fill gradient. */
  textGradientAngle: number
  /** Display font stack for the wordmark. */
  fontFamily: string
}

export const themes: Record<string, NovaTheme> = {
  novaDefault: {
    id: 'novaDefault',
    label: 'Nova Default',
    coolEdge: '#2DE1C2',
    warmEdge: '#8A4FFF',
    deepShadow: '#120826',
    glowCore: '#FFFFFF',
    glowEdge: '#B58CFF',
    particle: '#FFFFFF',
    textGradientAngle: 135,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif"
  },
  ember: {
    id: 'ember',
    label: 'Ember',
    coolEdge: '#FFB347',
    warmEdge: '#FF4E6A',
    deepShadow: '#26060C',
    glowCore: '#FFFFFF',
    glowEdge: '#FF9E7A',
    particle: '#FFE8D6',
    textGradientAngle: 135,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif"
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    coolEdge: '#4FF0B0',
    warmEdge: '#3A8DFF',
    deepShadow: '#04160F',
    glowCore: '#FFFFFF',
    glowEdge: '#8CE0FF',
    particle: '#EAFFF6',
    textGradientAngle: 120,
    fontFamily: "'Orbitron', 'Michroma', 'Rajdhani', sans-serif"
  }
}

export function getTheme(id: string): NovaTheme {
  return themes[id] ?? themes.novaDefault
}
