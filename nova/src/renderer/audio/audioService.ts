import type { AudioLevels } from '@shared/types'
import { personalityConfig } from '../config/personality.config'

/**
 * AudioService — the single owner of the microphone stream and the Web Audio
 * analysis graph.
 *
 * This layer is deliberately the *only* place that talks to `getUserMedia` /
 * `AnalyserNode`. Today it emits local volume/onset measurements for the
 * animation. Tomorrow the same `MediaStream` can be forked to a speech-to-text
 * service (Whisper, Deepgram, …) via `getStream()` — no animation code changes.
 */
export type AudioFrameHandler = (levels: AudioLevels) => void

export class AudioService {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0))
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0))
  private rafId: number | null = null

  private smoothedVolume = 0
  private runningAvg = 0
  private handler: AudioFrameHandler | null = null

  /** True once a live mic stream is being analysed. */
  get isActive(): boolean {
    return this.stream !== null
  }

  /**
   * Expose the raw stream for future consumers (STT, recording). Returns null
   * until `start()` has succeeded.
   */
  getStream(): MediaStream | null {
    return this.stream
  }

  async start(onFrame: AudioFrameHandler): Promise<void> {
    if (this.isActive) {
      this.handler = onFrame
      return
    }
    this.handler = onFrame

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false
      }
    })

    this.context = new AudioContext()
    this.source = this.context.createMediaStreamSource(this.stream)
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.6
    this.source.connect(this.analyser)

    this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount))
    this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize))

    // Resume is required on some platforms where the context starts suspended.
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    this.loop()
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.source?.disconnect()
    this.analyser?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    void this.context?.close()

    this.context = null
    this.analyser = null
    this.source = null
    this.stream = null
    this.smoothedVolume = 0
    this.runningAvg = 0
  }

  private loop = (): void => {
    if (!this.analyser) return

    this.analyser.getByteTimeDomainData(this.timeData)
    this.analyser.getByteFrequencyData(this.freqData)

    const rawVolume = computeRms(this.timeData)
    const brightness = computeBrightness(this.freqData)

    // Exponential moving average so the glow breathes rather than flickers.
    const a = personalityConfig.smoothingFactor
    this.smoothedVolume = this.smoothedVolume + a * (rawVolume - this.smoothedVolume)

    // Slow running average used as the baseline for onset detection.
    this.runningAvg = this.runningAvg + 0.02 * (rawVolume - this.runningAvg)
    const onset = rawVolume - this.runningAvg > personalityConfig.onsetThreshold

    this.handler?.({
      volume: clamp01(this.smoothedVolume),
      rawVolume: clamp01(rawVolume),
      onset,
      brightness: clamp01(brightness)
    })

    this.rafId = requestAnimationFrame(this.loop)
  }
}

/** RMS of a time-domain buffer (0..~1). */
function computeRms(timeData: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128 // center on 0
    sum += v * v
  }
  return Math.sqrt(sum / timeData.length)
}

/** Spectral centroid normalized to 0..1 — a rough "brightness" measure. */
function computeBrightness(freqData: Uint8Array): number {
  let weighted = 0
  let total = 0
  for (let i = 0; i < freqData.length; i++) {
    weighted += i * freqData[i]
    total += freqData[i]
  }
  if (total === 0) return 0
  return weighted / total / freqData.length
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Shared singleton — one mic, one analysis graph, many subscribers. */
export const audioService = new AudioService()
