# NOVA — Desktop AI Assistant Orb

A floating, always-on-top, voice-reactive assistant HUD. NOVA renders an animated
braid-of-light ring wrapped around the word **NOVA**, on a fully transparent
window that floats over your desktop. The ring's glow, rotation, and pulse react
live to your microphone.

Built with **Electron · React 18 · TypeScript · Tailwind CSS · Framer Motion ·
Web Audio API · Canvas 2D**.

---

## Quick start

```bash
cd nova-desktop-assistant
npm install
npm run dev        # launches the Electron app with hot reload
```

Grant microphone access when prompted, then open the panel (right-click the orb)
and click **Enable microphone**. Speak — the ring brightens, spins faster, and
pulses on your syllables.

### Build & package

```bash
npm run build        # typecheck + bundle main/preload/renderer into out/
npm run package      # unpacked app in release/ (electron-builder --dir)
npm run dist:mac     # or dist:win / dist:linux for installers
```

> Cross-platform installers generally require the target OS's toolchain. The
> `electron-builder.yml` is already set up so macOS, Windows, and Linux can be
> targeted from this one codebase.

---

## What's implemented

- **Transparent, frameless, always-on-top window** (`transparent: true`,
  `frame: false`), floating near the top-right of the primary display.
- **Draggable by the ring** (`-webkit-app-region: drag` on the orb) with panel
  controls excluded (`no-drag`).
- **Click-through to the desktop** everywhere except the orb: the window starts
  with `setIgnoreMouseEvents(true, { forward: true })` and the renderer captures
  the cursor only while it's over the orb.
- **Right-click** the orb (or the tray → Settings…) opens a minimal settings
  panel: mic toggle, theme picker, sensitivity/smoothing/size sliders, a state
  override, and a "simulate response" button.
- **System tray** menu: show/hide, settings, always-on-top toggle, quit.
- **Voice-reactive animation** — see below.

## The animation, in three parts

1. **Voice-reactive glow** — `AnalyserNode.getByteFrequencyData()` /
   time-domain RMS is sampled every frame, smoothed with an exponential moving
   average (`smoothingFactor`), and mapped to glow blur + opacity on both the
   ring and the wordmark. Silence settles into a slow ~4s idle sine breath.
2. **Rotation** — a continuous clockwise spin (20s/rev idle) whose speed is
   integrated from a state-dependent rate, so state changes accelerate the spin
   smoothly. Speaking and thinking spin faster.
3. **Pulse** — onset detection on the volume envelope kicks a Framer Motion
   spring that scales the orb ~100%→108% and springs back, for a natural
   breathing rebound. Rotation (in the canvas) and scale (the spring) are kept
   as independent transforms.

## State machine

`idle · listening · speaking · thinking · responding` — each with a distinct
glow/rotation profile (see `src/renderer/animation/glow.ts` and
`useRingAnimation.ts`). The mic hook auto-drives `listening ⇄ speaking`; the
assistant service owns `thinking → responding → listening`.

---

## Project structure

```
src/
  main/            Electron main process — window config, tray, IPC
    index.ts
    tray.ts
  preload/         contextBridge → window.nova (the only renderer⇄main bridge)
    index.ts
  renderer/
    components/    Ring (canvas), GlowText, Orb, SettingsPanel
    audio/         mic capture (useMicrophone) + analysis (NovaAnalyser)
    animation/     glow + rotation/pulse calculators (pure, tunable)
    state/         Zustand store (assistantState, audioLevels, theme, settings)
    config/        personality.config.ts + theme.config.ts
  services/
    assistant.ts   LLM backend abstraction (stub today, swap for a real API)
  shared/
    types.ts       types + IPC channel names shared by main and renderer
```

## Tuning without touching animation code

Everything behavioural lives in **`src/renderer/config/personality.config.ts`**:

```ts
export const personalityConfig = {
  name: 'NOVA',
  baseRotationSpeed: 20,          // seconds per revolution, idle
  activeRotationMultiplier: 1.4,
  pulseSensitivity: 0.6,          // 0–1, how strongly volume affects scale
  glowSensitivity: 0.8,           // 0–1, how strongly volume affects glow
  idlePulseSpeed: 4,              // seconds per breathing cycle
  colorTheme: 'novaDefault',      // swappable themes
  smoothingFactor: 0.15,          // EMA smoothing for the audio signal
  // ...
}
```

Colours + font are in **`theme.config.ts`** as plain data — add a new object to
`themes` for a new skin. The settings panel also edits these live at runtime.

---

## Designed to extend

- **Voice pipeline** — `useMicrophone` owns the single `MediaStream`; analysis
  is isolated in `NovaAnalyser`. Tee the stream to Whisper/STT later without
  touching any animation code.
- **LLM backend** — the UI only calls `assistant.sendMessage()`. Replace
  `StubAssistantBackend` in `services/assistant.ts` with a real API client (e.g.
  the Anthropic API) and nothing in the UI changes.
- **Theming** — new skins are TS/JSON theme objects, no component edits.
- **State/plugins** — the Zustand store is the single source of truth; new
  features (hotkeys, wake-word, tray actions) push state in without touching
  rendering components.
- **Packaging** — `electron-builder.yml` targets mac/win/linux from one build.

## Color palette

| Purpose            | Color                                   |
|--------------------|-----------------------------------------|
| Background         | transparent (`#000000` in mockups)      |
| Ring — cool edge   | `#2DE1C2`                               |
| Ring — warm edge   | `#8A4FFF`                               |
| Ring — deep shadow | `#120826`                               |
| Text glow          | `#FFFFFF` core → `#B58CFF` edge         |
| Particles          | `#FFFFFF` at 10–80% opacity             |
