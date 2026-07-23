import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNovaStore } from '@renderer/state/store'
import { useAssistant } from '@renderer/state/useAssistant'
import { themes } from '@renderer/config/themes'
import type { AssistantState } from '@shared/types'

/**
 * Minimal settings / control panel, opened by right-clicking the orb.
 *
 * Deliberately compact and glassy so it doesn't overwhelm the floating orb.
 * It surfaces the tuning that most affects the "feel": theme, orb size,
 * pulse/glow sensitivity, and manual state selection for demoing the machine.
 */
const STATES: AssistantState[] = ['idle', 'listening', 'speaking', 'thinking', 'responding']

export function SettingsPanel({
  onEnableMic,
  onDisableMic
}: {
  onEnableMic: () => void
  onDisableMic: () => void
}): JSX.Element {
  const open = useNovaStore((s) => s.settingsOpen)
  const setOpen = useNovaStore((s) => s.setSettingsOpen)
  const settings = useNovaStore((s) => s.settings)
  const personality = useNovaStore((s) => s.personality)
  const assistantState = useNovaStore((s) => s.assistantState)
  const setThemeKey = useNovaStore((s) => s.setThemeKey)
  const updateSettings = useNovaStore((s) => s.updateSettings)
  const updatePersonality = useNovaStore((s) => s.updatePersonality)
  const setAssistantState = useNovaStore((s) => s.setAssistantState)
  const lastExchange = useNovaStore((s) => s.lastExchange)

  const { ask, busy } = useAssistant()
  const [prompt, setPrompt] = useState('')

  const submitPrompt = (): void => {
    void ask(prompt)
    setPrompt('')
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          onMouseEnter={() => window.nova?.setClickThrough(false)}
          className="nova-no-drag pointer-events-auto absolute bottom-4 left-1/2 z-50 w-[320px] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/70 p-4 text-xs text-white/90 backdrop-blur-md"
          style={{ boxShadow: '0 8px 40px rgba(90, 40, 200, 0.25)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold tracking-widest text-nova-teal">NOVA · SETTINGS</span>
            <button
              className="rounded px-2 py-0.5 text-white/60 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Ask NOVA — exercises the assistant backend + state machine */}
          <div className="mb-3">
            <div className="mb-1 text-white/50">Ask NOVA</div>
            <div className="flex gap-1">
              <input
                type="text"
                value={prompt}
                disabled={busy}
                placeholder={busy ? 'NOVA is thinking…' : 'Type a message…'}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitPrompt()
                }}
                className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-white placeholder-white/30 outline-none focus:bg-white/15 disabled:opacity-50"
              />
              <button
                onClick={submitPrompt}
                disabled={busy || prompt.trim().length === 0}
                className="rounded bg-nova-teal/30 px-2 py-1 hover:bg-nova-teal/50 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            {lastExchange && (
              <div className="mt-2 rounded bg-white/5 p-2 text-white/70">
                <div className="truncate text-white/40">“{lastExchange.prompt}”</div>
                <div className="mt-0.5 text-nova-glow">{lastExchange.reply}</div>
              </div>
            )}
          </div>

          {/* Microphone */}
          <Row label="Microphone">
            {settings.micEnabled ? (
              <button
                className="rounded bg-nova-violet/40 px-2 py-1 hover:bg-nova-violet/60"
                onClick={onDisableMic}
              >
                Disable
              </button>
            ) : (
              <button
                className="rounded bg-nova-teal/30 px-2 py-1 hover:bg-nova-teal/50"
                onClick={onEnableMic}
              >
                Enable
              </button>
            )}
          </Row>

          {/* Theme */}
          <Row label="Theme">
            <select
              className="rounded bg-white/10 px-2 py-1 outline-none"
              value={settings.themeKey}
              onChange={(e) => setThemeKey(e.target.value)}
            >
              {Object.values(themes).map((t) => (
                <option key={t.key} value={t.key} className="bg-black">
                  {t.label}
                </option>
              ))}
            </select>
          </Row>

          {/* Orb size */}
          <Slider
            label={`Orb size · ${settings.orbSize}px`}
            min={360}
            max={680}
            step={10}
            value={settings.orbSize}
            onChange={(v) => updateSettings({ orbSize: v })}
          />

          {/* Sensitivities */}
          <Slider
            label={`Pulse sensitivity · ${personality.pulseSensitivity.toFixed(2)}`}
            min={0}
            max={1}
            step={0.05}
            value={personality.pulseSensitivity}
            onChange={(v) => updatePersonality({ pulseSensitivity: v })}
          />
          <Slider
            label={`Glow sensitivity · ${personality.glowSensitivity.toFixed(2)}`}
            min={0}
            max={1}
            step={0.05}
            value={personality.glowSensitivity}
            onChange={(v) => updatePersonality({ glowSensitivity: v })}
          />
          <Slider
            label={`Smoothing · ${personality.smoothingFactor.toFixed(2)}`}
            min={0.02}
            max={0.5}
            step={0.01}
            value={personality.smoothingFactor}
            onChange={(v) => updatePersonality({ smoothingFactor: v })}
          />

          {/* State machine (manual override for demos) */}
          <div className="mt-3">
            <div className="mb-1 text-white/50">State</div>
            <div className="flex flex-wrap gap-1">
              {STATES.map((st) => (
                <button
                  key={st}
                  onClick={() => setAssistantState(st)}
                  className={`rounded px-2 py-1 capitalize ${
                    assistantState === st
                      ? 'bg-nova-teal/60 text-black'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Window toggles */}
          <div className="mt-3 flex items-center justify-between text-white/70">
            <Toggle
              label="Always on top"
              checked={settings.alwaysOnTop}
              onChange={(v) => {
                updateSettings({ alwaysOnTop: v })
                window.nova?.setAlwaysOnTop(v)
              }}
            />
            <button
              className="rounded bg-red-500/30 px-2 py-1 hover:bg-red-500/50"
              onClick={() => window.nova?.quit()}
            >
              Quit
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-white/60">{label}</span>
      {children}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <div className="mb-2">
      <div className="mb-1 text-white/60">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-nova-teal"
      />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
