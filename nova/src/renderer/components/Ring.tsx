import { useEffect, useRef } from 'react'
import { novaSnapshot } from '@renderer/state/store'
import { computeGlow } from '@renderer/animation/glow'
import { rotationSpeed } from '@renderer/animation/ringMotion'
import type { NovaTheme } from '@renderer/config/theme.config'

interface RingProps {
  size: number
}

interface Particle {
  /** Angle around the ring, radians. */
  angle: number
  /** Radius offset from the ring centerline as a fraction of ring radius. */
  radial: number
  /** Base radius (0..1) of the ring the particle orbits. */
  base: number
  size: number
  baseAlpha: number
  /** Individual twinkle phase. */
  phase: number
  drift: number
}

const PARTICLE_COUNT = 220
const BRAID_STRANDS = 3
const SEGMENTS = 220

function makeParticles(): Particle[] {
  const ps: Particle[] = []
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Bias particles to cluster near the ring (radial close to 0).
    const clustered = Math.pow(Math.random(), 2)
    ps.push({
      angle: Math.random() * Math.PI * 2,
      radial: (Math.random() - 0.5) * 0.9 * (0.2 + clustered),
      base: 0.82,
      size: 0.4 + Math.random() * 1.8,
      baseAlpha: 0.1 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.0006
    })
  }
  return ps
}

/**
 * Canvas-2D renderer for the braided, particle-flecked NOVA ring.
 *
 * Rendering (rotation + glow) runs in a self-contained requestAnimationFrame
 * loop that reads a non-reactive store snapshot each frame, so it never causes
 * React re-renders. Scale/pulse is applied by the parent Orb via a CSS
 * transform, keeping rotation and scale as independent transforms.
 */
export function Ring({ size }: RingProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>(makeParticles())
  const rotationRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    let last = performance.now()
    const start = last

    const render = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const elapsed = (now - start) / 1000

      const snap = novaSnapshot()
      const { assistantState, audioLevels, personality, theme, settings } = snap

      const glow = computeGlow(
        assistantState,
        audioLevels,
        personality,
        settings.glowMaster,
        elapsed
      )

      // Advance rotation independent of scale.
      const degPerSec = rotationSpeed(assistantState, personality)
      rotationRef.current =
        (rotationRef.current + degPerSec * dt) % 360

      draw(ctx, {
        size,
        theme,
        rotationDeg: rotationRef.current,
        glowIntensity: glow.intensity,
        glowBlur: glow.blur,
        brightness: glow.brightness,
        elapsed,
        audio: audioLevels,
        state: assistantState,
        particles: particlesRef.current
      })

      rafRef.current = requestAnimationFrame(render)
    }

    rafRef.current = requestAnimationFrame(render)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}

interface DrawState {
  size: number
  theme: NovaTheme
  rotationDeg: number
  glowIntensity: number
  glowBlur: number
  brightness: number
  elapsed: number
  audio: import('@shared/types').AudioLevels
  state: import('@shared/types').AssistantState
  particles: Particle[]
}

