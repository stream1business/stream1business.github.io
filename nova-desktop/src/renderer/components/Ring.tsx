import { useEffect, useRef } from 'react'
import { useNovaStore } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'
import { rotationSpeedDegPerSec } from '@renderer/animation/rotation'
import type { NovaTheme } from '@renderer/config/themes'

/**
 * Canvas-2D renderer for the braided, voice-reactive ring of light.
 *
 * Everything visual about the ring lives here: the organic (non-geometric)
 * braided strands, the teal→violet gradient, the stardust particles, the
 * inner circuit shimmer, and the right-side lens-flare streaks. It reads the
 * live audio + state + theme from the store on every animation frame.
 *
 * Rotation (angle) and pulse (scale) are computed independently so they can be
 * tuned separately, exactly as the spec requires.
 */

interface Particle {
  angle: number // position around the ring
  radius: number // distance from centre (as fraction of ring radius)
  size: number
  baseAlpha: number
  twinkle: number // phase offset for twinkling
  drift: number // slow angular drift speed
}

const PARTICLE_COUNT = 220

function makeParticles(): Particle[] {
  const particles: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Denser near the ring itself: bias radius toward ~1.0.
    const near = Math.random() < 0.6
    const radius = near
      ? 0.85 + Math.random() * 0.35 // hugging the ring
      : 0.3 + Math.random() * 1.1 // scattered stardust
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radius,
      size: 0.5 + Math.random() * 1.8,
      baseAlpha: 0.1 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.0008
    })
  }
  return particles
}

export function Ring({ size }: { size: number }): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const particlesRef = useRef<Particle[]>(makeParticles())
  const angleRef = useRef(0)
  const startRef = useRef<number>(performance.now())
  const lastRef = useRef<number>(performance.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const render = (now: number): void => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now
      const elapsed = (now - startRef.current) / 1000

      const { audioLevels, assistantState, personality, theme } = useNovaStore.getState()

      // --- advance independent rotation ---
      const speed = rotationSpeedDegPerSec(assistantState, personality, audioLevels.rms)
      angleRef.current = (angleRef.current + speed * dt) % 360
      const angleRad = (angleRef.current * Math.PI) / 180

      // --- glow parameters ---
      const glow = computeGlow(audioLevels, assistantState, personality, elapsed)

      drawScene(ctx, {
        size,
        theme,
        angleRad,
        elapsed,
        glow,
        rms: audioLevels.rms,
        peak: audioLevels.peak,
        bands: audioLevels.bands,
        state: assistantState,
        particles: particlesRef.current
      })

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden="true"
    />
  )
}

interface DrawArgs {
  size: number
  theme: NovaTheme
  angleRad: number
  elapsed: number
  glow: { intensity: number; blur: number; opacity: number }
  rms: number
  peak: boolean
  bands: { low: number; mid: number; high: number }
  state: string
  particles: Particle[]
}

function drawScene(ctx: CanvasRenderingContext2D, a: DrawArgs): void {
  const { size } = a
  const cx = size / 2
  const cy = size / 2
  const baseRadius = size * 0.32

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter' // additive glow

  drawParticles(ctx, cx, cy, baseRadius, a)
  drawLensFlares(ctx, cx, cy, baseRadius, a)
  drawBraidedRing(ctx, cx, cy, baseRadius, a)
  drawInnerShimmer(ctx, cx, cy, baseRadius, a)

  ctx.restore()
}

/** Stardust particles, denser near the ring, gently twinkling and drifting. */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  a: DrawArgs
): void {
  const { particles, elapsed, glow, theme } = a
  for (const p of particles) {
    p.angle += p.drift + 0.0004 // slow overall drift
    const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 2 + p.twinkle)
    const alpha = p.baseAlpha * (0.4 + twinkle * 0.6) * (0.5 + glow.opacity * 0.7)
    const r = baseRadius * p.radius
    const x = cx + Math.cos(p.angle) * r
    const y = cy + Math.sin(p.angle) * r
    const s = p.size * (1 + a.rms * 0.8)
    ctx.beginPath()
    ctx.arc(x, y, s, 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(theme.particle, Math.min(0.8, alpha))
    ctx.fill()
  }
}

