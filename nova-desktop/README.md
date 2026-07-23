# NOVA — Desktop AI Assistant Orb

A floating, always-on-top, voice-reactive orb widget for the desktop. NOVA
renders a braided ring of teal→violet light wrapped around the word **NOVA**
that reacts live to microphone input — the glow brightens with your voice and
the ring rotates and pulses in sync with speech rhythm.

Built with **Electron + React 18 + TypeScript + Tailwind CSS**, with
**Framer Motion** for spring physics and **Canvas 2D** for the ring render
layer. Real-time audio comes from the **Web Audio API** (`AnalyserNode`); no
external services are required for this build.

---

## Quick start

```bash
cd nova-desktop
npm install
npm run dev      # launches the Electron app with hot reload
```

Right-click the orb (or use the tray menu) to open settings, enable the
microphone, switch themes, and drive the state machine manually.

### Build a distributable

```bash
npm run build            # typecheck + bundle main/preload/renderer
npm run build:mac        # or :win / :linux  (electron-builder)
```

---

## How it works

### Window (Electron main)
- `src/main/window.ts` — frameless, `transparent: true`, `alwaysOnTop`,
  `skipTaskbar`. Starts with `setIgnoreMouseEvents(true)` so clicks pass
  through the transparent corners to the desktop; the renderer re-enables
  hit-testing only while the pointer is over the ring.
- `src/main/tray.ts` — minimal system-tray menu (quit, toggles, manual state).
- `src/main/ipc.ts` + `src/preload/index.ts` — a narrow, typed `window.nova`
  bridge (contextIsolation on, nodeIntegration off).

### Audio (renderer)
- `src/renderer/audio/analyser.ts` — the **only** place that touches raw audio
  buffers. Computes RMS loudness, an EMA-smoothed envelope, syllable-onset
  peaks, and 3-band frequency energy. Exposes the live `MediaStream` so a
  future speech-to-text pipeline (e.g. Whisper) can tap it **without touching
  the animation code**.
- `src/renderer/audio/useMicrophone.ts` — owns the mic lifecycle, pumps
  `AudioLevels` into the store each frame, and derives coarse
  `listening ↔ speaking` transitions from voice activity.

### Animation
- `src/renderer/animation/glow.ts` — pure functions mapping audio + state →
  glow intensity/blur/opacity and the target pulse scale.
- `src/renderer/animation/rotation.ts` — angular velocity per state (rotation
  is kept independent from scale/glow so each can be tuned separately).
- `src/renderer/components/Ring.tsx` — Canvas-2D braided ring, stardust
  particles, lens flares, and inner circuit shimmer.
- `src/renderer/components/GlowText.tsx` — the layered "NOVA" wordmark
  (gradient fill + glass inner shadow + independently animated outer glow).
- `src/renderer/components/Orb.tsx` — composites the ring + text and applies
  the Framer Motion **spring** for natural breathing recoil on each peak.

### State
- `src/renderer/state/store.ts` — a single Zustand store holding
  `assistantState`, `audioLevels`, `theme`, `settings`, and `personality`.
  New features (hotkeys, wake-word, tray actions) subscribe here without
  touching the render components.

### Config (not hardcoded)
- `src/renderer/config/personality.config.ts` — tuning: rotation speeds,
  pulse/glow sensitivity, idle pulse period, EMA smoothing, peak threshold.
- `src/renderer/config/themes.ts` — swappable colour/typography "skins"
  (`novaDefault`, `emberForge`, `arcticPulse`).

### Assistant backend abstraction
- `src/services/assistant.ts` — a single `sendMessage()` interface. Today a
  local `StubAssistant` simulates `thinking → responding → listening`. Swap in
  a real API (e.g. the Anthropic Messages API) later by implementing the same
  interface and changing one line in `createAssistant()` — **zero UI changes**.

---

## State machine

| State        | Behaviour                                                        |
|--------------|-----------------------------------------------------------------|
| `idle`       | mic inactive, slow ~4s ambient sine breathing only              |
| `listening`  | mic active, dimmed, subtle shimmer                              |
| `speaking`   | full voice-reactive glow + syllable-peak pulse + faster spin    |
| `thinking`   | uniform faster spin, steady (non-mic) pulse                     |
| `responding` | bright glow that flows around the ring like a loading spinner   |

---

## Fonts

The wordmark uses **Orbitron**, bundled with the app as a variable `.woff2`
(`src/renderer/fonts/Orbitron.woff2`, weights 400–900) so it renders
identically offline on macOS, Windows, and Linux — no system install or
network fetch required. Vite fingerprints and bundles the file at build time.
A graceful fallback stack (`Michroma`, `Rajdhani`, `sans-serif`) covers the
unlikely case the font fails to load. Orbitron is licensed under the SIL Open
Font License 1.1 (see `src/renderer/fonts/OFL.txt`).

## Future expansion (designed in, not bolted on)

- **Voice pipeline:** tap `AudioEngine.stream` for STT — analysis code is
  isolated from capture.
- **LLM backend:** implement `Assistant` and return it from `createAssistant()`.
- **Theming:** add entries to `themes.ts` (or load JSON skins).
- **Plugins/state:** subscribe to the Zustand store.
- **Packaging:** `electron-builder.yml` already targets macOS / Windows / Linux.
