import { useNovaStore } from '@renderer/state/store'
import { themes } from '@renderer/config/theme.config'
import { assistant } from '@renderer/services/assistant'
import type { AssistantState } from '@shared/types'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

const STATES: AssistantState[] = [
  'idle',
  'listening',
  'speaking',
  'thinking',
  'responding'
]

/**
 * Minimal settings surface. Kept intentionally small and non-interfering with
 * the orb; it's opened from the tray/right-click menu. Uses `-webkit-app-region:
 * no-drag` so the controls remain usable inside the draggable window.
 */
export function SettingsPanel({ open, onClose }: SettingsPanelProps): JSX.Element | null {
  const settings = useNovaStore((s) => s.settings)
  const assistantState = useNovaStore((s) => s.assistantState)
  const updateSettings = useNovaStore((s) => s.updateSettings)
  const setTheme = useNovaStore((s) => s.setTheme)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)

  if (!open) return null

  return (
    <div
      className="fixed right-4 top-4 w-72 rounded-2xl border border-white/10 bg-black/80 p-4 text-sm text-white/90 shadow-2xl backdrop-blur-md"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display tracking-widest text-nova-teal">NOVA</span>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      {/* Microphone toggle */}
      <label className="mb-3 flex items-center justify-between">
        <span>Microphone</span>
        <input
          type="checkbox"
          checked={settings.micEnabled}
          onChange={(e) => updateSettings({ micEnabled: e.target.checked })}
          className="h-4 w-4 accent-nova-teal"
        />
      </label>

      {/* Click-through toggle */}
      <label className="mb-3 flex items-center justify-between">
        <span>Click-through desktop</span>
        <input
          type="checkbox"
          checked={settings.clickThrough}
          onChange={(e) => updateSettings({ clickThrough: e.target.checked })}
          className="h-4 w-4 accent-nova-teal"
        />
      </label>

      {/* Orb size */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between">
          <span>Orb size</span>
          <span className="text-white/50">{settings.orbSize}px</span>
        </div>
        <input
          type="range"
          min={320}
          max={720}
          step={10}
          value={settings.orbSize}
          onChange={(e) => updateSettings({ orbSize: Number(e.target.value) })}
          className="w-full accent-nova-violet"
        />
      </div>

      {/* Glow master */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between">
          <span>Glow</span>
          <span className="text-white/50">{Math.round(settings.glowMaster * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1.5}
          step={0.05}
          value={settings.glowMaster}
          onChange={(e) => updateSettings({ glowMaster: Number(e.target.value) })}
          className="w-full accent-nova-violet"
        />
      </div>

      {/* Theme */}
      <div className="mb-3">
        <div className="mb-1">Theme</div>
        <div className="flex gap-2">
          {Object.values(themes).map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`flex-1 rounded-lg border px-2 py-1 text-xs ${
                settings.themeKey === t.key
                  ? 'border-nova-teal text-white'
                  : 'border-white/10 text-white/60 hover:border-white/30'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* State machine debug controls */}
      <div className="mb-2">
        <div className="mb-1 text-white/60">State (debug)</div>
        <div className="flex flex-wrap gap-1">
          {STATES.map((st) => (
            <button
              key={st}
              onClick={() => setAssistantState(st)}
              className={`rounded px-2 py-0.5 text-xs ${
                assistantState === st
                  ? 'bg-nova-violet text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise the assistant round-trip stub */}
      <button
        onClick={() => void assistant.sendMessage('Hello NOVA')}
        className="mt-2 w-full rounded-lg bg-gradient-to-r from-nova-teal to-nova-violet py-1.5 text-xs font-medium text-black"
      >
        Simulate a reply
      </button>
    </div>
  )
}
