'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  MapPin,
  Plus,
  Search,
  Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import ActionDialog from '@/components/action-dialog'
import { ClientSearchField, type ClienteOption } from '@/components/client-search-field'
import {
  createMeeting,
  createMeetingTask,
  toggleMeetingTask,
  updateMeetingStatus,
} from '@/app/actions/agenda'
import type { AgendaLogisticsItem, AgendaMeeting, AgendaProfile, AgendaTask } from './agenda-types'
import MeetingDrawer from './agenda-drawer'

// ─── Types ────────────────────────────────────────────────────────────────────

type AgendaManagerProps = {
  clientes: ClienteOption[]
  logisticsItems: AgendaLogisticsItem[]
  meetings: AgendaMeeting[]
  profiles: AgendaProfile[]
  setupMissing: boolean
  tasks: AgendaTask[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS_ABBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todas' },
  { value: 'agendada', label: 'Agendadas' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'em deslocamento', label: 'Em campo' },
  { value: 'concluida', label: 'Concluídas' },
]

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  agendada: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: '#fcd34d' },
  confirmada: { dot: '#60a5fa', bg: 'rgba(96,165,250,0.1)', text: '#93c5fd' },
  'em deslocamento': { dot: '#22c55e', bg: 'rgba(34,197,94,0.1)', text: '#86efac' },
  concluida: { dot: '#64748b', bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function formatTime(dateString: string | null | undefined) {
  if (!dateString) return '--:--'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatShortDate(dateString: string | null | undefined) {
  if (!dateString) return '--/--'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '--/--'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
}

function formatShortDateTime(dateString?: string | null) {
  if (!dateString) return 'Sem prazo'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return 'Data inválida'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
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

function buildMonthCalendar(month: Date, meetings: AgendaMeeting[]) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const firstWeekDay = firstDay.getDay()
  const gridStart = new Date(year, monthIndex, 1 - firstWeekDay)

  return Array.from({ length: 35 }, (_, i) => {
    const day = addDays(gridStart, i)
    const isoDate = day.toISOString().slice(0, 10)
    const dayMeetings = meetings.filter(m => m.scheduled_for.slice(0, 10) === isoDate)
    return {
      date: day,
      day: day.getDate(),
      isoDate,
      currentMonth: day.getMonth() === monthIndex,
      isToday: isSameDay(day, new Date()),
      meetingCount: dayMeetings.length,
      statuses: [...new Set(dayMeetings.map(m => m.status))],
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgendaManager({
  clientes,
  logisticsItems: initialLogistics,
  meetings: initialMeetings,
  profiles,
  setupMissing,
  tasks: initialTasks,
}: AgendaManagerProps) {

  // State
  const [meetings, setMeetings] = useState<AgendaMeeting[]>(initialMeetings)
  const [tasks, setTasks] = useState<AgendaTask[]>(initialTasks)
  const [logisticsItems] = useState<AgendaLogisticsItem[]>(initialLogistics)
  const [isPending, startTransition] = useTransition()

  // Calendar State
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('week')
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))

  // Drawer / Modals
  const [selectedMeeting, setSelectedMeeting] = useState<AgendaMeeting | null>(null)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  // Forms
  const [meetingForm, setMeetingForm] = useState({
    title: '', lead_id: '', client_id: '', client_name: '', scheduled_for: '', ends_at: '',
    location: '', meeting_type: 'Presencial', objective: '',
    notes: '', next_step: '', next_contact_at: '', owner_profile_id: '',
    requires_logistics: false,
  })
  const [taskForm, setTaskForm] = useState({
    title: '', due_at: '', priority: 'Media', owner_profile_id: '', meeting_id: '',
  })

  // ─── Derived ────────────────────────────────────────────────────────────────

  const today = useMemo(() => new Date(), [])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekAnchor, i)
    const isoDate = day.toISOString().slice(0, 10)
    const dayMeetings = meetings.filter(m => m.scheduled_for.slice(0, 10) === isoDate)
    return {
      date: day,
      label: WEEK_DAYS_ABBR[day.getDay()],
      dayNum: day.getDate(),
      isoDate,
      isToday: isSameDay(day, today),
      meetingCount: dayMeetings.length,
      hasUrgent: dayMeetings.some(m => m.status === 'em deslocamento'),
    }
  }), [weekAnchor, meetings, today])

  const monthCalendar = useMemo(() => buildMonthCalendar(calendarMonth, meetings), [calendarMonth, meetings])

  const todayMeetings = useMemo(() => meetings.filter(m => isSameDay(new Date(m.scheduled_for), today)), [meetings, today])
  const openTasksCount = useMemo(() => tasks.filter(t => t.status !== 'concluida').length, [tasks])
  const overdueTasksCount = useMemo(() => tasks.filter(t => t.due_at && t.status !== 'concluida' && new Date(t.due_at) < today).length, [tasks, today])
  const pendingLogisticsCount = useMemo(() => logisticsItems.filter(i => i.status !== 'ok').length, [logisticsItems])

  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return meetings
      .filter(m => {
        const matchesSearch = !q || m.title.toLowerCase().includes(q) ||
          (m.lead_name || '').toLowerCase().includes(q) ||
          (m.company_name || '').toLowerCase().includes(q)
        const matchesStatus = statusFilter === 'todos' || m.status === statusFilter
        return matchesSearch && matchesStatus
      })
      .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())
  }, [meetings, searchQuery, statusFilter])

  // ─── Handlers ───────────────────────────────────────────────────────────────


  function resetMeetingForm() {
    setMeetingForm({
      title: '', lead_id: '', client_id: '', client_name: '', scheduled_for: '', ends_at: '',
      location: '', meeting_type: 'Presencial', objective: '',
      notes: '', next_step: '', next_contact_at: '', owner_profile_id: '',
      requires_logistics: false,
    })
  }

  function handleCreateMeeting() {
    if (!meetingForm.title.trim() || !meetingForm.scheduled_for) {
      toast.error('Preencha o título e a data da reunião.')
      return
    }

    if (setupMissing) {
      const ownerProfile = profiles.find(p => p.id === meetingForm.owner_profile_id)
      const newMeeting: AgendaMeeting = {
        id: `local-${Date.now()}`, title: meetingForm.title.trim(),
        lead_id: null, lead_name: null,
        company_name: null, client_id: meetingForm.client_id || null, client_name: meetingForm.client_name || null,
        scheduled_for: meetingForm.scheduled_for, ends_at: meetingForm.ends_at || null,
        location: meetingForm.location || null, meeting_type: meetingForm.meeting_type || 'Presencial',
        status: 'agendada', objective: meetingForm.objective || null, notes: meetingForm.notes || null,
        next_step: meetingForm.next_step || null, next_contact_at: meetingForm.next_contact_at || null,
        owner_profile_id: meetingForm.owner_profile_id || null,
        owner_name: ownerProfile?.full_name || 'Sem responsável',
        requires_logistics: meetingForm.requires_logistics,
      }
      setMeetings(prev => [...prev, newMeeting])
      toast.success('Reunião salva localmente.')
      resetMeetingForm()
      setMeetingOpen(false)
      return
    }

    startTransition(async () => {
      const result = await createMeeting({
        title: meetingForm.title,
        scheduled_for: meetingForm.scheduled_for,
        ends_at: meetingForm.ends_at || null,
        location: meetingForm.location || null,
        meeting_type: meetingForm.meeting_type || null,
        notes: meetingForm.notes || null,
        objective: meetingForm.objective || null,
        lead_id: null,
        client_id: meetingForm.client_id || null,
        company_name: meetingForm.client_name || null,
        next_step: meetingForm.next_step || null,
        next_contact_at: meetingForm.next_contact_at || null,
        owner_profile_id: meetingForm.owner_profile_id || null,
        requires_logistics: meetingForm.requires_logistics,
      })
      if (!result.success) { toast.error('Erro ao criar reunião', { description: result.error }); return }
      toast.success('Reunião salva na agenda.')
      resetMeetingForm()
      setMeetingOpen(false)
    })
  }

  function handleCreateTask() {
    if (!taskForm.title.trim()) { toast.error('Informe o título da tarefa.'); return }

    if (setupMissing) {
      const ownerProfile = profiles.find(p => p.id === taskForm.owner_profile_id)
      const newTask: AgendaTask = {
        id: `local-${Date.now()}`, meeting_id: taskForm.meeting_id || null,
        title: taskForm.title.trim(), due_at: taskForm.due_at || null,
        priority: taskForm.priority || 'Media', status: 'aberta',
        owner_profile_id: taskForm.owner_profile_id || null,
        owner_name: ownerProfile?.full_name || 'Sem responsável',
      }
      setTasks(prev => [...prev, newTask])
      toast.success('Tarefa adicionada.')
      setTaskForm({ title: '', due_at: '', priority: 'Media', owner_profile_id: '', meeting_id: '' })
      setTaskOpen(false)
      return
    }

    startTransition(async () => {
      const result = await createMeetingTask({
        ...taskForm, due_at: taskForm.due_at || null,
        meeting_id: taskForm.meeting_id || null, owner_profile_id: taskForm.owner_profile_id || null,
      })
      if (!result.success) { toast.error('Erro ao criar tarefa', { description: result.error }); return }
      toast.success('Tarefa adicionada.')
      setTaskForm({ title: '', due_at: '', priority: 'Media', owner_profile_id: '', meeting_id: '' })
      setTaskOpen(false)
    })
  }

  function handleToggleTask(taskId: string, done: boolean) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: done ? 'concluida' : 'aberta' } : t))
    if (setupMissing) { toast.success(done ? 'Tarefa concluída.' : 'Tarefa reaberta.'); return }
    startTransition(async () => {
      await toggleMeetingTask(taskId, done)
      toast.success(done ? 'Tarefa concluída.' : 'Tarefa reaberta.')
    })
  }

  function handleMeetingStatus(meetingId: string, status: string) {
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status } : m))
    if (selectedMeeting?.id === meetingId) setSelectedMeeting(prev => prev ? { ...prev, status } : null)
    toast.success(`Reunião: ${status}`)
    if (setupMissing) return
    startTransition(async () => {
      await updateMeetingStatus(meetingId, status)
    })
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '1480px', margin: '0 auto' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em', margin: 0 }}>
              Reuniões
            </h1>
            <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: '2px' }}>
              Agenda e controle comercial
            </p>
          </div>

          {/* KPI Dots */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: `${todayMeetings.length} hoje`, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
              { label: `${openTasksCount} tarefas`, color: overdueTasksCount > 0 ? '#f87171' : '#86efac', bg: overdueTasksCount > 0 ? 'rgba(248,113,113,0.08)' : 'rgba(34,197,94,0.08)', border: overdueTasksCount > 0 ? 'rgba(248,113,113,0.2)' : 'rgba(34,197,94,0.2)' },
              { label: `${pendingLogisticsCount} logística`, color: 'var(--brand-primary)', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 10px', borderRadius: '999px',
                background: kpi.bg, border: `1px solid ${kpi.border}`,
                color: kpi.color, fontSize: '0.75rem', fontWeight: 700,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color, display: 'inline-block' }} />
                {kpi.label}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={() => setMeetingOpen(true)} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
            <CalendarDays size={14} />
            Nova Reunião
          </button>
          <a
            href="https://palinos.vercel.app/frota"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <Truck size={14} />
            Logística
            <ExternalLink size={11} />
          </a>
          <button type="button" className="btn-ghost" onClick={() => setTaskOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />
            Tarefa
          </button>
        </div>
      </div>

      {setupMissing && (
        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)', color: '#fde68a', fontSize: '0.84rem' }}>
          As tabelas da agenda ainda não existem no Supabase. Configure via <code>docs/agenda-schema.sql</code>.
        </div>
      )}

      {/* ── CALENDAR BAR ─────────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        {/* Calendar header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '5px 8px' }}
              aria-label="Semana anterior"
              onClick={() => {
                if (calendarMode === 'week') setWeekAnchor(d => addDays(d, -7))
                else setCalendarMonth(d => addMonths(d, -1))
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.9rem', textTransform: 'capitalize', minWidth: '160px', textAlign: 'center' }}>
              {calendarMode === 'week'
                ? `${formatShortDate(weekAnchor.toISOString())} – ${formatShortDate(addDays(weekAnchor, 6).toISOString())}`
                : formatMonthLabel(calendarMonth)
              }
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '5px 8px' }}
              aria-label="Próxima semana"
              onClick={() => {
                if (calendarMode === 'week') setWeekAnchor(d => addDays(d, 7))
                else setCalendarMonth(d => addMonths(d, 1))
              }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: '0.74rem', marginLeft: '4px' }}
              onClick={() => { setWeekAnchor(startOfWeek(new Date())); setCalendarMonth(startOfMonth(new Date())) }}
            >
              Hoje
            </button>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '5px 12px', fontSize: '0.75rem' }}
            onClick={() => setCalendarMode(m => m === 'week' ? 'month' : 'week')}
          >
            {calendarMode === 'week' ? 'Ver mês' : 'Ver semana'}
          </button>
        </div>

        {/* WEEK BAR */}
        {calendarMode === 'week' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
            {weekDays.map(day => (
              <div
                key={day.isoDate}
                style={{
                  borderRadius: '12px',
                  padding: '10px 6px',
                  textAlign: 'center',
                  border: day.isToday ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.04)',
                  background: day.isToday ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.02)',
                  cursor: 'default',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: day.isToday ? '#93c5fd' : '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {day.label}
                </div>
                <div style={{ marginTop: '4px', fontSize: '1.1rem', fontWeight: 900, color: day.isToday ? '#60a5fa' : '#94a3b8' }}>
                  {day.dayNum}
                </div>
                {day.meetingCount > 0 && (
                  <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '3px', flexWrap: 'wrap' }}>
                    {Array.from({ length: Math.min(day.meetingCount, 3) }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: day.hasUrgent ? '#22c55e' : '#60a5fa',
                          display: 'inline-block',
                        }}
                      />
                    ))}
                    {day.meetingCount > 3 && <span style={{ fontSize: '0.55rem', color: '#60a5fa', fontWeight: 800 }}>+{day.meetingCount - 3}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MONTH CALENDAR */}
        {calendarMode === 'month' && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', minWidth: '560px' }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '0.68rem', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '8px' }}>
                  {d}
                </div>
              ))}
              {monthCalendar.map(cell => (
                <div
                  key={cell.isoDate}
                  style={{
                    borderRadius: '10px',
                    padding: '8px 6px',
                    minHeight: '56px',
                    textAlign: 'center',
                    border: cell.isToday ? '1px solid rgba(96,165,250,0.35)' : '1px solid rgba(255,255,255,0.03)',
                    background: cell.isToday ? 'rgba(96,165,250,0.07)' : cell.currentMonth ? 'rgba(255,255,255,0.015)' : 'transparent',
                    color: cell.currentMonth ? (cell.isToday ? '#60a5fa' : '#94a3b8') : '#2d3748',
                    fontSize: '0.82rem',
                    fontWeight: cell.isToday ? 900 : 600,
                  }}
                >
                  {cell.day}
                  {cell.meetingCount > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center', gap: '2px' }}>
                      {Array.from({ length: Math.min(cell.meetingCount, 3) }).map((_, i) => (
                        <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MEETING LIST ─────────────────────────────────────────────────── */}
      <div>
        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
            <input
              className="input-field"
              placeholder="Buscar por lead, empresa ou título…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', height: '36px', fontSize: '0.83rem' }}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  border: statusFilter === opt.value ? `1px solid rgba(96,165,250,0.4)` : '1px solid rgba(255,255,255,0.07)',
                  background: statusFilter === opt.value ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.03)',
                  color: statusFilter === opt.value ? '#93c5fd' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Meeting Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredMeetings.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', borderRadius: '14px', border: '1px dashed rgba(255,255,255,0.07)', color: '#334155' }}>
              {searchQuery || statusFilter !== 'todos' ? 'Nenhuma reunião encontrada com esses filtros.' : 'Nenhuma reunião cadastrada. Use "Nova Reunião" para começar.'}
            </div>
          ) : filteredMeetings.map(meeting => {
            const statusStyle = STATUS_COLORS[meeting.status] ?? { dot: '#64748b', bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' }
            const isSelected = selectedMeeting?.id === meeting.id

            return (
              <button
                key={meeting.id}
                type="button"
                onClick={() => setSelectedMeeting(isSelected ? null : meeting)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.05)',
                  background: isSelected ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.035)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
              >
                {/* Status dot */}
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyle.dot, flexShrink: 0 }} />

                {/* Time */}
                <div style={{ flexShrink: 0, textAlign: 'center', minWidth: '46px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8' }}>
                    {formatTime(meeting.scheduled_for)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#334155', fontWeight: 600 }}>
                    {formatShortDate(meeting.scheduled_for)}
                  </div>
                </div>

                {/* Title + Lead */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {meeting.title}
                  </div>
                  {(meeting.lead_name || meeting.company_name) && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {[meeting.lead_name, meeting.company_name].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>

                {/* Location */}
                {meeting.location && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#334155', fontSize: '0.74rem', flexShrink: 0, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <MapPin size={11} />
                    {meeting.location}
                  </div>
                )}

                {/* Owner */}
                <div style={{ fontSize: '0.74rem', color: '#334155', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {meeting.owner_name?.split(' ')[0] || '—'}
                </div>

                {/* Status badge */}
                <span style={{
                  padding: '3px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 800,
                  color: statusStyle.text, background: statusStyle.bg, flexShrink: 0,
                  textTransform: 'capitalize',
                }}>
                  {meeting.status}
                </span>

                {/* Logistics indicator */}
                {meeting.requires_logistics && (
                  <span title="Logística solicitada" style={{ fontSize: '0.75rem', flexShrink: 0 }}>🚗</span>
                )}

                <ChevronRight size={14} color={isSelected ? '#60a5fa' : '#334155'} style={{ flexShrink: 0 }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── TASKS (Compact) ─────────────────────────────────────────────── */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={16} color="#60a5fa" />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
              Tarefas
            </h2>
            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, background: 'rgba(96,165,250,0.1)', color: '#93c5fd' }}>
              {openTasksCount} abertas
            </span>
            {overdueTasksCount > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                {overdueTasksCount} vencidas
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.length === 0 ? (
            <div style={{ padding: '16px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.06)', color: '#334155', fontSize: '0.83rem', textAlign: 'center' }}>
              Nenhuma tarefa cadastrada.
            </div>
          ) : tasks.map(task => {
            const done = task.status === 'concluida'
            const overdue = !done && task.due_at && new Date(task.due_at) < today
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex', gap: '10px', alignItems: 'center',
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.015)', border: `1px solid ${overdue ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <button
                  type="button"
                  aria-label={done ? 'Reabrir tarefa' : 'Concluir tarefa'}
                  onClick={() => handleToggleTask(task.id, !done)}
                  style={{ color: done ? '#22c55e' : '#334155', background: 'none', border: 'none', cursor: 'pointer', padding: '0', flexShrink: 0, display: 'flex' }}
                >
                  <CheckCircle2 size={17} />
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: done ? '#334155' : '#cbd5e1', textDecoration: done ? 'line-through' : 'none' }}>
                    {task.title}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: overdue ? '#f87171' : '#334155', marginTop: '2px' }}>
                    {formatShortDateTime(task.due_at)} · {task.owner_name}
                  </div>
                </div>
                <span style={{
                  padding: '2px 7px', borderRadius: '5px', fontSize: '0.63rem', fontWeight: 800, flexShrink: 0,
                  background: task.priority === 'Alta' ? 'rgba(248,113,113,0.1)' : task.priority === 'Media' ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.1)',
                  color: task.priority === 'Alta' ? '#f87171' : task.priority === 'Media' ? 'var(--brand-primary)' : '#94a3b8',
                }}>
                  {task.priority}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      </div>

      {/* ── MEETING DRAWER ───────────────────────────────────────────────── */}
      <MeetingDrawer
        meeting={selectedMeeting}
        onClose={() => setSelectedMeeting(null)}
        onStatusChange={handleMeetingStatus}
        isPending={isPending}
      />

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
      <ActionDialog
        open={meetingOpen}
        title="Nova reunião comercial"
        subtitle="Registre pauta, o que foi falado e o próximo contato."
        onClose={() => setMeetingOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setMeetingOpen(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreateMeeting} disabled={isPending}>Salvar reunião</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <input className="input-field" placeholder="Título da reunião *" value={meetingForm.title} onChange={e => setMeetingForm(c => ({ ...c, title: e.target.value }))} />
          <ClientSearchField
            clientes={clientes}
            selected={meetingForm.client_id ? { id: meetingForm.client_id, nome: meetingForm.client_name } : null}
            onSelect={(cliente) => setMeetingForm(c => ({ ...c, client_id: cliente.id, client_name: cliente.nome }))}
            onClear={() => setMeetingForm(c => ({ ...c, client_id: '', client_name: '' }))}
            placeholder="Vincular a um cliente cadastrado"
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input className="input-field" type="datetime-local" value={meetingForm.scheduled_for} onChange={e => setMeetingForm(c => ({ ...c, scheduled_for: e.target.value }))} />
            <input className="input-field" type="datetime-local" value={meetingForm.ends_at} onChange={e => setMeetingForm(c => ({ ...c, ends_at: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input className="input-field" placeholder="Local ou link" value={meetingForm.location} onChange={e => setMeetingForm(c => ({ ...c, location: e.target.value }))} />
            <select className="input-field" value={meetingForm.meeting_type} onChange={e => setMeetingForm(c => ({ ...c, meeting_type: e.target.value }))}>
              {['Presencial', 'Online', 'Externa'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <select className="input-field" value={meetingForm.owner_profile_id} onChange={e => setMeetingForm(c => ({ ...c, owner_profile_id: e.target.value }))}>
            <option value="">Responsável</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <textarea className="input-field" rows={3} placeholder="Pauta da reunião" value={meetingForm.objective} onChange={e => setMeetingForm(c => ({ ...c, objective: e.target.value }))} />
          <textarea className="input-field" rows={2} placeholder="Próximo passo" value={meetingForm.next_step} onChange={e => setMeetingForm(c => ({ ...c, next_step: e.target.value }))} />
          <input className="input-field" type="datetime-local" value={meetingForm.next_contact_at} onChange={e => setMeetingForm(c => ({ ...c, next_contact_at: e.target.value }))} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={meetingForm.requires_logistics} onChange={e => setMeetingForm(c => ({ ...c, requires_logistics: e.target.checked }))} />
            Precisa de apoio logístico (reservar carro)
          </label>
        </div>
      </ActionDialog>

      <ActionDialog
        open={taskOpen}
        title="Nova tarefa"
        subtitle="Checklist para preparação, follow-up e registro."
        onClose={() => setTaskOpen(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setTaskOpen(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreateTask} disabled={isPending}>Salvar tarefa</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <input className="input-field" placeholder="Título da tarefa *" value={taskForm.title} onChange={e => setTaskForm(c => ({ ...c, title: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <select className="input-field" value={taskForm.meeting_id} onChange={e => setTaskForm(c => ({ ...c, meeting_id: e.target.value }))}>
              <option value="">Vincular a uma reunião</option>
              {meetings.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            <select className="input-field" value={taskForm.owner_profile_id} onChange={e => setTaskForm(c => ({ ...c, owner_profile_id: e.target.value }))}>
              <option value="">Responsável</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input className="input-field" type="datetime-local" value={taskForm.due_at} onChange={e => setTaskForm(c => ({ ...c, due_at: e.target.value }))} />
            <select className="input-field" value={taskForm.priority} onChange={e => setTaskForm(c => ({ ...c, priority: e.target.value }))}>
              {['Alta', 'Media', 'Baixa'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </ActionDialog>
    </>
  )
}
