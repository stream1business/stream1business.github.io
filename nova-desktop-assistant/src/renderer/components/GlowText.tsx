import { useEffect, useState } from 'react'
import { useNovaStore } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'

/**
 * The "NOVA" wordmark in the centre of the orb.
 *
 * Rendered with a layered technique to get the reference's glassy-yet-glowing
 * look: a gradient text *fill* (via background-clip), plus an independently
 * animated outer glow driven by the audio-reactive glow value. The glow layer
 * lives behind the fill so light appears to bleed out from behind the type.
 */
export function GlowText(): JSX.Element {
  const theme = useNovaStore((s) => s.theme)
  const name = useNovaStore((s) => s.settings.name)
  const [glow, setGlow] = useState(0.4)
  const [blur, setBlur] = useState(14)

  // Sample glow on its own RAF loop (independent of the ring's fill animation).
  useEffect(() => {
    let raf = 0
    const tick = (t: number): void => {
      const { assistantState, audioLevels, settings } = useNovaStore.getState()
      const g = computeGlow(assistantState, audioLevels, settings, t)
      setGlow(g.intensity)
      setBlur(g.blur)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const gradient = `linear-gradient(${theme.textGradientAngle}deg, ${theme.coolEdge}, ${theme.warmEdge})`

  return (
    <div className="relative flex items-center justify-center pointer-events-none select-none">
      {/* Outer glow layer — sits behind the fill, blurred and animated. */}
      <span
        aria-hidden
        className="absolute font-display font-bold tracking-nova"
        style={{
          fontSize: 'clamp(2rem, 9vw, 5rem)',
          color: theme.glowCore,
          opacity: 0.25 + glow * 0.6,
          filter: `blur(${blur}px)`,
          textShadow: `0 0 ${blur}px ${theme.glowCore}, 0 0 ${blur * 2}px ${theme.glowEdge}`
        }}
      >
        {name}
      </span>

      {/* Glass gradient fill layer. */}
      <span
        className="relative font-display font-bold tracking-nova"
        style={{
          fontSize: 'clamp(2rem, 9vw, 5rem)',
          backgroundImage: gradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          // Inner shadow for the "glass on a surface" feel.
          filter: `drop-shadow(0 1px 1px ${theme.deepShadow}) drop-shadow(0 0 ${
            2 + glow * 6
          }px ${theme.glowEdge})`
        }}
      >
        {name}
      </span>
    </div>
  )
}
