import { useEffect, useRef, useState } from 'react'
import { Orb } from '@renderer/components/Orb'
import { SettingsPanel } from '@renderer/components/SettingsPanel'
import { useMicAnalyser } from '@renderer/audio/useMicAnalyser'
import { useNovaStore } from '@renderer/state/store'

/**
 * Root component. Lays the orb over a fully transparent window, wires the mic
 * analysis loop, and manages the click-through behavior so the desktop stays
 * usable everywhere except over the orb itself.
 */
export default function App(): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const clickThrough = useNovaStore((s) => s.settings.clickThrough)
  const orbSize = useNovaStore((s) => s.settings.orbSize)
  const containerRef = useRef<HTMLDivElement>(null)

  // Run the microphone analysis / state loop for the app's lifetime.
  useMicAnalyser()

  // Open settings from the tray/menu (main → renderer via preload bridge).
  useEffect(() => {
    const off = window.nova?.onOpenSettings?.(() => setSettingsOpen((o) => !o))
    return off
  }, [])

  /**
   * Make the transparent window click-through everywhere except the circular
   * orb. We toggle `setIgnoreMouseEvents` based on whether the pointer is
   * within the orb's radius (with `forward: true` so we still receive move
   * events to detect re-entry).
   */
  useEffect(() => {
    if (!clickThrough) {
      window.nova?.setIgnoreMouseEvents?.(false)
      return
    }

    let ignoring = false
    const setIgnore = (val: boolean): void => {
      if (val === ignoring) return
      ignoring = val
      window.nova?.setIgnoreMouseEvents?.(val)
    }

    // Start ignoring; the move handler flips it off over the orb.
    setIgnore(true)

    const onMove = (e: MouseEvent): void => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const r = orbSize / 2
      const inside = Math.hypot(e.clientX - cx, e.clientY - cy) <= r
      // Also keep interactivity while the settings panel is open.
      setIgnore(!(inside || settingsOpen))
    }

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.nova?.setIgnoreMouseEvents?.(false)
    }
  }, [clickThrough, orbSize, settingsOpen])

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden"
      onContextMenu={(e) => {
        e.preventDefault()
        setSettingsOpen((o) => !o)
      }}
    >
      <div className="grid h-full w-full place-items-center">
        <Orb />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Tiny always-interactive hotspot to open settings when click-through. */}
      <button
        onClick={() => setSettingsOpen((o) => !o)}
        title="NOVA settings"
        className="fixed bottom-3 right-3 h-3 w-3 rounded-full bg-white/20 hover:bg-white/60"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        aria-label="Open settings"
      />
    </div>
  )
}
