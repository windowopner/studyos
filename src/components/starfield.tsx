'use client'

import { useEffect, useRef } from 'react'

// Still stars behind the whole app in dark mode (hidden in light mode by CSS). Drawn once per
// resize, so it costs nothing while you work.
export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = window.innerWidth
      const height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      let seed = 11
      const random = () => {
        seed = (seed * 16807) % 2147483647
        return (seed - 1) / 2147483646
      }
      const count = Math.round((width * height) / 9000)
      for (let i = 0; i < count; i++) {
        const big = random() > 0.94
        ctx.globalAlpha = big ? 0.5 + random() * 0.3 : 0.12 + random() * 0.3
        ctx.fillStyle = random() > 0.85 ? '#ffe6cc' : '#d6defa'
        const size = big ? 1.4 : 0.8 + random() * 0.4
        ctx.fillRect(random() * width, random() * height, size, size)
      }
      ctx.globalAlpha = 1
    }

    let timer = 0
    const onResize = () => {
      clearTimeout(timer)
      timer = window.setTimeout(draw, 150)
    }
    draw()
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className="starfield pointer-events-none fixed inset-0 -z-10 h-[100dvh] w-screen" />
}
