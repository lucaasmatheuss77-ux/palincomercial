'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  Mic, Square, Loader2,
  UserPlus, CalendarDays, Users, ChevronRight,
  Phone, FileSignature, AlertCircle, X, Search,
  Target, Plus, MapPin, Navigation,
} from 'lucide-react'
import { createLead, updateLeadStage } from '@/app/actions/pipeline'
import { createMeeting } from '@/app/actions/agenda'
import { recordCommercialActivity } from '@/app/actions/commercial-activities'
import { ClientSearchField, type ClienteOption } from '@/components/client-search-field'
import { triggerSaleConfetti } from '@/lib/effects'

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
      stars = Array.from({ length: 150 }, () => ({
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
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

// ── Partículas douradas ───────────────────────────────────────────────────────
type Particle = { top: string; left: string; size: string; dur: string; delay: string; op: number; drift: number }

function FloatingParticles() {
  const [list, setList] = useState<Particle[]>([])
  useEffect(() => {
    setList(Array.from({ length: 15 }, () => ({
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
    <div aria-hidden style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
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
      <style>{`
        @keyframes fp-float {
          0% { transform: translateY(100vh) translateX(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(-100px) translateX(var(--fp-drift)); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TabId = 'pipeline' | 'agenda' | 'radar' | 'lead' | 'call' | 'contract' | 'voz'

// ── Constante de tabs para FAB ──────────────────────────────────────────────
const ALL_TABS: { id: TabId; icon: React.ElementType; label: string; color: string }[] = [
  { id: 'pipeline', icon: Users,         label: 'Pipeline', color: '#fbbf24' },
  { id: 'radar',    icon: Target,        label: 'Radar',    color: '#38bdf8' },
  { id: 'voz',      icon: Mic,           label: 'Voz IA',   color: '#94a3b8' },
  { id: 'lead',     icon: UserPlus,      label: 'Novo Lead',color: '#10b981' },
  { id: 'call',     icon: Phone,         label: 'Ligação',  color: '#f59e0b' },
  { id: 'agenda',   icon: CalendarDays,  label: 'Agenda',   color: '#7dd3fc' },
  { id: 'contract', icon: FileSignature, label: 'Contrato', color: '#34d399' },
]

type Lead = {
  id: string
  name: string
  stage?: string | null
  whatsapp?: string | null
  email?: string | null
  expected_value?: number | string | null
  ai_score?: number | null
  cnpj?: string | null
  segmento_especifico?: string | null
  company?: string | null
}

type CnpjLookupData = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  situacao: string | null
  atividadePrincipal: string | null
  telefone: string | null
  email: string | null
  municipio: string | null
  uf: string | null
  origem: string
}

type MobileAgendaItem = {
  id: string
  title?: string | null
  scheduled_for?: string | null
  client_name?: string | null
  location?: string | null
}

interface MobileHubProps {
  user: {
    id?: string | null
    email?: string | null
    role?: string
    user_metadata?: { full_name?: string | null }
    avatar_skin?: number | null
  } | null
  leads: Lead[]
  clientes: ClienteOption[]
  agenda: MobileAgendaItem[]
  initialTab?: string
  initialLeadId?: string
  stats: {
    closedLeads: number
    activeLeads: number
    conversionRate: number
    hotLeads: number
    reunioesHoje: number
    atividadesAtrasadas: number
  }
}

function formatCnpj(value: string | null | undefined) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const STAGE_COLORS: Record<string, string> = {
  'Contato Inicial': '#64748b', 'Qualificação': '#3b82f6', 'Qualificacao': '#3b82f6',
  'Apresentação': '#14b8a6', 'Apresentacao': '#14b8a6', 'Proposta': '#f59e0b',
  'Proposta Enviada': '#f59e0b', 'Negociação': '#f97316', 'Negociacao': '#f97316',
  'Fechado': '#10b981', 'Perdido': '#ef4444',
}
const STAGES = ['Contato Inicial', 'Qualificação', 'Apresentação', 'Proposta', 'Negociação', 'Fechado']

function formatTime(s: number) { return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}` }

// ── FAB Semicircle (abre para cima em arco) ──────────────────────────────────
function FABMenu({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const [open, setOpen] = useState(false)

  const N       = ALL_TABS.length  // 7 itens
  const RADIUS  = 110             // raio do arco
  // Arco de 15° a 165° = semicírculo superior
  const A_START = 15
  const A_END   = 165

  const activeTab = ALL_TABS.find(t => t.id === active)

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 9990 }}
        />
      )}

      {/* Itens abrindo para cima */}
      {open && ALL_TABS.map((item, i) => {
        const isAct = active === item.id
        const Icon = item.icon

        return (
          <button
            key={item.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(item.id); setOpen(false); }}
            title={item.label}
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 190 + i * 58,
              transform: 'translateX(-50%)',
              width: 230,
              minHeight: 48,
              borderRadius: 14,
              background: isAct
                ? `linear-gradient(135deg, ${item.color}88, ${item.color})`
                : 'rgba(13,17,23,0.97)',
              border: `1px solid ${isAct ? item.color : item.color + '55'}`,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
              padding: '0 14px',
              cursor: 'pointer',
              boxShadow: isAct
                ? `0 0 20px ${item.color}80, 0 4px 16px rgba(0,0,0,0.8)`
                : `0 0 10px ${item.color}30, 0 4px 14px rgba(0,0,0,0.7)`,
              animation: `fadeInUp 0.3s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.03}s both`,
              zIndex: 9998,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon size={17} color={isAct ? '#0a0600' : item.color} strokeWidth={2.3} style={{ pointerEvents: 'none' }} />
            <span style={{
              fontSize: '0.78rem',
              fontWeight: 900,
              color: isAct ? '#0a0600' : item.color,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              lineHeight: 1,
              pointerEvents: 'none',
            }}>
              {item.label}
            </span>
          </button>
        )
      })}

      {/* Label da aba ativa */}
      {!open && activeTab && (
        <div style={{
          position: 'fixed',
          bottom: 120 + 70, // 120 + 60 + 10
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          padding: '4px 12px',
          borderRadius: 12,
          fontSize: '0.7rem',
          fontWeight: 600,
          color: activeTab.color,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          boxShadow: `0 2px 12px ${activeTab.color}20`,
          zIndex: 201,
        }}>
          {activeTab.label}
        </div>
      )}

      {/* Botão FAB principal */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          position: 'fixed',
          bottom: 120,
          left: 'calc(50% - 30px)',
          transform: open ? 'rotate(45deg)' : 'none',
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: open
            ? 'rgba(13,17,23,0.98)'
            : 'linear-gradient(135deg, #92620a 0%, #d4970c 35%, #fbbf24 60%, #f0a500 100%)',
          border: open ? '2px solid rgba(251,191,36,0.6)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open
            ? '0 0 32px rgba(251,191,36,0.3)'
            : '0 0 40px rgba(251,191,36,0.55), 0 8px 32px rgba(0,0,0,0.7)',
          transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          zIndex: 9999,
          pointerEvents: 'auto',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <Plus size={28} color={open ? '#fbbf24' : '#0a0600'} strokeWidth={2.5} style={{ pointerEvents: 'none' }} />
      </button>
    </>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function MobileTabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      aria-label="Menu mobile"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 8,
        padding: '0 16px',
        marginBottom: 18,
      }}
    >
      {ALL_TABS.map((item) => {
        const Icon = item.icon
        const selected = active === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              minHeight: 58,
              borderRadius: 12,
              border: `1px solid ${selected ? item.color : 'rgba(255,255,255,0.08)'}`,
              background: selected ? `${item.color}18` : 'rgba(22,27,34,0.72)',
              color: selected ? item.color : '#94a3b8',
              display: 'grid',
              placeItems: 'center',
              gap: 4,
              padding: '8px 4px',
              fontSize: '0.62rem',
              fontWeight: 850,
              cursor: 'pointer',
              boxShadow: selected ? `0 0 18px ${item.color}22` : 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Icon size={17} aria-hidden="true" />
            <span style={{ lineHeight: 1.05 }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function NativeFABMenu({ active }: { active: TabId }) {
  const activeTab = ALL_TABS.find(t => t.id === active)
  return (
    <details style={{ position: 'fixed', left: '50%', bottom: 112, transform: 'translateX(-50%)', zIndex: 10000, width: 62, height: 62 }}>
      <summary style={{ width: 62, height: 62, borderRadius: '50%', background: 'linear-gradient(135deg, #92620a 0%, #d4970c 35%, #fbbf24 60%, #f0a500 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 40px rgba(251,191,36,0.55), 0 8px 32px rgba(0,0,0,0.7)', listStyle: 'none', WebkitTapHighlightColor: 'transparent' }}>
        <Plus size={29} color="#0a0600" strokeWidth={2.5} />
      </summary>
      {activeTab && (
        <div style={{ position: 'fixed', bottom: 74, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.68)', padding: '4px 12px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, color: activeTab.color, textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {activeTab.label}
        </div>
      )}
      <div style={{ position: 'absolute', left: 31, bottom: 76, width: 1, height: 1, pointerEvents: 'none' }}>
        {ALL_TABS.map((item, i) => {
          const Icon = item.icon
          const selected = active === item.id
          const total = ALL_TABS.length
          const angle = (18 + (144 * i) / Math.max(1, total - 1)) * Math.PI / 180
          const radius = 118
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          return (
            <a key={item.id} href={`?tab=${item.id}`} style={{ position: 'absolute', left: x - 28, bottom: y - 28, width: 56, height: 56, borderRadius: '50%', background: selected ? `linear-gradient(135deg, ${item.color}88, ${item.color})` : 'rgba(13,17,23,0.98)', border: `1.5px solid ${selected ? item.color : item.color + '66'}`, display: 'grid', placeItems: 'center', gap: 1, padding: '7px 4px', boxSizing: 'border-box', textDecoration: 'none', boxShadow: selected ? `0 0 20px ${item.color}70` : `0 0 12px ${item.color}25`, WebkitTapHighlightColor: 'transparent', pointerEvents: 'auto' }}>
              <Icon size={17} color={selected ? '#0a0600' : item.color} strokeWidth={2.4} />
              <span style={{ fontSize: '0.43rem', fontWeight: 900, color: selected ? '#0a0600' : item.color, textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1, textAlign: 'center', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </a>
          )
        })}
      </div>
    </details>
  )
}

function StatCard({ label, value, sub, color = '#fbbf24', alert = false }: { label: string; value: string | number; sub: string; color?: string; alert?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, padding: '13px 12px',
      background: `linear-gradient(135deg, rgba(22,27,34,0.95) 0%, rgba(${alert ? '239,68,68' : '22,27,34'},0.85) 100%)`,
      border: `1px solid ${alert ? 'rgba(239,68,68,0.35)' : color + '22'}`,
      borderRadius: 14, position: 'relative', overflow: 'hidden',
      backdropFilter: 'blur(8px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
    }}>
      {alert && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #ef4444, #f97316)' }} />}
      {!alert && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />}
      <p style={{ fontSize: '0.5rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.04em', textShadow: `0 0 20px ${color}60` }}>{value}</p>
      <p style={{ fontSize: '0.57rem', color: '#334155', marginTop: 5, fontWeight: 600 }}>{sub}</p>
    </div>
  )
}

// ── Lead Row ──────────────────────────────────────────────────────────────────
function LeadRow({ lead }: { lead: Lead }) {
  const sc = STAGE_COLORS[lead.stage || ''] || '#64748b'
  const isUrgent = ['Proposta', 'Negociacao', 'Negociação'].includes(lead.stage || '')
  return (
    <a className={isUrgent ? 'pulse-red-border' : ''} href={`?tab=agenda&leadId=${encodeURIComponent(lead.id)}`} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
      background: isUrgent ? 'linear-gradient(135deg, rgba(69,10,10,0.6) 0%, rgba(16,20,28,0.9) 100%)' : 'linear-gradient(135deg, rgba(22,27,34,0.95) 0%, rgba(16,20,28,0.9) 100%)',
      border: isUrgent ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, cursor: 'pointer', textAlign: 'left', textDecoration: 'none',
      boxShadow: isUrgent ? '0 2px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(239,68,68,0.1)' : '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${sc}25, ${sc}12)`,
        border: `1.5px solid ${sc}45`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem', fontWeight: 900, color: sc,
        boxShadow: `0 0 12px ${sc}25`,
      }}>
        {lead.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc, boxShadow: `0 0 6px ${sc}` }} />
          <span style={{ fontSize: '0.62rem', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{lead.stage}</span>
          {lead.segmento_especifico && <span style={{ fontSize: '0.58rem', color: '#334155', marginLeft: 4 }}>· {lead.segmento_especifico}</span>}
        </div>
      </div>
      <ChevronRight size={14} color="#334155" />
    </a>
  )
}

// ── Lead Detail Modal ─────────────────────────────────────────────────────────
function LeadDetail({ lead, onClose, onUpdate, onSchedule }: { lead: Lead; onClose: () => void; onUpdate: () => void; onSchedule: (lead: Lead) => void }) {
  const [stage, setStage]   = useState(lead.stage || 'Contato Inicial')
  const [note, setNote]     = useState('')
  const [loading, setLoading] = useState(false)

  async function moveStage(s: string) {
    setLoading(true)
    const r = await updateLeadStage(lead.id, s)
    if (r.success) { setStage(s); toast.success(`Lead → ${s}`); if (s === 'Fechado') triggerSaleConfetti(); onUpdate() }
    else toast.error('Erro ao mover lead')
    setLoading(false)
  }

  async function logNote() {
    if (!note.trim()) return
    setLoading(true)
    const r = await recordCommercialActivity({ leadId: lead.id, activityType: 'nota', subject: note.trim() })
    if (r.success) { toast.success('Nota registrada!'); setNote('') }
    else toast.error('Erro ao registrar nota')
    setLoading(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: 'rgba(13,17,23,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderRadius: '20px 20px 0 0', border: '1px solid rgba(251,191,36,0.15)', padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 900, color: '#f0f6fc' }}>{lead.name}</p>
            {lead.company && <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>{lead.company}</p>}
            {lead.segmento_especifico && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={11} color="#fbbf24" />
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24' }}>{lead.segmento_especifico}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>

        <div>
          <p style={{ fontSize: '0.58rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Mover etapa</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STAGES.map(s => (
              <button key={s} onClick={() => moveStage(s)} disabled={loading}
                style={{ padding: '10px 12px', minHeight: 44, borderRadius: 8, background: stage === s ? `${STAGE_COLORS[s]}20` : 'rgba(255,255,255,0.03)', border: `1px solid ${stage === s ? STAGE_COLORS[s] : 'rgba(255,255,255,0.07)'}`, color: stage === s ? STAGE_COLORS[s] : '#64748b', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {lead.whatsapp && (
          <a href={`https://wa.me/55${lead.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', fontSize: '0.82rem', fontWeight: 800, textDecoration: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.112 1.522 5.84L.057 23.884c-.054.218.022.448.197.592a.5.5 0 0 0 .42.082l6.19-1.623A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.51-5.094-1.395l-.356-.208-3.692.967.986-3.604-.233-.375A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            Abrir WhatsApp — {lead.whatsapp}
          </a>
        )}

        <button
          type="button"
          onClick={() => onSchedule(lead)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 12, background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.25)', color: '#7dd3fc', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
        >
          <CalendarDays size={16} />
          Agendar reunião
        </button>

        <div>
          <p style={{ fontSize: '0.58rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Nota rápida</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Registrar contato, decisão, próximo passo..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={logNote} disabled={!note.trim() || loading}
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24', cursor: 'pointer', fontWeight: 800 }}>
              {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pipeline View ─────────────────────────────────────────────────────────────
function PipelineView({ leads, stats, onLeadsChange, onScheduleLead }: { leads: Lead[]; stats: MobileHubProps['stats']; onLeadsChange: (l: Lead[]) => void; onScheduleLead: (lead: Lead) => void }) {
  const [search, setSearch]     = useState('')
  const [selectedLead, setSelected] = useState<Lead | null>(null)
  const active   = leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')
  const filtered = search.trim() ? leads.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || (l.stage||'').toLowerCase().includes(search.toLowerCase()) || (l.segmento_especifico||'').toLowerCase().includes(search.toLowerCase())) : active

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        <StatCard label="Contratos" value={stats.closedLeads} sub="Fechados" color="#10b981" />
        <StatCard label="Ativos" value={stats.activeLeads} sub="Pipeline" color="#38bdf8" />
        <StatCard label="Quentes" value={stats.hotLeads} sub="Neg.+Prop." color="#f97316" />
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <StatCard label="Conversão" value={`${stats.conversionRate}%`} sub="Taxa" color="#fbbf24" />
        <StatCard label="Reuniões" value={stats.reunioesHoje} sub="Hoje" color="#94a3b8" />
        <StatCard label="Atrasadas" value={stats.atividadesAtrasadas} sub="Atividades" color={stats.atividadesAtrasadas > 0 ? '#ef4444' : '#64748b'} alert={stats.atividadesAtrasadas > 0} />
      </div>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155', pointerEvents: 'none' }} />
        <input type="text" placeholder="Buscar por nome, etapa ou cidade..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, color: '#f0f6fc', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtered.length === 0
          ? <div style={{ padding: 24, textAlign: 'center', color: '#1e293b', fontSize: '0.82rem', background: 'rgba(22,27,34,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>{search ? `Nenhum resultado para "${search}"` : 'Nenhum lead ativo.'}</div>
          : filtered.slice(0, 12).map(lead => <LeadRow key={lead.id} lead={lead} />)
        }
      </div>
      {selectedLead && <LeadDetail lead={selectedLead} onClose={() => setSelected(null)} onUpdate={() => onLeadsChange(leads)} onSchedule={(lead) => { setSelected(null); onScheduleLead(lead) }} />}
    </div>
  )
}

// ── Radar View com GPS ────────────────────────────────────────────────────────
interface GeoLead extends Lead { distance?: number; matched?: boolean }

function RadarView({ leads, onScheduleLead }: { leads: Lead[]; onScheduleLead: (lead: Lead) => void }) {
  const [myCity, setMyCity]       = useState('')
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError]   = useState('')
  const [gpsSource, setGpsSource] = useState<'native'|'ip'|'manual'|null>(null)
  const [nearbyLeads, setNearby]  = useState<GeoLead[]>([])
  const [allLeads, setAllLeads]   = useState<GeoLead[]>([])
  const [selectedLead, setSelected] = useState<Lead | null>(null)
  const [searchCity, setSearchCity] = useState('')
  const [angle, setAngle]         = useState(0)

  // Animação do radar
  useEffect(() => {
    const id = setInterval(() => setAngle(a => (a + 2) % 360), 30)
    return () => clearInterval(id)
  }, [])

  // Inicializa com todos os leads que têm cidade
  useEffect(() => {
    const withCity = leads.filter(l => l.segmento_especifico && l.stage !== 'Perdido')
    setAllLeads(withCity.map(l => ({ ...l, matched: false })))
  }, [leads])

  function matchLeadsByCity(city: string) {
    const lower = city.toLowerCase().trim()
    const matched = leads
      .filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')
      .map(l => {
        const regionText = `${l.segmento_especifico || ''} ${l.company || ''} ${l.name || ''}`.toLowerCase()
        return { ...l, matched: lower.length > 2 && regionText.includes(lower) }
      })
    const sorted = [...matched].sort((a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0))
    setNearby(sorted)
    return matched.filter(l => l.matched).length
  }

  async function detectGPS() {
    setGpsLoading(true)
    setGpsError('')

    // Estratégia principal: API server-side que não depende de HTTPS no browser
    // O servidor faz a consulta de geolocalização pelo IP real do dispositivo
    try {
      const res  = await fetch('/api/geolocate', { signal: AbortSignal.timeout(10000) })
      const data = await res.json() as {
        success: boolean
        city?: string
        region?: string
        lat?: number | null
        lon?: number | null
        ip?: string
        source?: string
        isPrivate?: boolean
        error?: string
      }

      if (data.success && data.city) {
        setMyCity(data.city)
        setSearchCity(data.city)
        setGpsSource('ip')
        const count = matchLeadsByCity(data.city)
        const regionLabel = data.region ? ` (${data.region})` : ''
        toast.success(`📍 Localização: ${data.city}${regionLabel}`, {
          description: `${count} lead(s) nesta região. (via IP do dispositivo)`,
        })
        setGpsLoading(false)
        return
      }

      // Se retornou IP privado (rede local), orientar busca manual
      if (data.isPrivate) {
        setGpsError('Você está em rede local (Wi-Fi). Digite sua cidade manualmente.')
        toast.info('Rede local detectada', {
          description: 'Use o campo de busca para digitar sua cidade.',
        })
        setGpsLoading(false)
        return
      }

    } catch { /* fallback abaixo */ }

    // Fallback: tenta GPS nativo do browser (só funciona em HTTPS)
    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
    if (isSecure && navigator.geolocation) {
      const coords = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
        )
      })

      if (coords) {
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'PalinMartinsCRM/1.0' }, signal: AbortSignal.timeout(6000) }
          )
          const geoData = await res.json() as { address?: { city?: string; town?: string; village?: string; municipality?: string } }
          const city = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.municipality || ''
          if (city) {
            setMyCity(city)
            setSearchCity(city)
            setGpsSource('native')
            const count = matchLeadsByCity(city)
            toast.success(`📍 ${city}`, { description: `${count} lead(s) nesta região. (GPS nativo)` })
            setGpsLoading(false)
            return
          }
        } catch { /* ignora */ }
      }
    }

    // Sem sucesso em nenhuma estratégia
    setGpsError('Não foi possível detectar localização. Digite sua cidade abaixo.')
    toast.warning('Localização indisponível', {
      description: 'Use o campo de busca manual para encontrar leads por cidade.',
    })
    setGpsLoading(false)
  }

  function handleManualSearch() {
    if (!searchCity.trim()) return
    setMyCity(searchCity)
    setGpsSource('manual')
    const count = matchLeadsByCity(searchCity)
    toast.info(`Buscando em: ${searchCity}`, { description: `${count} lead(s) encontrado(s).` })
  }

  const displayLeads = nearbyLeads.length > 0 ? nearbyLeads : allLeads

  // Posições dos dots no radar visual
  const dotsOnRadar = displayLeads.slice(0, 6).map((lead, i) => {
    const a = (360 / Math.min(displayLeads.length, 6)) * i
    const rad = (a * Math.PI) / 180
    const r = lead.matched ? 28 : 40 + (i % 3) * 15
    return { lead, x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad), matched: lead.matched }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* GPS + busca manual */}
      <div style={{ background: 'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(251,191,36,0.1)', borderRadius: 14, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Target size={15} color="#fbbf24" />
          <p style={{ fontSize: '0.7rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Radar de Clientes</p>
          {myCity && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 999 }}>📍 {myCity}</span>
              {gpsSource === 'native' && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: 999 }}>🛰️ GPS</span>}
              {gpsSource === 'ip' && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 6px', borderRadius: 999 }}>🌐 IP</span>}
              {gpsSource === 'manual' && <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '2px 6px', borderRadius: 999 }}>⌨️ MANUAL</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={detectGPS} disabled={gpsLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'linear-gradient(135deg,#b8880a,#fbbf24)', border: 'none', color: '#0a0600', fontWeight: 900, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0 }}>
            {gpsLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Navigation size={14} />}
            {gpsLoading ? 'Detectando...' : 'Usar GPS'}
          </button>
          <div style={{ display: 'flex', flex: 1, gap: 6 }}>
            <input value={searchCity} onChange={e => setSearchCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
              placeholder="Buscar cidade ou região..." style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px', color: '#f0f6fc', fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
            <button onClick={handleManualSearch}
              style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', color: '#fbbf24', cursor: 'pointer', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
              <Search size={14} />
            </button>
          </div>
        </div>

        {gpsError && <p style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 6 }}>⚠️ {gpsError}</p>}

        {/* Visual do radar */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', marginTop: 12 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(13,17,23,0.9)', border: '1px solid rgba(251,191,36,0.1)', overflow: 'hidden' }}>
            {/* Anéis */}
            {[75, 55, 35, 18].map(r => (
              <div key={r} style={{ position: 'absolute', top: `${50-r/2}%`, left: `${50-r/2}%`, width: `${r}%`, height: `${r}%`, border: '1px solid rgba(251,191,36,0.07)', borderRadius: '50%' }} />
            ))}
            {/* Grade cruzada */}
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(251,191,36,0.06)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(251,191,36,0.06)' }} />
            {/* Sweep animado */}
            <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(from ${angle}deg, rgba(251,191,36,0.12) 0deg, transparent 40deg)` }} />
            {/* Centro */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 12px rgba(251,191,36,0.8)' }} />
            {/* Pontos dos leads */}
            {dotsOnRadar.map(({ lead, x, y, matched }) => (
              <button key={lead.id}
                onClick={() => setSelected(lead)}
                title={`${lead.name}${lead.segmento_especifico ? ` — ${lead.segmento_especifico}` : ''}`}
                style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', width: matched ? 14 : 10, height: matched ? 14 : 10, borderRadius: '50%', background: matched ? '#fbbf24' : (STAGE_COLORS[lead.stage||'']||'#64748b'), border: 'none', cursor: 'pointer', boxShadow: matched ? '0 0 10px rgba(251,191,36,0.9)' : '0 0 6px rgba(0,0,0,0.5)', zIndex: 10, animation: matched ? 'pulse-gold 1.5s ease-in-out infinite' : 'none' }}
              />
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.8)' }} />
            <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Na sua região</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
            <span style={{ fontSize: '0.6rem', color: '#64748b' }}>Outros leads</span>
          </div>
        </div>
      </div>

      {/* Lista de leads do radar */}
      <div>
        <p style={{ fontSize: '0.58rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10 }}>
          {myCity ? `Leads — ${myCity} e arredores` : 'Todos os leads com cidade cadastrada'}
          <span style={{ marginLeft: 8, color: '#fbbf24' }}>({displayLeads.filter(l => l.matched).length} na região)</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {displayLeads.length === 0
            ? <div style={{ padding: 24, textAlign: 'center', color: '#1e293b', fontSize: '0.82rem', background: 'rgba(22,27,34,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.04)' }}>
                Nenhum lead com cidade cadastrada. Ao criar leads, preencha a cidade no campo &ldquo;Região/Cidade&rdquo;.
              </div>
            : displayLeads.slice(0, 10).map(lead => (
                <button key={lead.id} onClick={() => setSelected(lead)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', background: lead.matched ? 'rgba(251,191,36,0.07)' : 'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${lead.matched ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: lead.matched ? '#fbbf24' : (STAGE_COLORS[lead.stage||'']||'#64748b'), flexShrink: 0, boxShadow: lead.matched ? '0 0 8px rgba(251,191,36,0.7)' : 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.83rem', fontWeight: 700, color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {lead.segmento_especifico && <><MapPin size={10} color="#fbbf24" /><span style={{ fontSize: '0.62rem', color: '#fbbf24', fontWeight: 700 }}>{lead.segmento_especifico}</span></>}
                      <span style={{ fontSize: '0.6rem', color: '#475569' }}>· {lead.stage}</span>
                    </div>
                  </div>
                  {lead.matched && <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 7px', borderRadius: 999, flexShrink: 0 }}>Próximo</span>}
                </button>
              ))
          }
        </div>
      </div>

      {selectedLead && <LeadDetail lead={selectedLead} onClose={() => setSelected(null)} onUpdate={() => {}} onSchedule={(lead) => { setSelected(null); onScheduleLead(lead) }} />}
    </div>
  )
}

// ── Ações View ────────────────────────────────────────────────────────────────
function NewLeadInlineFull({ clientes, onDone }: { clientes: ClienteOption[]; onDone: (lead: Lead) => void }) {
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [whats, setWhats] = useState('')
  const [valor, setValor] = useState('')
  const [cidade, setCidade] = useState('')
  const [atividade, setAtividade] = useState('')
  const [lookupData, setLookupData] = useState<CnpjLookupData | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [isPending, start] = useTransition()

  async function lookupCnpj() {
    const digits = cnpj.replace(/\D/g, '')
    if (digits.length !== 14) {
      toast.error('Informe um CNPJ com 14 digitos.')
      return
    }

    setLookupLoading(true)
    setLookupData(null)
    try {
      const response = await fetch(`/api/cnpj/${digits}`)
      const data = await response.json()
      if (!response.ok) {
        toast.error('CNPJ nao encontrado', { description: data.error || 'Confira o numero informado.' })
        return
      }

      const lookup = data as CnpjLookupData
      setCnpj(formatCnpj(lookup.cnpj))
      setEmpresa(lookup.razaoSocial || empresa)
      setNome(nome || lookup.nomeFantasia || lookup.razaoSocial || '')
      setAtividade(lookup.atividadePrincipal || atividade)
      setCidade([lookup.municipio, lookup.uf].filter(Boolean).join('/') || cidade)
      setEmail(email || lookup.email || '')
      setWhats(whats || lookup.telefone || '')
      setLookupData(lookup)
      toast.success('Dados do CNPJ carregados.')
    } catch {
      toast.error('Falha ao consultar CNPJ.')
    } finally {
      setLookupLoading(false)
    }
  }

  function submit() {
    if (!nome.trim() && !empresa.trim()) {
      toast.error('Informe o nome ou razao social.')
      return
    }

    start(async () => {
      const displayName = nome.trim() || empresa.trim()
      const formattedCnpj = formatCnpj(cnpj)
      const r = await createLead({
        name: displayName,
        company: empresa.trim() || displayName,
        product_id: '',
        consultant_id: '',
        expected_value: Number(valor.replace(/\D/g, '')) || 0,
        stage: 'Contato Inicial',
        cnpj: formattedCnpj || undefined,
        email: email.trim() || undefined,
        whatsapp: whats.trim() || undefined,
        segmento_especifico: atividade.trim() || cidade.trim() || undefined,
      })

      if (r.success && r.lead) {
        toast.success('Lead criado!', { description: `${displayName}${cidade ? ` - ${cidade}` : ''}` })
        onDone({ id: r.lead.id, name: displayName, company: empresa || displayName, stage: 'Contato Inicial', cnpj: formattedCnpj || null, email: email || null, whatsapp: whats || null, expected_value: valor || null, ai_score: null, segmento_especifico: atividade || cidade || null })
        setNome('')
        setEmpresa('')
        setCnpj('')
        setEmail('')
        setWhats('')
        setValor('')
        setCidade('')
        setAtividade('')
        setLookupData(null)
      } else {
        toast.error(r.error || 'Erro ao criar lead')
      }
    })
  }

  return (
    <div style={{ background: 'rgba(22,27,34,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Novo Lead</p>
      <ClientSearchField
        clientes={clientes}
        selected={null}
        onSelect={(cliente) => {
          setNome(cliente.nome)
          setEmpresa(cliente.company_name || cliente.nome)
          setCnpj(formatCnpj(cliente.documento || ''))
          setEmail(cliente.email || '')
          setWhats(cliente.phone || '')
        }}
        onClear={() => {}}
        placeholder="Ja e cliente? Buscar cadastro"
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="CNPJ 00.000.000/0001-00" inputMode="numeric" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', minWidth: 0, boxSizing: 'border-box' }} />
        <button type="button" onClick={lookupCnpj} disabled={lookupLoading || cnpj.replace(/\D/g, '').length !== 14} style={{ width: 46, borderRadius: 9, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.28)', color: '#fbbf24', display: 'grid', placeItems: 'center', cursor: lookupLoading ? 'wait' : 'pointer', flexShrink: 0 }}>
          {lookupLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
        </button>
      </div>
      {lookupData && (
        <div style={{ border: '1px solid rgba(16,185,129,0.22)', background: 'rgba(16,185,129,0.06)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 4 }}>
          <strong style={{ fontSize: '0.8rem', color: '#d1fae5', lineHeight: 1.25 }}>{lookupData.razaoSocial}</strong>
          {lookupData.nomeFantasia && <span style={{ fontSize: '0.72rem', color: '#86efac' }}>{lookupData.nomeFantasia}</span>}
          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{lookupData.situacao || 'Situacao nao informada'} {lookupData.municipio && lookupData.uf ? `- ${lookupData.municipio}/${lookupData.uf}` : ''}</span>
          {lookupData.atividadePrincipal && <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{lookupData.atividadePrincipal}</span>}
        </div>
      )}
      <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Razao social / empresa *" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do contato / responsavel" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" type="email" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <input value={whats} onChange={e => setWhats(e.target.value)} placeholder="WhatsApp" type="tel" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <input value={atividade} onChange={e => setAtividade(e.target.value)} placeholder="Atividade / CNAE / segmento" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Cidade / Regiao" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <button onClick={submit} disabled={isPending || (!nome.trim() && !empresa.trim())}
        style={{ padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,#b8880a,#fbbf24)', border: 'none', color: '#0a0600', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={16} />}
        {isPending ? 'Criando...' : 'Criar Lead'}
      </button>
    </div>
  )
}

function NewLeadInline({ clientes, onDone }: { clientes: ClienteOption[]; onDone: (lead: Lead) => void }) {
  const [nome, setNome]    = useState('')
  const [whats, setWhats]  = useState('')
  const [valor, setValor]  = useState('')
  const [cidade, setCidade]= useState('')
  const [isPending, start] = useTransition()

  function submit() {
    if (!nome.trim()) { toast.error('Informe o nome'); return }
    start(async () => {
      const r = await createLead({
        name: nome.trim(), company: nome.trim(),
        product_id: '', consultant_id: '',
        expected_value: Number(valor.replace(/\D/g,'')) || 0,
        stage: 'Contato Inicial',
        whatsapp: whats.trim() || undefined,
        segmento_especifico: cidade.trim() || undefined,
      })
      if (r.success && r.lead) {
        toast.success('Lead criado!', { description: `${nome}${cidade ? ` — ${cidade}` : ''}` })
        onDone({ id: r.lead.id, name: nome, stage: 'Contato Inicial', whatsapp: whats||null, expected_value: valor||null, ai_score: null, segmento_especifico: cidade||null })
        setNome(''); setWhats(''); setValor(''); setCidade('')
      } else toast.error(r.error || 'Erro ao criar lead')
    })
  }

  return (
    <div style={{ background: 'rgba(22,27,34,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Novo Lead</p>
      <ClientSearchField
        clientes={clientes}
        selected={null}
        onSelect={(cliente) => { setNome(cliente.nome); setWhats(cliente.phone || '') }}
        onClear={() => {}}
        placeholder="Ja e cliente? Buscar cadastro"
      />
      <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do cliente *" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <input value={whats} onChange={e => setWhats(e.target.value)} placeholder="WhatsApp" type="tel" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="📍 Cidade / Região *" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <input value={valor} onChange={e => setValor(e.target.value)} placeholder="Valor" style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
      <button onClick={submit} disabled={isPending || !nome.trim()}
        style={{ padding: '12px', borderRadius: 10, background: 'linear-gradient(135deg,#b8880a,#fbbf24)', border: 'none', color: '#0a0600', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={16} />}
        {isPending ? 'Criando...' : 'Criar Lead'}
      </button>
    </div>
  )
}

function LogCallInline({ leads }: { leads: Lead[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [nota, setNota] = useState('')
  const [isPending, start] = useTransition()
  const active = leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')

  function submit() {
    if (!selectedId || !nota.trim()) { toast.error('Selecione o lead e escreva a nota'); return }
    start(async () => {
      const r = await recordCommercialActivity({ leadId: selectedId, activityType: 'ligacao', subject: nota.trim() })
      if (r.success) { toast.success('Ligação registrada!'); setNota(''); setSelectedId('') }
      else toast.error('Erro ao registrar')
    })
  }

  return (
    <div style={{ background: 'rgba(22,27,34,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Registrar Ligação</p>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ background: 'rgba(13,17,23,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: selectedId ? '#f0f6fc' : '#64748b', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
        <option value="">Selecione o lead...</option>
        {active.map(l => <option key={l.id} value={l.id}>{l.name}{l.segmento_especifico ? ` — ${l.segmento_especifico}` : ''}</option>)}
      </select>
      <textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="O que foi discutido? Próximo passo?" rows={2} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, padding: '10px 12px', color: '#f0f6fc', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%', resize: 'none', boxSizing: 'border-box' }} />
      <button onClick={submit} disabled={isPending || !selectedId || !nota.trim()}
        style={{ padding: '11px', borderRadius: 10, background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {isPending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={15} />}
        {isPending ? 'Salvando...' : 'Registrar Ligação'}
      </button>
    </div>
  )
}

function ContractInline({ leads, onDone }: { leads: Lead[]; onDone: () => void }) {
  const [selectedId, setSelectedId] = useState('')
  const [isPending, start] = useTransition()
  const hot = leads.filter(l => ['Proposta','Proposta Enviada','Negociação','Negociacao'].includes(l.stage||''))

  function submit() {
    if (!selectedId) { toast.error('Selecione o lead'); return }
    start(async () => {
      const r = await updateLeadStage(selectedId, 'Fechado')
      if (r.success) { toast.success('Contrato registrado!'); triggerSaleConfetti(); onDone(); setSelectedId('') }
      else toast.error('Erro ao fechar contrato')
    })
  }

  return (
    <div style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(22,27,34,0.9))', border: '1px solid rgba(251,191,36,0.22)', borderRadius: 14, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <p style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🤝 Registrar Contrato</p>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ background: 'rgba(13,17,23,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, padding: '10px 12px', color: selectedId ? '#f0f6fc' : '#64748b', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', width: '100%' }}>
        <option value="">Selecione o lead a fechar...</option>
        {(hot.length > 0 ? hot : leads.filter(l => l.stage !== 'Fechado' && l.stage !== 'Perdido')).map(l => <option key={l.id} value={l.id}>{l.name} — {l.stage}</option>)}
      </select>
      {hot.length > 0 && <p style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 600 }}>⚡ {hot.length} lead(s) em negociação ativa</p>}
      <button onClick={submit} disabled={isPending || !selectedId}
        style={{ padding: '13px', borderRadius: 10, background: 'linear-gradient(135deg,#b8880a,#fbbf24)', border: 'none', color: '#0a0600', fontWeight: 900, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 0 24px rgba(251,191,36,0.25)' }}>
        {isPending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <FileSignature size={16} />}
        {isPending ? 'Registrando...' : 'Confirmar Fechamento'}
      </button>
    </div>
  )
}



// ── Voz IA ────────────────────────────────────────────────────────────────────
type TriggerType = 'followup'|'reuniao'|'proposta'|'urgente'|'fechamento'|'nota'
interface VoiceResult { transcription: string; trigger: TriggerType; triggerLabel: string; triggerEmoji: string; clientMessage: string; nextStep: string; saved: boolean }
const TC: Record<TriggerType,{bg:string;border:string;text:string}> = {
  followup:   {bg:'rgba(56,189,248,0.07)',  border:'rgba(56,189,248,0.2)',  text:'#38bdf8'},
  reuniao:    {bg:'rgba(34,197,94,0.07)',   border:'rgba(34,197,94,0.2)',   text:'#22c55e'},
  proposta:   {bg:'rgba(251,191,36,0.07)',  border:'rgba(251,191,36,0.2)',  text:'#fbbf24'},
  urgente:    {bg:'rgba(239,68,68,0.07)',   border:'rgba(239,68,68,0.2)',   text:'#ef4444'},
  fechamento: {bg:'rgba(16,185,129,0.07)',  border:'rgba(16,185,129,0.2)', text:'#10b981'},
  nota:       {bg:'rgba(148,163,184,0.07)',border:'rgba(148,163,184,0.2)',text:'#94a3b8'},
}

function VozView({ leads }: { leads: Lead[] }) {
  const [phase, setPhase]   = useState<'idle'|'picking'|'ready'|'recording'|'processing'|'done'>('idle')
  const [lead, setLead]     = useState<Lead|null>(null)
  const [time, setTime]     = useState(0)
  const [result, setResult] = useState<VoiceResult|null>(null)
  const [sq, setSq]         = useState('')
  const [copied, setCopied] = useState(false)
  const timerRef  = useRef<NodeJS.Timeout|null>(null)
  const mrRef     = useRef<MediaRecorder|null>(null)
  const chRef     = useRef<Blob[]>([])
  const active    = leads.filter(l => l.stage!=='Fechado'&&l.stage!=='Perdido')
  const filtered  = sq.trim() ? active.filter(l=>l.name.toLowerCase().includes(sq.toLowerCase())) : active

  useEffect(() => ()=>{ if(timerRef.current) clearInterval(timerRef.current); mrRef.current?.stream?.getTracks().forEach(t=>t.stop()) }, [])
  const stopTimer = () => { if(timerRef.current){clearInterval(timerRef.current);timerRef.current=null} }

  const tap = async () => {
    if(phase==='idle')      { setPhase('picking'); setSq(''); return }
    if(phase==='picking')   { setPhase('idle'); return }
    if(phase==='processing'){ return }
    if(phase==='done')      { setPhase('idle'); setLead(null); setResult(null); return }
    if(phase==='recording') { setPhase('processing'); stopTimer(); mrRef.current?.stop(); return }
    if(phase==='ready') {
      if(typeof window !== 'undefined' && !window.isSecureContext) {
        toast.error('Microfone bloqueado pelo navegador', {
          description: 'No celular, gravacao de audio so funciona em HTTPS. Use o link HTTPS local ou Vercel.',
        })
        return
      }
      if(!navigator.mediaDevices?.getUserMedia){ toast.error('Microfone não suportado neste browser'); return }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({audio:true})
      } catch(err: unknown) {
        // SecurityError = browser bloqueou por HTTP (não é localhost/HTTPS)
        const name = err instanceof Error ? err.name : ''
        if(name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          toast.error('Permissão negada', { description: 'Permita o microfone nas configurações do browser.' })
        } else if(name === 'NotSupportedError' || name === 'SecurityError') {
          toast.error('Microfone bloqueado', { description: 'Para gravar voz, acesse via HTTPS ou localhost.' })
        } else {
          toast.error('Microfone indisponível', { description: 'Verifique se o microfone está conectado.' })
        }
        return
      }
      chRef.current=[]
      const mt = MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'audio/ogg'
      const mr = new MediaRecorder(stream,{mimeType:mt})
      mrRef.current=mr
      mr.ondataavailable=e=>{ if(e.data.size>0) chRef.current.push(e.data) }
      mr.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop())
        const blob=new Blob(chRef.current,{type:mr.mimeType})
        const form=new FormData()
        form.append('audio',blob,'audio.webm')
        if(lead){ form.append('leadId',lead.id); form.append('leadName',lead.name) }
        try {
          const res=await fetch('/api/voice-note',{method:'POST',body:form})
          const data=await res.json() as VoiceResult&{error?:string}
          if(!res.ok||data.error){ toast.error('Erro na transcrição',{description:data.error}); setPhase('ready'); return }
          setResult(data); setPhase('done')
          toast.success(`${data.triggerEmoji} ${data.triggerLabel}`,{description: data.saved&&lead?`Salvo em ${lead.name}`:'Concluído.'})
        } catch { toast.error('Falha ao enviar áudio'); setPhase('ready') }
        finally { setTime(0) }
      }
      mr.start(1000); setPhase('recording'); setTime(0)
      timerRef.current=setInterval(()=>setTime(p=>p+1),1000)
      toast.info('Gravando...',{description:'Toque novamente para parar.'})
    }
  }

  const isRec=phase==='recording', isProc=phase==='processing', isDone=phase==='done'
  const ac=isRec?'#ef4444':isProc?'#f59e0b':'#fbbf24'

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{padding:'12px 14px',borderRadius:12,background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.1)',display:'flex',alignItems:'flex-start',gap:10}}>
        <span style={{fontSize:'1rem',flexShrink:0}}>🎙️</span>
        <div>
          <p style={{fontSize:'0.75rem',fontWeight:800,color:'#fbbf24',marginBottom:3}}>Como funciona?</p>
          <p style={{fontSize:'0.72rem',color:'#64748b',lineHeight:1.5}}>Grave → <strong style={{color:'#c9d1d9'}}>Whisper</strong> transcreve → <strong style={{color:'#c9d1d9'}}>GPT</strong> analisa → salva em <strong style={{color:'#c9d1d9'}}>Histórico do lead</strong> + gera mensagem WhatsApp.</p>
        </div>
      </div>

      <button onClick={tap} disabled={isProc} style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'16px',background:isRec?'rgba(239,68,68,0.07)':isDone?'rgba(16,185,129,0.05)':'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',border:`1px solid ${isRec?'rgba(239,68,68,0.25)':isDone?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.07)'}`,borderRadius:14,cursor:isProc?'wait':'pointer',textAlign:'left'}}>
        <div style={{width:48,height:48,borderRadius:14,background:`${ac}15`,border:`1px solid ${ac}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {isProc?<Loader2 size={20} color="#f59e0b" style={{animation:'spin 1s linear infinite'}}/>:isRec?<Square size={18} color="#ef4444"/>:<Mic size={20} color={isDone?'#10b981':'#fbbf24'}/>}
        </div>
        <div style={{flex:1}}>
          <p style={{fontSize:'0.9rem',fontWeight:800,color:'#f0f6fc',lineHeight:1.2}}>
            {isProc?'Transcrevendo...':isRec?'Gravando — toque para parar':isDone?'Nova gravação':phase==='ready'?`Gravar para: ${lead?.name??'sem lead'}`:phase==='picking'?'Fechar seletor':'Iniciar Diário de Voz IA'}
          </p>
          <p style={{fontSize:'0.7rem',color:'#475569',marginTop:3}}>
            {isProc?'Whisper + GPT processando':isRec?`⏱ ${formatTime(time)}`:isDone?'Nota salva no CRM':phase==='ready'?'Toque para gravar':phase==='picking'?'Selecione o lead abaixo':'Selecione um lead e grave'}
          </p>
        </div>
        {isRec&&<span style={{fontSize:'0.65rem',fontWeight:800,color:'#ef4444',background:'rgba(239,68,68,0.1)',padding:'4px 10px',borderRadius:999,flexShrink:0}}>PARAR</span>}
        {phase==='ready'&&<span style={{fontSize:'0.65rem',fontWeight:800,color:'#fbbf24',background:'rgba(251,191,36,0.1)',padding:'4px 10px',borderRadius:999,flexShrink:0}}>GRAVAR</span>}
      </button>

      {phase==='picking'&&(
        <div style={{borderRadius:13,overflow:'hidden',border:'1px solid rgba(251,191,36,0.15)',background:'rgba(13,17,23,0.95)'}}>
          <div style={{padding:'10px 12px',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <input type="text" placeholder="Buscar lead..." value={sq} onChange={e=>setSq(e.target.value)} autoFocus style={{width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,padding:'8px 12px',color:'#f0f6fc',fontSize:'0.82rem',outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit'}}/>
          </div>
          <div style={{maxHeight:220,overflowY:'auto' as const}}>
            <button onClick={()=>{setLead(null);setPhase('ready');setSq('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',textAlign:'left' as const}}>
              <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center'}}><Mic size={13} color="#475569"/></div>
              <div><p style={{fontSize:'0.8rem',fontWeight:600,color:'#64748b'}}>Sem lead (só transcrever)</p></div>
            </button>
            {filtered.map(l=>(
              <button key={l.id} onClick={()=>{setLead(l);setPhase('ready');setSq('')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'transparent',border:'none',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',textAlign:'left' as const}}>
                <div style={{width:30,height:30,borderRadius:'50%',background:`${STAGE_COLORS[l.stage||'']||'#64748b'}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',fontWeight:900,color:STAGE_COLORS[l.stage||'']||'#64748b'}}>{l.name.charAt(0).toUpperCase()}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:'0.8rem',fontWeight:700,color:'#f0f6fc',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.name}</p>
                  <p style={{fontSize:'0.6rem',color:'#475569',marginTop:1}}>{l.stage}{l.segmento_especifico?` · ${l.segmento_especifico}`:''}</p>
                </div>
                <ChevronRight size={13} color="#1e293b"/>
              </button>
            ))}
          </div>
        </div>
      )}

      {(phase==='ready'||phase==='recording')&&lead&&(
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,background:'rgba(251,191,36,0.05)',border:'1px solid rgba(251,191,36,0.14)'}}>
          <span style={{fontSize:'0.72rem',fontWeight:700,color:'#fbbf24'}}>Nota para:</span>
          <span style={{fontSize:'0.72rem',fontWeight:800,color:'#f0f6fc',flex:1}}>{lead.name}</span>
          {phase!=='recording'&&<button onClick={()=>{setPhase('picking');setSq('')}} style={{fontSize:'0.6rem',color:'#334155',background:'none',border:'none',cursor:'pointer'}}>trocar</button>}
        </div>
      )}

      {isDone&&result&&(()=>{
        const tc=TC[result.trigger]
        const waNum=lead?.whatsapp?.replace(/\D/g,'')
        const waLink=waNum?`https://wa.me/55${waNum}?text=${encodeURIComponent(result.clientMessage)}`:null
        return (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 13px',borderRadius:11,background:tc.bg,border:`1px solid ${tc.border}`}}>
              <span style={{fontSize:'1.1rem'}}>{result.triggerEmoji}</span>
              <div style={{flex:1}}><p style={{fontSize:'0.58rem',fontWeight:800,color:tc.text,textTransform:'uppercase' as const,letterSpacing:'0.1em'}}>Gatilho</p><p style={{fontSize:'0.82rem',fontWeight:800,color:'#f0f6fc'}}>{result.triggerLabel}</p></div>
              {result.saved&&<span style={{fontSize:'0.58rem',fontWeight:800,color:'#10b981',background:'rgba(16,185,129,0.1)',padding:'3px 7px',borderRadius:999}}>✓ SALVO</span>}
            </div>
            <div style={{padding:'10px 13px',borderRadius:11,background:'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',border:'1px solid rgba(255,255,255,0.06)'}}>
              <p style={{fontSize:'0.56rem',fontWeight:800,color:'#334155',textTransform:'uppercase' as const,letterSpacing:'0.1em',marginBottom:4}}>Você disse</p>
              <p style={{fontSize:'0.76rem',color:'#64748b',lineHeight:1.55,fontStyle:'italic'}}>&ldquo;{result.transcription}&rdquo;</p>
            </div>
            {result.clientMessage&&result.trigger!=='nota'&&(
              <div style={{padding:'11px 13px',borderRadius:11,background:'rgba(34,197,94,0.05)',border:'1px solid rgba(34,197,94,0.14)'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}>
                  <p style={{fontSize:'0.56rem',fontWeight:800,color:'#22c55e',textTransform:'uppercase' as const,letterSpacing:'0.1em'}}>💬 Para o cliente</p>
                  <button onClick={()=>{navigator.clipboard.writeText(result.clientMessage).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);toast.success('Copiado!')})}} style={{fontSize:'0.58rem',fontWeight:800,color:copied?'#10b981':'#475569',background:'none',border:'none',cursor:'pointer'}}>{copied?'✓':'Copiar'}</button>
                </div>
                <p style={{fontSize:'0.76rem',color:'#e2e8f0',lineHeight:1.6}}>{result.clientMessage}</p>
                {waLink?<a href={waLink} target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,marginTop:10,padding:'9px 14px',borderRadius:9,background:'rgba(37,211,102,0.1)',border:'1px solid rgba(37,211,102,0.22)',color:'#25d366',fontSize:'0.76rem',fontWeight:800,textDecoration:'none'}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.112 1.522 5.84L.057 23.884c-.054.218.022.448.197.592a.5.5 0 0 0 .42.082l6.19-1.623A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.854 0-3.6-.51-5.094-1.395l-.356-.208-3.692.967.986-3.604-.233-.375A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp
                </a>:<p style={{marginTop:7,fontSize:'0.62rem',color:'#334155',textAlign:'center' as const}}>Sem WhatsApp — copie a mensagem</p>}
              </div>
            )}
            <div style={{padding:'10px 13px',borderRadius:11,background:'rgba(251,191,36,0.04)',border:'1px solid rgba(251,191,36,0.1)'}}>
              <p style={{fontSize:'0.56rem',fontWeight:800,color:'#fbbf24',textTransform:'uppercase' as const,letterSpacing:'0.1em',marginBottom:3}}>➡️ Próximo passo</p>
              <p style={{fontSize:'0.76rem',color:'#e2e8f0',fontWeight:600}}>{result.nextStep}</p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Agenda View ───────────────────────────────────────────────────────────────
function AgendaView({
  agenda,
  leads,
  userId,
  selectedLeadId,
  onCreated,
}: {
  agenda: MobileAgendaItem[]
  leads: Lead[]
  userId?: string | null
  selectedLeadId?: string
  onCreated: (item: MobileAgendaItem) => void
}) {
  const [leadId, setLeadId] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [location, setLocation] = useState('')
  const [objective, setObjective] = useState('')
  const [isPending, start] = useTransition()
  const hoje = new Date().toDateString()
  const activeLeads = leads.filter((lead) => lead.stage !== 'Fechado' && lead.stage !== 'Perdido')

  useEffect(() => {
    if (selectedLeadId) setLeadId(selectedLeadId)
  }, [selectedLeadId])

  function getValidOwnerId(value?: string | null) {
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
  }

  function submitMeeting() {
    const lead = leads.find((item) => item.id === leadId)
    if (!lead) { toast.error('Selecione o lead.'); return }
    if (!scheduledFor) { toast.error('Informe data e horario.'); return }

    const isoDate = new Date(scheduledFor).toISOString()
    start(async () => {
      const title = `Reuniao com ${lead.name}`
      const result = await createMeeting({
        title,
        scheduled_for: isoDate,
        location: location.trim() || null,
        meeting_type: 'Presencial',
        lead_id: lead.id,
        lead_name: lead.name,
        company_name: lead.company || null,
        objective: objective.trim() || null,
        agenda: objective.trim() || null,
        owner_profile_id: getValidOwnerId(userId),
      })

      if (!result.success) {
        toast.error('Erro ao agendar reuniao', { description: result.error })
        return
      }

      onCreated({
        id: result.data?.id || `local-${Date.now()}`,
        title,
        scheduled_for: isoDate,
        client_name: lead.name,
        location: location.trim() || null,
      })
      setLeadId('')
      setScheduledFor('')
      setLocation('')
      setObjective('')
      toast.success('Reuniao agendada no CRM.')
    })
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{background:'rgba(22,27,34,0.6)',border:'1px solid rgba(125,211,252,0.18)',borderRadius:14,padding:'14px',display:'grid',gap:9}}>
        <p style={{fontSize:'0.6rem',fontWeight:900,color:'#7dd3fc',textTransform:'uppercase',letterSpacing:'0.1em'}}>Marcar reuniao</p>
        <select value={leadId} onChange={e => setLeadId(e.target.value)} style={{background:'rgba(13,17,23,0.5)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,padding:'10px 12px',color:leadId?'#f0f6fc':'#64748b',fontSize:'0.85rem',outline:'none',fontFamily:'inherit',width:'100%'}}>
          <option value="">Selecione o lead...</option>
          {activeLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}{lead.company ? ` - ${lead.company}` : ''}</option>)}
        </select>
        <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,padding:'10px 12px',color:'#f0f6fc',fontSize:'0.85rem',outline:'none',fontFamily:'inherit',colorScheme:'dark'}} />
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Local ou endereco" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,padding:'10px 12px',color:'#f0f6fc',fontSize:'0.85rem',outline:'none',fontFamily:'inherit'}} />
        <textarea value={objective} onChange={e => setObjective(e.target.value)} placeholder="Pauta / objetivo" rows={2} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:9,padding:'10px 12px',color:'#f0f6fc',fontSize:'0.85rem',outline:'none',fontFamily:'inherit',resize:'none'}} />
        <button onClick={submitMeeting} disabled={isPending || !leadId || !scheduledFor} style={{padding:'12px',borderRadius:10,background:'rgba(125,211,252,0.12)',border:'1px solid rgba(125,211,252,0.28)',color:'#7dd3fc',fontWeight:900,fontSize:'0.85rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {isPending ? <Loader2 size={15} style={{animation:'spin 1s linear infinite'}}/> : <CalendarDays size={15}/>}
          {isPending ? 'Agendando...' : 'Salvar reuniao'}
        </button>
      </div>
      <div style={{display:'flex',gap:7}}>
        <StatCard label="Hoje" value={agenda.filter(m=>m.scheduled_for&&new Date(m.scheduled_for).toDateString()===hoje).length} sub="Reuniões" color="#7dd3fc"/>
        <StatCard label="Próximas" value={agenda.length} sub="Agendadas" color="#38bdf8"/>
      </div>
      {agenda.length===0
        ? <div style={{padding:28,textAlign:'center',borderRadius:14,background:'rgba(22,27,34,0.6)',border:'1px dashed rgba(251,191,36,0.1)'}}>
            <CalendarDays size={28} color="rgba(251,191,36,0.2)" style={{margin:'0 auto 10px'}}/>
            <p style={{fontSize:'0.82rem',color:'#1e293b'}}>Nenhuma reunião agendada.</p>
          </div>
        : agenda.slice(0,8).map((m,i)=>{
            const dt=m.scheduled_for?new Date(m.scheduled_for):null
            const isHoje=dt?.toDateString()===hoje
            return (
              <div key={m.id||i} style={{display:'flex',gap:12,padding:'13px 14px',background:isHoje?'rgba(125,211,252,0.06)':'rgba(22,27,34,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',border:`1px solid ${isHoje?'rgba(125,211,252,0.2)':'rgba(255,255,255,0.06)'}`,borderRadius:12}}>
                <div style={{textAlign:'center',flexShrink:0,minWidth:44}}>
                  <p style={{fontSize:'0.6rem',fontWeight:800,color:isHoje?'#7dd3fc':'#475569',textTransform:'uppercase' as const}}>{dt?dt.toLocaleDateString('pt-BR',{weekday:'short'}):'-'}</p>
                  <p style={{fontSize:'1.2rem',fontWeight:900,color:isHoje?'#7dd3fc':'#f0f6fc',lineHeight:1}}>{dt?dt.getDate():'-'}</p>
                  <p style={{fontSize:'0.62rem',color:'#475569'}}>{dt?dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):''}</p>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:'0.84rem',fontWeight:700,color:'#f0f6fc',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.title||'Reunião'}</p>
                  {m.client_name&&<p style={{fontSize:'0.65rem',color:'#475569',marginTop:3}}>{m.client_name}</p>}
                  {isHoje&&<span style={{fontSize:'0.58rem',fontWeight:800,color:'#7dd3fc',background:'rgba(125,211,252,0.1)',padding:'2px 7px',borderRadius:999,marginTop:4,display:'inline-block'}}>HOJE</span>}
                </div>
              </div>
            )
          })
      }
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
function normalizeTab(value?: string): TabId {
  return ALL_TABS.some((item) => item.id === value) ? value as TabId : 'pipeline'
}

export default function MobileHubClient({ user, leads: initialLeads, clientes, stats, agenda, initialTab, initialLeadId }: MobileHubProps) {
  const [activeTab, setActiveTab] = useState<TabId>(normalizeTab(initialTab))
  const [greeting, setGreeting]   = useState('Olá')
  const [leads, setLeads]         = useState<Lead[]>(initialLeads)
  const [agendaItems, setAgendaItems] = useState<MobileAgendaItem[]>(agenda)
  const [agendaLeadId, setAgendaLeadId] = useState(initialLeadId || '')

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Consultor'

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 12) setGreeting('Bom dia')
    else if (h < 18) setGreeting('Boa tarde')
    else setGreeting('Boa noite')
  }, [])

  // Paleta idêntica ao sistema web (globals.css)
  // --brand-darker: #010409 | --brand-dark: #0d1117 | --brand-surface: #161b22
  // --brand-primary: #fbbf24 | --brand-text: #f0f6fc

  return (
    <>
      <div style={{
        maxWidth: 500, margin: '0 auto', minHeight: '100svh',
        background: 'radial-gradient(ellipse at top, #0d1117 0%, #010409 100%)',
        color: '#f0f6fc', position: 'relative', overflowX: 'hidden',
        fontFamily: 'var(--font-inter),Inter,-apple-system,sans-serif',
      }}>
      {/* Background animado (igual web login) */}
      <StarField />
      <FloatingParticles />

      {/* Conteúdo (zIndex > 1) */}
      <div style={{ position: 'relative', zIndex: 10 }}>
      {/* Glow superior — igual ao web */}
      <div style={{
        position: 'fixed', top: -80, left: '5%', right: '5%', height: 300,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.09) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ padding: '0 0 120px', position: 'relative', zIndex: 1 }}>

        {/* ── Header: logo centralizada, sem avatar ── */}
        <header style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '28px 20px 20px',
          borderBottom: '1px solid rgba(251,191,36,0.1)',
          background: 'linear-gradient(180deg, rgba(22,27,34,0.6) 0%, transparent 100%)',
          backdropFilter: 'blur(8px)',
          position: 'sticky', top: 0, zIndex: 10,
          marginBottom: 20,
        }}>
          <Image
            src="/logo-branco-pbg.png"
            alt="Grupo Palin Martins"
            width={160}
            height={46}
            priority
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.25))',
            }}
          />
          {/* Linha de status/alertas abaixo da logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.2)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8' }}>{greeting}, <span style={{ color: '#fbbf24' }}>{firstName}</span></span>
            </div>
            {stats.atividadesAtrasadas > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 999,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              }}>
                <AlertCircle size={10} color="#ef4444" />
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#ef4444' }}>
                  {stats.atividadesAtrasadas} atrasada{stats.atividadesAtrasadas !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* ── Saudação ── */}
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <p style={{ fontSize: '0.7rem', color: '#8b949e', fontWeight: 600, marginBottom: 2 }}>
            {greeting}, {firstName} 👋
          </p>
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(22,27,34,0.95), rgba(13,17,23,0.9))',
            border: '1px solid rgba(251,191,36,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div>
              <p style={{ fontSize: '0.58rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Leads Ativos</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1.1, textShadow: '0 0 24px rgba(251,191,36,0.5)' }}>{stats.activeLeads}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.58rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Fechados</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981', lineHeight: 1.1, textShadow: '0 0 24px rgba(16,185,129,0.4)' }}>{stats.closedLeads}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.58rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Hot Leads</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ef4444', lineHeight: 1.1, textShadow: '0 0 24px rgba(239,68,68,0.4)' }}>{stats.hotLeads}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.58rem', color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Conversão</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#38bdf8', lineHeight: 1.1, textShadow: '0 0 24px rgba(56,189,248,0.4)' }}>{stats.conversionRate}%</p>
            </div>
          </div>
        </div>

        {/* ── Conteúdo das abas ── */}
        <div style={{ padding: '0 16px' }}>
          {activeTab === 'pipeline' && <PipelineView leads={leads} stats={stats} onLeadsChange={setLeads} onScheduleLead={(lead) => { setAgendaLeadId(lead.id); setActiveTab('agenda') }} />}
          {activeTab === 'agenda'   && <AgendaView agenda={agendaItems} leads={leads} userId={user?.id} selectedLeadId={agendaLeadId} onCreated={(item) => setAgendaItems((current) => [item, ...current])} />}
          {activeTab === 'radar'    && <RadarView leads={leads} onScheduleLead={(lead) => { setAgendaLeadId(lead.id); setActiveTab('agenda') }} />}
          {activeTab === 'voz'      && <VozView leads={leads} />}
          {activeTab === 'lead'     && <NewLeadInlineFull clientes={clientes} onDone={l => { setLeads([l,...leads]); setActiveTab('pipeline') }} />}
          {activeTab === 'call'     && <LogCallInline leads={leads} />}
          {activeTab === 'contract' && <ContractInline leads={leads} onDone={() => setActiveTab('pipeline')} />}
        </div>
        
        {/* Bottom spacer for FAB */}
        <div style={{ height: 100 }} />
      </div>
      </div>
      </div>

      <NativeFABMenu active={activeTab} />

      <style>{`
        @keyframes spin       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse-gold { 0%,100%{box-shadow:0 0 6px rgba(251,191,36,0.6)} 50%{box-shadow:0 0 16px rgba(251,191,36,1)} }
        @keyframes fadeInUp   { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
        select option { background: #0d1117; }
      `}</style>
    </>
  )
}

// SEO Helper: og: name="description" <title>
