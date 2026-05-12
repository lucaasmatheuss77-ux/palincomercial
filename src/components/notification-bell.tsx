'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, X, Phone, UserCheck, MessageSquare, Clock, CheckCircle2, ArrowRightCircle, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

type Notification = {
  id: string
  type: string
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const unreadCount = notifications.filter((n) => !n.read).length

  // Fecha o painel ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const addNotification = useCallback((payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
    const record = payload.new as {
      id: string
      activity_type?: string
      subject?: string
      notes?: string
      created_at?: string
    }

    let title = 'Nova Atividade'
    let message = record.subject || record.notes || 'Uma nova atividade foi registrada.'
    const type = record.activity_type || 'nota'

    if (type === 'client_created' || type === 'lead_entry') {
      title = '👤 Novo Lead'
      message = `O Lead ${record.subject || ''} entrou no CRM.`
    } else if (type === 'ligacao_goto') {
      title = '📞 Ligação GoTo'
      message = record.subject || 'Ligação via GoTo registrada.'
    } else if (type === 'reuniao') {
      title = '📅 Reunião'
      message = record.subject || 'Uma nova reunião foi agendada.'
    } else if (type === 'contrato_ativado') {
      title = '📄 Contrato Ativado'
      message = `O contrato de ${record.subject || 'um cliente'} foi ativado.`
    }

    const newNotification: Notification = {
      id: record.id || String(Date.now()),
      type: type,
      title,
      message: message.slice(0, 120),
      timestamp: record.created_at ? new Date(record.created_at) : new Date(),
      read: false,
    }

    setNotifications((prev) => [newNotification, ...prev].slice(0, 20))
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('commercial_activities_notify')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'commercial_activities' },
        (payload) => addNotification(payload as RealtimePostgresInsertPayload<Record<string, unknown>>)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, addNotification])

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'ligacao_goto': return <Phone size={14} className="text-blue-400" />
      case 'client_created':
      case 'lead_entry': return <UserCheck size={14} className="text-green-400" />
      case 'stage_change': return <ArrowRightCircle size={14} className="text-sky-400" />
      case 'fechamento': return <Trophy size={14} className="text-yellow-400" />
      case 'nota': return <MessageSquare size={14} className="text-amber-400" />
      case 'reuniao': return <Clock size={14} className="text-var(--brand-primary)-400" />
      case 'contrato_ativado': return <CheckCircle2 size={14} className="text-emerald-400" />
      default: return <Bell size={14} />
    }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Botão do Sino */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) markAllRead()
        }}
        className="btn-ghost"
        style={{
          position: 'relative',
          padding: '8px',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          border: open ? '1px solid var(--brand-primary)' : '1px solid rgba(251,191,36,0.1)',
          background: open ? 'rgba(251,191,36,0.1)' : 'transparent',
          color: unreadCount > 0 ? 'var(--brand-primary)' : 'var(--brand-muted)',
        }}
      >
        <Bell size={20} className={unreadCount > 0 ? 'animate-pulse' : ''} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
              border: '2px solid var(--brand-darker)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Painel Dropdown */}
      {open && (
        <div
          className="glass-card animate-fade-in-up"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            right: 0,
            width: '340px',
            maxHeight: '480px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            background: 'var(--brand-surface)',
            border: '1px solid var(--brand-border)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--brand-primary)' }}>Notificações</span>
              <span className="badge-gold" style={{ fontSize: '0.65rem' }}>Realtime</span>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setNotifications([])}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  color: 'var(--brand-muted)',
                  fontWeight: 600,
                }}
                className="hover:text-white transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: 'var(--brand-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ transform: 'rotate(20deg)', opacity: 0.1 }}>
                  <Bell size={48} />
                </div>
                <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>Nenhuma notificação recente</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="telemetry-module"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    background: n.read ? 'transparent' : 'rgba(251,191,36,0.03)',
                    position: 'relative'
                  }}
                >
                  <div className="scanline-effect"></div>
                  
                  <div
                    style={{
                      marginTop: '2px',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      flexShrink: 0
                    }}
                  >
                    {getIcon(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-text)' }}>
                        {n.title}
                      </span>
                      {!n.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand-primary)' }}></div>}
                    </div>
                    
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.72rem',
                        color: 'var(--brand-muted)',
                        lineHeight: 1.5,
                        wordBreak: 'break-all',
                      }}
                    >
                      {n.message}
                    </p>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <Clock size={10} style={{ color: '#484f58' }} />
                      <span style={{ fontSize: '0.65rem', color: '#484f58', fontWeight: 600 }}>
                        {formatDistanceToNow(n.timestamp, { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dismiss(n.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#484f58',
                      flexShrink: 0,
                      padding: '4px',
                    }}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div
            style={{
              padding: '12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <button
              className="btn-accent"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '8px' }}
            >
              Monitorar atividades em tempo real
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
