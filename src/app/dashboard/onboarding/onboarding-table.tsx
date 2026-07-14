'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Landmark,
  Laptop,
  Mail,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { setOnboardingFilial } from '@/app/actions/filiais'

type Filial = { id: string; nome: string }

type ClientOnboarding = {
  id: string
  name: string
  company_name: string | null
  documento: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  product: string
  contract_date: string
  filiais: Filial[]
  selected_filial_id: string | null
}

type TrackKey = 'tributario' | 'tecnologia' | 'psicologico'
type ViewMode = 'ativos' | 'concluidos'

type Task = {
  key: string
  label: string
  detail: string
  points: number
}

type Track = {
  key: TrackKey
  label: string
  description: string
  icon: typeof Landmark
  color: string
  terms: string[]
  tasks: Task[]
}

const TRACKS: Track[] = [
  {
    key: 'tributario',
    label: 'Tributário',
    description: 'Escopo fiscal, contrato, documentos e kickoff técnico.',
    icon: Landmark,
    color: '#eab308',
    terms: ['tribut', 'icms', 'pis', 'cofins', 'fiscal', 'crédito', 'credito', 'cat', 'rural', 'dca'],
    tasks: [
      { key: 'welcome_email', label: 'Email de boas-vindas enviado', detail: 'Enviar orientação inicial, contato responsável e próximos passos.', points: 20 },
      { key: 'contact_confirmed', label: 'Contato responsável confirmado', detail: 'Validar nome, telefone, WhatsApp e melhor canal da empresa.', points: 20 },
      { key: 'contract', label: 'Contrato conferido', detail: 'Objeto, assinatura, filial e responsável confirmados.', points: 30 },
      { key: 'tax_scope', label: 'Escopo tributário validado', detail: 'Produto, crédito, regime e documentos necessários.', points: 35 },
      { key: 'kickoff', label: 'Kickoff técnico marcado', detail: 'Primeira reunião com pauta e donos definidos.', points: 25 },
    ],
  },
  {
    key: 'tecnologia',
    label: 'Tecnologia',
    description: 'Acessos, canais, pastas e rotina operacional prontos.',
    icon: Laptop,
    color: '#22c55e',
    terms: ['tech', 'tecnolog', 'software', 'sistema', 'automação', 'automacao', 'dados'],
    tasks: [
      { key: 'welcome_email', label: 'Email de boas-vindas enviado', detail: 'Enviar canais, acessos e responsável pelo início.', points: 20 },
      { key: 'access', label: 'Acessos configurados', detail: 'Sistema, pastas e canal de atendimento.', points: 25 },
      { key: 'documents', label: 'Documentos recebidos', detail: 'Checklist documental mínimo validado.', points: 30 },
      { key: 'data_room', label: 'Ambiente organizado', detail: 'Arquivos e responsáveis padronizados.', points: 20 },
    ],
  },
  {
    key: 'psicologico',
    label: 'Integramente',
    description: 'Confiança, segurança e expectativa do cliente.',
    icon: Brain,
    color: '#c084fc',
    terms: ['psic', 'mental', 'integramente', 'nr1', 'nr-1', 'bem-estar', 'bem estar'],
    tasks: [
      { key: 'welcome_email', label: 'Email de boas-vindas enviado', detail: 'Enviar agenda inicial, canal oficial e combinados.', points: 20 },
      { key: 'expectations', label: 'Expectativas alinhadas', detail: 'Riscos, tempo e critérios sem promessa frouxa.', points: 30 },
      { key: 'sponsor', label: 'Patrocinador mapeado', detail: 'Quem decide e quem operacionaliza.', points: 20 },
      { key: 'confidence', label: 'Canal de confiança', detail: 'Cliente sabe quem chamar e quando.', points: 20 },
    ],
  },
]

const allTasks = TRACKS.flatMap((track) => track.tasks.map((task) => ({ ...task, track: track.key })))
const maxPoints = allTasks.reduce((sum, task) => sum + task.points, 0)

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function getInitials(value: string) {
  return value
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getTrackForClient(client: ClientOnboarding): Track {
  const haystack = `${client.product} ${client.company_name || ''} ${client.name}`.toLowerCase()
  return TRACKS.find((track) => track.terms.some((term) => haystack.includes(term))) || TRACKS[0]
}

function onlyDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '')
}

