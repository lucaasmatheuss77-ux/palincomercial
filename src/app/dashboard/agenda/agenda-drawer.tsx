'use client'

import Link from 'next/link'
import { CalendarDays, Clock3, ExternalLink, MapPin, User, X, ChevronRight } from 'lucide-react'
import type { AgendaMeeting } from './agenda-types'

type MeetingDrawerProps = {
  meeting: AgendaMeeting | null
  onClose: () => void
  onStatusChange: (meetingId: string, status: string) => void
  isPending: boolean
}

const meetingStatusOptions = [
  { value: 'agendada', label: 'Agendada', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { value: 'confirmada', label: 'Confirmada', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  { value: 'em deslocamento', label: 'Em Deslocamento', color: '#86efac', bg: 'rgba(34,197,94,0.1)' },
  { value: 'concluida', label: 'Concluída', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
]

function formatFullDate(dateString: string | null | undefined) {
  if (!dateString) return 'Data não informada'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function formatTime(dateString: string | null | undefined) {
  if (!dateString) return '--:--'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatShortDateTime(dateString?: string | null) {
  if (!dateString) return 'Não definido'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

export default function MeetingDrawer({ meeting, onClose, onStatusChange, isPending }: MeetingDrawerProps) {
  const isOpen = Boolean(meeting)

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 499,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Drawer Panel */}
      <div
        aria-label="Detalhes da reunião"
        aria-hidden={!isOpen}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '480px',
          maxWidth: '95vw',
          height: '100dvh',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(2,6,23,0.99))',
          borderLeft: '1px solid rgba(148,163,184,0.1)',
          boxShadow: '-24px 0 80px rgba(0,0,0,0.5)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflowY: 'auto',
        }}
      >
        {meeting && (
          <>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(148,163,184,0.08)',
              background: 'rgba(255,255,255,0.015)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backdropFilter: 'blur(12px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    {(() => {
                      const statusOpt = meetingStatusOptions.find(s => s.value === meeting.status)
                      return (
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '999px',
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: statusOpt?.color ?? '#94a3b8',
                          background: statusOpt?.bg ?? 'rgba(148,163,184,0.1)',
                          border: `1px solid ${statusOpt?.color ?? '#94a3b8'}22`,
                        }}>
                          {meeting.status}
                        </span>
                      )
                    })()}
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                      {meeting.meeting_type || 'Presencial'}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.3 }}>
                    {meeting.title}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Fechar painel"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    color: '#64748b',
                    display: 'flex',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#f1f5f9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#64748b' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Date / Time / Location */}
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <CalendarDays size={15} color="#60a5fa" />
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                    {formatFullDate(meeting.scheduled_for)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <Clock3 size={15} color="#60a5fa" />
                  <span style={{ color: '#94a3b8' }}>
                    {formatTime(meeting.scheduled_for)}
                    {meeting.ends_at ? ` até ${formatTime(meeting.ends_at)}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <MapPin size={15} color="#60a5fa" />
                  <span style={{ color: '#94a3b8' }}>{meeting.location || 'Local não informado'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <User size={15} color="#60a5fa" />
                  <span style={{ color: '#94a3b8' }}>{meeting.owner_name || 'Sem responsável'}</span>
                </div>
              </div>

              {/* Status Actions */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                  Atualizar Status
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {meetingStatusOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isPending || meeting.status === opt.value}
                      onClick={() => onStatusChange(meeting.id, opt.value)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: meeting.status === opt.value ? 'default' : 'pointer',
                        border: `1px solid ${meeting.status === opt.value ? opt.color + '40' : 'rgba(255,255,255,0.08)'}`,
                        background: meeting.status === opt.value ? opt.bg : 'rgba(255,255,255,0.03)',
                        color: meeting.status === opt.value ? opt.color : '#64748b',
                        transition: 'all 0.15s',
                        opacity: isPending ? 0.5 : 1,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pauta */}
              <div>
                <div style={{ fontSize: '0.68rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  Pauta da Reunião
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.1)', borderRadius: '10px', padding: '12px' }}>
                  {meeting.objective || 'Pauta não informada.'}
                </p>
              </div>

              {/* Notas / O que foi falado */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--brand-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  O Que Foi Falado
                </div>
                <p style={{ color: '#a8b2bd', fontSize: '0.88rem', lineHeight: 1.6, background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.1)', borderRadius: '10px', padding: '12px' }}>
                  {meeting.notes || 'Sem registro da conversa ainda.'}
                </p>
              </div>

              {/* Próximo passo */}
              {(meeting.next_step || meeting.next_contact_at) && (
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#93c5fd', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    Próximo Passo
                  </div>
                  <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {meeting.next_step && <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.5 }}>{meeting.next_step}</p>}
                    {meeting.next_contact_at && (
                      <span style={{ color: '#60a5fa', fontSize: '0.78rem', fontWeight: 700 }}>
                        📅 Próximo contato: {formatShortDateTime(meeting.next_contact_at)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* CRM Link */}
              {meeting.lead_id && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                    Vinculado no CRM
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{meeting.lead_name || 'Lead'}</span>
                      {meeting.company_name && <span style={{ color: '#475569' }}> · {meeting.company_name}</span>}
                    </div>
                    <Link
                      href={`/dashboard/pipeline?lead=${encodeURIComponent(meeting.lead_id)}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'rgba(96,165,250,0.08)',
                        border: '1px solid rgba(96,165,250,0.2)',
                        color: '#60a5fa',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                        width: 'fit-content',
                      }}
                    >
                      Abrir no Pipeline CRM
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              )}

              {/* Client Link */}
              {meeting.client_id && (
                <Link
                  href="/dashboard/clientes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: 'rgba(34,197,94,0.06)',
                    border: '1px solid rgba(34,197,94,0.15)',
                    color: '#86efac',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    width: 'fit-content',
                  }}
                >
                  Ver Cliente
                  <ExternalLink size={12} />
                </Link>
              )}

              {/* Logistics indicator */}
              {meeting.requires_logistics && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.15)',
                  color: 'var(--brand-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}>
                  🚗 Apoio logístico solicitado para esta reunião
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </>
  )
}
