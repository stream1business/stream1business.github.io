# NOVA — Desktop AI Assistant Orb

A floating, always-on-top, voice-reactive desktop assistant. NOVA renders a
braided ring of teal→violet light wrapped around the word **NOVA**, and the
glow, rotation and pulse react live to your microphone.

<p align="center"><em>Electron · React 18 · TypeScript · Tailwind · Framer Motion · Web Audio API · Canvas 2D</em></p>

---

## Quick start

```bash
cd nova
npm install
npm run dev      # launches Electron with the Vite dev server + HMR
```

Grant microphone access when prompted. Toggle the mic from the settings panel
(right-click the orb, click the small bottom-right dot, or use the tray menu).

### Build & package

```bash
npm run build            # type-check-safe production build into ./out
npm run package          # build + electron-builder for the current OS
npm run package:mac      # or :win / :linux
```

## What it does

- **Transparent, frameless, always-on-top** window that floats on the desktop.
- **Draggable** by the orb itself; the rest of the window is **click-through**
  so it never blocks the desktop underneath.
- **Voice-reactive glow** — RMS volume (via `AnalyserNode`) drives the text/ring
  glow, smoothed with an exponential moving average so it breathes, not flickers.
- **Rotation + pulse** — the ring spins continuously and springs on syllable-like
  amplitude onsets; rotation and scale are kept as independent transforms.
- **State machine** — `idle · listening · speaking · thinking · responding`,
  each with a distinct animation treatment.

## Project structure

```
nova/
├─ electron.vite.config.ts     # main / preload / renderer build config
├─ electron-builder.yml        # cross-platform packaging (mac/win/linux)
├─ tailwind.config.js
└─ src/
   ├─ main/                    # Electron main process
   │  ├─ index.ts              #   window config, tray, IPC
   │  └─ preload.ts            #   typed context-bridge (window.nova)
   ├─ shared/
   │  └─ types.ts              # types + IPC channel names shared both ways
   └─ renderer/
      ├─ App.tsx               # root: layout + click-through logic
      ├─ components/           # Orb, Ring (canvas), GlowText, SettingsPanel
      ├─ audio/                # AudioService + useMicAnalyser hook
      ├─ animation/            # glow + ring-motion calculators (pure fns)
      ├─ state/                # Zustand store (assistantState, audioLevels, …)
      ├─ services/             # assistant backend abstraction (stub today)
      └─ config/               # personality.config.ts, theme.config.ts
```

## Configuration

All behavior is config-driven — you shouldn't need to touch animation code.

- **`src/renderer/config/personality.config.ts`** — rotation speed, pulse/glow
  sensitivity, idle-pulse period, EMA smoothing, onset sensitivity.
- **`src/renderer/config/theme.config.ts`** — colors, gradient angle, font.
  Add a new object to `themes` to create a new skin (a second theme, `ember`,
  ships as an example and is switchable from the settings panel).

## Designed for future expansion

- **Voice pipeline hook point** — `AudioService.getStream()` exposes the raw mic
  `MediaStream`, so a speech-to-text stage (e.g. Whisper) can tap the exact same
  stream the analyzer uses, without touching any animation code.
- **LLM backend abstraction** — `src/renderer/services/assistant.ts` defines an
  `AssistantBackend` interface with a single `sendMessage()`. Today it's a local
  stub; swap in a real implementation (e.g. an Anthropic API client) with zero
  UI changes, since the UI only reacts to the store.
- **Theming system** — palette + font come from config objects (or JSON later).
- **Central store** — a typed Zustand store (`assistantState`, `audioLevels`,
  `theme`, `settings`) that new features (hotkeys, wake-word, tray actions) can
  subscribe to without editing rendering components.
- **Cross-platform packaging** — one `electron-builder.yml` targets macOS,
  Windows and Linux.

## Notes

- The mic is **off by default**; the app requests permission only when enabled.
- Audio analysis is entirely **local** — no audio leaves the machine.
- If the tray icon asset is missing the app still runs; use the right-click menu
  or the small bottom-right hotspot to open settings.
