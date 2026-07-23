# NOVA — Desktop AI Assistant Orb

A floating, always-on-top, voice-reactive orb widget for the desktop. NOVA
renders a braided ring of teal→violet light wrapped around the word **NOVA**
that reacts live to microphone input — the glow brightens with your voice and
the ring rotates and pulses in sync with speech rhythm.

Built with **Electron + React 18 + TypeScript + Tailwind CSS**, with
**Framer Motion** for spring physics and **Canvas 2D** for the ring render
layer. Real-time audio comes from the **Web Audio API** (`AnalyserNode`), and
NOVA can talk to the **Claude Messages API** when an API key is present (it
runs fully offline otherwise).

---

## Browser preview (no install)

Don't want to install Electron just to see the orb? Two self-contained pages
(the Orbitron font is inlined in each) port the real render layer — the same
canvas ring, glow math, pulse spring, rotation, and state machine:

- [`preview/index.html`](preview/index.html) — the **instrument console**: every
  control and readout laid out for inspecting the animation.
- [`preview/live.html`](preview/live.html) — the **live rendition**: a
  full-screen, cinematic presentation with the orb filling the frame, a silent
  ambient "living glow" that autoplays on load, and a minimal control dock that
  dims out of the way.

Both work the same way under the hood:

- **Enable microphone** to drive the ring live from your voice, or **Play demo
  voice** for a synthetic speech envelope that exercises the same pipeline
  (handy when a sandboxed frame blocks the mic).
- Flip through the `idle / listening / speaking / thinking / responding`
  states, swap themes, and tune pulse/glow/smoothing live.

Only the desktop-specific pieces (transparent always-on-top window,
click-through, tray, drag) are absent — those exist solely in the Electron
build below.

---

## Quick start

```bash
cd nova-desktop
npm install
npm run dev      # launches the Electron app with hot reload
```

Right-click the orb (or use the tray menu) to open settings — enable the
microphone, switch themes, tune sensitivities, drive the state machine, or type
into **Ask NOVA** — or tap the **🎙 mic button and speak** — to talk to Claude,
watch the reply stream in, and **hear NOVA speak it aloud** as the ring moves
through `thinking → responding → listening`. Set `ANTHROPIC_API_KEY` for real
replies (see below); without it NOVA runs in offline stub mode. Settings and
tuning persist across restarts.

Press **Ctrl/Cmd + Shift + Space** anywhere to show or hide the orb.

### Package for distribution

```bash
npm run build            # typecheck + bundle main/preload/renderer only
npm run pack             # build + an unpacked app in dist/ (fast smoke test)
npm run dist             # build + installers for the current OS
npm run build:mac        # force a specific target: :mac / :win / :linux
```

`electron-builder` (config in `electron-builder.yml`) writes to `dist/`:

| Platform | Output |
|----------|--------|
| macOS    | `NOVA-<version>.dmg` + a `.zip` (the zip lets the in-app updater patch) |
| Windows  | `nova-desktop-assistant-<version>-setup.exe` (NSIS; user picks the install dir, desktop + start-menu shortcuts) |
| Linux    | `NOVA-<version>.AppImage` (portable, self-contained) |

Only the app bundle (`out/`) and production dependencies ship — the Anthropic
SDK is externalized so it's included, while Vite-bundled UI libs
(React, Framer Motion, Zustand) are dev-only and pruned. Each OS's installer
must be built **on that OS** (electron-builder doesn't cross-compile installers).

**Code signing / notarization:** builds are unsigned by default, so macOS
Gatekeeper and Windows SmartScreen will warn on first launch. To sign, provide
the usual electron-builder credentials (`CSC_LINK` / `CSC_KEY_PASSWORD` on
Windows/macOS, plus `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`
for macOS notarization) — no config change needed.

**Auto-update:** `src/main/updater.ts` checks for updates on launch in packaged
builds (via `electron-updater`, feed configured in `electron-builder.yml` →
`publish`). It's fully defensive — a no-op in development and silent if the feed
is unreachable — so it never interrupts the assistant. Ship updates by
publishing a GitHub release with the generated artifacts.

### Test

```bash
npm test                 # run the unit suite once (Vitest)
npm run test:watch       # re-run on change
```

The suite covers the pure core the whole product rests on — the audio DSP
(`audio/signal.ts`: RMS loudness, EMA smoothing, syllable-onset detection with
its refractory guard, band energy) and the animation math (`animation/glow.ts`,
`animation/rotation.ts`) — plus theme resolution. It runs in plain Node with no
Electron, Web Audio, or DOM, so it's fast and CI-friendly; a GitHub Actions
workflow (`.github/workflows/nova-desktop-ci.yml`) runs typecheck + tests on
every change under `nova-desktop/`.

---

## How it works

### Window (Electron main)
- `src/main/window.ts` — frameless, `transparent: true`, `alwaysOnTop`,
  `skipTaskbar`. Starts with `setIgnoreMouseEvents(true)` so clicks pass
  through the transparent corners to the desktop; the renderer re-enables
  hit-testing only while the pointer is over the ring.
- `src/main/tray.ts` — minimal system-tray menu (quit, toggles, manual state).
- `src/main/hotkeys.ts` — global shortcuts (Ctrl/Cmd+Shift+Space toggles the
  orb's visibility); a seam for push-to-talk / wake-word bypass later.
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
- `src/renderer/audio/transcription.ts` — the **speech-to-text** hook point.
  The UI depends only on the `TranscriptionService` interface;
  `createTranscription()` picks the backend:
  - `WhisperTranscription` — records the mic with `MediaRecorder` and sends the
    clip to the main process (`src/main/transcription.ts`), which POSTs it to an
    OpenAI-compatible `/audio/transcriptions` endpoint. Reliable everywhere; the
    API key never leaves the main process. **Preferred when configured.**
  - `WebSpeechTranscription` — Chromium's built-in recognizer (no key, no
    network of ours; streams interim results). Used when Whisper isn't
    configured.
  - `NullTranscription` — no-op fallback that reports "unavailable".
- `src/renderer/audio/useVoiceInput.ts` — the "talk to NOVA" hook: manages the
  transcription lifecycle, exposes the live interim transcript, and hands a
  finalised utterance to `useAssistant().ask()`, so **speech flows straight into
  Claude** and the orb runs `listening → thinking → responding`.
- `src/renderer/audio/speech.ts` — the **text-to-speech** service. NOVA speaks
  each reply aloud via the platform's `speechSynthesis` (offline, no key, works
  in Electron), while the orb holds `responding`. A process-wide singleton
  enables **barge-in** — asking again or opening the mic cancels current speech.
  Toggle it with **Speak replies** in settings. A cloud TTS backend can slot in
  behind the same `SpeechService` interface.

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
  `assistantState`, `audioLevels`, `theme`, `settings`, `personality`, and the
  last assistant `exchange`. New features (hotkeys, wake-word, tray actions)
  subscribe here without touching the render components. User-tunable slices
  (`settings`, `personality`) are persisted to `localStorage` and restored on
  launch — the write is guarded so the 60 fps audio updates never touch disk.
