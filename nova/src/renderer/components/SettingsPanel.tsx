import { useState } from 'react'
import type { AssistantState } from '@shared/types'
import { useNovaStore } from '../state/store'
import { useMicAnalyser } from '../audio/useMicAnalyser'
import { themes } from '../config/themes'
import { assistant } from '../services/assistant'

/**
 * SettingsPanel — a minimal control surface, hidden by default and toggled
 * from the tray or a hotspot. Everything here just mutates the store /
 * services; the rendering components react on their own.
 */
interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

const STATES: AssistantState[] = ['idle', 'listening', 'speaking', 'thinking', 'responding']

export function SettingsPanel({ open, onClose }: SettingsPanelProps): JSX.Element | null {
  const settings = useNovaStore((s) => s.settings)
  const assistantState = useNovaStore((s) => s.assistantState)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const updateSettings = useNovaStore((s) => s.updateSettings)
  const setTheme = useNovaStore((s) => s.setTheme)
  const { micActive, error, toggle } = useMicAnalyser()
  const [asking, setAsking] = useState(false)

  if (!open) return null

  const demoAsk = async (): Promise<void> => {
    setAsking(true)
    const previous = micActive ? 'listening' : 'idle'
    await assistant.ask('Hello NOVA', setAssistantState, previous)
    setAsking(false)
  }

  return (
    <div className="no-drag fixed right-4 top-4 w-72 rounded-2xl border border-white/10 bg-black/80 p-4 text-sm text-white/90 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display tracking-widest text-nova-teal">NOVA</span>
        <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Microphone */}
      <button
        onClick={() => void toggle()}
        className={`mb-2 w-full rounded-lg px-3 py-2 font-medium transition ${
          micActive ? 'bg-nova-teal/20 text-nova-teal' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        {micActive ? 'Stop microphone' : 'Start microphone'}
      </button>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {/* Demo assistant turn */}
      <button
        onClick={() => void demoAsk()}
        disabled={asking}
        className="mb-4 w-full rounded-lg bg-nova-violet/20 px-3 py-2 font-medium text-nova-glow transition hover:bg-nova-violet/30 disabled:opacity-50"
      >
        {asking ? 'NOVA is responding…' : 'Test think → respond'}
      </button>

      {/* State override (dev/demo) */}
      <label className="mb-1 block text-xs uppercase tracking-wider text-white/40">State</label>
      <div className="mb-4 flex flex-wrap gap-1">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setAssistantState(s)}
            className={`rounded px-2 py-1 text-xs capitalize transition ${
              assistantState === s ? 'bg-nova-teal text-black' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Theme */}
      <label className="mb-1 block text-xs uppercase tracking-wider text-white/40">Theme</label>
      <select
        value={settings.themeId}
        onChange={(e) => setTheme(e.target.value)}
        className="mb-4 w-full rounded-lg bg-white/5 px-2 py-1.5 text-white"
      >
        {Object.values(themes).map((t) => (
          <option key={t.id} value={t.id} className="bg-black">
            {t.label}
          </option>
        ))}
      </select>

      {/* Orb size */}
      <label className="mb-1 block text-xs uppercase tracking-wider text-white/40">
        Orb size — {settings.orbSize}px
      </label>
      <input
        type="range"
        min={360}
        max={640}
        step={20}
        value={settings.orbSize}
        onChange={(e) => updateSettings({ orbSize: Number(e.target.value) })}
        className="mb-4 w-full accent-nova-teal"
      />

      {/* Always on top */}
      <label className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/40">Always on top</span>
        <input
          type="checkbox"
          checked={settings.alwaysOnTop}
          onChange={(e) => {
            updateSettings({ alwaysOnTop: e.target.checked })
            window.nova?.toggleAlwaysOnTop(e.target.checked)
          }}
          className="accent-nova-teal"
        />
      </label>
    </div>
  )
}