function draw(ctx: CanvasRenderingContext2D, s: DrawState): void {
  const { size, theme, rotationDeg, glowIntensity, brightness, elapsed } = s
  const cx = size / 2
  const cy = size / 2
  const ringR = size * 0.34

  ctx.clearRect(0, 0, size, size)

  // Ambient inner halo so the "NOVA" text sits on a soft field of light.
  const halo = ctx.createRadialGradient(cx, cy, ringR * 0.2, cx, cy, ringR * 1.25)
  halo.addColorStop(0, withAlpha(theme.ring.warm, 0.05 + glowIntensity * 0.08))
  halo.addColorStop(0.6, withAlpha(theme.ring.cool, 0.03 + glowIntensity * 0.05))
  halo.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, ringR * 1.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotationDeg * Math.PI) / 180)

  // --- Braided ring: several offset, wavy strands sharing a gradient -------
  const grad = ctx.createLinearGradient(-ringR, -ringR, ringR, ringR)
  grad.addColorStop(0, theme.ring.cool)
  grad.addColorStop(0.5, mix(theme.ring.cool, theme.ring.warm, 0.5))
  grad.addColorStop(1, theme.ring.warm)

  ctx.globalCompositeOperation = 'lighter'

  for (let strand = 0; strand < BRAID_STRANDS; strand++) {
    const strandPhase = (strand / BRAID_STRANDS) * Math.PI * 2
    const strandWidth = size * (0.008 + 0.004 * (strand % 2))

    ctx.beginPath()
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = (i / SEGMENTS) * Math.PI * 2
      // Organic, braided wobble — layered sines make it non-geometric.
      const wob =
        Math.sin(t * 6 + strandPhase + elapsed * 0.6) * 0.02 +
        Math.sin(t * 13 - strandPhase * 1.5) * 0.012 +
        Math.sin(t * 3 + elapsed * 0.3) * 0.015
      const braid = Math.sin(t * 9 + strandPhase) * 0.018
      const r = ringR * (1 + wob + braid)
      const x = Math.cos(t) * r
      const y = Math.sin(t) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    // Deep braid shadow underlay for depth.
    ctx.lineWidth = strandWidth * 2.4
    ctx.strokeStyle = withAlpha(theme.ring.shadow, 0.7)
    ctx.shadowBlur = 0
    ctx.stroke()

    // Glowing colored strand.
    ctx.lineWidth = strandWidth
    ctx.strokeStyle = grad
    ctx.shadowColor = strand % 2 === 0 ? theme.ring.cool : theme.ring.warm
    ctx.shadowBlur = s.glowBlur * (0.5 + brightness)
    ctx.globalAlpha = 0.55 + brightness * 0.45
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // --- Fine inner circuit/particle dust that rotates with the ring ---------
  ctx.shadowBlur = 0
  for (const p of s.particles) {
    p.angle += p.drift + 0.0008 // slow orbital drift + steady spin
    const twinkle = 0.5 + 0.5 * Math.sin(elapsed * 2 + p.phase)
    const r = ringR * (p.base + p.radial * 0.35)
    const x = Math.cos(p.angle) * r
    const y = Math.sin(p.angle) * r
    const alpha =
      p.baseAlpha * twinkle * (0.4 + glowIntensity) * (1 - Math.abs(p.radial))
    if (alpha <= 0.01) continue
    ctx.fillStyle = withAlpha(theme.particle, Math.min(0.85, alpha))
    ctx.beginPath()
    ctx.arc(x, y, p.size, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()

  // --- Horizontal lens-flare streaks (do NOT rotate) -----------------------
  drawFlares(ctx, cx, cy, ringR, theme, glowIntensity)

  // --- Responding state: a bright arc that sweeps the ring like a loader ---
  if (s.state === 'responding') {
    drawResponderArc(ctx, cx, cy, ringR, theme, elapsed)
  }

  ctx.globalCompositeOperation = 'source-over'
}

function drawFlares(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ringR: number,
  theme: NovaTheme,
  intensity: number
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const flareY = cy - ringR * 0.15
  const g = ctx.createLinearGradient(cx, flareY, cx + ringR * 2.4, flareY)
  g.addColorStop(0, withAlpha(theme.ring.cool, 0.35 * (0.4 + intensity)))
  g.addColorStop(0.4, withAlpha(theme.text.glowEdge, 0.12 * (0.4 + intensity)))
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.strokeStyle = g
  for (let i = 0; i < 3; i++) {
    ctx.lineWidth = (i === 1 ? 2.2 : 1) * (0.6 + intensity)
    ctx.beginPath()
    ctx.moveTo(cx + ringR * 0.9, flareY + (i - 1) * 6)
    ctx.lineTo(cx + ringR * 2.5, flareY + (i - 1) * 14)
    ctx.stroke()
  }
  ctx.restore()
}

function drawResponderArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ringR: number,
  theme: NovaTheme,
  elapsed: number
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const head = (elapsed * 2.2) % (Math.PI * 2)
  const sweep = Math.PI * 0.5
  const g = ctx.createLinearGradient(cx - ringR, cy, cx + ringR, cy)
  g.addColorStop(0, withAlpha(theme.ring.cool, 0))
  g.addColorStop(1, withAlpha(theme.text.glowCore, 0.9))
  ctx.strokeStyle = g
  ctx.lineWidth = ringR * 0.03
  ctx.lineCap = 'round'
  ctx.shadowColor = theme.ring.warm
  ctx.shadowBlur = 24
  ctx.beginPath()
  ctx.arc(cx, cy, ringR * 1.04, head - sweep, head)
  ctx.stroke()
  ctx.restore()
}

// --- tiny color helpers -----------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const bl = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${bl})`
}
