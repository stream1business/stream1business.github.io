import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useAnimationFrame } from 'framer-motion'
import { useNovaStore } from '../state/store'
import { rotationDegPerSec, pulseTargetScale } from '../animation/ringMotion'
import { Ring } from './Ring'
import { GlowText } from './GlowText'

/**
 * Orb — composes the Ring + GlowText and applies the two independent
 * transforms:
 *   - rotation (continuous spin, faster while active) on the ring layer
 *   - pulse (spring-backed scale) on the whole orb, driven by speech onsets
 *
 * The word "NOVA" is counter-rotated so it stays upright while the ring spins.
 */
interface OrbProps {
  size: number
}

export function Orb({ size }: OrbProps): JSX.Element {
  const assistantState = useNovaStore((s) => s.assistantState)

  // Rotation motion value, advanced manually each frame so speed can vary.
  const rotation = useMotionValue(0)

  // Pulse: a spring gives the natural "breathe back to 1.0" recoil.
  const pulseTarget = useMotionValue(1)
  const scale = useSpring(pulseTarget, { stiffness: 220, damping: 18, mass: 0.6 })

  const stateRef = useRef(assistantState)
  stateRef.current = assistantState

  useAnimationFrame((_t, delta) => {
    const { audioLevels, assistantState: st } = useNovaStore.getState()
    // Advance rotation by state-dependent angular velocity.
    const degPerMs = rotationDegPerSec(st) / 1000
    rotation.set(rotation.get() + degPerMs * delta)
    // Update the pulse target; the spring smooths the spring-back.
    pulseTarget.set(pulseTargetScale(audioLevels, st))
  })

  return (
    <motion.div
      className="app-drag relative select-none"
      style={{ width: size, height: size, scale }}
    >
      {/* Rotating ring layer. */}
      <motion.div className="absolute inset-0" style={{ rotate: rotation }}>
        <Ring size={size} />
      </motion.div>
      {/* Upright wordmark, counter-rotated so it never spins. */}
      <motion.div className="absolute inset-0" style={{ rotate: useCounterRotation(rotation) }}>
        <GlowText size={size} />
      </motion.div>
    </motion.div>
  )
}

/**
 * Returns a motion value that is always the negative of `rotation`, so a child
 * placed inside a rotating parent renders upright.
 */
function useCounterRotation(rotation: ReturnType<typeof useMotionValue<number>>) {
  const counter = useMotionValue(0)
  useEffect(() => {
    const unsub = rotation.on('change', (v) => counter.set(-v))
    return () => unsub()
  }, [rotation, counter])
  return counter
}
