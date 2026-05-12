'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock3, MapPin, Users, Copy, CheckCircle2, ArrowLeft, Building2, Phone, Mail, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { concludeEvent, updateEvent, assignEventStaff, removeEventStaff } from '@/app/actions/eventos'
import { useTransition } from 'react'
import EventChecklist from '../event-checklist'
import type { ChecklistItem } from '@/lib/types'

type Participant = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  converted_to_lead: boolean
  created_at: string
  leads?: { stage: string }
}

interface EventData {
  id: string
  name: string
  type?: string
  status: string
  capacity: number
  date: string
  ends_at?: string
  location: string
  current_stage?: string
  products?: { name: string } | null
  organizer_name?: string | null
  organizer_contact?: string | null
  participation_type?: string | null
  investment?: number | null
  expected_leads?: number | null
  objectives?: string | null
  notes_logistics?: string | null
}

interface ProfileData {
  id: string
  full_name: string | null
  role: string | null
}

interface StaffMeeting {
  id: string
  owner_name: string | null
  status: string | null
}

export default function EventDashboardClient({ 
  event, 
  initialParticipants, 
  initialStaff, 
  initialChecklist,
  profiles 
}: { 
  event: EventData, 
  initialParticipants: Participant[], 
  initialStaff: StaffMeeting[], 
  initialChecklist: ChecklistItem[],
  profiles: ProfileData[] 
}) {
  const [participants] = useState<Participant[]>(initialParticipants)
  const [staff, setStaff] = useState<StaffMeeting[]>(initialStaff)
  const [currentStage, setCurrentStage] = useState(event.current_stage || 'Planejamento')
  const [isPending, startTransition] = useTransition()
  
  const [showingAssign, setShowingAssign] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState('')

  const occupancy = event.capacity > 0 ? Math.min(Math.round((participants.length / event.capacity) * 100), 100) : 0

  async function handleConclude() {
    if (!confirm('Deseja realmente marcar o evento como realizado? Isso ira arquiva-lo para novas inscricoes no Link Publico (ficara fechado).')) return
    startTransition(async () => {
      const res = await concludeEvent(event.id)
      if (res.success) {
        toast.success('Evento concluido com sucesso!')
        setCurrentStage('Pós-Evento')
      } else toast.error(res.error)
    })
  }

  async function handleStageChange(stage: string) {
    setCurrentStage(stage)
    startTransition(async () => {
      const res = await updateEvent(event.id, { current_stage: stage })
      if (!res.success) {
        toast.error('Erro ao salvar etapa.')
      }
    })
  }

  async function handleAssign() {
    if (!selectedProfile) return
    startTransition(async () => {
      const res = await assignEventStaff(event.id, selectedProfile, event.name, event.date, event.ends_at)
      if (res.success) {
        toast.success('Consultor alocado e agenda travada!')
        setShowingAssign(false)
        setSelectedProfile('')
      } else {
        toast.error(res.error)
      }
    })
  }

  async function handleRemoveStaff(meetingId: string) {
    if (!confirm('Remover consultor da operacao? Isso libera a agenda dele.')) return
    startTransition(async () => {
      const res = await removeEventStaff(meetingId)
      if (res.success) {
        toast.success('Consultor liberado.')
        setStaff(s => s.filter(m => m.id !== meetingId))
      } else {
        toast.error(res.error)
      }
    })
  }

  async function handleCopyLink() {
    try {
      const origin = window.location.origin
      await navigator.clipboard.writeText(`${origin}/evento/${event.id}`)
      toast.success('Link do formulario de inscricao copiado!')
    } catch {
      toast.error('Erro ao copiar link.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <Link href="/dashboard/eventos" className="btn-ghost" style={{ padding: '8px', borderRadius: '50%' }}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {event.name}
            <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
              {event.status.toUpperCase()}
            </span>
          </h1>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Gestao completa do evento e lista de inscritos.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {event.status !== 'realizado' && (
            <button className="btn-primary" onClick={handleConclude} disabled={isPending} style={{ background: '#10b981', color: '#000', border: 'none' }}>
              <CheckCircle2 size={16} /> Concluir Evento
            </button>
          )}
        </div>
      </div>

      {/* Stepper Andamento */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--brand-text)', marginBottom: '16px' }}>Andamento (Etapas)</h3>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {/* Linha de fundo */}
          <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0, transform: 'translateY(-50%)' }} />
          
          {['Planejamento', 'Captação', 'Confirmação', 'Execução', 'Pós-Evento'].map((step, index, arr) => {
            const stepIndex = arr.indexOf(step)
            const currentIndex = arr.indexOf(currentStage)
            const isActive = step === currentStage
            const isCompleted = stepIndex < currentIndex

            return (
              <div key={step} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleStageChange(step)}
                  disabled={isPending}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    border: isActive ? '2px solid #58a6ff' : isCompleted ? '2px solid #10b981' : '2px solid #30363d',
                    background: isActive ? 'rgba(88,166,255,0.1)' : isCompleted ? '#10b981' : '#0d1117',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {isCompleted ? <CheckCircle2 size={16} color="#fff" /> : <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActive ? '#58a6ff' : '#30363d' }} />}
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--brand-text)' : isCompleted ? 'var(--brand-muted)' : '#484f58' }}>
                  {step}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Card Info */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-text)' }}>Detalhes do Evento</h3>
            <button className="btn-accent" onClick={handleCopyLink} title="Copiar Link de Inscricao" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}>
              <Copy size={14} /> Link Publico
            </button>
          </div>
          
          <div style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c9d1d9', fontSize: '0.9rem' }}>
              <Clock3 size={16} color="var(--brand-muted)" />
              {new Date(event.date).toLocaleString('pt-BR')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c9d1d9', fontSize: '0.9rem' }}>
              <MapPin size={16} color="var(--brand-muted)" />
              {event.location}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c9d1d9', fontSize: '0.9rem' }}>
              <Building2 size={16} color="var(--brand-muted)" />
              Produto: <strong style={{ color: 'var(--brand-text)' }}>{event.products?.name || 'Geral'}</strong>
            </div>
            
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--brand-muted)', marginBottom: '8px' }}>
                <span>Ocupacao ({participants.length} / {event.capacity})</span>
                <span style={{ color: occupancy >= 100 ? '#ef4444' : 'var(--brand-primary)', fontWeight: 700 }}>{occupancy}%</span>
              </div>
              <div className="progress-bar" style={{ height: '8px' }}>
                <div className="progress-fill" style={{ width: `${occupancy}%`, background: occupancy >= 100 ? '#ef4444' : 'var(--brand-primary)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Staff Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-text)' }}>Staff & Operação</h3>
            <button className="btn-ghost" onClick={() => setShowingAssign(true)} style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px' }}>
              <UserPlus size={14} /> Alocar
            </button>
          </div>
          
          <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
            {staff.length === 0 ? (
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.85rem' }}>Nenhum consultor alocado na operação deste evento ainda.</p>
            ) : (
              staff.map(member => (
                <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#c9d1d9', fontWeight: 600 }}>{member.owner_name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--brand-muted)' }}>Agenda bloqueada ({member.status})</span>
                  </div>
                  <button className="btn-ghost" style={{ padding: '4px', color: '#ef4444' }} onClick={() => handleRemoveStaff(member.id)} title="Remover alocação" disabled={isPending}>
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Card Stats */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--brand-text)' }}>ROI e Conversao</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Leads Gerados</p>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-text)', margin: '4px 0' }}>{participants.filter(p => p.converted_to_lead).length}</p>
              <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Sincronizados com CRM
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ color: 'var(--brand-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Em Negociacao</p>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-primary)', margin: '4px 0' }}>
                {participants.filter(p => p.leads?.stage && ['Proposta', 'Apresentacao', 'Negociacao'].includes(p.leads.stage)).length}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--brand-muted)' }}>
                Ativos no Pipeline
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── CHECKLIST ──────────────────────────────────────────────── */}
      <EventChecklist
        eventId={event.id}
        initialItems={initialChecklist}
        profiles={profiles.map(p => ({ id: p.id, full_name: p.full_name }))}
      />

      {/* Participants List */}
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-text)', marginBottom: '16px' }}>Lista de Inscritos</h2>
        
        {participants.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <Users size={32} color="#30363d" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.9rem' }}>Ninguém se inscreveu neste evento ainda.</p>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Compartilhe o Link Público para receber inscrições.</p>
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Nome</th>
                    <th style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Contato</th>
                    <th style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Empresa</th>
                    <th style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>CRM Lead Status</th>
                    <th style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px', color: 'var(--brand-text)', fontSize: '0.9rem', fontWeight: 600 }}>{p.name}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#c9d1d9', fontSize: '0.85rem' }}><Phone size={12} color="var(--brand-muted)" /> {p.phone || '-'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--brand-muted)', fontSize: '0.8rem' }}><Mail size={12} color="var(--brand-muted)" /> {p.email || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: '#c9d1d9', fontSize: '0.85rem' }}>{p.company || '-'}</td>
                      <td style={{ padding: '16px' }}>
                        {p.converted_to_lead ? (
                          <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>{p.leads?.stage || 'Lead'}</span>
                        ) : (
                          <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>Aguardando</span>
                        )}
                      </td>
                      <td style={{ padding: '16px', color: 'var(--brand-muted)', fontSize: '0.85rem' }}>
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ActionDialog
        open={showingAssign}
        title="Alocar Consultor"
        subtitle="Selecione o consultor. A agenda dele sera bloqueada nas datas deste evento."
        onClose={() => { setShowingAssign(false); setSelectedProfile('') }}
        footer={
          <>
            <button className="btn-ghost" onClick={() => { setShowingAssign(false); setSelectedProfile('') }}>Cancelar</button>
            <button className="btn-primary" onClick={handleAssign} disabled={isPending || !selectedProfile}>
              {isPending ? 'Alocando...' : 'Confirmar Alocacao'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '4px' }}>Clique no consultor para selecionar:</p>
          {profiles.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhum perfil encontrado.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
              {profiles.map(p => {
                const isSelected = selectedProfile === p.id
                const initials = (p.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                const roleColor = p.role === 'Administrador' ? '#ef4444'
                  : p.role === 'Gestor' ? 'var(--brand-primary)'
                  : p.role === 'SDR' ? '#3b82f6'
                  : '#38bdf8'

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProfile(isSelected ? '' : p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 14px', borderRadius: '10px', textAlign: 'left',
                      background: isSelected ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1.5px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer', transition: 'all 0.15s', width: '100%',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: `${roleColor}22`, border: `1.5px solid ${roleColor}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8rem', fontWeight: 800, color: roleColor,
                    }}>
                      {initials}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? '#93c5fd' : '#e2e8f0' }}>
                        {p.full_name || 'Sem nome'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: roleColor, fontWeight: 600 }}>
                        {p.role || 'Consultor'}
                      </div>
                    </div>
                    {/* Check */}
                    {isSelected && (
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle2 size={13} color="#fff" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </ActionDialog>
    </div>
  )
}
