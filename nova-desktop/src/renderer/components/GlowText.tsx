import { motion } from 'framer-motion'
import { useNovaStore } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'
import { useEffect, useRef, useState } from 'react'

/**
 * The centred "NOVA" wordmark.
 *
 * Rendered with a layered technique:
 *  1. a gradient FILL (teal→violet at ~135°) shown through the letterforms,
 *  2. an inner shadow for the dark, glass-like surface look,
 *  3. an independently-animated outer glow (drop-shadow blur) driven by audio.
 *
 * The fill and the glow animate independently — the glow breathes with the
 * mic while the fill stays stable — matching the reference image.
 */
export function GlowText(): JSX.Element {
  const theme = useNovaStore((s) => s.theme)
  const name = useNovaStore((s) => s.personality.name)

  // Sample the glow on a rAF loop from the store so the text pulses in sync
  // with the ring without re-rendering React on every frame.
  const [glowPx, setGlowPx] = useState(16)
  const [glowOpacity, setGlowOpacity] = useState(0.6)
  const startRef = useRef(performance.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = (now: number): void => {
      const elapsed = (now - startRef.current) / 1000
      const { audioLevels, assistantState, personality } = useNovaStore.getState()
      const glow = computeGlow(audioLevels, assistantState, personality, elapsed)
      setGlowPx(8 + glow.intensity * 40)
      setGlowOpacity(0.35 + glow.intensity * 0.6)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const gradient = `linear-gradient(${theme.textGradientAngle}deg, ${theme.coolEdge}, ${theme.warmEdge})`

  return (
    <div className="pointer-events-none relative flex items-center justify-center">
      {/* Outer glow layer — blurred duplicate behind the fill. */}
      <motion.span
        aria-hidden="true"
        className="absolute font-display font-bold"
        style={{
          fontFamily: theme.fontFamily,
          letterSpacing: theme.letterSpacing,
          fontSize: 'clamp(2.5rem, 9vw, 4.2rem)',
          color: theme.glowCore,
          filter: `blur(${glowPx * 0.35}px)`,
          opacity: glowOpacity,
          textShadow: `0 0 ${glowPx}px ${theme.glowCore}, 0 0 ${glowPx * 2}px ${theme.glowEdge}`
        }}
      >
        {name}
      </motion.span>

      {/* Gradient fill with glass-like inner shadow, shown through the type. */}
      <span
        className="relative font-display font-bold"
        style={{
          fontFamily: theme.fontFamily,
          letterSpacing: theme.letterSpacing,
          fontSize: 'clamp(2.5rem, 9vw, 4.2rem)',
          backgroundImage: gradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          // Subtle inner-shadow "glass" using a layered text-shadow trick.
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))'
        }}
      >
        {name}
      </span>
    </div>
  )
}
