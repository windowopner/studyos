'use client'

import { useEffect, useRef } from 'react'

// A ringed planet drawn on a canvas: a shaded sphere, a ring of a few thousand particles in
// perspective (inner particles orbit faster, like real rings), the planet's shadow across the
// ring, a small moon, and a starfield. The pointer tilts it a few degrees. It pauses when
// off-screen or in a background tab, and draws a single still frame for reduced motion.

type Particle = { r: number; a: number; y: number; size: number; alpha: number; tint: number }
type Star = { x: number; y: number; size: number; alpha: number; phase: number }

const TAU = Math.PI * 2

// Ring density by radius (in planet radii): bright B ring, a Cassini-style gap, fainter A ring.
function ringDensity(r: number) {
  if (r < 1.42) return 0
  if (r < 1.62) return 0.35
  if (r < 2.02) return 1
  if (r < 2.1) return 0.05
  if (r < 2.42) return 0.7
  if (r < 2.48) return 0.12
  if (r < 2.56) return 0.4
  return 0
}

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export default function OrbitScene({
  className = '',
  particles: particleCount = 2200,
  planetScale = 0.2,
  stars: starCount = 140,
  interactive = true,
}: {
  className?: string
  particles?: number
  /** Planet radius as a fraction of the canvas's shorter side. */
  planetScale?: number
  stars?: number
  interactive?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const random = seeded(7)

    const ring: Particle[] = []
    while (ring.length < particleCount) {
      const r = 1.4 + random() * 1.2
      if (random() > ringDensity(r)) continue
      ring.push({
        r,
        a: random() * TAU,
        y: (random() - 0.5) * 0.025,
        size: 0.5 + random() * random() * 1.4,
        alpha: 0.25 + random() * 0.6,
        tint: random(),
      })
    }

    let width = 0
    let height = 0
    let stars: Star[] = []
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const starRandom = seeded(42)
      stars = Array.from({ length: starCount }, () => ({
        x: starRandom() * width,
        y: starRandom() * height,
        size: starRandom() < 0.9 ? 0.6 + starRandom() * 0.6 : 1.3 + starRandom() * 0.6,
        alpha: 0.2 + starRandom() * 0.6,
        phase: starRandom() * TAU,
      }))
      if (reduceMotion) draw(0)
    }

    // Pointer tilt, eased so it glides rather than snaps.
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 }
    const onPointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      tilt.tx = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      tilt.ty = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    const onLeave = () => { tilt.tx = 0; tilt.ty = 0 }

    // Light comes from the upper left and slightly in front.
    const light = { x: -0.62, y: -0.5, z: -0.6 }
    const lightLength = Math.hypot(light.x, light.y, light.z)
    light.x /= lightLength; light.y /= lightLength; light.z /= lightLength

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      // Stars, a few of them twinkling.
      for (const star of stars) {
        const twinkle = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(time * 0.0012 + star.phase)
        ctx.globalAlpha = star.alpha * twinkle
        ctx.fillStyle = '#dfe6ff'
        ctx.fillRect(star.x, star.y, star.size, star.size)
      }
      ctx.globalAlpha = 1

      const cx = width / 2 + tilt.x * 6
      const cy = height / 2 + tilt.y * 4
      // The ring is about 5.2 planet radii wide; keep it inside narrow canvases.
      const R = Math.min(Math.min(width, height) * planetScale, width / 5.8)
      const focal = R * 9

      // Ring plane: tipped toward the viewer, rolled a little, nudged by the pointer.
      const pitch = 0.4 + tilt.y * 0.08
      const roll = -0.32 + tilt.x * 0.07
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch)
      const cosR = Math.cos(roll), sinR = Math.sin(roll)

      const project = (x: number, y: number, z: number) => {
        // Pitch around X, then roll around Z.
        const y1 = y * cosP - z * sinP
        const z1 = y * sinP + z * cosP
        const x2 = x * cosR - y1 * sinR
        const y2 = x * sinR + y1 * cosR
        const scale = focal / (focal + z1 * R)
        return { sx: cx + x2 * R * scale, sy: cy + y2 * R * scale, z: z1, scale, wx: x2, wy: y2 }
      }

      // Is a point (in planet radii, view space) inside the planet's shadow? The shadow
      // extends away from the light, so only points on the far side count.
      const inShadow = (x: number, y: number, z: number) => {
        const along = x * light.x + y * light.y + z * light.z
        if (along > 0) return false
        const px = x - along * light.x
        const py = y - along * light.y
        const pz = z - along * light.z
        return px * px + py * py + pz * pz < 1
      }

      const t = reduceMotion ? 0 : time * 0.00006
      const back: { sx: number; sy: number; size: number; alpha: number; tint: number }[] = []
      const front: typeof back = []
      for (const p of ring) {
        // Kepler: angular speed falls off with radius^1.5.
        const angle = p.a + t / Math.pow(p.r, 1.5)
        const x = Math.cos(angle) * p.r
        const z = Math.sin(angle) * p.r
        const pt = project(x, p.y, z)
        const shade = inShadow(pt.wx, pt.wy, pt.z) ? 0.18 : 1
        const item = { sx: pt.sx, sy: pt.sy, size: p.size * pt.scale, alpha: p.alpha * shade, tint: p.tint }
        if (pt.z > 0) back.push(item)
        else front.push(item)
      }

      const drawParticles = (list: typeof back) => {
        for (const p of list) {
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = p.tint > 0.82 ? '#ffe2c4' : p.tint > 0.4 ? '#dbe3ff' : '#aebdff'
          ctx.fillRect(p.sx, p.sy, p.size, p.size)
        }
        ctx.globalAlpha = 1
      }

      // Faint continuous bands under the particles so the ring reads as a surface.
      const drawBands = (side: 'back' | 'front') => {
        for (const [radius, alpha, widthPx] of [[1.8, 0.1, 6], [2.25, 0.07, 5], [1.52, 0.05, 3]] as const) {
          ctx.beginPath()
          let started = false
          for (let i = 0; i <= 160; i++) {
            const angle = (i / 160) * TAU
            const pt = project(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
            const visible = side === 'back' ? pt.z > 0 : pt.z <= 0
            if (visible) {
              if (started) ctx.lineTo(pt.sx, pt.sy)
              else ctx.moveTo(pt.sx, pt.sy)
              started = true
            } else {
              started = false
            }
          }
          ctx.strokeStyle = `rgba(190, 205, 255, ${alpha})`
          ctx.lineWidth = widthPx * (R / 90)
          ctx.stroke()
        }
      }

      // Moon on an inclined orbit; drawn before or after the planet depending on its depth.
      const moonAngle = (reduceMotion ? 0.9 : time * 0.00018) + 0.9
      const moonPt = project(Math.cos(moonAngle) * 3.3, Math.sin(moonAngle) * 0.9, Math.sin(moonAngle) * 3.3)
      const drawMoon = () => {
        const mr = R * 0.09 * moonPt.scale
        const glow = ctx.createRadialGradient(moonPt.sx - mr * 0.4, moonPt.sy - mr * 0.4, mr * 0.1, moonPt.sx, moonPt.sy, mr)
        glow.addColorStop(0, '#f2f4ff')
        glow.addColorStop(0.7, '#9aa6d4')
        glow.addColorStop(1, '#2a3156')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(moonPt.sx, moonPt.sy, mr, 0, TAU)
        ctx.fill()
      }

      if (moonPt.z > 0) drawMoon()
      drawBands('back')
      drawParticles(back)

      // Planet: soft atmosphere, lit sphere, bands, then the night side.
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.5)
      halo.addColorStop(0, 'rgba(120, 150, 255, 0.22)')
      halo.addColorStop(1, 'rgba(120, 150, 255, 0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.5, 0, TAU)
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, TAU)
      ctx.clip()

      const body = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.1, cx, cy, R * 1.05)
      body.addColorStop(0, '#d9e1ff')
      body.addColorStop(0.35, '#8ea4f5')
      body.addColorStop(0.75, '#3c4fa8')
      body.addColorStop(1, '#151c45')
      ctx.fillStyle = body
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)

      // Cloud bands are latitude strips on the sphere, so they curve with the planet's tilt.
      const latitudeArc = (lat: number) => {
        const points: { sx: number; sy: number }[] = []
        for (let i = 0; i <= 48; i++) {
          const angle = (i / 48) * TAU
          const pt = project(Math.cos(lat) * Math.cos(angle), Math.sin(lat), Math.cos(lat) * Math.sin(angle))
          if (pt.z <= 0.05) points.push(pt)
        }
        return points.sort((a, b) => a.sx - b.sx)
      }
      for (const [from, to, alpha] of [[-0.62, -0.48, 0.13], [-0.3, -0.12, 0.1], [0.08, 0.16, 0.12], [0.32, 0.5, 0.08]] as const) {
        const top = latitudeArc(from)
        const bottom = latitudeArc(to).reverse()
        if (top.length < 2 || bottom.length < 2) continue
        ctx.beginPath()
        top.forEach((p, i) => (i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy)))
        bottom.forEach((p) => ctx.lineTo(p.sx, p.sy))
        ctx.closePath()
        ctx.fillStyle = `rgba(16, 24, 70, ${alpha})`
        ctx.fill()
      }

      const night = ctx.createLinearGradient(cx - R * 0.6, cy - R * 0.6, cx + R, cy + R)
      night.addColorStop(0, 'rgba(5, 7, 20, 0)')
      night.addColorStop(0.55, 'rgba(5, 7, 20, 0.15)')
      night.addColorStop(1, 'rgba(5, 7, 20, 0.85)')
      ctx.fillStyle = night
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
      ctx.restore()

      drawBands('front')
      drawParticles(front)
      if (moonPt.z <= 0) drawMoon()
    }

    let frame = 0
    let running = false
    let visible = true
    const loop = (time: number) => {
      tilt.x += (tilt.tx - tilt.x) * 0.05
      tilt.y += (tilt.ty - tilt.y) * 0.05
      draw(time)
      frame = requestAnimationFrame(loop)
    }
    const start = () => {
      if (running || reduceMotion || !visible || document.hidden) return
      running = true
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
      else stop()
    })
    intersection.observe(canvas)

    const onVisibility = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)

    const target = canvas.parentElement || canvas
    if (interactive && !reduceMotion) {
      target.addEventListener('pointermove', onPointer)
      target.addEventListener('pointerleave', onLeave)
    }

    if (reduceMotion) draw(0)
    else start()

    return () => {
      stop()
      resizeObserver.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      target.removeEventListener('pointermove', onPointer)
      target.removeEventListener('pointerleave', onLeave)
    }
  }, [particleCount, planetScale, starCount, interactive])

  // Absolutely positioned so the canvas never feeds its own size back into the layout.
  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 block h-full w-full ${className}`} />
}
