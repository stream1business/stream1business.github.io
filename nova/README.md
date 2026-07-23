# NOVA — Desktop AI Assistant Orb

A floating, always-on-top, voice-reactive desktop assistant. The centerpiece is
an animated braided ring of teal→violet light wrapped around the word **NOVA**
that reacts live to microphone input — the glow brightens with volume and the
ring rotates and pulses in sync with speech rhythm.

> This is the **first build**: a fully scaffolded Electron + React + TypeScript +
> Tailwind app with a working mic-reactive orb, a config-driven personality /
> theme system, and a five-state animation machine. Voice-to-text and a real LLM
> backend are stubbed behind interfaces so they can be added later without
> touching the UI.

## Tech stack

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Shell          | Electron (frameless, transparent, always-on-top)   |
| UI             | React 18 + TypeScript                              |
| Styling        | Tailwind CSS                                        |
| Animation      | Framer Motion (transforms) + Canvas 2D (ring/particles) |
| Audio          | Web Audio API (`AnalyserNode`)                      |
| State          | Zustand                                             |
| Build          | electron-vite, electron-builder                     |

## Getting started

```bash
cd nova
npm install
npm run dev        # launches Electron with hot-reload
```

Grant microphone access when prompted, then open **Settings** (right-click the
orb or use the tray icon) and press **Start microphone**. Speak — the glow and
pulse react in real time.

```bash
npm run build        # production build into ./out
npm run build:mac    # or :win / :linux — packaged app via electron-builder
npm run typecheck    # node + web TypeScript projects
```

## Project structure

```
src/
  main/          Electron main process — window config, tray, IPC
    index.ts       frameless/transparent/always-on-top BrowserWindow
    tray.ts        system tray menu
  preload/       contextIsolated bridge (window.nova)
  renderer/
    components/    Orb, Ring (canvas), GlowText, SettingsPanel
    audio/         AudioService (mic + AnalyserNode) + useMicAnalyser hook
    animation/     glowIntensity + ringMotion pure calculators
    state/         Zustand store (assistantState, audioLevels, theme, settings)
    config/        personality.config.ts, themes.ts
    services/      assistant.ts (LLM backend abstraction, stubbed)
  shared/        types shared between main + renderer
```

## Animation model

- **Voice-reactive glow** — `AnalyserNode` is sampled every animation frame; RMS
  volume is smoothed with an exponential moving average (`smoothingFactor`) so
  the glow breathes rather than flickers. Silence settles to a slow idle sine.
- **Rotation** — continuous clockwise spin (`baseRotationSpeed`), sped up while
  speaking/thinking (`activeRotationMultiplier`). The wordmark counter-rotates so
  it stays upright.
- **Pulse** — syllable-like onsets (volume rising above a running average) push a
  Framer Motion **spring** target so the ring scales up to ~108% and springs back
  naturally. Rotation (`rotate`) and pulse (`scale`) are separate transforms.

## States

`idle → listening → speaking → thinking → responding`

- `idle` — mic off, slow ambient pulse
- `listening` — mic on, dim + subtle shimmer
- `speaking` — full reactive glow + pulse (user talking)
- `thinking` — faster uniform spin, steady pulse (NOVA processing)
- `responding` — bright, lively glow while NOVA "speaks"

The audio layer only arbitrates `listening ↔ speaking`; `thinking`/`responding`
are owned by `services/assistant.ts`, so the two pipelines stay independent.

## Configuration

Behavior lives in **`src/renderer/config/personality.config.ts`** (rotation
speed, pulse/glow sensitivity, smoothing, onset threshold) and themes in
**`src/renderer/config/themes.ts`**. No animation code reads colors or tuning
constants directly — everything flows through these config objects and the
store, so new skins and personalities are drop-in.

## Designed for future expansion

- **Voice pipeline** — `AudioService.getStream()` exposes the raw `MediaStream`
  so a speech-to-text service can consume the same mic without changing the
  animation code.
- **LLM backend** — `services/assistant.ts` defines an `AssistantBackend`
  interface with a single `sendMessage()`. Today it's a stub; swap in the
  Anthropic API by calling `assistant.useBackend(...)` — zero UI changes.
- **Theming** — colors + font come from config, not components.
- **State/plugins** — the Zustand store is the single source of truth; hotkeys,
  wake-word, and tray actions subscribe to it without touching rendering.
- **Packaging** — `electron-builder.yml` already targets macOS, Windows, Linux.

## Notes

- The window is transparent and click-through everywhere except the orb: the
  renderer toggles `setIgnoreMouseEvents` on pointer enter/leave so clicks pass
  to the desktop underneath.
- Drop `Orbitron-Bold.woff2` into `resources/fonts/` for the exact reference
  lettering (see `resources/fonts/README.md`); otherwise the system sans-serif
  is used as a fallback.
