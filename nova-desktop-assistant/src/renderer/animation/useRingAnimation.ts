import { useEffect, useRef, useState } from 'react'
import type { AssistantState } from '@shared/types'
import type { PersonalityConfig } from '@renderer/config/personality.config'

/**
 * Derives ring *rotation* speed (degrees/second) from the current state.
 * Rotation and pulse are intentionally kept as separate transforms so they can
 * be tuned — and driven — independently.
 */
export function rotationSpeedDegPerSec(state: AssistantState, cfg: PersonalityConfig): number {
  const base = 360 / cfg.baseRotationSpeed // deg/s for one revolution
  switch (state) {
    case 'speaking':
      return base * cfg.activeRotationMultiplier
    case 'thinking':
      return base * cfg.thinkingRotationMultiplier
    case 'responding':
      return base * (cfg.activeRotationMultiplier * 1.1)
    case 'listening':
      return base * 0.9
    case 'idle':
    default:
      return base
  }
}

/**
 * Runs a RAF loop that integrates the (state-dependent) rotation speed into a
 * continuously increasing angle. Returns the current angle in degrees.
 *
 * Integrating speed rather than snapping between fixed durations means a state
 * change accelerates the spin smoothly instead of jumping.
 */
export function useContinuousRotation(
  state: AssistantState,
  cfg: PersonalityConfig
): number {
  const [angle, setAngle] = useState(0)
  const angleRef = useRef(0)
  const lastRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  const cfgRef = useRef(cfg)
  stateRef.current = state
  cfgRef.current = cfg

  useEffect(() => {
    let raf = 0
    const tick = (t: number): void => {
      if (lastRef.current === null) lastRef.current = t
      const dt = (t - lastRef.current) / 1000
      lastRef.current = t
      angleRef.current =
        (angleRef.current + rotationSpeedDegPerSec(stateRef.current, cfgRef.current) * dt) % 360
      setAngle(angleRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return angle
}

/**
 * Target scale for the ring's "breathing" pulse. On a detected onset it kicks
 * up toward `1 + pulseSensitivity * 0.08`; Framer Motion's spring in the
 * component springs it back for a natural feel.
 */
export function pulseTargetScale(
  peak: boolean,
  volume: number,
  cfg: PersonalityConfig
): number {
  const volumeScale = 1 + volume * cfg.pulseSensitivity * 0.04
  const onsetKick = peak ? cfg.pulseSensitivity * 0.08 : 0
  return volumeScale + onsetKick
}