- `src/renderer/state/useAssistant.ts` — the hook the **Ask NOVA** input calls;
  it runs the prompt through the backend and lets the assistant drive the state
  machine, keeping the UI decoupled from whatever backend is wired in.

### Config (not hardcoded)
- `src/renderer/config/personality.config.ts` — tuning: rotation speeds,
  pulse/glow sensitivity, idle pulse period, EMA smoothing, peak threshold.
- `src/renderer/config/themes.ts` — swappable colour/typography "skins"
  (`novaDefault`, `emberForge`, `arcticPulse`).

### Assistant backend (real Anthropic API)
- `src/services/assistant.ts` — a single `sendMessage()` interface behind which
  `createAssistant()` picks the backend. `RemoteAssistant` talks to the real
  **Claude Messages API** (`claude-opus-4-8`); `StubAssistant` is the offline
  fallback. The UI is identical either way.
- `src/main/assistant.ts` — the **only** place the Anthropic SDK and API key
  live. The renderer never holds the key: it calls `window.nova.assistant.send()`,
  which IPCs to the main process, which runs `client.messages.stream(...)` and
  forwards each token back over `nova:assistant-delta`. Replies **stream** into
  the panel live, and drive the state machine (`thinking → responding →
  listening`).

**Enabling it:** set `ANTHROPIC_API_KEY` in the environment before launching
(`ANTHROPIC_API_KEY=sk-ant-... npm run dev`). Without a key, NOVA runs in
offline stub mode and says so — no crash, no config needed to try the UI.

**Voice (Whisper) config:** to use the reliable cloud transcription backend,
set an STT key. It targets an OpenAI-compatible endpoint, so it works with
OpenAI Whisper by default or any compatible service (e.g. Groq) via env vars:

| Env var             | Default                          | Purpose                          |
|---------------------|----------------------------------|----------------------------------|
| `NOVA_STT_API_KEY`  | falls back to `OPENAI_API_KEY`, then `GROQ_API_KEY` | the transcription API key |
| `NOVA_STT_BASE_URL` | `https://api.openai.com/v1`      | OpenAI-compatible base URL       |
| `NOVA_STT_MODEL`    | `whisper-1`                      | transcription model              |

When no STT key is set, voice falls back to the browser's Web Speech recognizer.

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

## App icon

The application icon is the NOVA ring mark on a dark rounded tile, wired into
`electron-builder.yml` per platform (Linux → png, Windows → ico, macOS → icns).

It comes in two renderings that share one palette:

- **detailed** (`resources/icon.png`, 1024²) — braided ring, stardust, layered
  glow; used at large sizes.
- **flat** (`resources/icon-small.png`, 512²) — a single smooth gradient ring
  with a thick stroke and minimal glow, so it stays legible at 16–32px where
  the detailed art turns to mush. Used for the system-tray glyph.

The Windows `resources/icon.ico` is a multi-image container: the flat art fills
the 16/24/32/48px frames and the detailed art the 64/128/256px frames, so each
size shows the rendering that reads best.

The icons are generated from a single script and committed, so packaging never
depends on the generator:

```bash
npm run icon    # regenerates resources/icon.{png,ico,icns}  (requires Pillow)
```

Edit `scripts/generate-icon.py` (it reuses the brand palette) and re-run to
tweak the mark.

## Future expansion (designed in, not bolted on)

- **Voice pipeline:** tap `AudioEngine.stream` for STT — analysis code is
  isolated from capture.
- **LLM backend:** implement `Assistant` and return it from `createAssistant()`.
- **Theming:** add entries to `themes.ts` (or load JSON skins).
- **Plugins/state:** subscribe to the Zustand store.
- **Packaging:** `electron-builder.yml` already targets macOS / Windows / Linux.
