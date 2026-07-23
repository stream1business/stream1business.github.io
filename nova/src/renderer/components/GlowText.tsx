import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNovaStore, novaSnapshot } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'

interface GlowTextProps {
  text: string
  size: number
}

/**
 * The "NOVA" wordmark: a gradient-filled, glass-like fill layered under an
 * independently-animated outer glow.
 *
 * The fill uses `background-clip: text` with the theme gradient. A separate
 * blurred, glowing copy sits behind it and is animated every frame from the
 * audio-driven glow model — so the fill stays crisp while the halo breathes.
 */
export function GlowText({ text, size }: GlowTextProps): JSX.Element {
  const theme = useNovaStore((s) => s.theme)
  const [glow, setGlow] = useState({ blur: 20, opacity: 0.5, intensity: 0.4 })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const tick = (now: number): void => {
      const elapsed = (now - start) / 1000
      const snap = novaSnapshot()
      const g = computeGlow(
        snap.assistantState,
        snap.audioLevels,
        snap.personality,
        snap.settings.glowMaster,
        elapsed
      )
      setGlow({ blur: g.blur, opacity: g.opacity, intensity: g.intensity })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const fontSize = size * 0.2
  const angle = theme.text.gradientAngle
  const fillGradient = `linear-gradient(${angle}deg, ${theme.text.gradient[0]}, ${theme.text.gradient[1]})`

  const baseStyle: React.CSSProperties = {
    fontSize,
    letterSpacing: '0.15em',
    fontWeight: 700,
    fontFamily: 'Orbitron, Michroma, Rajdhani, sans-serif',
    lineHeight: 1,
    userSelect: 'none',
    margin: 0,
    // Nudge for the letter-spacing on the last glyph so it stays centered.
    paddingLeft: '0.15em'
  }

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size, pointerEvents: 'none' }}
      aria-label={text}
    >
      {/* Outer glow layer — blurred, colored, animated independently. */}
      <motion.h1
        aria-hidden
        className="absolute"
        style={{
          ...baseStyle,
          color: theme.text.glowCore,
          filter: `blur(${glow.blur * 0.5}px)`,
          textShadow: [
            `0 0 ${glow.blur}px ${theme.text.glowCore}`,
            `0 0 ${glow.blur * 2}px ${theme.text.glowEdge}`,
            `0 0 ${glow.blur * 3.5}px ${theme.text.glowEdge}`
          ].join(', ')
        }}
        animate={{ opacity: glow.opacity }}
        transition={{ duration: 0.12, ease: 'linear' }}
      >
        {text}
      </motion.h1>

      {/* Glass fill layer — gradient clipped to the letterforms. */}
      <h1
        className="absolute"
        style={{
          ...baseStyle,
          backgroundImage: fillGradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          // Subtle inner "glass" shadow rimming the glyphs.
          filter: `drop-shadow(0 1px 1px rgba(0,0,0,0.6))`
        }}
      >
        {text}
      </h1>

      {/* Bright inner rim that tracks intensity for the "lit from behind" look. */}
      <h1
        aria-hidden
        className="absolute"
        style={{
          ...baseStyle,
          color: 'transparent',
          WebkitTextStroke: `0.6px ${theme.text.glowCore}`,
          opacity: 0.25 + glow.intensity * 0.5
        }}
      >
        {text}
      </h1>
    </div>
  )
}
