import { useEffect, useRef, useState } from 'react'
import { Orb } from './components/Orb'
import { SettingsPanel } from './components/SettingsPanel'
import { useNovaStore } from './state/store'
import { useMicAnalyser } from './audio/useMicAnalyser'

/**
 * Root component. Owns:
 *  - the settings panel visibility (right-click / hotspot)
 *  - passing pointer enter/leave over the orb through to the main process so
 *    the transparent window stays click-through everywhere except the orb.
 *  - auto-starting the mic if configured.
 */
export function App(): JSX.Element {
  const orbSize = useNovaStore((s) => s.settings.orbSize)
  const autoStartMic = useNovaStore((s) => s.settings.autoStartMic)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { start } = useMicAnalyser()
  const startedRef = useRef(false)

  useEffect(() => {
    if (autoStartMic && !startedRef.current) {
      startedRef.current = true
      void start()
    }
  }, [autoStartMic, start])

  // Let the tray toggle the settings panel.
  useEffect(() => {
    return window.nova?.onToggleSettings(() => setSettingsOpen((v) => !v))
  }, [])

  return (
    <div
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden"
      onContextMenu={(e) => {
        e.preventDefault()
        setSettingsOpen((v) => !v)
      }}
    >
      {/* The orb is the only interactive/opaque region. Hovering it makes the
          window capture the mouse; leaving it makes the window click-through. */}
      <div
        onPointerEnter={() => window.nova?.setIgnoreMouseEvents(false)}
        onPointerLeave={() => !settingsOpen && window.nova?.setIgnoreMouseEvents(true)}
      >
        <Orb size={orbSize} />
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
