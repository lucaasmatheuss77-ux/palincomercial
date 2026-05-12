'use client'

import { useState, useTransition, useMemo } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { CalendarDays, Users, AlertTriangle, ChevronRight, Check, Clock, Star, Gem, MapPin } from 'lucide-react'
import InsiderLogo from '@/components/insider-logo'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { updateClubMember, upsertDeliverable, toggleDeliverableDone } from '@/app/actions/clube'
import type { ClubMember, ClubDeliverable } from '@/app/actions/clube'

type Profile = { id: string; full_name: string; avatar_url: string | null; role: string }
type EventRow = { id: string; name: string; date: string; location?: string | null; status?: string | null; type?: string | null; ends_at?: string | null }
type MemberStatus = ClubMember['status']
type MemberTier = ClubMember['tier']
type DeliverableCategory = ClubDeliverable['category']

type TierIcon = ComponentType<{ size?: number; className?: string; color?: string; style?: CSSProperties }>

const TIER_CONFIG: Record<string, { label: string; color: string; icon: TierIcon }> = {
  standard: { label: 'Standard', color: '#94a3b8', icon: InsiderLogo },
  plus: { label: 'Plus', color: '#60a5fa', icon: Star },
  vip: { label: 'VIP', color: '#f59e0b', icon: Gem },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  ativo: { label: 'Ativo', bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  em_renovacao: { label: 'Em renovação', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  inativo: { label: 'Inativo', bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
}

const CAT_COLORS: Record<string, string> = { mentoria: '#0ea5e9', conteudo: '#3b82f6', material: '#10b981', evento: '#f59e0b' }

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtEvt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function ClubeClient({
  initialMembers, initialDeliverables, initialEvents, profiles
}: {
  initialMembers: ClubMember[]
  initialDeliverables: ClubDeliverable[]
  initialEvents: EventRow[]
  profiles: Profile[]
}) {
  const [members, setMembers] = useState(initialMembers)
  const [deliverables, setDeliverables] = useState(initialDeliverables)
  const [events] = useState(initialEvents)
  const [isPending, startTransition] = useTransition()

  // Modals
  const [editMember, setEditMember] = useState<ClubMember | null>(null)
  const [editForm, setEditForm] = useState({ status: 'ativo' as MemberStatus, tier: 'standard' as MemberTier, mentor_id: '', notes: '', contract_start: '', contract_end: '' })
  const [showDeliverable, setShowDeliverable] = useState(false)
  const [delivForm, setDelivForm] = useState({ title: '', description: '', category: 'mentoria' as DeliverableCategory, due_date: '', event_id: '' })

  // KPIs
  const activeCount = members.filter(m => m.status === 'ativo').length
  const renewalCount = members.filter(m => { const d = daysUntil(m.contract_end); return d !== null && d <= 30 && d >= 0 }).length
  const inactiveCount = members.filter(m => m.status === 'inativo').length

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6)
  }, [events])

  const pastEvents = useMemo(() => {
    const now = new Date()
    return events.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 4)
  }, [events])

  function openEditMember(m: ClubMember) {
    setEditForm({
      status: m.status, tier: m.tier, mentor_id: m.mentor_id || '',
      notes: m.notes || '', contract_start: m.contract_start || '', contract_end: m.contract_end || ''
    })
    setEditMember(m)
  }

  function handleSaveMember() {
    if (!editMember) return
    startTransition(async () => {
      const res = await updateClubMember(editMember.id, {
        status: editForm.status, tier: editForm.tier,
        mentor_id: editForm.mentor_id || null, notes: editForm.notes || null,
        contract_start: editForm.contract_start || null, contract_end: editForm.contract_end || null,
      })
      if (res.success) {
        setMembers(prev => prev.map(m => m.id === editMember.id ? { ...m, ...editForm } : m))
        toast.success('Membro atualizado')
        setEditMember(null)
      } else toast.error(res.error)
    })
  }

  function handleSaveDeliverable() {
    startTransition(async () => {
      const res = await upsertDeliverable({
        title: delivForm.title, description: delivForm.description || null,
        category: delivForm.category, due_date: delivForm.due_date || null,
        is_global: true, event_id: delivForm.event_id || null,
      })
      if (res.success) {
        toast.success('Entrega criada')
        setShowDeliverable(false)
        setDelivForm({ title: '', description: '', category: 'mentoria', due_date: '', event_id: '' })
        window.location.reload()
      } else toast.error(res.error)
    })
  }

  function handleToggleDeliv(id: string, status: string) {
    startTransition(async () => {
      const res = await toggleDeliverableDone(id, status)
      if (res.success) {
        setDeliverables(prev => prev.map(d => d.id === id ? { ...d, status: status === 'concluido' ? 'pendente' : 'concluido' } : d))
      }
    })
  }

  // ─── Card style helpers ──────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px', padding: '20px',
  }
  const inputClass = 'input-field'

  return (
    <>
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InsiderLogo size={32} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Insider Club</h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Controle de membros da mentoria</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-ghost" onClick={() => { setDelivForm({ title: '', description: '', category: 'mentoria', due_date: '', event_id: '' }); setShowDeliverable(true) }}>
              + Entrega
            </button>
          </div>
        </div>

        {/* RENEWAL ALERT */}
        {renewalCount > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 700 }}>
              {renewalCount} contrato{renewalCount > 1 ? 's' : ''} vence{renewalCount > 1 ? 'm' : ''} nos próximos 30 dias
            </span>
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Total Membros', value: members.length, color: '#0ea5e9', icon: Users },
            { label: 'Ativos', value: activeCount, color: '#10b981', icon: Users },
            { label: 'Renovação', value: renewalCount, color: '#f59e0b', icon: Clock },
            { label: 'Inativos', value: inactiveCount, color: '#ef4444', icon: AlertTriangle },
          ].map(k => (
            <div key={k.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <k.icon size={20} color={k.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f8fafc' }}>{k.value}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* MEMBERS TABLE */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <InsiderLogo size={18} /> Membros do Clube
          </div>
          {members.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '30px' }}>
              Nenhum membro ainda. Cadastre um cliente com o produto <strong>Insider Club</strong> para adicioná-lo automaticamente.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map(m => {
                const tierCfg = TIER_CONFIG[m.tier] || TIER_CONFIG.standard
                const statusCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.ativo
                const daysLeft = daysUntil(m.contract_end)
                const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0
                const clientName = m.client?.name || 'Sem nome'
                const TierIcon = tierCfg.icon

                return (
                  <button key={m.id} onClick={() => openEditMember(m)} style={{
                    ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
                    cursor: 'pointer', transition: 'all 0.15s', width: '100%', textAlign: 'left',
                    border: isUrgent ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {/* Avatar */}
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `${tierCfg.color}20`, border: `2px solid ${tierCfg.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 900, color: tierCfg.color }}>
                      {initials(clientName)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#f8fafc' }}>{clientName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                        {m.client?.company_name && <span>{m.client.company_name}</span>}
                        <span>Início: {fmt(m.contract_start)}</span>
                        <span style={{ color: isUrgent ? '#f59e0b' : undefined }}>Fim: {fmt(m.contract_end)}{daysLeft !== null && daysLeft <= 30 ? ` (${daysLeft}d)` : ''}</span>
                      </div>
                    </div>
                    {/* Tier badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px', background: `${tierCfg.color}15`, fontSize: '0.7rem', fontWeight: 800, color: tierCfg.color, flexShrink: 0 }}>
                      <TierIcon size={12} /> {tierCfg.label}
                    </div>
                    {/* Status badge */}
                    <div style={{ padding: '4px 10px', borderRadius: '8px', background: statusCfg.bg, fontSize: '0.7rem', fontWeight: 800, color: statusCfg.color, flexShrink: 0 }}>
                      {statusCfg.label}
                    </div>
                    <ChevronRight size={16} color="#475569" />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* EVENTS SECTION */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} color="#f59e0b" /> Eventos do Clube
          </div>
          {events.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhum evento vinculado ao clube.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {upcomingEvents.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Próximos</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {upcomingEvents.map(e => {
                      const dLeft = daysUntil(e.date)
                      return (
                        <div key={e.id} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f8fafc' }}>{e.name}</div>
                          <div style={{ display: 'flex', gap: '10px', fontSize: '0.72rem', color: '#94a3b8', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CalendarDays size={12} /> {fmtEvt(e.date)}</span>
                            {e.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {e.location}</span>}
                          </div>
                          {dLeft !== null && (
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: dLeft <= 7 ? '#f59e0b' : '#10b981' }}>
                              {dLeft === 0 ? 'HOJE' : `em ${dLeft} dia${dLeft !== 1 ? 's' : ''}`}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {pastEvents.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Realizados</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {pastEvents.map(e => (
                      <div key={e.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', opacity: 0.7 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#94a3b8' }}>{e.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px' }}>{fmtEvt(e.date)}{e.location ? ` — ${e.location}` : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* DELIVERABLES */}
        <div style={cardStyle}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#10b981" /> Entregas & Conteúdos</span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{deliverables.filter(d => d.status === 'concluido').length}/{deliverables.length} concluídas</span>
          </div>
          {deliverables.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhuma entrega cadastrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {deliverables.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: d.status === 'concluido' ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={() => handleToggleDeliv(d.id, d.status)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: d.status === 'concluido' ? '2px solid #10b981' : '2px solid #475569', background: d.status === 'concluido' ? '#10b981' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {d.status === 'concluido' && <Check size={14} color="#fff" />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: d.status === 'concluido' ? '#64748b' : '#e2e8f0', textDecoration: d.status === 'concluido' ? 'line-through' : 'none' }}>{d.title}</div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                      <span style={{ color: CAT_COLORS[d.category] || '#94a3b8', fontWeight: 700 }}>{d.category}</span>
                      {d.due_date && <span>{fmt(d.due_date)}</span>}
                      {d.event?.name && <span>🎪 {d.event.name}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── EDIT MEMBER MODAL ───────────────────────────────────── */}
      <ActionDialog
        open={!!editMember}
        title={`Editar — ${editMember?.client?.name || 'Membro'}`}
        subtitle="Atualize status, nível e dados do contrato."
        onClose={() => setEditMember(null)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setEditMember(null)}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSaveMember} disabled={isPending}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Status</label>
                    <select className={inputClass} value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as MemberStatus }))}>
                <option value="ativo">Ativo</option>
                <option value="em_renovacao">Em renovação</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Nível</label>
                    <select className={inputClass} value={editForm.tier} onChange={e => setEditForm(f => ({ ...f, tier: e.target.value as MemberTier }))}>
                <option value="standard">Standard</option>
                <option value="plus">Plus</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Início contrato</label>
              <input type="date" className={inputClass} value={editForm.contract_start} onChange={e => setEditForm(f => ({ ...f, contract_start: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Fim contrato</label>
              <input type="date" className={inputClass} value={editForm.contract_end} onChange={e => setEditForm(f => ({ ...f, contract_end: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Mentor</label>
            <select className={inputClass} value={editForm.mentor_id} onChange={e => setEditForm(f => ({ ...f, mentor_id: e.target.value }))}>
              <option value="">Sem mentor</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Observações</label>
            <textarea className={inputClass} rows={3} value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anotações sobre o membro..." />
          </div>
        </div>
      </ActionDialog>

      {/* ── NEW DELIVERABLE MODAL ───────────────────────────────── */}
      <ActionDialog
        open={showDeliverable}
        title="Nova entrega"
        subtitle="Adicione conteúdo ou material ao calendário do clube."
        onClose={() => setShowDeliverable(false)}
        footer={<>
          <button type="button" className="btn-ghost" onClick={() => setShowDeliverable(false)}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSaveDeliverable} disabled={isPending || !delivForm.title.trim()}>Salvar</button>
        </>}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <input className={inputClass} placeholder="Título da entrega *" value={delivForm.title} onChange={e => setDelivForm(f => ({ ...f, title: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select className={inputClass} value={delivForm.category} onChange={e => setDelivForm(f => ({ ...f, category: e.target.value as DeliverableCategory }))}>
              <option value="mentoria">Mentoria</option>
              <option value="conteudo">Conteúdo</option>
              <option value="material">Material</option>
              <option value="evento">Evento</option>
            </select>
            <input type="date" className={inputClass} value={delivForm.due_date} onChange={e => setDelivForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>
          {delivForm.category === 'evento' && events.length > 0 && (
            <select className={inputClass} value={delivForm.event_id} onChange={e => setDelivForm(f => ({ ...f, event_id: e.target.value }))}>
              <option value="">Vincular a um evento</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {fmtEvt(ev.date)}</option>)}
            </select>
          )}
          <textarea className={inputClass} rows={2} placeholder="Descrição (opcional)" value={delivForm.description} onChange={e => setDelivForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </ActionDialog>
    </>
  )
}