/** Thin horizontal light-flare streaks extending to the right. */
function drawLensFlares(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  a: DrawArgs
): void {
  const { glow, theme, size } = a
  const streaks = [
    { y: -baseRadius * 0.15, len: size * 0.42, w: 1.4, alpha: 0.5 },
    { y: baseRadius * 0.05, len: size * 0.36, w: 1.0, alpha: 0.35 },
    { y: baseRadius * 0.28, len: size * 0.24, w: 0.8, alpha: 0.25 }
  ]
  for (const s of streaks) {
    const y = cy + s.y
    const x0 = cx + baseRadius * 0.6
    const x1 = x0 + s.len * (0.7 + glow.intensity * 0.6)
    const grad = ctx.createLinearGradient(x0, y, x1, y)
    grad.addColorStop(0, withAlpha(theme.glowCore, s.alpha * glow.opacity))
    grad.addColorStop(0.5, withAlpha(theme.coolEdge, s.alpha * 0.6 * glow.opacity))
    grad.addColorStop(1, withAlpha(theme.warmEdge, 0))
    ctx.strokeStyle = grad
    ctx.lineWidth = s.w
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
  }
}

/**
 * The braided ring: several overlapping wavy strokes whose radius wobbles with
 * angle (and a little with audio) so the ring reads as organic, flowing energy
 * rather than a clean circle. A conic-like gradient is faked by drawing the
 * ring in angular segments coloured teal→violet→teal.
 */
function drawBraidedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  a: DrawArgs
): void {
  const { angleRad, elapsed, glow, theme, rms, bands } = a
  const segments = 160
  const strands = 3

  ctx.shadowBlur = glow.blur
  ctx.shadowColor = withAlpha(theme.glowEdge, glow.opacity)

  for (let strand = 0; strand < strands; strand++) {
    const strandPhase = (strand / strands) * Math.PI * 2
    const strandWidth = 3.5 - strand * 0.8
    ctx.lineWidth = Math.max(1, strandWidth)
    ctx.lineCap = 'round'

    ctx.beginPath()
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const theta = t * Math.PI * 2 + angleRad

      // Organic radius wobble: layered sines + audio-driven jitter.
      const wobble =
        Math.sin(theta * 6 + strandPhase + elapsed * 1.3) * 0.02 +
        Math.sin(theta * 11 - elapsed * 0.7) * 0.012 +
        Math.sin(theta * 3 + strandPhase) * 0.03 +
        (bands.high + bands.mid) * 0.02 * Math.sin(theta * 9 + elapsed * 3)

      const r = baseRadius * (1 + wobble) * (1 + rms * 0.03)
      const x = cx + Math.cos(theta) * r
      const y = cy + Math.sin(theta) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }

    // Colour the whole strand with a gradient across the bounding box so one
    // side reads teal and the other violet, blending through the shadow tone.
    const grad = ctx.createLinearGradient(
      cx - baseRadius,
      cy - baseRadius,
      cx + baseRadius,
      cy + baseRadius
    )
    grad.addColorStop(0, withAlpha(theme.coolEdge, glow.opacity))
    grad.addColorStop(0.45, withAlpha(theme.coolEdge, glow.opacity * 0.9))
    grad.addColorStop(0.55, withAlpha(theme.warmEdge, glow.opacity * 0.9))
    grad.addColorStop(1, withAlpha(theme.warmEdge, glow.opacity))
    ctx.strokeStyle = grad
    ctx.stroke()
  }

  // Deep-shadow inner rim to give the braid depth.
  ctx.shadowBlur = 0
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, baseRadius * 0.9, 0, Math.PI * 2)
  ctx.strokeStyle = withAlpha(theme.deepShadow, 0.6)
  ctx.stroke()
}

/** Faint circuit/particle shimmer inside the ring. */
function drawInnerShimmer(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  a: DrawArgs
): void {
  const { elapsed, glow, theme, state } = a
  const spokes = 24
  // In `responding`, the shimmer flows around the ring like a loading spinner.
  const flow = state === 'responding' ? (elapsed * 2) % (Math.PI * 2) : 0
  for (let i = 0; i < spokes; i++) {
    const theta = (i / spokes) * Math.PI * 2 + elapsed * 0.2
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3 + i)
    let alpha = 0.06 + pulse * 0.06 * glow.intensity
    if (state === 'responding') {
      // Bright leading edge sweeping around.
      const delta = Math.abs(((theta - flow + Math.PI) % (Math.PI * 2)) - Math.PI)
      if (delta < 0.5) alpha += (0.5 - delta) * 0.5
    }
    const rInner = baseRadius * 0.2
    const rOuter = baseRadius * (0.55 + pulse * 0.2)
    const x0 = cx + Math.cos(theta) * rInner
    const y0 = cy + Math.sin(theta) * rInner
    const x1 = cx + Math.cos(theta) * rOuter
    const y1 = cy + Math.sin(theta) * rOuter
    ctx.strokeStyle = withAlpha(i % 2 === 0 ? theme.coolEdge : theme.warmEdge, alpha)
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }
}

/** Convert a hex colour + alpha (0–1) to an rgba() string. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}