function getMailto(client: ClientOnboarding, track: Track) {
  const subject = encodeURIComponent(`Onboarding Palin - ${client.company_name || client.name}`)
  const body = encodeURIComponent(
    `Olá, ${client.name}.\n\nVamos iniciar seu onboarding de ${track.label}. Seguem os próximos passos:\n\n1. confirmar o contato responsável;\n2. validar documentos e escopo;\n3. agendar o kickoff.\n\nFico à disposição.`
  )
  return `mailto:${client.email || ''}?subject=${subject}&body=${body}`
}

function getWhatsAppLink(client: ClientOnboarding, track: Track) {
  const phone = onlyDigits(client.whatsapp || client.phone)
  const text = encodeURIComponent(`Olá, ${client.name}. Vamos iniciar seu onboarding de ${track.label}. Pode confirmar o responsável e o melhor horário para alinharmos os próximos passos?`)
  return phone ? `https://wa.me/55${phone}?text=${text}` : '#'
}

export default function OnboardingTable({ clients }: { clients: ClientOnboarding[] }) {
  const [selectedTrack, setSelectedTrack] = useState<TrackKey>('tributario')
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id ?? '')
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({})
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('ativos')
  const [filialByClient, setFilialByClient] = useState<Record<string, string>>(() =>
    Object.fromEntries(clients.filter((client) => client.selected_filial_id).map((client) => [client.id, client.selected_filial_id as string]))
  )
  const [savingFilialFor, setSavingFilialFor] = useState<string | null>(null)

  const statsByClient = useMemo(() => {
    return new Map(
      clients.map((client) => {
        const completed = allTasks.filter((task) => checks[client.id]?.[`${task.track}.${task.key}`]).length
        const points = allTasks
          .filter((task) => checks[client.id]?.[`${task.track}.${task.key}`])
          .reduce((sum, task) => sum + task.points, 0)
        return [client.id, { completed, points, pct: Math.round((completed / allTasks.length) * 100), done: completed === allTasks.length }]
      })
    )
  }, [clients, checks])

  const trackCounts = useMemo(() => {
    return new Map(
      TRACKS.map((track) => {
        const trackClients = clients.filter((client) => getTrackForClient(client).key === track.key)
        const done = trackClients.filter((client) => statsByClient.get(client.id)?.done).length
        return [track.key, { total: trackClients.length, done, active: trackClients.length - done }]
      })
    )
  }, [clients, statsByClient])

  const visibleClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    return clients
      .filter((client) => getTrackForClient(client).key === selectedTrack)
      .filter((client) => {
        const done = Boolean(statsByClient.get(client.id)?.done)
        return viewMode === 'concluidos' ? done : !done
      })
      .filter((client) => {
        if (!query) return true
        return [client.name, client.company_name || '', client.product].some((value) => value.toLowerCase().includes(query))
      })
  }, [clients, selectedTrack, statsByClient, viewMode, search])

  const selectedClient = visibleClients.find((client) => client.id === selectedClientId) || visibleClients[0]
  const selectedTrackData = TRACKS.find((track) => track.key === selectedTrack) || TRACKS[0]
  const clientProgress = selectedClient ? statsByClient.get(selectedClient.id) : null
  const trackCompleted = selectedClient
    ? selectedTrackData.tasks.filter((task) => checks[selectedClient.id]?.[`${selectedTrackData.key}.${task.key}`]).length
    : 0
  const selectedFilialId = selectedClient ? filialByClient[selectedClient.id] : undefined
  const needsFilial = Boolean(selectedClient && selectedClient.filiais.length > 0 && !selectedFilialId)

  const stats = {
    total: clients.length,
    done: Array.from(statsByClient.values()).filter((item) => item.done).length,
    attention: Array.from(statsByClient.values()).filter((item) => item.completed > 0 && !item.done).length,
    points: Array.from(statsByClient.values()).reduce((sum, item) => sum + item.points, 0),
  }

  function selectTrack(track: TrackKey) {
    setSelectedTrack(track)
    setSelectedClientId('')
    setViewMode('ativos')
  }

  function toggleTask(track: TrackKey, taskKey: string) {
    if (!selectedClient || needsFilial) return
    const key = `${track}.${taskKey}`
    setChecks((prev) => ({
      ...prev,
      [selectedClient.id]: {
        ...(prev[selectedClient.id] || {}),
        [key]: !prev[selectedClient.id]?.[key],
      },
    }))
  }

  async function chooseFilial(clientId: string, filialId: string) {
    setFilialByClient((prev) => ({ ...prev, [clientId]: filialId }))
    setSavingFilialFor(clientId)
    try {
      const result = await setOnboardingFilial(clientId, filialId)
      if (!result.success) throw new Error(result.error)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar filial do onboarding.')
    } finally {
      setSavingFilialFor(null)
    }
  }

  if (clients.length === 0) {
    return (
      <section className="glass-card" style={{ padding: 32, textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 16 }}>
        <ClipboardCheck size={36} color="var(--brand-primary)" aria-hidden="true" />
        <div>
          <h2 style={{ fontSize: '1.15rem', color: 'var(--brand-text)', fontWeight: 800 }}>Nenhum cliente em onboarding</h2>
          <p style={{ color: 'var(--brand-muted)', marginTop: 4 }}>
            A lista está zerada. Cadastre o cliente e feche o contrato para ele aparecer aqui.
          </p>
          <p style={{ color: '#38bdf8', marginTop: 6, fontSize: '0.86rem' }}>
            Onboarding educacional fica no menu Clube.
          </p>
        </div>
        <Link href="/dashboard/clientes" className="btn-primary">
          <ArrowRight size={16} aria-hidden="true" />
          Ver Clientes
        </Link>
      </section>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="onboarding-summary-grid">
        {[
          { label: 'Clientes', value: stats.total, icon: Users, color: '#94a3b8' },
          { label: 'Concluídos', value: stats.done, icon: CheckCircle2, color: '#22c55e' },
          { label: 'Em andamento', value: stats.attention, icon: MessageCircle, color: '#eab308' },
          { label: 'Pontos', value: stats.points, icon: ShieldCheck, color: 'var(--brand-primary)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span className="font-label" style={{ color: 'var(--brand-muted)' }}>{label}</span>
              <Icon size={16} color={color} aria-hidden="true" />
            </div>
            <strong className="font-kpi" style={{ color, fontSize: '1.7rem' }}>{value}</strong>
          </div>
        ))}
      </section>

      <section className="glass-card" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--brand-text)', fontSize: '1rem', fontWeight: 800 }}>Trilhas de onboarding</h2>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.86rem', marginTop: 2 }}>
              Separado por tipo de trabalho. Educacional fica no Clube.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Phone size={16} color="var(--brand-primary)" aria-hidden="true" />
            <span style={{ color: 'var(--brand-muted)', fontSize: '0.82rem' }}>Próxima ação: contato humano e escopo técnico.</span>
          </div>
        </div>

        <div className="onboarding-track-grid">
          {TRACKS.map((track) => {
            const Icon = track.icon
            const active = selectedTrack === track.key
            const counts = trackCounts.get(track.key)
            return (
              <button
                key={track.key}
                type="button"
                onClick={() => selectTrack(track.key)}
                className="onboarding-track-button"
                style={{
                  minHeight: 112,
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${active ? track.color : 'rgba(255,255,255,0.08)'}`,
                  background: active ? `${track.color}14` : 'rgba(255,255,255,0.025)',
                  color: active ? track.color : 'var(--brand-text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Icon size={20} aria-hidden="true" />
                <strong style={{ display: 'block', marginTop: 10, fontSize: '0.92rem' }}>{track.label}</strong>
                <span style={{ display: 'block', marginTop: 4, color: 'var(--brand-muted)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  {counts?.active || 0} ativos · {counts?.done || 0} concluídos
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="onboarding-workspace">
        <aside className="glass-card" style={{ padding: 14, display: 'grid', gap: 10, alignSelf: 'start' }}>
          <div style={{ padding: '4px 4px 0' }}>
            <h3 style={{ color: 'var(--brand-text)', fontSize: '0.95rem', fontWeight: 800 }}>Clientes</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.78rem' }}>Lista filtrada pela trilha selecionada.</p>
          </div>

          <label style={{ height: 40, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, background: 'rgba(255,255,255,0.025)', padding: '0 10px' }}>
            <Search size={16} color="var(--brand-muted)" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, empresa ou produto"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 0, color: 'var(--brand-text)', fontSize: '0.82rem' }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" className={viewMode === 'ativos' ? 'btn-accent' : 'btn-ghost'} onClick={() => setViewMode('ativos')}>Ativos</button>
            <button type="button" className={viewMode === 'concluidos' ? 'btn-accent' : 'btn-ghost'} onClick={() => setViewMode('concluidos')}>Concluídos</button>
          </div>

          <div style={{ display: 'grid', gap: 8, maxHeight: 560, overflow: 'auto', paddingRight: 4 }}>
            {visibleClients.length === 0 ? (
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 8, padding: 18, color: 'var(--brand-muted)', fontSize: '0.82rem', textAlign: 'center' }}>
                Nenhum cliente nesta visão.
              </div>
            ) : visibleClients.map((client) => {
              const progress = statsByClient.get(client.id)
              const active = selectedClient?.id === client.id
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setSelectedClientId(client.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '42px minmax(0, 1fr) auto',
                    gap: 10,
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 8,
                    border: `1px solid ${active ? 'rgba(212,160,23,0.38)' : 'rgba(255,255,255,0.07)'}`,
                    background: active ? 'rgba(212,160,23,0.08)' : 'rgba(255,255,255,0.02)',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ width: 42, height: 42, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.05)', color: 'var(--brand-primary)', fontWeight: 800 }}>
                    {getInitials(client.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--brand-text)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</strong>
                    <span style={{ display: 'block', color: 'var(--brand-muted)', fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.company_name || client.product}</span>
                  </span>
                  <span style={{ color: active ? 'var(--brand-primary)' : 'var(--brand-muted)', fontWeight: 800, fontSize: '0.8rem' }}>{progress?.pct ?? 0}%</span>
                </button>
              )
            })}
          </div>
        </aside>

        {selectedClient ? (
          <main className="glass-card" style={{ padding: 20, display: 'grid', gap: 18 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h3 style={{ color: 'var(--brand-text)', fontSize: '1.15rem', fontWeight: 850 }}>{selectedClient.name}</h3>
                  <span className="badge badge-gold">{selectedClient.product}</span>
                </div>
                <p style={{ color: 'var(--brand-muted)', fontSize: '0.86rem', marginTop: 4 }}>
                  {selectedClient.company_name || 'Sem empresa informada'} · contrato em {formatDate(selectedClient.contract_date)}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {selectedClient.documento && <span className="badge">CNPJ/CPF {selectedClient.documento}</span>}
                  {selectedClient.email && <span className="badge">{selectedClient.email}</span>}
                  {(selectedClient.whatsapp || selectedClient.phone) && <span className="badge">{selectedClient.whatsapp || selectedClient.phone}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong className="font-kpi" style={{ color: selectedTrackData.color, fontSize: '1.8rem' }}>{clientProgress?.points ?? 0}</strong>
                <div style={{ color: 'var(--brand-muted)', fontSize: '0.76rem' }}>de {maxPoints} pontos</div>
              </div>
            </header>

            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <a href={getMailto(selectedClient, selectedTrackData)} className="btn-accent" style={{ justifyContent: 'center', textDecoration: 'none' }}>
                <Mail size={15} aria-hidden="true" />
                Enviar email
              </a>
              <a
                href={getWhatsAppLink(selectedClient, selectedTrackData)}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
                style={{ justifyContent: 'center', textDecoration: 'none', pointerEvents: selectedClient.whatsapp || selectedClient.phone ? 'auto' : 'none', opacity: selectedClient.whatsapp || selectedClient.phone ? 1 : 0.45 }}
              >
                <MessageCircle size={15} aria-hidden="true" />
                WhatsApp
              </a>
              <a
                href={selectedClient.phone ? `tel:${onlyDigits(selectedClient.phone)}` : '#'}
                className="btn-ghost"
                style={{ justifyContent: 'center', textDecoration: 'none', pointerEvents: selectedClient.phone ? 'auto' : 'none', opacity: selectedClient.phone ? 1 : 0.45 }}
              >
                <Phone size={15} aria-hidden="true" />
                Ligar
              </a>
              <Link href="/dashboard/agenda" className="btn-ghost" style={{ justifyContent: 'center' }}>Agendar</Link>
            </section>

            {selectedClient.filiais.length > 0 && (
              <div style={{ display: 'grid', gap: 6 }}>
                <label style={{ color: 'var(--brand-muted)', fontSize: '0.78rem', fontWeight: 700 }}>
                  Filial {needsFilial ? '(selecione para liberar o checklist)' : ''}
                </label>
                <select
                  value={selectedFilialId || ''}
                  onChange={(event) => chooseFilial(selectedClient.id, event.target.value)}
                  disabled={savingFilialFor === selectedClient.id}
                  style={{
                    height: 40,
                    borderRadius: 8,
                    border: `1px solid ${needsFilial ? '#eab308' : 'rgba(255,255,255,0.08)'}`,
                    background: 'rgba(255,255,255,0.025)',
                    color: 'var(--brand-text)',
                    padding: '0 10px',
                    fontSize: '0.86rem',
                  }}
                >
                  <option value="" disabled>Selecione a filial</option>
                  {selectedClient.filiais.map((filial) => (
                    <option key={filial.id} value={filial.id}>{filial.nome}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ width: `${clientProgress?.pct ?? 0}%`, height: '100%', background: selectedTrackData.color, transition: 'width 180ms ease' }} />
            </div>

            {needsFilial ? (
              <section
                style={{
                  padding: 24,
                  borderRadius: 8,
                  border: '1px dashed rgba(234,179,8,0.35)',
                  background: 'rgba(234,179,8,0.06)',
                  color: 'var(--brand-muted)',
                  textAlign: 'center',
                }}
              >
                Selecione a filial deste cliente acima para liberar o checklist de tarefas.
              </section>
            ) : (
              <section style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h4 style={{ color: selectedTrackData.color, fontWeight: 850, fontSize: '0.98rem' }}>{selectedTrackData.label}</h4>
                    <p style={{ color: 'var(--brand-muted)', fontSize: '0.8rem' }}>{trackCompleted}/{selectedTrackData.tasks.length} ações concluídas</p>
                  </div>
                  <FileText size={18} color={selectedTrackData.color} aria-hidden="true" />
                </div>

                {selectedTrackData.tasks.map((task) => {
                  const checked = Boolean(checks[selectedClient.id]?.[`${selectedTrackData.key}.${task.key}`])
                  return (
                    <label
                      key={task.key}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px minmax(0, 1fr) auto',
                        alignItems: 'center',
                        gap: 12,
                        padding: 14,
                        borderRadius: 8,
                        border: `1px solid ${checked ? `${selectedTrackData.color}55` : 'rgba(255,255,255,0.07)'}`,
                        background: checked ? `${selectedTrackData.color}10` : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleTask(selectedTrackData.key, task.key)} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                      {checked ? <CheckCircle2 size={20} color={selectedTrackData.color} aria-hidden="true" /> : <Circle size={20} color="var(--brand-muted)" aria-hidden="true" />}
                      <span style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: 'var(--brand-text)', fontSize: '0.92rem' }}>{task.label}</strong>
                        <span style={{ display: 'block', color: 'var(--brand-muted)', fontSize: '0.8rem', marginTop: 2 }}>{task.detail}</span>
                      </span>
                      <span style={{ color: checked ? selectedTrackData.color : 'var(--brand-muted)', fontWeight: 800, fontSize: '0.78rem' }}>+{task.points}</span>
                    </label>
                  )
                })}
              </section>
            )}

            <footer style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
              <Link href="/dashboard/clientes" className="btn-accent">Ver cliente</Link>
              <Link href="/dashboard/agenda" className="btn-ghost">Agendar reunião</Link>
              <button type="button" className="btn-ghost">Registrar nota</button>
            </footer>
          </main>
        ) : (
          <main className="glass-card" style={{ padding: 28, display: 'grid', placeItems: 'center', color: 'var(--brand-muted)', textAlign: 'center' }}>
            Selecione uma trilha com clientes ativos para iniciar o onboarding.
          </main>
        )}
      </section>
    </div>
  )
}
