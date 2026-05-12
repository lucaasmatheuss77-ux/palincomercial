'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Calendar, ChevronLeft, ChevronRight, Clock3, DollarSign,
  MapPin, Users, Share2, Plus, Building2, Target, TrendingUp,
  ClipboardList, PartyPopper,
} from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { createEvent, assignEventStaff } from '@/app/actions/eventos'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventItem = {
  id: string
  name: string
  tipo: 'proprio' | 'externo'
  date: string
  rawDate: string
  local: string
  inscritos: number
  capacidade: number
  status: string
  produto: string
  current_stage?: string | null
  organizer_name?: string | null
  organizer_contact?: string | null
  participation_type?: string | null
  investment?: number
  expected_leads?: number
  objectives?: string | null
  notes_logistics?: string | null
  ends_at?: string | null
  description?: string | null
}

export type ProfileItem = {
  id: string
  full_name: string | null
  role: string | null
}

type TabId = 'todos' | 'terceiros'

const statusLabel: Record<string, string> = {
  confirmado: 'Confirmado',
  participando: 'Em participacao',
  avaliando: 'Em analise',
  planejamento: 'Planejamento',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

const statusBadge: Record<string, string> = {
  confirmado: 'badge-green',
  participando: 'badge-blue',
  avaliando: 'badge-gold',
  planejamento: 'badge-blue',
  realizado: 'badge-green',
  cancelado: 'badge-gold',
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

const WEEK_DAYS_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function addDays(date: Date, n: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function addMonths(date: Date, n: number) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function buildMonthCalendar(month: Date, events: EventItem[]) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const firstWeekDay = firstDay.getDay()
  const gridStart = new Date(year, monthIndex, 1 - firstWeekDay)

  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(gridStart, i)
    const isoDate = day.toISOString().slice(0, 10)
    const dayEvents = events.filter(e => {
      if (!e.rawDate) return false
      return e.rawDate.slice(0, 10) === isoDate
    })
    return {
      date: day,
      day: day.getDate(),
      isoDate,
      currentMonth: day.getMonth() === monthIndex,
      isToday: isSameDay(day, new Date()),
      events: dayEvents,
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventosClient({ initialEvents, profiles = [] }: { initialEvents: EventItem[], profiles?: ProfileItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabId>('todos')
  const [search, setSearch] = useState('')

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Create Dialog
  const [showCreate, setShowCreate] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftTipo, setDraftTipo] = useState<'proprio' | 'externo'>('proprio')
  const [draftDate, setDraftDate] = useState('')
  const [draftEndsAt, setDraftEndsAt] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  // Consultant assignment (external events)
  const [draftConsultant, setDraftConsultant] = useState('')
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([])

  // ─── Derived ────────────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase()
    let events = initialEvents
    if (activeTab === 'terceiros') events = events.filter(e => e.tipo === 'externo')
    if (q) events = events.filter(e => e.name.toLowerCase().includes(q) || (e.local || '').toLowerCase().includes(q))
    return events
  }, [initialEvents, activeTab, search])

  const ownCount = initialEvents.filter(e => e.tipo === 'proprio').length
  const externalCount = initialEvents.filter(e => e.tipo === 'externo').length
  const totalInvestment = initialEvents
    .filter(e => e.tipo === 'externo')
    .reduce((sum, e) => sum + (e.investment || 0), 0)
  const totalExpectedLeads = initialEvents
    .filter(e => e.tipo === 'externo')
    .reduce((sum, e) => sum + (e.expected_leads || 0), 0)
  const totalActualLeads = initialEvents
    .filter(e => e.tipo === 'externo')
    .reduce((sum, e) => sum + (e.inscritos || 0), 0)

  const monthCalendar = useMemo(() => buildMonthCalendar(calendarMonth, initialEvents), [calendarMonth, initialEvents])

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return []
    return initialEvents.filter(e => e.rawDate && e.rawDate.slice(0, 10) === selectedDate)
  }, [selectedDate, initialEvents])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function resetCreateForm() {
    setDraftName(''); setDraftTipo('proprio')
    setDraftDate(''); setDraftEndsAt('')
    setDraftLocation(''); setDraftConsultant('')
    setSelectedProfileIds([])
  }

  function toggleProfile(id: string) {
    setSelectedProfileIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function handleCreateEvent() {
    if (!draftName.trim()) {
      toast.error('Informe o nome do evento.')
      return
    }

    startTransition(async () => {
      const result = await createEvent({
        name: draftName,
        tipo: draftTipo,
        date: draftDate || undefined,
        ends_at: draftEndsAt || undefined,
        local: draftLocation || undefined,
      })
      if (result.success) {
        // If external event and a consultant was selected, allocate them right away
        if (draftTipo === 'externo' && draftConsultant && result.event?.id) {
          await assignEventStaff(
            result.event.id,
            draftConsultant,
            draftName,
            draftDate || new Date().toISOString(),
            draftEndsAt || undefined,
          )
        }
        toast.success(draftTipo === 'externo' && draftConsultant
          ? 'Evento salvo e consultor alocado na agenda!'
          : 'Evento salvo na agenda.'
        )
        resetCreateForm()
        setShowCreate(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Erro ao criar evento')
      }
    })
  }

  async function handleLink(eventId: string) {
    try {
      const origin = window.location.origin
      await navigator.clipboard.writeText(`${origin}/evento/${eventId}`)
      toast.success('Link de inscricao copiado para envio!')
    } catch {
      toast.error('Nao foi possivel copiar o link.')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'todos', label: 'Meus Eventos', icon: <PartyPopper size={14} />, count: ownCount + externalCount },
    { id: 'terceiros', label: 'Terceiros', icon: <Building2 size={14} />, count: externalCount },
  ]

  return (
    <>
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── HEADER ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em' }}>
              Gerenciamento de Eventos
            </h1>
            <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '2px' }}>
              {ownCount} {ownCount === 1 ? 'proprio' : 'proprios'} · {externalCount} {externalCount === 1 ? 'externo' : 'externos'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Pesquisar eventos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '240px', height: '36px', fontSize: '0.83rem' }}
            />
            <button type="button" className="btn-primary" onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} />
              Novo evento
            </button>
          </div>
        </div>

        {/* ── CALENDAR (always visible) ─────────────────────────────── */}
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          {/* Calendar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setCalendarMonth(d => addMonths(d, -1))}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.9rem', textTransform: 'capitalize', minWidth: '180px', textAlign: 'center' }}>
                {formatMonthLabel(calendarMonth)}
              </span>
              <button type="button" className="btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setCalendarMonth(d => addMonths(d, 1))}>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '4px 10px', fontSize: '0.74rem', marginLeft: '4px' }}
                onClick={() => { setCalendarMonth(startOfMonth(new Date())); setSelectedDate(null) }}
              >
                Hoje
              </button>
            </div>
            {selectedDate && (
              <button type="button" className="btn-ghost" style={{ fontSize: '0.74rem', padding: '4px 10px' }} onClick={() => setSelectedDate(null)}>
                Limpar selecao
              </button>
            )}
          </div>

          {/* Calendar grid */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', minWidth: '560px' }}>
              {WEEK_DAYS_ABBR.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '6px' }}>
                  {d}
                </div>
              ))}
              {monthCalendar.map(cell => {
                const hasOwn = cell.events.some(e => e.tipo === 'proprio')
                const hasExternal = cell.events.some(e => e.tipo === 'externo')
                const isSelected = selectedDate === cell.isoDate

                return (
                  <button
                    key={cell.isoDate}
                    type="button"
                    onClick={() => setSelectedDate(cell.events.length > 0 ? cell.isoDate : null)}
                    style={{
                      borderRadius: '10px',
                      padding: '6px 4px',
                      minHeight: '52px',
                      textAlign: 'center',
                      border: isSelected
                        ? '1px solid rgba(96,165,250,0.5)'
                        : cell.isToday
                          ? '1px solid rgba(251,191,36,0.35)'
                          : '1px solid rgba(255,255,255,0.03)',
                      background: isSelected
                        ? 'rgba(96,165,250,0.1)'
                        : cell.isToday
                          ? 'rgba(251,191,36,0.07)'
                          : cell.currentMonth
                            ? 'rgba(255,255,255,0.015)'
                            : 'transparent',
                      color: cell.currentMonth
                        ? cell.isToday ? 'var(--brand-primary)' : '#94a3b8'
                        : '#1e293b',
                      fontSize: '0.82rem',
                      fontWeight: cell.isToday ? 900 : 600,
                      cursor: cell.events.length > 0 ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    {cell.day}
                    {cell.events.length > 0 && (
                      <div style={{ marginTop: '3px', display: 'flex', justifyContent: 'center', gap: '3px' }}>
                        {hasOwn && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />}
                        {hasExternal && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />}
                        {cell.events.length > 1 && (
                          <span style={{ fontSize: '0.55rem', color: '#60a5fa', fontWeight: 800 }}>+{cell.events.length - 1}</span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', justifyContent: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#475569' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-primary)', display: 'inline-block' }} />
              Proprio
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', color: '#475569' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
              Externo
            </span>
          </div>

          {/* Selected day sidebar */}
          {selectedDate && selectedDayEvents.length > 0 && (
            <div style={{
              marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c9d1d9', marginBottom: '10px' }}>
                Eventos em {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </h4>
              <div style={{ display: 'grid', gap: '6px' }}>
                {selectedDayEvents.map(ev => (
                  <Link
                    key={ev.id}
                    href={`/dashboard/eventos/${ev.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                      textDecoration: 'none', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: ev.tipo === 'proprio' ? 'var(--brand-primary)' : '#60a5fa',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#e2e8f0' }}>{ev.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#475569' }}>{ev.local} · {ev.date}</div>
                    </div>
                    <span className={`badge ${ev.tipo === 'proprio' ? 'badge-gold' : 'badge-blue'}`} style={{ fontSize: '0.62rem' }}>
                      {ev.tipo === 'proprio' ? 'Proprio' : 'Externo'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TABS ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700,
                color: activeTab === tab.id ? 'var(--brand-primary)' : '#475569',
                background: 'transparent',
                border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--brand-primary)' : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                marginBottom: '-1px',
              }}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  padding: '1px 7px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800,
                  background: activeTab === tab.id ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                  color: activeTab === tab.id ? 'var(--brand-primary)' : '#475569',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── KPI CARDS (Third-party tab) ───────────────────────────── */}
        {activeTab === 'terceiros' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Investido</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-text)', margin: '4px 0' }}>
                    R$ {totalInvestment.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>em {externalCount} eventos</span>
                </div>
                <DollarSign size={24} color="#f59e0b" style={{ opacity: 0.6 }} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads Esperados</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-text)', margin: '4px 0' }}>
                    {totalExpectedLeads}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>meta de captacao</span>
                </div>
                <Target size={24} color="#60a5fa" style={{ opacity: 0.6 }} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads Captados</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-text)', margin: '4px 0' }}>
                    {totalActualLeads}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: totalActualLeads >= totalExpectedLeads && totalExpectedLeads > 0 ? '#10b981' : '#f59e0b' }}>
                    {totalExpectedLeads > 0 ? `${Math.round((totalActualLeads / totalExpectedLeads) * 100)}% da meta` : 'sem meta definida'}
                  </span>
                </div>
                <TrendingUp size={24} color="#10b981" style={{ opacity: 0.6 }} />
              </div>
            </div>

            <div className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custo por Lead</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--brand-text)', margin: '4px 0' }}>
                    R$ {totalActualLeads > 0 ? Math.round(totalInvestment / totalActualLeads).toLocaleString('pt-BR') : '--'}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: '#475569' }}>investimento / lead</span>
                </div>
                <ClipboardList size={24} color="#f97316" style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
        )}

        {/* ── EVENT LIST ─────────────────────────────────────────────── */}
        {filteredEvents.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Calendar size={32} color="#30363d" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.9rem' }}>
              {activeTab === 'terceiros'
                ? 'Nenhum evento de terceiro cadastrado.'
                : 'Nenhum evento na agenda. Crie o primeiro.'}
            </p>
            <button type="button" className="btn-primary" style={{ margin: '16px auto 0', display: 'inline-flex' }} onClick={() => { setDraftTipo(activeTab === 'terceiros' ? 'externo' : 'proprio'); setShowCreate(true) }}>
              {activeTab === 'terceiros' ? 'Adicionar evento de terceiro' : 'Novo evento'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {filteredEvents.map(event => {
              const occupancy = event.tipo === 'proprio' && event.capacidade > 0
                ? Math.min(Math.round((event.inscritos / event.capacidade) * 100), 100)
                : 0

              return (
                <article key={event.id} className="glass-card" style={{ padding: '16px 20px', display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: event.tipo === 'proprio' ? 'rgba(251,191,36,0.1)' : 'rgba(59,130,246,0.1)',
                      color: event.tipo === 'proprio' ? 'var(--brand-primary)' : '#93c5fd',
                    }}>
                      {event.tipo === 'proprio' ? <PartyPopper size={18} /> : <Building2 size={18} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Link href={`/dashboard/eventos/${event.id}`} style={{ fontWeight: 800, fontSize: '0.93rem', color: 'var(--brand-text)', textDecoration: 'none' }}>
                          {event.name}
                        </Link>
                        <span className={`badge ${event.tipo === 'proprio' ? 'badge-gold' : 'badge-blue'}`} style={{ fontSize: '0.62rem' }}>
                          {event.tipo === 'proprio' ? 'Proprio' : 'Externo'}
                        </span>
                        <span className={`badge ${statusBadge[event.status] || 'badge-gold'}`} style={{ fontSize: '0.62rem' }}>
                          {statusLabel[event.status] || event.status}
                          {event.current_stage ? ` (${event.current_stage})` : ''}
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '0.78rem' }}>
                          <Clock3 size={11} />{event.date}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '0.78rem' }}>
                          <MapPin size={11} />{event.local}
                        </span>
                        {event.tipo === 'proprio' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '0.78rem' }}>
                            <Users size={11} />{event.inscritos}/{event.capacidade}
                          </span>
                        )}
                        {event.tipo === 'externo' && event.organizer_name && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '0.78rem' }}>
                            <Building2 size={11} />{event.organizer_name}
                          </span>
                        )}
                        {event.tipo === 'externo' && (event.investment || 0) > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700 }}>
                            <DollarSign size={11} />R$ {(event.investment || 0).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                      {event.tipo === 'proprio' && (
                        <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: '0.74rem' }} onClick={() => handleLink(event.id)}>
                          <Share2 size={12} /> Link
                        </button>
                      )}
                      <Link
                        href={`/dashboard/eventos/${event.id}`}
                        className="btn-accent"
                        style={{ padding: '6px 12px', fontSize: '0.74rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        Painel <ChevronRight size={13} />
                      </Link>
                    </div>
                  </div>

                  {event.tipo === 'proprio' && event.capacidade > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '4px' }}>
                        <span>Ocupacao ({event.inscritos} confirmados)</span>
                        <span>{occupancy}%</span>
                      </div>
                      <div className="progress-bar" style={{ height: '4px' }}>
                        <div className="progress-fill" style={{ width: `${occupancy}%`, background: occupancy >= 100 ? '#ef4444' : 'var(--brand-primary)' }} />
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* ── CREATE DIALOG ─────────────────────────────────────────── */}
      <ActionDialog
        open={showCreate}
        title={draftTipo === 'externo' ? 'Novo evento de terceiro' : 'Novo evento'}
        subtitle={draftTipo === 'externo' ? 'Registre uma feira ou evento externo que sua equipe ira participar.' : 'Adicione um evento a agenda.'}
        onClose={() => { setShowCreate(false); resetCreateForm() }}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => { setShowCreate(false); resetCreateForm() }}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreateEvent} disabled={isPending}>
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Nome do evento</label>
            <input className="input-field" placeholder="Ex: Rodada de Negocios" value={draftName} onChange={e => setDraftName(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Tipo</label>
              <select className="input-field" value={draftTipo} onChange={e => setDraftTipo(e.target.value as 'proprio' | 'externo')}>
                <option value="proprio">Evento proprio</option>
                <option value="externo">Participacao externa (terceiro)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Data</label>
              <input type="date" className="input-field" value={draftDate} onChange={e => setDraftDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Local</label>
              <input className="input-field" placeholder="Ex: Centro de Convencoes" value={draftLocation} onChange={e => setDraftLocation(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 700 }}>Final (Opcional)</label>
              <input type="date" className="input-field" value={draftEndsAt} onChange={e => setDraftEndsAt(e.target.value)} />
            </div>
          </div>

          {draftTipo === 'externo' && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', marginTop: '4px' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#60a5fa', marginBottom: '4px' }}>
                Participantes (Comercial/Palin)
              </p>
              {profiles.length === 0 ? (
                <p style={{ color: '#475569', fontSize: '0.82rem' }}>Nenhum perfil disponivel.</p>
              ) : (
                <div style={{ display: 'grid', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                  {profiles.map(p => {
                    const isSelected = selectedProfileIds.includes(p.id)
                    const initials = (p.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                    const roleColor = p.role === 'gestor' ? 'var(--brand-primary)' : '#3b82f6'

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProfile(p.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', borderRadius: '10px', textAlign: 'left',
                          background: isSelected ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1.5px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer', transition: 'all 0.15s', width: '100%',
                        }}
                      >
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                          background: isSelected ? 'var(--brand-primary)' : 'rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 800, color: isSelected ? '#0d1117' : '#94a3b8',
                        }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#fff' : '#e2e8f0' }}>
                            {p.full_name || 'Sem nome'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: roleColor, fontWeight: 600 }}>
                            {p.role || 'Consultor'}
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </ActionDialog>
    </>
  )
}
