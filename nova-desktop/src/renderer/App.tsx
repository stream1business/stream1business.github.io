import { useEffect } from 'react'
import { Orb } from './components/Orb'
import { SettingsPanel } from './components/SettingsPanel'
import { useMicrophone } from './audio/useMicrophone'
import { useNovaStore } from './state/store'

/**
 * Root renderer component.
 *
 * Responsibilities:
 *  - mount the mic hook (audio → store),
 *  - bridge tray-driven state changes into the store,
 *  - keep Electron's always-on-top flag in sync with settings,
 *  - render the floating orb + settings panel.
 *
 * The window is transparent, so the app renders nothing but the orb graphic.
 */
export default function App(): JSX.Element {
  const { enable, disable } = useMicrophone()
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const alwaysOnTop = useNovaStore((s) => s.settings.alwaysOnTop)

  // Tray menu → renderer state machine.
  useEffect(() => {
    const off = window.nova?.onSetState((state) => setAssistantState(state))
    return () => off?.()
  }, [setAssistantState])

  // Keep the OS window flag aligned with the store.
  useEffect(() => {
    window.nova?.setAlwaysOnTop(alwaysOnTop)
  }, [alwaysOnTop])

  return (
    <div className="relative h-full w-full">
      <Orb />
      <SettingsPanel onEnableMic={enable} onDisableMic={disable} />
    </div>
  )
}
