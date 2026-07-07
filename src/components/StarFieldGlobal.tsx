'use client'

import { useEffect, useRef, useState } from 'react'

export function StarFieldGlobal() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    type Star = { x: number; y: number; r: number; o: number; speed: number; phase: number }
    let stars: Star[] = []
    let animId: number

    function resize() {
      if (!canvas) return
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      stars = Array.from({ length: 150 }, () => ({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        r:     Math.random() * 1.2 + 0.2, // Slightly smaller stars
        o:     Math.random() * 0.35 + 0.05, // MUCH LOWER BRIGHTNESS (was 0.75 + 0.12)
        speed: Math.random() * 0.012 + 0.003,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    function draw() {
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach(s => {
        s.phase += s.speed
        const opacity = s.o * (0.5 + 0.5 * Math.sin(s.phase))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${opacity})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animId = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -10 }}
    />
  )
}
