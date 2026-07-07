'use client'

import { useState, useTransition, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Users, Star, Gem, ChevronLeft, ChevronRight, Plus, X,
  Package, CalendarDays, CheckSquare, GraduationCap, Link2,
  Clock, AlertTriangle, Check, Search, Filter,
  Phone, Mail, Building2, User2, Edit2, Trash2,
} from 'lucide-react'
import InsiderLogo from '@/components/insider-logo'
import {
  updateClubMember, upsertDeliverable, toggleDeliverableDone, deleteDeliverable,
  addMemberConnection, removeMemberConnection,
} from '@/app/actions/clube'
import type { ClubMember, ClubDeliverable, ClubConnection } from '@/app/actions/clube'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Profile = { id: string; full_name: string; avatar_url: string | null; role: string }
type EventRow = { id: string; name: string; date: string; location?: string | null; status?: string | null }
type MemberTab = 'resumo' | 'conexoes' | 'entregas' | 'tarefas' | 'treinamentos'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  standard: { label: 'Standard', color: '#94a3b8', icon: InsiderLogo },
  plus:     { label: 'Plus',     color: '#60a5fa', icon: Star },
  vip:      { label: 'VIP',      color: '#f59e0b', icon: Gem },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  ativo:        { label: 'Ativo',        bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  em_renovacao: { label: 'Em Renovação', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  inativo:      { label: 'Inativo',      bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const CAT_CONFIG: Record<string, { label: string; color: string }> = {
  mentoria: { label: 'Mentoria',   color: '#0ea5e9' },
  conteudo: { label: 'Conteúdo',   color: '#3b82f6' },
  material: { label: 'Material',   color: '#10b981' },
  evento:   { label: 'Evento',     color: '#f59e0b' },
}

const CONN_TYPE: Record<string, { label: string; color: string }> = {
  parceiro:   { label: 'Parceiro',    color: '#0ea5e9' },
  indicacao:  { label: 'Indicação',   color: '#10b981' },
  networking: { label: 'Networking',  color: '#e879f9' },
  cliente:    { label: 'Cliente',     color: '#f59e0b' },
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function parseConnections(notes: string | null): ClubConnection[] {
  if (!notes) return []
  try {
    const parsed = JSON.parse(notes)
    return Array.isArray(parsed.connections) ? parsed.connections : []
  } catch {
    return []
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = '#fbbf24', alert = false }: { label: string; value: string | number; sub?: string; color?: string; alert?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 110, padding: '16px 14px',
      background: 'rgba(22,27,34,0.9)',
      border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : color + '25'}`,
      borderRadius: 14, position: 'relative', overflow: 'hidden',
      boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${alert ? '#ef4444' : color}, transparent)` }} />
      <p style={{ fontSize: '0.55rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: '1.7rem', fontWeight: 900, color: alert ? '#ef4444' : color, lineHeight: 1, letterSpacing: '-0.04em', textShadow: `0 0 20px ${color}50` }}>{value}</p>
      {sub && <p style={{ fontSize: '0.65rem', color: '#334155', marginTop: 5, fontWeight: 600 }}>{sub}</p>}
    </div>
  )
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em' }}>
      {label}
    </span>
  )
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ fontSize: '0.72rem', fontWeight: 900, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{children}</h3>
      {action}
    </div>
  )
}

function TabBtn({ label, icon: Icon, active, onClick }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
      background: active ? 'rgba(251,191,36,0.1)' : 'transparent',
      border: `1px solid ${active ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
      borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
      color: active ? '#fbbf24' : '#475569',
      fontSize: '0.72rem', fontWeight: 800,
      transition: 'all 0.2s ease',
    }}>
      <Icon size={13} />
      {label}
    </button>
  )
}

function EmptyState({ icon: Icon, label, color = '#334155' }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center', borderRadius: 14, background: 'rgba(22,27,34,0.4)', border: '1px dashed rgba(255,255,255,0.06)' }}>
      <Icon size={28} color={color} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
      <p style={{ fontSize: '0.8rem', color: '#334155' }}>{label}</p>
    </div>
  )
}

// ─── Deliverable Card ─────────────────────────────────────────────────────────

function DeliverableCard({ d, onToggle, onDelete }: { d: ClubDeliverable; onToggle: () => void; onDelete: () => void }) {
  const cat = CAT_CONFIG[d.category] || { label: d.category, color: '#64748b' }
  const done = d.status === 'concluido'
  const late = d.status === 'atrasado'

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px',
      background: done ? 'rgba(16,185,129,0.04)' : late ? 'rgba(239,68,68,0.04)' : 'rgba(22,27,34,0.9)',
      border: `1px solid ${done ? 'rgba(16,185,129,0.15)' : late ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12,
    }}>
      <button onClick={onToggle} style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginTop: 2,
        background: done ? '#10b981' : 'transparent',
        border: `2px solid ${done ? '#10b981' : late ? '#ef4444' : '#334155'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }}>
        {done && <Check size={12} color="#000" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.84rem', fontWeight: 700, color: done ? '#475569' : '#f0f6fc', textDecoration: done ? 'line-through' : 'none' }}>{d.title}</p>
        {d.description && <p style={{ fontSize: '0.68rem', color: '#334155', marginTop: 3 }}>{d.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: cat.color, background: cat.color + '18', padding: '2px 8px', borderRadius: 999 }}>{cat.label}</span>
          {d.due_date && <span style={{ fontSize: '0.62rem', color: late ? '#ef4444' : '#475569', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{fmt(d.due_date)}</span>}
        </div>
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#334155', flexShrink: 0 }}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Connection Card ──────────────────────────────────────────────────────────

function ConnectionCard({ conn, onDelete }: { conn: ClubConnection; onDelete: () => void }) {
  const ct = CONN_TYPE[conn.type] || { label: conn.type, color: '#64748b' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: ct.color + '18', border: `1.5px solid ${ct.color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.8rem', fontWeight: 900, color: ct.color,
      }}>
        {conn.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f0f6fc' }}>{conn.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: '0.6rem', fontWeight: 800, color: ct.color, background: ct.color + '18', padding: '2px 8px', borderRadius: 999 }}>{ct.label}</span>
          {conn.company && <span style={{ fontSize: '0.64rem', color: '#475569' }}>{conn.company}</span>}
          <span style={{ fontSize: '0.62rem', color: '#334155' }}>{new Date(conn.date).toLocaleDateString('pt-BR')}</span>
        </div>
        {conn.notes && <p style={{ fontSize: '0.66rem', color: '#334155', marginTop: 4 }}>{conn.notes}</p>}
      </div>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#334155' }}>
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Member Detail View ───────────────────────────────────────────────────────

function MemberDetail({
  member, deliverables, events, profiles,
  onBack, onMemberUpdate,
}: {
  member: ClubMember
  deliverables: ClubDeliverable[]
  events: EventRow[]
  profiles: Profile[]
  onBack: () => void
  onMemberUpdate: (m: ClubMember) => void
}) {
  const [activeTab, setActiveTab] = useState<MemberTab>('resumo')
  const [isPending, startTransition] = useTransition()
  const [localDeliverables, setLocalDeliverables] = useState(deliverables)
  const connections = useMemo(() => parseConnections(member.notes), [member.notes])

  // Forms
  const [showDeliv, setShowDeliv] = useState(false)
  const [showConn, setShowConn] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [delivForm, setDelivForm] = useState({ title: '', description: '', category: 'mentoria' as ClubDeliverable['category'], due_date: '' })
  const [connForm, setConnForm] = useState({ name: '', company: '', type: 'networking' as ClubConnection['type'], date: new Date().toISOString().split('T')[0], notes: '' })
  const [editForm, setEditForm] = useState({ status: member.status, tier: member.tier, mentor_id: member.mentor_id || '', contract_start: member.contract_start || '', contract_end: member.contract_end || '' })

  const tier = TIER_CONFIG[member.tier] || TIER_CONFIG.standard
  const status = STATUS_CONFIG[member.status] || STATUS_CONFIG.ativo
  const TierIcon = tier.icon
  const daysLeft = daysUntil(member.contract_end)

  const memberDeliverables = localDeliverables.filter(d => d.member_id === member.id || d.is_global)

  const tabs: { id: MemberTab; label: string; icon: React.ElementType }[] = [
    { id: 'resumo',       label: 'Resumo',       icon: User2 },
    { id: 'conexoes',     label: 'Conexões',      icon: Link2 },
    { id: 'entregas',     label: 'Entregas',      icon: Package },
    { id: 'tarefas',      label: 'Tarefas',       icon: CheckSquare },
    { id: 'treinamentos', label: 'Treinamentos',  icon: GraduationCap },
  ]

  function handleToggle(d: ClubDeliverable) {
    setLocalDeliverables(prev => prev.map(x => x.id === d.id ? { ...x, status: x.status === 'concluido' ? 'pendente' : 'concluido' } : x))
    startTransition(async () => {
      const res = await toggleDeliverableDone(d.id, d.status)
      if (!res.success) toast.error('Erro ao atualizar entrega')
    })
  }

  function handleDeleteDeliv(id: string) {
    setLocalDeliverables(prev => prev.filter(x => x.id !== id))
    startTransition(async () => {
      const res = await deleteDeliverable(id)
      if (!res.success) toast.error('Erro ao remover entrega')
    })
  }

  function handleAddDeliv() {
    if (!delivForm.title.trim()) return toast.error('Título obrigatório')
    startTransition(async () => {
      const res = await upsertDeliverable({
        ...delivForm,
        member_id: member.id,
        is_global: false,
        status: 'pendente',
      })
      if (res.success) {
        toast.success('Entrega adicionada!')
        setShowDeliv(false)
        setDelivForm({ title: '', description: '', category: 'mentoria', due_date: '' })
      } else {
        toast.error(res.error || 'Erro ao adicionar')
      }
    })
  }

  function handleAddConn() {
    if (!connForm.name.trim()) return toast.error('Nome obrigatório')
    startTransition(async () => {
      const res = await addMemberConnection(member.id, connForm)
      if (res.success) {
        toast.success('Conexão registrada!')
        setShowConn(false)
        setConnForm({ name: '', company: '', type: 'networking', date: new Date().toISOString().split('T')[0], notes: '' })
        // Force update connections (refetch would be ideal, but we update parent)
        onMemberUpdate({ ...member })
      } else {
        toast.error(res.error || 'Erro ao salvar conexão')
      }
    })
  }

  function handleRemoveConn(connId: string) {
    startTransition(async () => {
      const res = await removeMemberConnection(member.id, connId)
      if (res.success) { toast.success('Conexão removida'); onMemberUpdate({ ...member }) }
      else toast.error('Erro ao remover conexão')
    })
  }

  function handleSaveEdit() {
    startTransition(async () => {
      const res = await updateClubMember(member.id, editForm)
      if (res.success) {
        toast.success('Membro atualizado!')
        setShowEdit(false)
        onMemberUpdate({ ...member, ...editForm })
      } else {
        toast.error(res.error || 'Erro ao salvar')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: '0.82rem',
    background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#f0f6fc', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.62rem', color: '#475569', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
  }
  const btnStyle = (primary = false): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer',
    border: primary ? 'none' : '1px solid rgba(255,255,255,0.1)',
    background: primary ? 'linear-gradient(135deg, #92620a, #fbbf24)' : 'rgba(22,27,34,0.9)',
    color: primary ? '#000' : '#8b949e',
  })

  return (
    <div>
      {/* Back + Member Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: '0.78rem', fontWeight: 700, marginBottom: 16 }}>
          <ChevronLeft size={16} /> Todos os Membros
        </button>

        <div style={{
          padding: '20px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(22,27,34,0.98), rgba(13,17,23,0.95))',
          border: `1px solid ${tier.color}30`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${tier.color}10`,
        }}>
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: `linear-gradient(135deg, ${tier.color}30, ${tier.color}12)`,
                border: `2px solid ${tier.color}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', fontWeight: 900, color: tier.color,
                boxShadow: `0 0 20px ${tier.color}30`,
              }}>
                {initials(member.client?.name || 'C')}
              </div>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f0f6fc', lineHeight: 1.2 }}>{member.client?.name || '—'}</h2>
                {member.client?.company_name && <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 3 }}>{member.client.company_name}</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Badge label={tier.label} bg={tier.color + '18'} color={tier.color} />
                  <Badge label={status.label} bg={status.bg} color={status.color} />
                </div>
              </div>
            </div>
            <button onClick={() => setShowEdit(true)} style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#fbbf24' }}>
              <Edit2 size={14} />
            </button>
          </div>

          {/* Contact row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {member.client?.email && (
              <a href={`mailto:${member.client.email}`} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#475569', textDecoration: 'none' }}>
                <Mail size={11} color="#38bdf8" />{member.client.email}
              </a>
            )}
            {member.client?.whatsapp && (
              <a href={`https://wa.me/${member.client.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#475569', textDecoration: 'none' }}>
                <Phone size={11} color="#10b981" />{member.client.whatsapp}
              </a>
            )}
          </div>

          {/* Contract */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: 'rgba(13,17,23,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.55rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Início</p>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f0f6fc' }}>{fmt(member.contract_start)}</p>
            </div>
            <div style={{ flex: 1, padding: '9px 12px', borderRadius: 10, background: daysLeft !== null && daysLeft <= 30 ? 'rgba(239,68,68,0.06)' : 'rgba(13,17,23,0.6)', border: `1px solid ${daysLeft !== null && daysLeft <= 30 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
              <p style={{ fontSize: '0.55rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Vencimento</p>
              <p style={{ fontSize: '0.82rem', fontWeight: 700, color: daysLeft !== null && daysLeft <= 30 ? '#ef4444' : '#f0f6fc' }}>
                {fmt(member.contract_end)}
                {daysLeft !== null && <span style={{ fontSize: '0.62rem', marginLeft: 6 }}>({daysLeft}d)</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {tabs.map(t => (
          <TabBtn key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
        ))}
      </div>

      {/* ── Resumo ── */}
      {activeTab === 'resumo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <KpiCard label="Entregas" value={memberDeliverables.filter(d => d.status === 'concluido').length} sub="concluídas" color="#10b981" />
            <KpiCard label="Pendentes" value={memberDeliverables.filter(d => d.status === 'pendente').length} sub="em aberto" color="#fbbf24" />
            <KpiCard label="Conexões" value={connections.length} color="#0ea5e9" />
          </div>
          {member.mentor && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: '0.6rem', color: '#334155', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Mentor</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 900, color: '#fbbf24' }}>
                  {(member.mentor.full_name || '?').charAt(0)}
                </div>
                <p style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f0f6fc' }}>{member.mentor.full_name}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Conexões ── */}
      {activeTab === 'conexoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle action={
            <button onClick={() => setShowConn(true)} style={{ ...btnStyle(true), padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
              <Plus size={12} /> Nova
            </button>
          }>
            Conexões ({connections.length})
          </SectionTitle>
          {connections.length === 0 ? <EmptyState icon={Link2} label="Nenhuma conexão registrada ainda." /> :
            connections.map(c => <ConnectionCard key={c.id} conn={c} onDelete={() => handleRemoveConn(c.id)} />)
          }

          {showConn && (
            <div style={{ padding: 16, borderRadius: 14, background: 'rgba(22,27,34,0.98)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fbbf24', marginBottom: 14 }}>Nova Conexão</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><label style={labelStyle}>Nome *</label><input style={inputStyle} value={connForm.name} onChange={e => setConnForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome da conexão" /></div>
                <div><label style={labelStyle}>Empresa</label><input style={inputStyle} value={connForm.company} onChange={e => setConnForm(p => ({ ...p, company: e.target.value }))} placeholder="Nome da empresa" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={labelStyle}>Tipo</label>
                    <select style={inputStyle} value={connForm.type} onChange={e => setConnForm(p => ({ ...p, type: e.target.value as ClubConnection['type'] }))}>
                      <option value="networking">Networking</option>
                      <option value="parceiro">Parceiro</option>
                      <option value="indicacao">Indicação</option>
                      <option value="cliente">Cliente</option>
                    </select>
                  </div>
                  <div><label style={labelStyle}>Data</label><input type="date" style={inputStyle} value={connForm.date} onChange={e => setConnForm(p => ({ ...p, date: e.target.value }))} /></div>
                </div>
                <div><label style={labelStyle}>Observações</label><input style={inputStyle} value={connForm.notes} onChange={e => setConnForm(p => ({ ...p, notes: e.target.value }))} placeholder="Contexto ou observações" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button style={btnStyle(true)} onClick={handleAddConn} disabled={isPending}>Salvar</button>
                <button style={btnStyle()} onClick={() => setShowConn(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Entregas ── */}
      {activeTab === 'entregas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle action={
            <button onClick={() => setShowDeliv(true)} style={{ ...btnStyle(true), padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
              <Plus size={12} /> Adicionar
            </button>
          }>
            Entregas ({memberDeliverables.length})
          </SectionTitle>
          {memberDeliverables.length === 0 ? <EmptyState icon={Package} label="Nenhuma entrega registrada." /> :
            memberDeliverables.map(d => (
              <DeliverableCard key={d.id} d={d} onToggle={() => handleToggle(d)} onDelete={() => handleDeleteDeliv(d.id)} />
            ))
          }
          {showDeliv && <DelivForm form={delivForm} setForm={setDelivForm} onSave={handleAddDeliv} onCancel={() => setShowDeliv(false)} isPending={isPending} />}
        </div>
      )}

      {/* ── Tarefas ── */}
      {activeTab === 'tarefas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle action={
            <button onClick={() => { setShowDeliv(true); setDelivForm(p => ({ ...p, category: 'mentoria' })) }} style={{ ...btnStyle(true), padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
              <Plus size={12} /> Nova Tarefa
            </button>
          }>
            Acompanhamento e Tarefas
          </SectionTitle>
          {memberDeliverables.filter(d => d.status !== 'concluido').length === 0
            ? <EmptyState icon={CheckSquare} label="Nenhuma tarefa pendente. 🎉" color="#10b981" />
            : memberDeliverables.filter(d => d.status !== 'concluido').map(d => (
              <DeliverableCard key={d.id} d={d} onToggle={() => handleToggle(d)} onDelete={() => handleDeleteDeliv(d.id)} />
            ))
          }
          {showDeliv && <DelivForm form={delivForm} setForm={setDelivForm} onSave={handleAddDeliv} onCancel={() => setShowDeliv(false)} isPending={isPending} />}
        </div>
      )}

      {/* ── Treinamentos ── */}
      {activeTab === 'treinamentos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionTitle action={
            <button onClick={() => { setShowDeliv(true); setDelivForm(p => ({ ...p, category: 'conteudo' })) }} style={{ ...btnStyle(true), padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
              <Plus size={12} /> Novo Treinamento
            </button>
          }>
            Treinamentos e Conteúdo
          </SectionTitle>
          {memberDeliverables.filter(d => d.category === 'conteudo' || d.category === 'evento').length === 0
            ? <EmptyState icon={GraduationCap} label="Nenhum treinamento registrado." />
            : memberDeliverables.filter(d => d.category === 'conteudo' || d.category === 'evento').map(d => (
              <DeliverableCard key={d.id} d={d} onToggle={() => handleToggle(d)} onDelete={() => handleDeleteDeliv(d.id)} />
            ))
          }
          {showDeliv && <DelivForm form={delivForm} setForm={setDelivForm} onSave={handleAddDeliv} onCancel={() => setShowDeliv(false)} isPending={isPending} />}
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 18, background: '#0d1117', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#f0f6fc' }}>Editar Membro</h3>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Status</label>
                  <select style={inputStyle} value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value as ClubMember['status'] }))}>
                    <option value="ativo">Ativo</option>
                    <option value="em_renovacao">Em Renovação</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div><label style={labelStyle}>Tier</label>
                  <select style={inputStyle} value={editForm.tier} onChange={e => setEditForm(p => ({ ...p, tier: e.target.value as ClubMember['tier'] }))}>
                    <option value="standard">Standard</option>
                    <option value="plus">Plus</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Início</label><input type="date" style={inputStyle} value={editForm.contract_start} onChange={e => setEditForm(p => ({ ...p, contract_start: e.target.value }))} /></div>
                <div><label style={labelStyle}>Vencimento</label><input type="date" style={inputStyle} value={editForm.contract_end} onChange={e => setEditForm(p => ({ ...p, contract_end: e.target.value }))} /></div>
              </div>
              <div><label style={labelStyle}>Mentor</label>
                <select style={inputStyle} value={editForm.mentor_id} onChange={e => setEditForm(p => ({ ...p, mentor_id: e.target.value }))}>
                  <option value="">Nenhum</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button style={btnStyle(true)} onClick={handleSaveEdit} disabled={isPending}>Salvar</button>
              <button style={btnStyle()} onClick={() => setShowEdit(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DelivForm (reusable) ─────────────────────────────────────────────────────

function DelivForm({ form, setForm, onSave, onCancel, isPending }: {
  form: { title: string; description: string; category: ClubDeliverable['category']; due_date: string }
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; category: ClubDeliverable['category']; due_date: string }>>
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: '0.82rem', background: 'rgba(13,17,23,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f6fc', outline: 'none' }
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.62rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }

  return (
    <div style={{ padding: 16, borderRadius: 14, background: 'rgba(22,27,34,0.98)', border: '1px solid rgba(251,191,36,0.2)', marginTop: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div><label style={labelStyle}>Título *</label><input style={inputStyle} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Descrição da entrega" /></div>
        <div><label style={labelStyle}>Detalhe</label><input style={inputStyle} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Observações adicionais" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={labelStyle}>Categoria</label>
            <select style={inputStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as ClubDeliverable['category'] }))}>
              <option value="mentoria">Mentoria</option>
              <option value="conteudo">Conteúdo</option>
              <option value="material">Material</option>
              <option value="evento">Evento</option>
            </select>
          </div>
          <div><label style={labelStyle}>Prazo</label><input type="date" style={inputStyle} value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button style={{ padding: '9px 18px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg, #92620a, #fbbf24)', color: '#000' }} onClick={onSave} disabled={isPending}>Salvar</button>
        <button style={{ padding: '9px 18px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(22,27,34,0.9)', color: '#8b949e' }} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// ─── Members List View ────────────────────────────────────────────────────────

function MembersListView({ members, onSelect }: { members: ClubMember[]; onSelect: (m: ClubMember) => void }) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterTier, setFilterTier] = useState<string>('todos')

  const activeCount    = members.filter(m => m.status === 'ativo').length
  const renewalCount   = members.filter(m => { const d = daysUntil(m.contract_end); return d !== null && d <= 30 && d >= 0 }).length
  const inactiveCount  = members.filter(m => m.status === 'inativo').length
  const vipCount       = members.filter(m => m.tier === 'vip').length

  const filtered = useMemo(() => {
    return members.filter(m => {
      const name = (m.client?.name || '').toLowerCase()
      const company = (m.client?.company_name || '').toLowerCase()
      const q = search.toLowerCase()
      const matchSearch = !q || name.includes(q) || company.includes(q)
      const matchStatus = filterStatus === 'todos' || m.status === filterStatus
      const matchTier = filterTier === 'todos' || m.tier === filterTier
      return matchSearch && matchStatus && matchTier
    })
  }, [members, search, filterStatus, filterTier])

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
        <KpiCard label="Ativos" value={activeCount} color="#10b981" />
        <KpiCard label="Renovação" value={renewalCount} color="#f59e0b" alert={renewalCount > 0} />
        <KpiCard label="Inativos" value={inactiveCount} color="#ef4444" />
        <KpiCard label="VIP" value={vipCount} color="#f59e0b" />
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar membro..."
            style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, background: 'rgba(22,27,34,0.9)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0f6fc', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['todos', 'ativo', 'em_renovacao', 'inativo'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
              background: filterStatus === s ? 'rgba(251,191,36,0.15)' : 'rgba(22,27,34,0.8)',
              border: `1px solid ${filterStatus === s ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
              color: filterStatus === s ? '#fbbf24' : '#475569',
            }}>
              {s === 'todos' ? 'Todos' : s === 'em_renovacao' ? 'Renovação' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {['todos', 'standard', 'plus', 'vip'].map(t => (
            <button key={t} onClick={() => setFilterTier(t)} style={{
              padding: '5px 12px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer',
              background: filterTier === t ? `${TIER_CONFIG[t]?.color || '#64748b'}18` : 'rgba(22,27,34,0.8)',
              border: `1px solid ${filterTier === t ? `${TIER_CONFIG[t]?.color || '#64748b'}35` : 'rgba(255,255,255,0.06)'}`,
              color: filterTier === t ? (TIER_CONFIG[t]?.color || '#64748b') : '#475569',
            }}>
              {t === 'todos' ? 'Tier' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Member List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <EmptyState icon={Users} label="Nenhum membro encontrado." />
        ) : filtered.map(m => {
          const tier = TIER_CONFIG[m.tier] || TIER_CONFIG.standard
          const status = STATUS_CONFIG[m.status] || STATUS_CONFIG.ativo
          const daysLeft = daysUntil(m.contract_end)
          return (
            <button key={m.id} onClick={() => onSelect(m)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(22,27,34,0.97), rgba(16,20,28,0.92))',
              border: `1px solid ${tier.color}20`,
              borderRadius: 14, cursor: 'pointer', textAlign: 'left',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              transition: 'border-color 0.2s',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${tier.color}25, ${tier.color}10)`,
                border: `2px solid ${tier.color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', fontWeight: 900, color: tier.color,
                boxShadow: `0 0 16px ${tier.color}20`,
              }}>
                {initials(m.client?.name || 'C')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f0f6fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.client?.name || '—'}</p>
                {m.client?.company_name && <p style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.client.company_name}</p>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: tier.color, background: tier.color + '15', padding: '2px 8px', borderRadius: 999 }}>{tier.label}</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 800, color: status.color, background: status.bg, padding: '2px 8px', borderRadius: 999 }}>{status.label}</span>
                  {daysLeft !== null && daysLeft <= 30 && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <AlertTriangle size={9} /> {daysLeft}d
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={14} color="#334155" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ClubeClient({
  initialMembers, initialDeliverables, initialEvents, profiles,
}: {
  initialMembers: ClubMember[]
  initialDeliverables: ClubDeliverable[]
  initialEvents: EventRow[]
  profiles: Profile[]
}) {
  const [members, setMembers] = useState(initialMembers)
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null)

  function handleMemberUpdate(updated: ClubMember) {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    setSelectedMember(updated)
  }

  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: 960, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <InsiderLogo size={20} color="#0ea5e9" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f0f6fc', letterSpacing: '-0.03em' }}>
              {selectedMember ? 'Perfil do Membro' : 'Insider Club'}
            </h1>
            <p style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 600 }}>
              {selectedMember ? selectedMember.client?.name : `${members.filter(m => m.status === 'ativo').length} membros ativos`}
            </p>
          </div>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(14,165,233,0.3), transparent)' }} />
      </div>

      {selectedMember ? (
        <MemberDetail
          member={selectedMember}
          deliverables={initialDeliverables}
          events={initialEvents}
          profiles={profiles}
          onBack={() => setSelectedMember(null)}
          onMemberUpdate={handleMemberUpdate}
        />
      ) : (
        <MembersListView members={members} onSelect={setSelectedMember} />
      )}
    </div>
  )
}
