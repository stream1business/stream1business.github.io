import { useEffect, useRef } from 'react'
import { motion, useSpring } from 'framer-motion'
import { Ring } from './Ring'
import { GlowText } from './GlowText'
import { useNovaStore, novaSnapshot } from '@renderer/state/store'
import { pulseScale, pulseSpring } from '@renderer/animation/ringMotion'

/**
 * The floating orb: the braided ring, the "NOVA" wordmark, and the
 * audio-driven pulse. Scale/pulse is applied here via a Framer Motion spring so
 * it's an independent transform from the canvas's internal rotation.
 *
 * The circular hit area is the only draggable / interactive region; the rest of
 * the window is click-through (handled by App via the preload bridge).
 */
export function Orb(): JSX.Element {
  const size = useNovaStore((s) => s.settings.orbSize)
  const name = useNovaStore((s) => s.personality.name)
  const assistantState = useNovaStore((s) => s.assistantState)

  // Spring the pulse scale for natural bounce-back on syllable onsets. The
  // spring config is chosen from the state at mount; state-specific feel is
  // still expressed through the target values from pulseScale().
  const scale = useSpring(1, pulseSpring(assistantState))
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = (): void => {
      const snap = novaSnapshot()
      const target = pulseScale(snap.assistantState, snap.audioLevels, snap.personality)
      scale.set(target)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [scale])

  return (
    <motion.div
      className="orb-hit relative grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        scale,
        // The orb is the drag handle; -webkit-app-region makes the window move.
        WebkitAppRegion: 'drag',
        cursor: 'grab'
      }}
      data-state={assistantState}
    >
      {/* Rotation lives inside the canvas; scale lives on this wrapper. */}
      <div className="absolute inset-0 grid place-items-center">
        <Ring size={size} />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <GlowText text={name} size={size} />
      </div>
    </motion.div>
  )
}
