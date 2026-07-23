import { useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { Ring } from './Ring'
import { GlowText } from './GlowText'
import { useNovaStore } from '@renderer/state/store'
import { pulseTargetScale } from '@renderer/animation/useRingAnimation'

interface OrbProps {
  /** Called when the pointer enters/leaves the interactive orb region, so the
   *  transparent window can toggle click-through against the desktop. */
  onHoverChange?: (hovering: boolean) => void
}

/**
 * Composites the ring + wordmark and applies the springy "breathing" pulse.
 *
 * The scale is a Framer Motion spring: onset peaks push the target up, and the
 * spring settles it back for a natural rebound. Rotation lives inside the Ring
 * canvas, keeping the two transforms independent as specified.
 */
export function Orb({ onHoverChange }: OrbProps): JSX.Element {
  const diameter = useNovaStore((s) => s.settings.orbDiameter)

  const scaleTarget = useMotionValue(1)
  const scale = useSpring(scaleTarget, { stiffness: 260, damping: 18, mass: 0.6 })

  // Drive the spring target from audio onsets without re-rendering React.
  useEffect(() => {
    let raf = 0
    const tick = (): void => {
      const { audioLevels, settings } = useNovaStore.getState()
      scaleTarget.set(pulseTargetScale(audioLevels.peak, audioLevels.volume, settings))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [scaleTarget])

  return (
    <motion.div
      // `drag-region` makes the ring surface the drag handle for the frameless
      // window; rotation lives in the canvas, scale is this spring.
      className="drag-region relative flex items-center justify-center"
      style={{ width: diameter, height: diameter, scale }}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
    >
      <Ring size={diameter} />
      <div className="absolute inset-0 flex items-center justify-center">
        <GlowText />
      </div>
    </motion.div>
  )
}
