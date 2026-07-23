import { useEffect, useState } from 'react'
import { useNovaStore } from '../state/store'
import { computeGlow } from '../animation/glowIntensity'
import { personalityConfig } from '../config/personality.config'

/**
 * GlowText — the "NOVA" wordmark. Layered technique:
 *   1. base fill: the teal→violet gradient shows through the letterforms
 *   2. glass look: subtle inner shadow so the type reads as dark glass
 *   3. glow: an independently-animated outer blur that reacts to voice
 *
 * The glow layer is driven straight from the audio store on a rAF loop so it
 * tracks volume tightly, decoupled from the fill.
 */
interface GlowTextProps {
  size: number
}

export function GlowText({ size }: GlowTextProps): JSX.Element {
  const theme = useNovaStore((s) => s.theme)
  const [glow, setGlow] = useState({ blur: 18, opacity: 0.6 })

  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      const { audioLevels, assistantState } = useNovaStore.getState()
      const g = computeGlow(audioLevels, assistantState, performance.now())
      setGlow({ blur: g.blur, opacity: g.opacity })
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const fontSize = size * 0.19
  const gradient = `linear-gradient(135deg, ${theme.ringCool}, ${theme.ringWarm})`

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {/* Glow layer — sits behind, blurred, voice-reactive. */}
        <span
          aria-hidden
          className="absolute inset-0 font-display font-bold uppercase"
          style={{
            fontSize,
            letterSpacing: '0.15em',
            color: theme.glowCore,
            filter: `blur(${glow.blur * 0.4}px)`,
            opacity: glow.opacity,
            textShadow: `0 0 ${glow.blur}px ${theme.glowCore}, 0 0 ${glow.blur * 2}px ${theme.glowEdge}`
          }}
        >
          {personalityConfig.name}
        </span>

        {/* Fill layer — gradient clipped to the letterforms, dark-glass inner shadow. */}
        <span
          className="relative font-display font-bold uppercase"
          style={{
            fontSize,
            letterSpacing: '0.15em',
            backgroundImage: gradient,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            // Faint dark core so the type reads as glass over light.
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))'
          }}
        >
          {personalityConfig.name}
        </span>
      </div>
    </div>
  )
}
