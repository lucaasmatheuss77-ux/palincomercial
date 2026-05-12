'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Eye, EyeOff, Lock, Mail, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

// ── Fundo estrelado ───────────────────────────────────────────────────────────
function StarField() {
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
      stars = Array.from({ length: 240 }, () => ({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        r:     Math.random() * 1.5 + 0.2,
        o:     Math.random() * 0.75 + 0.12,
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
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ── Partículas douradas ───────────────────────────────────────────────────────
type Particle = { top: string; left: string; size: string; dur: string; delay: string; op: number; drift: number }

function FloatingParticles() {
  const [list, setList] = useState<Particle[]>([])
  useEffect(() => {
    setList(Array.from({ length: 22 }, () => ({
      top:   `${Math.random() * 100}%`,
      left:  `${Math.random() * 100}%`,
      size:  `${Math.random() * 4 + 1.5}px`,
      dur:   `${Math.random() * 8 + 6}s`,
      delay: `${Math.random() * 7}s`,
      op:    Math.random() * 0.28 + 0.07,
      drift: Math.random() * 28 - 14,
    })))
  }, [])

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {list.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: p.top, left: p.left,
          width: p.size, height: p.size,
          background: `rgba(251,191,36,${p.op})`,
          borderRadius: '50%', filter: 'blur(1px)',
          boxShadow: '0 0 8px rgba(251,191,36,0.25)',
          animation: `fp-float ${p.dur} ease-in-out infinite`,
          animationDelay: p.delay,
          ['--fp-drift' as string]: `${p.drift}px`,
        } as React.CSSProperties} />
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted, setMounted]   = useState(false)
  const [cursor, setCursor]     = useState({ x: 50, y: 50 })
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
    supabase.auth.signOut()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setCursor({
      x: ((e.clientX - r.left) / r.width)  * 100,
      y: ((e.clientY - r.top)  / r.height) * 100,
    })
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const t = e.touches[0]
    setCursor({
      x: ((t.clientX - r.left) / r.width)  * 100,
      y: ((t.clientY - r.top)  / r.height) * 100,
    })
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      })
      if (err) {
        const msg = err.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : `Erro: ${err.message}`
        setError(msg)
        toast.error('Acesso negado', { description: msg })
        setLoading(false)
        return
      }
      if (data.session) {
        toast.success('Bem-vindo!')
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        window.location.href = isMobile ? '/mobile' : '/dashboard'
      }
    } catch {
      setError('Falha de conexão. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030608',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: '#fff',
      }}
    >
      {/* Fundo de estrelas */}
      {mounted && <StarField />}

      {/* Partículas douradas */}
      {mounted && <FloatingParticles />}

      {/* ── Cursor com luz intensa ── */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(1100px circle at ${cursor.x}% ${cursor.y}%, rgba(251,191,36,0.13) 0%, rgba(251,191,36,0.04) 35%, transparent 65%)`,
        pointerEvents: 'none',
        transition: 'background 0.06s linear',
        zIndex: 2,
      }} />

      {/* Halo central fixo */}
      <div aria-hidden style={{
        position: 'absolute',
        top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px', height: '500px',
        background: 'radial-gradient(ellipse, rgba(168,146,46,0.06) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ── Conteúdo central ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%',
        maxWidth: '460px',
        padding: '0 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '48px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(28px)',
        transition: 'opacity 0.9s ease, transform 0.9s ease',
      }}>

        {/* ── LOGO ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0px',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s',
        }}>
          {/* Glow atrás do logo */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Halo dourado atrás */}
            <div aria-hidden style={{
              position: 'absolute',
              inset: '-24px',
              background: 'radial-gradient(ellipse 120% 80%, rgba(168,146,46,0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            {/* Logo real PNG */}
            <Image
              src="/logo-branco-pbg.png"
              alt="Grupo Palin Martins"
              width={340}
              height={100}
              priority
              style={{
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 28px rgba(168,146,46,0.35)) drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
                maxWidth: '100%',
              }}
            />
          </div>

          {/* Linha decorativa */}
          <div style={{
            width: '60%',
            height: '1px',
            marginTop: '20px',
            background: 'linear-gradient(90deg, transparent, rgba(168,146,46,0.4), transparent)',
          }} />

          {/* Subtítulo */}
          <p style={{
            marginTop: '10px',
            fontSize: '9px',
            fontWeight: 800,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'rgba(168,146,46,0.7)',
          }}>
            Área Restrita — Acesso Comercial
          </p>
        </div>

        {/* ── FORMULÁRIO ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* E-mail */}
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{
              position: 'absolute', left: 20, top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(168,146,46,0.55)',
              pointerEvents: 'none',
            }} />
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="lf-input"
            />
          </div>

          {/* Senha */}
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{
              position: 'absolute', left: 20, top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(168,146,46,0.55)',
              pointerEvents: 'none',
            }} />
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="lf-input lf-input-pr"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              style={{
                position: 'absolute', right: 16, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(148,163,184,0.5)',
                padding: '4px',
                display: 'flex', alignItems: 'center',
              }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Erro */}
          {error && (
            <p style={{
              fontSize: '12px', color: '#f87171',
              textAlign: 'center', margin: 0,
              animation: 'lf-fadein 0.3s ease',
            }}>
              {error}
            </p>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className="lf-btn"
            style={{ marginTop: '6px' }}
          >
            {loading
              ? <Loader2 size={22} className="lf-spin" />
              : <><span>ENTRAR</span><ArrowRight size={20} /></>
            }
          </button>
        </form>

        {/* Rodapé */}
        <p style={{
          fontSize: '10px',
          color: 'rgba(100,116,139,0.35)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          margin: 0,
          textAlign: 'center',
        }}>
          © 2026 Grupo Palin Martins
        </p>
      </div>

      {/* ── Estilos ── */}
      <style>{`
        @keyframes lf-spin-anim {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lf-fadein {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fp-float {
          0%,100% { transform: translateY(0) translateX(0); opacity: 1; }
          50%      { transform: translateY(-30px) translateX(var(--fp-drift)); opacity: 0.4; }
        }

        /* ── Inputs ── */
        .lf-input {
          width: 100%;
          height: 60px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 18px;
          padding-left: 52px;
          padding-right: 20px;
          font-size: 15px;
          font-weight: 500;
          color: #fff;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          -webkit-appearance: none;
          font-family: inherit;
        }
        .lf-input-pr { padding-right: 50px; }
        .lf-input::placeholder { color: rgba(100,116,139,0.4); }
        .lf-input:focus {
          border-color: rgba(168,146,46,0.5);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 4px rgba(168,146,46,0.09), 0 0 24px rgba(168,146,46,0.08);
        }
        .lf-input:hover:not(:focus) {
          border-color: rgba(255,255,255,0.18);
        }
        .lf-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #07090c inset;
          -webkit-text-fill-color: #fff;
          caret-color: #fff;
        }

        /* ── Botão ── */
        .lf-btn {
          width: 100%;
          height: 62px;
          background: linear-gradient(135deg, #b8880a 0%, #fbbf24 45%, #d4970c 100%);
          background-size: 200% 100%;
          color: #08050a;
          font-weight: 900;
          font-size: 14px;
          letter-spacing: 0.22em;
          border: none;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          font-family: inherit;
          box-shadow:
            0 0 50px rgba(251,191,36,0.25),
            0 0 120px rgba(251,191,36,0.08),
            0 10px 30px rgba(0,0,0,0.5);
          transition: background-position 0.4s ease, transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s;
        }
        .lf-btn:hover:not(:disabled) {
          background-position: 100% 0;
          transform: translateY(-3px);
          box-shadow:
            0 0 70px rgba(251,191,36,0.4),
            0 0 160px rgba(251,191,36,0.12),
            0 18px 40px rgba(0,0,0,0.6);
        }
        .lf-btn:active:not(:disabled) {
          transform: scale(0.98) translateY(0);
        }
        .lf-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .lf-spin { animation: lf-spin-anim 1s linear infinite; }

        /* ── Mobile ── */
        @media (max-width: 480px) {
          .lf-input {
            height: 58px;
            font-size: 16px;
            border-radius: 16px;
          }
          .lf-btn {
            height: 60px;
            border-radius: 16px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lf-btn, .lf-input { transition: none; }
          .lf-spin { animation: none; }
        }
      `}</style>
    </div>
  )
}
