import { useCallback, useEffect, useState } from 'react'
import { Orb } from './components/Orb'
import { SettingsPanel } from './components/SettingsPanel'
import { useMicrophone } from './audio/useMicrophone'
import { useNovaStore } from './state/store'
import { assistant } from '@services/assistant'

export default function App(): JSX.Element {
  const { start, stop } = useMicrophone()
  const micActive = useNovaStore((s) => s.micActive)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Toggle desktop click-through as the pointer enters/leaves the orb. The
  // window is created ignoring mouse events (forwarding move events), so the
  // renderer only "captures" the cursor while it's actually over the orb.
  const handleHoverChange = useCallback((hovering: boolean) => {
    window.nova?.setIgnoreMouseEvents(!hovering, { forward: true })
  }, [])

  // Keep click-through captured while the settings panel is open.
  useEffect(() => {
    if (settingsOpen) window.nova?.setIgnoreMouseEvents(false)
  }, [settingsOpen])

  // Right-click anywhere opens/closes the settings panel.
  useEffect(() => {
    const onContext = (e: MouseEvent): void => {
      e.preventDefault()
      setSettingsOpen((v) => !v)
    }
    window.addEventListener('contextmenu', onContext)
    return () => window.removeEventListener('contextmenu', onContext)
  }, [])

  // Let the tray "Settings…" item open the panel too.
  useEffect(() => {
    return window.nova?.onOpenSettings(() => setSettingsOpen(true))
  }, [])

  const toggleMic = useCallback(() => {
    if (micActive) stop()
    else void start().catch((err) => console.error('Mic permission denied:', err))
  }, [micActive, start, stop])

  // Fire the stub assistant so all five states can be seen end-to-end.
  const ping = useCallback(() => {
    void assistant.sendMessage('Hello NOVA', [], (state) => setAssistantState(state))
  }, [setAssistantState])

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-transparent">
      <Orb onHoverChange={handleHoverChange} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        micActive={micActive}
        onToggleMic={toggleMic}
        onPing={ping}
      />
    </div>
  )
}
