import { useEffect, useRef } from 'react'
import { motion, useSpring } from 'framer-motion'
import { Ring } from './Ring'
import { GlowText } from './GlowText'
import { useNovaStore } from '@renderer/state/store'
import { computeTargetScale } from '@renderer/animation/glow'

/**
 * The floating orb: composites the canvas {@link Ring} and the {@link GlowText}
 * wordmark, applies the audio-driven pulse via a Framer Motion spring, and
 * owns the desktop interaction rules:
 *
 *  - The ring circle is a window-drag handle (`-webkit-app-region: drag`).
 *  - Hovering the ring disables click-through so the tray/settings are usable;
 *    leaving it re-enables click-through so clicks pass to the desktop below.
 */
export function Orb(): JSX.Element {
  const size = useNovaStore((s) => s.settings.orbSize)
  const setSettingsOpen = useNovaStore((s) => s.setSettingsOpen)

  // Pulse: drive a spring toward the audio-derived target scale. The spring
  // physics provide the natural "breathing" recoil on each syllable peak.
  const scale = useSpring(1, { stiffness: 220, damping: 18, mass: 0.6 })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = (): void => {
      const { audioLevels, assistantState, personality } = useNovaStore.getState()
      scale.set(computeTargetScale(audioLevels, assistantState, personality))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [scale])

  // Toggle Electron click-through as the pointer enters/leaves the ring.
  const handleEnter = (): void => window.nova?.setClickThrough(false)
  const handleLeave = (): void => window.nova?.setClickThrough(true)

  return (
    <div className="flex h-full w-full items-center justify-center">
      <motion.div
        className="nova-draggable relative flex items-center justify-center"
        style={{ width: size, height: size, scale, borderRadius: '50%' }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onContextMenu={(e) => {
          // Right-click anywhere on the orb opens the in-app settings panel.
          e.preventDefault()
          setSettingsOpen(true)
        }}
      >
        <Ring size={size} />
        <div className="absolute inset-0 flex items-center justify-center">
          <GlowText />
        </div>
      </motion.div>
    </div>
  )
}
