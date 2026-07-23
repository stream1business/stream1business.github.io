import { useNovaStore } from '@renderer/state/store'
import { themes } from '@renderer/config/theme.config'
import type { AssistantState } from '@shared/types'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  micActive: boolean
  onToggleMic: () => void
  onPing: () => void
}

const STATES: AssistantState[] = ['idle', 'listening', 'speaking', 'thinking', 'responding']

/**
 * Minimal settings panel. Opened by right-click on the orb or via the tray.
 * Marked `no-drag` so its controls stay clickable inside the draggable window.
 */
export function SettingsPanel({
  open,
  onClose,
  micActive,
  onToggleMic,
  onPing
}: SettingsPanelProps): JSX.Element | null {
  const settings = useNovaStore((s) => s.settings)
  const theme = useNovaStore((s) => s.theme)
  const assistantState = useNovaStore((s) => s.assistantState)
  const setTheme = useNovaStore((s) => s.setTheme)
  const updateSettings = useNovaStore((s) => s.updateSettings)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)

  if (!open) return null

  return (
    <div className="no-drag absolute top-4 right-4 w-72 rounded-2xl border border-white/10 bg-black/70 p-4 text-xs text-white/80 backdrop-blur-md shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display tracking-nova text-sm text-white">SETTINGS</span>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Microphone */}
      <button
        onClick={onToggleMic}
        className="mb-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-white/5"
        style={{ color: micActive ? theme.coolEdge : undefined }}
      >
        {micActive ? '● Microphone active — click to stop' : '○ Enable microphone'}
      </button>

      {/* Assistant round-trip demo */}
      <button
        onClick={onPing}
        className="mb-4 w-full rounded-lg border border-white/10 px-3 py-2 text-left hover:bg-white/5"
      >
        ▷ Simulate a NOVA response
      </button>

      {/* Theme */}
      <Label>Theme</Label>
      <div className="mb-4 flex gap-2">
        {Object.values(themes).map((t) => (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="h-8 flex-1 rounded-md border"
            style={{
              borderColor: settings.colorTheme === t.id ? '#fff' : 'transparent',
              background: `linear-gradient(135deg, ${t.coolEdge}, ${t.warmEdge})`
            }}
            title={t.label}
          />
        ))}
      </div>

      {/* Sliders */}
      <Slider
        label="Glow sensitivity"
        value={settings.glowSensitivity}
        onChange={(v) => updateSettings({ glowSensitivity: v })}
      />
      <Slider
        label="Pulse sensitivity"
        value={settings.pulseSensitivity}
        onChange={(v) => updateSettings({ pulseSensitivity: v })}
      />
      <Slider
        label="Smoothing"
        value={settings.smoothingFactor}
        min={0.02}
        max={0.6}
        onChange={(v) => updateSettings({ smoothingFactor: v })}
      />
      <Slider
        label="Orb size"
        value={settings.orbDiameter}
        min={320}
        max={720}
        step={10}
        format={(v) => `${Math.round(v)}px`}
        onChange={(v) => updateSettings({ orbDiameter: v })}
      />

      {/* State override (useful for tuning each state's look) */}
      <Label>State</Label>
      <div className="flex flex-wrap gap-1">
        {STATES.map((st) => (
          <button
            key={st}
            onClick={() => setAssistantState(st)}
            className="rounded px-2 py-1 text-[10px] uppercase tracking-wide"
            style={{
              background: assistantState === st ? theme.warmEdge : 'rgba(255,255,255,0.06)',
              color: assistantState === st ? '#000' : undefined
            }}
          >
            {st}
          </button>
        ))}
      </div>

      <button
        onClick={() => window.nova?.quit()}
        className="mt-4 w-full rounded-lg border border-red-400/30 px-3 py-2 text-red-300/80 hover:bg-red-500/10"
      >
        Quit NOVA
      </button>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="mb-1 mt-1 uppercase tracking-wide text-white/40">{children}</div>
}

interface SliderProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  format = (v) => v.toFixed(2),
  onChange
}: SliderProps): JSX.Element {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between">
        <span className="uppercase tracking-wide text-white/40">{label}</span>
        <span className="text-white/60">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-fuchsia-400"
      />
    </div>
  )
}
