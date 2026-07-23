import { useEffect, useRef } from 'react'
import { useNovaStore } from '../state/store'
import type { NovaTheme } from '../config/themes'
import { computeGlow } from '../animation/glowIntensity'

/**
 * Ring — the animated braided ring of light plus stardust particles, drawn on
 * a Canvas 2D layer. Rotation and pulse (scale) are applied by the parent
 * <Orb> via transforms; this component owns only the *appearance* of the ring
 * (braid strands, gradient, glow intensity, particles).
 */
interface RingProps {
  size: number
}

interface Particle {
  angle: number
  radius: number // fraction of ring radius
  size: number
  baseOpacity: number
  twinkle: number
}

const PARTICLE_COUNT = 220

export function Ring({ size }: RingProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Seed particles once — denser near the ring, scattered outward.
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const nearRing = Math.random() < 0.7
      const radius = nearRing
        ? 0.82 + Math.random() * 0.22 // hug the ring
        : 0.3 + Math.random() * 0.9 // scattered dust
      return {
        angle: Math.random() * Math.PI * 2,
        radius,
        size: 0.5 + Math.random() * 1.8,
        baseOpacity: 0.1 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2
      }
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const render = (): void => {
      const { audioLevels, assistantState, theme } = useNovaStore.getState()
      const now = performance.now()
      const glow = computeGlow(audioLevels, assistantState, now)

      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const ringRadius = size * 0.36

      drawRing(ctx, cx, cy, ringRadius, theme, glow.intensity, now)
      drawParticles(ctx, cx, cy, ringRadius, theme, particlesRef.current, glow.intensity, now)

      rafRef.current = requestAnimationFrame(render)
    }
    render()

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="pointer-events-none absolute inset-0"
    />
  )
}

/** Draw the organic, braided, gradient ring with an additive glow. */
function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  theme: NovaTheme,
  intensity: number,
  now: number
): void {
  const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  gradient.addColorStop(0, theme.ringCool)
  gradient.addColorStop(0.5, blend(theme.ringCool, theme.ringWarm, 0.5))
  gradient.addColorStop(1, theme.ringWarm)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  // Several offset, wavy strands make the ring look braided/organic rather
  // than a clean geometric circle.
  const strands = 3
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * Math.PI * 2
    const strandWave = 0.03 + 0.015 * s
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
      // Wavy radius: braid wobble + slow breathing.
      const wobble =
        Math.sin(a * 6 + phase + now / 1400) * strandWave +
        Math.sin(a * 11 - now / 900) * strandWave * 0.5
      const r = radius * (1 + wobble)
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (a === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = gradient
    ctx.lineWidth = 2.5 + intensity * 2
    ctx.globalAlpha = 0.35 + 0.5 * intensity
    ctx.shadowColor = theme.glowEdge
    ctx.shadowBlur = (16 + intensity * 34) * (0.7 + s * 0.2)
    ctx.stroke()
  }

  ctx.restore()
}

/** Scatter white stardust particles, twinkling and densest near the ring. */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ringRadius: number,
  theme: NovaTheme,
  particles: Particle[],
  intensity: number,
  now: number
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const p of particles) {
    const twinkle = 0.5 + 0.5 * Math.sin(now / 600 + p.twinkle)
    const opacity = p.baseOpacity * twinkle * (0.4 + 0.6 * intensity)
    const r = ringRadius * p.radius
    // Slow drift around the ring.
    const a = p.angle + now / 26000
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    ctx.beginPath()
    ctx.arc(x, y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = theme.particle
    ctx.globalAlpha = Math.min(0.85, opacity)
    ctx.fill()
  }
  ctx.restore()
}

/** Linear blend between two hex colors. */
function blend(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(ca.r + (cb.r - ca.r) * t)
  const g = Math.round(ca.g + (cb.g - ca.g) * t)
  const bl = Math.round(ca.b + (cb.b - ca.b) * t)
  return `rgb(${r},${g},${bl})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16)
  }
}
