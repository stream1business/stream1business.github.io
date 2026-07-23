import { useEffect, useRef } from 'react'
import { useNovaStore } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'
import { rotationSpeedDegPerSec } from '@renderer/animation/useRingAnimation'
import type { NovaTheme } from '@renderer/config/theme.config'

interface RingProps {
  /** Diameter of the drawing surface in CSS pixels. */
  size: number
}

interface Particle {
  angle: number // radians around the ring
  radiusJitter: number // 0..1 offset from ring toward/away from centre
  size: number
  baseOpacity: number
  twinkle: number // phase offset for twinkle
  drift: number // angular drift speed
}

/**
 * The braided, voice-reactive ring, drawn on a Canvas 2D surface.
 *
 * Everything time-varying is read from the store *inside* the RAF loop (not via
 * React state) so the 60fps render never triggers React re-renders. The ring
 * geometry is an organic, wavy braid rather than a clean circle, matching the
 * "flowing energy" look of the reference art.
 */
export function Ring({ size }: RingProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const angleRef = useRef(0)
  const lastRef = useRef<number | null>(null)

  // Seed the stardust once.
  if (particlesRef.current.length === 0) {
    const count = 220
    for (let i = 0; i < count; i++) {
      const nearRing = Math.random() < 0.7
      particlesRef.current.push({
        angle: Math.random() * Math.PI * 2,
        radiusJitter: nearRing
          ? (Math.random() - 0.5) * 0.14
          : (Math.random() - 0.5) * 0.6,
        size: Math.random() * 1.8 + 0.4,
        baseOpacity: Math.random() * 0.7 + 0.1,
        twinkle: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.0006
      })
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const render = (t: number): void => {
      if (lastRef.current === null) lastRef.current = t
      const dt = (t - lastRef.current) / 1000
      lastRef.current = t

      const { assistantState, audioLevels, settings, theme } = useNovaStore.getState()

      // Integrate rotation from the state-dependent speed.
      angleRef.current =
        (angleRef.current +
          (rotationSpeedDegPerSec(assistantState, settings) * Math.PI) / 180 * dt) %
        (Math.PI * 2)

      const glow = computeGlow(assistantState, audioLevels, settings, t)

      drawFrame(ctx, {
        size,
        theme,
        angle: angleRef.current,
        glow: glow.intensity,
        blur: glow.blur,
        volume: audioLevels.volume,
        peak: audioLevels.peak,
        state: assistantState,
        time: t,
        particles: particlesRef.current
      })

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none select-none"
    />
  )
}

interface FrameArgs {
  size: number
  theme: NovaTheme
  angle: number
  glow: number
  blur: number
  volume: number
  peak: boolean
  state: string
  time: number
  particles: Particle[]
}

function drawFrame(ctx: CanvasRenderingContext2D, a: FrameArgs): void {
  const { size, theme, angle, glow, volume, time, particles } = a
  const cx = size / 2
  const cy = size / 2
  const baseRadius = size * 0.34
  // Volume-driven breathing on the ring radius (small, springy-feeling).
  const radius = baseRadius * (1 + volume * 0.06 + (a.peak ? 0.02 : 0))

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(cx, cy)

  // ---- Outer glow halo -------------------------------------------------
  const halo = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 1.7)
  halo.addColorStop(0, hexToRgba(theme.warmEdge, 0.0))
  halo.addColorStop(0.6, hexToRgba(theme.warmEdge, 0.05 + glow * 0.12))
  halo.addColorStop(0.8, hexToRgba(theme.coolEdge, 0.04 + glow * 0.1))
  halo.addColorStop(1, hexToRgba(theme.coolEdge, 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, radius * 1.7, 0, Math.PI * 2)
  ctx.fill()

  // ---- Lens-flare streaks to the right --------------------------------
  drawFlares(ctx, radius, theme, glow, time)

  // ---- The braided ring ------------------------------------------------
  ctx.rotate(angle)
  drawBraidedRing(ctx, radius, theme, glow, time)

  // ---- Stardust particles ---------------------------------------------
  ctx.rotate(-angle) // particles have their own slow drift, unrotated
  drawParticles(ctx, particles, radius, theme, glow, time)

  ctx.restore()
}

/**
 * The ring itself: several overlapping, slightly-offset wavy strands that read
 * as a woven braid of light, with a teal→violet sweep and a dark inner shadow.
 */
function drawBraidedRing(
  ctx: CanvasRenderingContext2D,
  radius: number,
  theme: NovaTheme,
  glow: number,
  time: number
): void {
  const strands = 3
  const segments = 220

  ctx.globalCompositeOperation = 'lighter'
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * Math.PI * 2
    const strandWave = 0.02 + s * 0.006
    const lineWidth = (radius * 0.05) * (1 - s * 0.18)

    ctx.beginPath()
    for (let i = 0; i <= segments; i++) {
      const th = (i / segments) * Math.PI * 2
      // Organic, non-circular wobble that slowly evolves over time.
      const wobble =
        Math.sin(th * 6 + phase + time / 1400) * strandWave +
        Math.sin(th * 11 - phase - time / 2000) * (strandWave * 0.5)
      const r = radius * (1 + wobble)
      const x = Math.cos(th) * r
      const y = Math.sin(th) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    // Gradient across the ring: cool on one side, warm on the other.
    const grad = ctx.createLinearGradient(-radius, -radius, radius, radius)
    grad.addColorStop(0, hexToRgba(theme.coolEdge, 0.25 + glow * 0.55))
    grad.addColorStop(0.5, hexToRgba(theme.glowEdge, 0.2 + glow * 0.4))
    grad.addColorStop(1, hexToRgba(theme.warmEdge, 0.25 + glow * 0.55))
    ctx.strokeStyle = grad
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.shadowColor = hexToRgba(theme.glowEdge, 0.6 + glow * 0.4)
    ctx.shadowBlur = 18 + glow * 26
    ctx.stroke()
  }

  // Inner braid shadow to give the "deep indigo" depth between strands.
  ctx.globalCompositeOperation = 'source-over'
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(theme.deepShadow, 0.35)
  ctx.lineWidth = radius * 0.02
  ctx.shadowBlur = 0
  ctx.stroke()
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  radius: number,
  theme: NovaTheme,
  glow: number,
  time: number
): void {
  ctx.globalCompositeOperation = 'lighter'
  for (const p of particles) {
    p.angle += p.drift
    const r = radius * (1 + p.radiusJitter)
    const x = Math.cos(p.angle) * r
    const y = Math.sin(p.angle) * r
    const twinkle = 0.6 + Math.sin(time / 500 + p.twinkle) * 0.4
    const opacity = Math.min(1, p.baseOpacity * twinkle * (0.5 + glow * 0.9))
    ctx.beginPath()
    ctx.arc(x, y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(theme.particle, opacity)
    ctx.shadowColor = hexToRgba(theme.particle, opacity)
    ctx.shadowBlur = 4
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowBlur = 0
}

/** A few thin horizontal light-flare streaks extending to the right. */
function drawFlares(
  ctx: CanvasRenderingContext2D,
  radius: number,
  theme: NovaTheme,
  glow: number,
  time: number
): void {
  const flicker = 0.5 + Math.sin(time / 700) * 0.5
  const alpha = (0.05 + glow * 0.12) * flicker
  ctx.globalCompositeOperation = 'lighter'
  const streaks = [
    { y: -radius * 0.05, w: radius * 2.4, h: 1.4 },
    { y: radius * 0.02, w: radius * 1.7, h: 0.9 },
    { y: radius * 0.12, w: radius * 1.1, h: 0.7 }
  ]
  for (const st of streaks) {
    const grad = ctx.createLinearGradient(0, 0, st.w, 0)
    grad.addColorStop(0, hexToRgba(theme.glowCore, alpha))
    grad.addColorStop(0.4, hexToRgba(theme.coolEdge, alpha * 0.6))
    grad.addColorStop(1, hexToRgba(theme.coolEdge, 0))
    ctx.fillStyle = grad
    ctx.fillRect(radius * 0.6, st.y - st.h / 2, st.w, st.h)
  }
  ctx.globalCompositeOperation = 'source-over'
}

/** Convert #RRGGBB + alpha to an rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
