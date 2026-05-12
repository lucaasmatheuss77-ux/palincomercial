'use client'
import React, { useEffect, useState, useRef } from 'react'

// ─── Partículas flutuantes ────────────────────────────────────────────────────
type Particle = { top: string; left: string; size: string; duration: string; delay: string; opacity: number; drift: number }

export function FloatingParticles({ count = 18 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([])
  useEffect(() => {
    setParticles(Array.from({ length: count }, () => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 5 + 2}px`,
      duration: `${Math.random() * 6 + 6}s`,
      delay: `${Math.random() * 6}s`,
      opacity: Math.random() * 0.3 + 0.1,
      drift: Math.random() * 22 - 11,
    })))
  }, [count])

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          '--drift': `${p.drift}px`,
          position: 'absolute', top: p.top, left: p.left,
          width: p.size, height: p.size,
          background: `rgba(251,191,36,${p.opacity})`,
          borderRadius: '50%', filter: 'blur(1px)',
          animation: `float-particle ${p.duration} ease-in-out infinite`,
          animationDelay: p.delay,
          boxShadow: '0 0 8px rgba(251,191,36,0.25)',
        } as React.CSSProperties} />
      ))}
    </div>
  )
}

// ─── Logo animada (draw-on + pulse) ──────────────────────────────────────────
export function AnimatedBrandLogo({ size = 56 }: { size?: number }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 180); return () => clearTimeout(t) }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
      {/* Anel de pulso */}
      <div style={{ position: 'relative', width: size + 32, height: size + 32, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px solid rgba(251,191,36,0.18)',
          animation: 'ring-pulse 3s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 6, borderRadius: '50%',
          border: '1px dashed rgba(251,191,36,0.28)',
          animation: 'spin-slow 12s linear infinite reverse',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.10) 0%, transparent 70%)',
        }} />
        {/* SVG logo inside ring */}
        <div style={{ position: 'absolute', inset: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 310 260" width={size} height={size} overflow="visible">
            <g transform="translate(6 18) scale(1.0)">
              <path d="M288 66 A168 168 0 0 0 20 160" fill="none" stroke="#a8922e" strokeWidth="22"
                strokeDasharray="400" strokeDashoffset={drawn ? 0 : 400}
                style={{ transition: 'stroke-dashoffset 1.2s ease 0.1s' }} />
              <path d="M50 156 H125 C148 156 166 138 166 114 C166 91 148 73 125 73 H26"
                fill="none" stroke="#a8922e" strokeLinecap="round" strokeWidth="22"
                strokeDasharray="300" strokeDashoffset={drawn ? 0 : 300}
                style={{ transition: 'stroke-dashoffset 1s ease 0.3s' }} />
              <path d="M64 156 V230" fill="none" stroke="#a8922e" strokeWidth="22"
                strokeDasharray="80" strokeDashoffset={drawn ? 0 : 80}
                style={{ transition: 'stroke-dashoffset 0.6s ease 0.6s' }} />
              <path d="M20 194 A168 168 0 1 0 288 78" fill="none" stroke="white" strokeWidth="22"
                strokeDasharray="700" strokeDashoffset={drawn ? 0 : 700}
                style={{ transition: 'stroke-dashoffset 1.4s ease 0.2s' }} />
              <path d="M168 230 V110 L232 178 L296 110 V230" fill="none" stroke="white"
                strokeLinejoin="miter" strokeWidth="22"
                strokeDasharray="320" strokeDashoffset={drawn ? 0 : 320}
                style={{ transition: 'stroke-dashoffset 1s ease 0.5s' }} />
            </g>
          </svg>
        </div>
      </div>

      {/* Texto da marca */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          display: 'flex', flexDirection: 'column', lineHeight: 1,
          opacity: drawn ? 1 : 0, transform: drawn ? 'translateX(0)' : 'translateX(-12px)',
          transition: 'opacity 0.7s ease 0.8s, transform 0.7s ease 0.8s',
        }}>
          <span style={{ fontFamily: "'Times New Roman', Georgia, serif", fontWeight: 700, fontSize: size * 0.58, color: '#fff', letterSpacing: '0.04em', lineHeight: 1 }}>GRUPO</span>
          <span style={{ fontFamily: "'Times New Roman', Georgia, serif", fontWeight: 700, fontSize: size * 1.05, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.05 }}>PALIN</span>
          <span style={{ fontFamily: "'Times New Roman', Georgia, serif", fontWeight: 700, fontSize: size * 1.05, color: '#fff', letterSpacing: '0.02em', lineHeight: 1.05 }}>MARTINS</span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase',
          color: '#a8922e', marginTop: 4,
          opacity: drawn ? 1 : 0, transition: 'opacity 0.6s ease 1.2s',
        }}>
          Assessoria Tributária
        </span>
      </div>
    </div>
  )
}

// ─── Contador animado ─────────────────────────────────────────────────────────
export function AnimatedCounter({ target, suffix = '', duration = 1800, delay = 0 }: { target: number; suffix?: string; duration?: number; delay?: number }) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now()
      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        setValue(Math.round(ease * target))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(timeout)
  }, [target, duration, delay])

  return <span ref={ref}>{value}{suffix}</span>
}

// ─── Badge de feature ─────────────────────────────────────────────────────────
export function FeatureBadge({ emoji, label, delay = 0 }: { emoji: string; label: string; delay?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(251,191,36,0.12)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-16px)',
      transition: `opacity 0.5s ease, transform 0.5s ease`,
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontSize: '0.78rem', color: '#c9d1d9', fontWeight: 600 }}>{label}</span>
    </div>
  )
}
