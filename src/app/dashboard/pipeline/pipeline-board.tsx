'use client'

import { useEffect, useMemo, useRef, useState, useCallback, type DragEvent } from 'react'
import Link from 'next/link'
import { Brain, CalendarDays, ChevronRight, ExternalLink, FileText, History, Mail, MessageSquare, Mic, Pencil, Phone, PhoneCall, Plus, Search, Sparkles, TimerReset, Trash2, Target, Upload, Wand2, X, Loader2, UserSearch } from 'lucide-react'
import { toast } from 'sonner'
import { createMeeting } from '@/app/actions/agenda'
import { updateLeadStage, createLead, updateLead, deleteLead } from '@/app/actions/pipeline'
import { createCallLog, type CallOutcome } from '@/app/actions/ligacoes'
import { analyzePipelineAssistant } from '@/app/actions/pipeline-assistant'
import { generateLeadIntelligence, getIntelligenceHistory, getUrgentLeadsActionPlans } from '@/app/actions/intelligence'
import ActionDialog from '@/components/action-dialog'
import { ClientSearchField, type ClienteOption } from '@/components/client-search-field'
import { generateFollowUpSuggestion } from '@/app/actions/pipeline-assistant'
import { saveLeadDocument, getLeadDocuments } from '@/app/actions/pipeline'
import {
  buildPipelineAssistantInsights,
  PIPELINE_ASSISTANT_VERSION,
} from '@/lib/pipeline-assistant'
import { triggerSingleBoom, triggerSaleConfetti } from '@/lib/effects'
import { formatCnpj } from '@/lib/formatters'
import type {
  PipelineAssistantAppliedFilter,
  PipelineAssistantActionResponse,
  PipelineAssistantAnalysisView,
  PipelineAssistantMeta,
  PipelineAssistantPrompt,
  PipelineAssistantStage,
  PipelineLeadSnapshot,
} from '@/lib/pipeline-assistant-contracts'

export type Stage = 'Contato Inicial' | 'Qualificacao' | 'Apresentacao' | 'Proposta' | 'Fechado' | 'Perdido'
export const stages: Stage[] = ['Contato Inicial', 'Qualificacao', 'Apresentacao', 'Proposta', 'Fechado']
type LeadDocument = Awaited<ReturnType<typeof getLeadDocuments>>[number]
type StalledStyle = {
  color: string
  bg: string
  icon: string
  label: string
  fontSize?: string
  fontWeight?: number
  pulse?: boolean
}

const NORMALIZED_STAGE_MAP: Record<string, string> = {
  'Contato Inicial': 'Contato Inicial',
  'Lead': 'Contato Inicial',
  'Qualificação': 'Qualificacao',
  'Qualificacao': 'Qualificacao',
  'Qualificado': 'Qualificacao',
  'Apresentação': 'Apresentacao',
  'Apresentacao': 'Apresentacao',
  'Diagnóstico': 'Apresentacao',
  'Diagnostico': 'Apresentacao',
  'Reunião Agendada': 'Apresentacao',
  'Reunião': 'Apresentacao',
  'Proposta': 'Proposta',
  'Proposta Enviada': 'Proposta',
  'Negociação': 'Proposta',
  'Negociaçãão': 'Proposta',
  'Fechado': 'Fechado',
  'Ganhos': 'Fechado',
  'Vendido': 'Fechado',
  'Venda': 'Fechado',
  'Ganho': 'Fechado',
  'Perdido': 'Perdido'
}

export const stageColors: Record<Stage, string> = {
  'Contato Inicial': '#9ca3af', // cinza
  Qualificacao: '#3b82f6', // azul
  Apresentacao: '#eab308', // amarelo
  Proposta: '#ef4444', // vermelho
  Fechado: '#3b82f6', // azul (conforme solicitado para fechamento)
  Perdido: '#475569',
}

const stageDisplay: Record<Stage, { label: string; detail: string; next: string }> = {
  'Contato Inicial': {
    label: 'Contato Inicial',
    detail: 'Lead frio identificado por pesquisa. Primeiro contato ainda não qualificado.',
    next: 'Ligar, qualificar e avançar para Qualificação.',
  },
  Qualificacao: {
    label: 'Qualificação',
    detail: 'Agendar reunião e confirmar dor e escopo.',
    next: 'Confirmar agenda e validar potencial.',
  },
  Apresentacao: {
    label: 'Apresentação',
    detail: 'Apresentar solução e mapear necessidades.',
    next: 'Documentar pauta e preparar proposta.',
  },
  Proposta: {
    label: 'Proposta',
    detail: 'Enviar proposta formal e agendar follow-up.',
    next: 'Retomar contato e remover objeções.',
  },
  Fechado: {
    label: 'Fechamento',
    detail: 'Contrato encerrado e conta pronta para Clientes.',
    next: 'Encaminhar para a base de Clientes.',
  },
  Perdido: {
    label: 'Perdido',
    detail: 'Oportunidade encerrada fora da conversa ativa.',
    next: 'Registrar aprendizado para reativação.',
  },
}

const CADENCE_DAYS: Record<Stage, number> = {
  'Contato Inicial': 1,
  Qualificacao: 5,
  Apresentacao: 5,
  Proposta: 2,
  Fechado: 999,
  Perdido: 999,
}

export type LeadType = PipelineLeadSnapshot & {
  ai_freshness_minutes?: number | null
  ai_freshness_label?: string
  ai_is_fresh?: boolean
  cnpj?: string | null
  regime_tributario?: string | null
  segmento_especifico?: string | null
  faturamento_estimado?: number | null
  client_id?: string | null
  client_status_label?: string
  contract_status_label?: string | null
  contract_number?: string | null
  contract_valid_until?: string | null
  contract_pdf_name?: string | null
  ai_warning_text?: string | null
  ai_recommended_action?: string | null
}

type LeadMeetingTimeline = {
  id: string
  title: string
  scheduled_for: string
  ends_at: string | null
  location: string | null
  meeting_type: string | null
  status: string
  objective: string | null
  notes: string | null
  next_step: string | null
  next_contact_at: string | null
  owner_name: string
  created_at: string | null
}

type LeadActivityTimeline = {
  id: string
  activity_type: string | null
  subject: string
  agenda: string | null
  summary: string | null
  next_step: string | null
  next_contact_at: string | null
  status: string | null
  created_at: string | null
}

export type LeadTimeline = {
  leadId: string
  meetings: LeadMeetingTimeline[]
  activities: LeadActivityTimeline[]
}

type Option = { id: string; name: string }

type AssistantAnalysisView = PipelineAssistantAnalysisView & {
  meta?: AssistantMeta
}
type AssistantActionResponse = PipelineAssistantActionResponse
type AssistantMeta = PipelineAssistantMeta
type AssistantFilters = {
  scope: 'all' | 'mine'
  productId: string
  stageFilter: Stage[]
  includeClosed: boolean
}

type PipelineBoardProps = {
  initialLeads: LeadType[]
  products: Option[]
  consultants: Option[]
  clientes: ClienteOption[]
  leadTimelines: Array<{ leadId: string; meetings: LeadMeetingTimeline[]; activities: LeadActivityTimeline[] }>
  initialSelectedLeadId?: string | null
  latestAiFreshnessMinutes: number | null
}


const emptyDraft = {
  client_id: '',
  name: '',
  company: '',
  product_id: '',
  consultant_id: '',
  value: '',
  phone: '',
  whatsapp: '',
  email: '',
  cnpj: '',
  regime_tributario: '',
  faturamento_estimado: '',
  segmento_especifico: '',
  ai_status: '',
  ai_score: '',
  ai_source: '',
  ai_summary: '',
  stage: '' as Stage | '',
  next_contact_at: '',
}



function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value || 0)
}

function formatCompactCurrency(value: number) {
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`
  return formatCurrency(value)
}

function addMinutesToDateTimeLocal(value: string, minutes: number) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() + minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getLeadTemperature(lead: LeadType) {
  if (lead.stage === 'Proposta' || lead.stage === 'Fechado') {
    return { label: 'Quente', color: '#f97316', background: 'rgba(249,115,22,0.12)' }
  }
  if (lead.ai_score >= 80) {
    return { label: 'Promissor', color: '#93c5fd', background: 'rgba(96,165,250,0.12)' }
  }
  if (lead.days >= 20) {
    return { label: 'Em risco', color: '#f87171', background: 'rgba(248,113,113,0.12)' }
  }
  return { label: 'Em aquecimento', color: '#86efac', background: 'rgba(34,197,94,0.12)' }
}

function getLeadNextAction(lead: LeadType) {
  if (lead.stage === 'Contato Inicial') return stageDisplay['Contato Inicial'].next
  if (lead.stage === 'Qualificacao') return stageDisplay.Qualificacao.next
  if (lead.stage === 'Apresentacao') return stageDisplay.Apresentacao.next
  if (lead.stage === 'Proposta') return stageDisplay.Proposta.next
  if (lead.stage === 'Fechado') return stageDisplay.Fechado.next
  return stageDisplay.Perdido.next
}

function getPalinIAPrioritizedPlan(lead: LeadType) {
  if (lead.stage === 'Contato Inicial') return '[1º Pesquisar Empresa, 2º Ligar e Qualificar]'
  if (lead.stage === 'Qualificacao') return '[1º Ligar p/ Qualificar, 2º Agendar Reunião]'
  if (lead.stage === 'Apresentacao') return '[1º Preparar Material, 2º Apresentação]'
  if (lead.stage === 'Proposta') return '[1º Ligar urgente, 2º Resolver Objeções e Fechar]'
  return '[1º Retomar Contato, 2º Entender Momento]'
}

function getLeadAttention(lead: LeadType) {
  if (lead.stage === 'Contato Inicial' && lead.days >= 1) return 'URGENTE: Contato Inicial deve ser feito em até 1 dia.'
  if (lead.stage === 'Proposta' && lead.days >= 2) return 'URGENTE: Proposta não pode ficar mais de 2 dias sem envio.'
  if (lead.days >= 30) return 'Lead parado ha mais de 30 dias.'
  if (lead.days >= 15) return 'Vale retomar o contato ainda hoje.'
  if (lead.ai_status === 'revisar') return 'IA pediu revisao antes de avancar.'
  if (lead.ai_status === 'reprovado') return 'Checar aderencia antes de insistir.'
  return 'Fluxo sob controle.'
}

const STAGE_PROBABILITY: Record<Stage, number> = {
  'Contato Inicial': 10,
  Qualificacao: 20,
  Apresentacao: 35,
  Proposta: 60,
  Fechado: 95,
  Perdido: 0,
}

function getStalledDays(timeline: { meetings: LeadMeetingTimeline[]; activities: LeadActivityTimeline[] } | undefined): number | null {
  const candidates: number[] = []
  if (timeline?.activities[0]?.created_at) {
    candidates.push(new Date(timeline.activities[0].created_at).getTime())
  }
  if (timeline?.meetings[0]?.scheduled_for) {
    candidates.push(new Date(timeline.meetings[0].scheduled_for).getTime())
  }
  if (candidates.length === 0) return null
  const latest = Math.max(...candidates)
  return Math.max(0, Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24)))
}

function getDaysSinceContact(lead: LeadType, timeline?: { meetings: LeadMeetingTimeline[]; activities: LeadActivityTimeline[] }): number {
  const stalledDays = getStalledDays(timeline)
  if (stalledDays !== null) return stalledDays;
  
  const candidates: number[] = [];
  if ((lead as any).last_contact_at) candidates.push(new Date((lead as any).last_contact_at).getTime());
  if (lead.ai_updated_at) candidates.push(new Date(lead.ai_updated_at).getTime());
  if ((lead as any).created_at) candidates.push(new Date((lead as any).created_at).getTime());
  
  if (candidates.length > 0) {
    const latest = Math.max(...candidates);
    if (!Number.isNaN(latest)) {
      return Math.max(0, Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24)));
    }
  }
  return typeof lead.days === 'number' ? lead.days : 0;
}

function getStalledStyle(days: number | null, stage: Stage): StalledStyle {
  if (days === null) return { color: '#64748b', bg: 'rgba(100,116,139,0.1)', icon: '○', label: 'Sem contato' }
  const limit = CADENCE_DAYS[stage] || 5
  
  if (days === 0) return { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', icon: '●', label: 'Ativo hoje' }
  if (days <= limit) return { color: '#86efac', bg: 'rgba(34,197,94,0.15)', icon: '●', label: `${days}d - Saudável` }
  
  if (days <= limit * 1.5) {
    return { color: '#fbbf24', bg: 'rgba(251,191,36,0.2)', icon: '⚠', label: `${days}d - Atenção`, fontSize: '0.75rem', fontWeight: 900 }
  }
  
  return { 
    color: '#ef4444', 
    bg: 'rgba(239,68,68,0.25)', 
    icon: '🚨', 
    label: `${days}d - PRECISA DE REAÇÃO`, 
    fontSize: '0.85rem', 
    fontWeight: 950,
    pulse: true 
  }
}

function getClientBadgeStyle(status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('ativo')) {
    return { color: '#86efac', background: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.22)' }
  }
  if (normalized.includes('vencer')) {
    return { color: '#facc15', background: 'rgba(250,204,21,0.12)', border: 'rgba(250,204,21,0.22)' }
  }
  if (normalized.includes('venc')) {
    return { color: '#fca5a5', background: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.22)' }
  }
  if (normalized.includes('pend')) {
    return { color: 'var(--brand-primary)', background: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.22)' }
  }
  return { color: '#93c5fd', background: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.22)' }
}

const assistantPrompts: PipelineAssistantPrompt[] = [
  {
    label: 'Atacar hoje',
    prompt: 'Quais leads devo atacar hoje?',
    hint: 'Foco em oportunidades prontas para contato e avanço.',
  },
  {
    label: 'Fechar agora',
    prompt: 'Quais leads estão mais perto de fechar?',
    hint: 'Prioriza fases quentes com melhor chance de conversão.',
  },
  {
    label: 'Risco',
    prompt: 'Quais leads estão esfriando e precisam de força?',
    hint: 'Mostra aging, travas e sinais de alerta.',
  },
  {
    label: 'Dar força',
    prompt: 'Em quais leads devo dar mais força agora?',
    hint: 'Mistura valor, estágio e score de IA.',
  },
]

function getFreshnessInfo(aiUpdatedAt?: string | null) {
  if (!aiUpdatedAt) {
    return {
      label: 'sem data da IA',
      days: null as number | null,
      score: 0,
      reason: 'sem carimbo de atualizacao da analise',
      isFresh: false,
      isStale: false,
    }
  }

  const updatedAt = new Date(aiUpdatedAt)
  if (Number.isNaN(updatedAt.getTime())) {
    return {
      label: 'data da IA invalida',
      days: null as number | null,
      score: 0,
      reason: 'carimbo de IA nao pode ser lido',
      isFresh: false,
      isStale: false,
    }
  }

  const days = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)))

  if (days <= 2) {
    return {
      label: 'IA muito fresca',
      days,
      score: 10,
      reason: `${days} dia${days === 1 ? '' : 's'} desde a ultima analise`,
      isFresh: true,
      isStale: false,
    }
  }

  if (days <= 7) {
    return {
      label: 'IA fresca',
      days,
      score: 7,
      reason: `${days} dias desde a ultima analise`,
      isFresh: true,
      isStale: false,
    }
  }

  if (days <= 15) {
    return {
      label: 'IA ok',
      days,
      score: 3,
      reason: `${days} dias desde a ultima analise`,
      isFresh: false,
      isStale: false,
    }
  }

  if (days <= 30) {
    return {
      label: 'IA antiga',
      days,
      score: -3,
      reason: `${days} dias desde a ultima analise`,
      isFresh: false,
      isStale: true,
    }
  }

  return {
    label: 'IA desatualizada',
    days,
    score: -7,
    reason: `${days} dias desde a ultima analise`,
    isFresh: false,
    isStale: true,
  }
}


function getAssistantScopeLabel(scope: 'all' | 'mine') {
  return scope === 'mine' ? 'Meus leads' : 'Todos os leads'
}


function getAssistantVisibleLeads(leads: LeadType[], productId: string, stageFilter: Stage[], includeClosed: boolean) {
  return leads.filter((lead) => {
    if (productId && lead.product_id !== productId) return false
    if (stageFilter.length && !stageFilter.includes(lead.stage)) return false
    if (!stageFilter.length && !includeClosed && lead.stage === 'Fechado') return false
    return true
  })
}

function buildAssistantMeta(
  params: {
    query: string
    limit: number
    scope: 'all' | 'mine'
    consultantId?: string | null
    stageFilter: Stage[]
    productId?: string | null
    includeClosed: boolean
  },
  leads: LeadType[],
  analysis: AssistantAnalysisView,
  totalLeads: number
): AssistantMeta {
  const filtersApplied: PipelineAssistantAppliedFilter[] = [
    {
      key: 'scope',
      label: 'Escopo',
      value: params.scope,
      displayValue: getAssistantScopeLabel(params.scope),
      active: true,
      source: 'request',
    },
    {
      key: 'stageFilter',
      label: 'Etapas',
      value: params.stageFilter,
      displayValue: params.stageFilter.length ? params.stageFilter.join(', ') : 'Todas',
      active: params.stageFilter.length > 0,
      source: params.stageFilter.length > 0 ? 'request' : 'default',
    },
    {
      key: 'productId',
      label: 'Produto',
      value: params.productId ?? null,
      displayValue: params.productId || 'Todos',
      active: Boolean(params.productId),
      source: params.productId ? 'request' : 'default',
    },
    {
      key: 'includeClosed',
      label: 'Fechados',
      value: params.includeClosed,
      displayValue: params.includeClosed ? 'Incluidos' : 'Ocultos',
      active: params.includeClosed,
      source: params.includeClosed ? 'request' : 'default',
    },
  ]

  const freshness = leads.reduce(
    (acc, lead) => {
      const info = getFreshnessInfo(lead.ai_updated_at)
      if (info.days !== null && info.days <= 7) acc.freshLeadCount += 1
      if (info.isStale) acc.staleLeadCount += 1
      if (lead.ai_updated_at) {
        const updatedAt = new Date(lead.ai_updated_at)
        if (!Number.isNaN(updatedAt.getTime()) && (!acc.freshestAiUpdatedAt || updatedAt.getTime() > new Date(acc.freshestAiUpdatedAt).getTime())) {
          acc.freshestAiUpdatedAt = lead.ai_updated_at
        }
      }
      return acc
    },
    {
      freshestAiUpdatedAt: null as string | null,
      freshLeadCount: 0,
      staleLeadCount: 0,
    }
  )

  return {
    query: params.query,
    limit: params.limit,
    scope: params.scope,
    consultantId: params.consultantId ?? null,
    stageFilter: params.stageFilter,
    productId: params.productId ?? null,
    includeClosed: params.includeClosed,
    filtersApplied,
    totalLeads,
    filteredLeads: leads.length,
    activeLeads: analysis.totalActive,
    freshness,
    generatedAt: analysis.generatedAt || new Date().toISOString(),
    version: analysis.version,
  }
}

function buildLocalAssistantAnalysis(leads: LeadType[], query: string, meta?: AssistantMeta): AssistantAnalysisView {
  const analysis = buildPipelineAssistantInsights(leads, query, { limit: 5 })
  return {
    source: 'local',
    version: PIPELINE_ASSISTANT_VERSION,
    generatedAt: new Date().toISOString(),
    ...analysis,
    insights: analysis.insights.map((insight) => ({ ...insight, lead: insight.lead as LeadType })),
    meta,
  }
}

function toAssistantAnalysisView(result: AssistantActionResponse): AssistantAnalysisView | null {
  if (!result?.success || !result.analysis || !result.analysis.insights.length) return null

  return {
    source: 'server',
    version: result.version || PIPELINE_ASSISTANT_VERSION,
    generatedAt: result.generatedAt,
    ...result.analysis,
    filters: result.meta?.filtersApplied,
    meta: result.meta,
  }
}

function resolveAssistantAnalysis(
  leads: LeadType[],
  query: string,
  meta: AssistantMeta,
  serverAnalysis?: AssistantAnalysisView | null
): AssistantAnalysisView {
  const fallback = buildLocalAssistantAnalysis(leads, query, meta)

  if (!serverAnalysis) {
    return fallback
  }

  return {
    ...serverAnalysis,
    insights: serverAnalysis.insights.map((insight) => ({
      ...insight,
      lead: insight.lead as LeadType,
    })),
  }
}

export default function PipelineBoard({
  initialLeads,
  products,
  consultants,
  clientes,
  leadTimelines,
  initialSelectedLeadId,
}: PipelineBoardProps) {
  const [leads, setLeads] = useState<LeadType[]>(initialLeads)
  const [draftStage, setDraftStage] = useState<Stage>('Contato Inicial')
  const [showCreateLead, setShowCreateLead] = useState(false)
  const [showEditLead, setShowEditLead] = useState(false)
  const [editingLead, setEditingLead] = useState<LeadType | null>(null)
  const [showContractModal, setShowContractModal] = useState(false)
  const [pendingClosedLead, setPendingClosedLead] = useState<LeadType | null>(null)
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [isUploadingContract, setIsUploadingContract] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedLeadId ?? null)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [draftLead, setDraftLead] = useState({ ...emptyDraft })
  const [meetingDraft, setMeetingDraft] = useState({
    lead_id: '',
    title: '',
    scheduled_for: '',
    ends_at: '',
    location: '',
    meeting_type: 'Presencial',
    objective: '',
    notes: '',
    next_step: '',
    next_contact_at: '',
    owner_profile_id: '',
    requires_logistics: false,
  })
  const [showMeetingFollowUp, setShowMeetingFollowUp] = useState(false)
  const [meetingPautaLoading, setMeetingPautaLoading] = useState(false)
  const [meetingAudioUploading, setMeetingAudioUploading] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantDraft, setAssistantDraft] = useState('Quais leads devo atacar hoje?')
  const [assistantQuestion, setAssistantQuestion] = useState('Quais leads devo atacar hoje?')
  const [assistantFocusedLeadId, setAssistantFocusedLeadId] = useState<string | null>(null)
  const [assistantServerAnalysis, setAssistantServerAnalysis] = useState<AssistantAnalysisView | null>(null)
  const [assistantServerMeta, setAssistantServerMeta] = useState<AssistantMeta | null>(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantFilters, setAssistantFilters] = useState<AssistantFilters>({
    scope: 'all',
    productId: '',
    stageFilter: [],
    includeClosed: false,
  })
  const [timelineState, setTimelineState] = useState<LeadTimeline[]>(leadTimelines || [])
  const [callLogLead, setCallLogLead] = useState<LeadType | null>(null)
  const [callForm, setCallForm] = useState({ outcome: 'atendeu' as CallOutcome, durationMin: '', recordingUrl: '', notes: '' })
  const [callPending, setCallPending] = useState(false)
  const [activeTab, setActiveTab] = useState<'history' | 'intelligence' | 'followup' | 'documents'>('history')
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([])
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [leadDocs, setLeadDocs] = useState<LeadDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  type IntelligenceRecord = {
    id: string
    created_at: string
    full_markdown?: string
    report_json?: {
      score?: string | number
      prioridade?: string
      match_icp?: string | number
      prospeccao_qualificacao?: string
      estrutura_pipeline_crm?: string
      gancho_proxima_reuniao?: string
      kpis_metas_valor?: string
      potencial_financeiro_detalhado?: string
      pos_venda_retencao?: string
      dor_principal?: string
    }
  }
  const [intelligenceRecords, setIntelligenceRecords] = useState<IntelligenceRecord[]>([])
  const [intelligenceLoading, setIntelligenceLoading] = useState(false)
  const [urgentActionPlans, setUrgentActionPlans] = useState<Record<string, any>>({})
  const [archivedContracts, setArchivedContracts] = useState<Set<string>>(new Set())
  const initialSelectedLeadAppliedRef = useRef<string | null>(null)

  const getLeadsByStage = (stage: Stage) => leads.filter((lead) => {
    const normalized = NORMALIZED_STAGE_MAP[lead.stage || ''] || lead.stage
    return normalized === stage
  })
  const assistantVisibleLeads = useMemo(
    () => getAssistantVisibleLeads(leads, assistantFilters.productId, assistantFilters.stageFilter, assistantFilters.includeClosed),
    [assistantFilters.includeClosed, assistantFilters.productId, assistantFilters.stageFilter, leads]
  )
  const assistantMeta = useMemo(() => {
    if (assistantServerMeta) return assistantServerMeta

    const localAnalysis = buildLocalAssistantAnalysis(assistantVisibleLeads, assistantQuestion)
    return buildAssistantMeta({
      query: assistantQuestion,
      limit: 5,
      scope: assistantFilters.scope,
      consultantId: null,
      stageFilter: assistantFilters.stageFilter,
      productId: assistantFilters.productId || null,
      includeClosed: assistantFilters.includeClosed,
    }, assistantVisibleLeads, localAnalysis, leads.length)
  }, [assistantQuestion, assistantFilters.includeClosed, assistantFilters.productId, assistantFilters.scope, assistantFilters.stageFilter, assistantServerMeta, assistantVisibleLeads, leads.length])
  const assistantAnalysis = useMemo(
    () => resolveAssistantAnalysis(assistantVisibleLeads, assistantQuestion, assistantMeta, assistantServerAnalysis),
    [assistantQuestion, assistantMeta, assistantServerAnalysis, assistantVisibleLeads]
  )
  const assistantTopLead = assistantAnalysis.insights[0] ?? null
  const assistantRecommendationMap = useMemo(
    () => new Map(assistantAnalysis.insights.map((insight) => [insight.lead.id, insight])),
    [assistantAnalysis.insights]
  )
  const leadTimelineMap = useMemo(
    () => new Map(timelineState.map((item) => [item.leadId, item])),
    [timelineState]
  )
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId]
  )
  const selectedLeadTimeline = useMemo(
    () => (selectedLeadId ? leadTimelineMap.get(selectedLeadId) || null : null),
    [leadTimelineMap, selectedLeadId]
  )

  useEffect(() => {
    setTimelineState(leadTimelines)
  }, [leadTimelines])


  useEffect(() => {
    setSelectedLeadId(initialSelectedLeadId ?? null)

    if (!initialSelectedLeadId) {
      initialSelectedLeadAppliedRef.current = null
      return
    }

    if (initialSelectedLeadAppliedRef.current === initialSelectedLeadId) {
      return
    }

    initialSelectedLeadAppliedRef.current = initialSelectedLeadId

    window.requestAnimationFrame(() => {
      document.getElementById(`lead-card-${initialSelectedLeadId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      })
    })
  }, [initialSelectedLeadId])

  const handleDragStart = (event: DragEvent, leadId: string) => {
    event.dataTransfer.setData('leadId', leadId)
  }

  const handleGenerateFollowUp = async (leadId: string) => {
    setFollowUpLoading(true)
    try {
      const result = await generateFollowUpSuggestion(leadId)
      if (result.success) {
        setFollowUpSuggestions(result.suggestions || [])
      }
    } catch (error) {
      console.error('Erro ao gerar follow-up:', error)
    } finally {
      setFollowUpLoading(false)
    }
  }

  const handleFetchDocuments = async (leadId: string) => {
    setDocsLoading(true)
    try {
      const docs = await getLeadDocuments(leadId)
      setLeadDocs(docs || [])
    } catch (error) {
      console.error('Erro ao buscar documentos:', error)
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDrop = async (event: DragEvent, newStage: Stage) => {
    event.preventDefault()
    const leadId = event.dataTransfer.getData('leadId')
    const currentLead = leads.find((lead) => lead.id === leadId)

    if (!currentLead || currentLead.stage === newStage) return

    const isBackwards = stages.indexOf(newStage) < stages.indexOf(currentLead.stage as Stage)

    if (newStage === 'Fechado') {
      setPendingClosedLead(currentLead)
      setShowContractModal(true)
      return
    }

    setLeads((previous) => previous.map((lead) => (lead.id === leadId ? { ...lead, stage: newStage } : lead)))

    const result = await updateLeadStage(leadId, newStage)
    if (!result.success) {
      setLeads((previous) => previous.map((lead) => (lead.id === leadId ? { ...lead, stage: currentLead.stage } : lead)))
      toast.error('Falha ao mover lead', { description: result.error })
      return
    }

    // Feedback visual de vitória
    if (isBackwards) {
      toast.warning('Auditoria Solicitada', { description: 'O gestor foi notificado para realizar uma auditoria sobre o retorno deste lead.' })
    } else {
      triggerSingleBoom()
    }

    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    toast.success('Lead atualizado', { description: `${currentLead.name} foi movido para ${newStage}.` })
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
  }

  const handleRunAssistant = useCallback(async (question?: string) => {
    const nextQuestion = (question ?? assistantDraft).trim()
    const safeQuestion = nextQuestion || 'Quais leads devo atacar hoje?'
    setAssistantDraft(safeQuestion)
    setAssistantQuestion(safeQuestion)
    setAssistantOpen(true)

    setAssistantLoading(true)
    try {
      const result = await analyzePipelineAssistant({
        query: safeQuestion,
        limit: 5,
        scope: assistantFilters.scope,
        productId: assistantFilters.productId || null,
        stageFilter: assistantFilters.stageFilter as PipelineAssistantStage[],
        includeClosed: assistantFilters.includeClosed,
      })
      const nextAnalysis = toAssistantAnalysisView(result)

      if (nextAnalysis) {
        setAssistantServerAnalysis(nextAnalysis)
        setAssistantServerMeta(nextAnalysis.meta || null)
      } else {
        setAssistantServerAnalysis(null)
        setAssistantServerMeta(null)

        if (!result.success) {
          toast.info('Assistente usando fallback local', {
            description: result.error || 'Nao foi possivel consultar o servidor agora.',
          })
        }
      }
    } catch (error) {
      setAssistantServerAnalysis(null)
      setAssistantServerMeta(null)
      toast.info('Assistente usando fallback local', {
        description: error instanceof Error ? error.message : 'Nao foi possivel consultar o servidor agora.',
      })
    } finally {
      setAssistantLoading(false)
    }
  }, [assistantDraft, assistantFilters.scope, assistantFilters.productId, assistantFilters.stageFilter, assistantFilters.includeClosed])

  useEffect(() => {
    const handleNewLead = () => {
      setDraftLead({ ...emptyDraft })
      setShowCreateLead(true)
    }
    const handleOpenAssistant = () => {
      handleRunAssistant()
    }

    window.addEventListener('pipeline-new-lead', handleNewLead)
    window.addEventListener('pipeline-assistant-open', handleOpenAssistant)

    return () => {
      window.removeEventListener('pipeline-new-lead', handleNewLead)
      window.removeEventListener('pipeline-assistant-open', handleOpenAssistant)
    }
  }, [handleRunAssistant])

  const updateAssistantFilters = (nextFilters: Partial<AssistantFilters>) => {
    setAssistantFilters((current) => ({ ...current, ...nextFilters }))
    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
  }

  const toggleAssistantStage = (stage: Stage) => {
    const nextStageFilter = assistantFilters.stageFilter.includes(stage)
      ? assistantFilters.stageFilter.filter((item) => item !== stage)
      : [...assistantFilters.stageFilter, stage]

    updateAssistantFilters({
      stageFilter: nextStageFilter,
      includeClosed: nextStageFilter.includes('Fechado'),
    })
  }

  const focusAssistantLead = (leadId: string) => {
    setAssistantFocusedLeadId(leadId)
    const element = document.getElementById(`lead-card-${leadId}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }

  const handleContactAction = (channel: 'telefone' | 'whatsapp' | 'email', lead: LeadType) => {
    if (channel === 'telefone') {
      if (lead.phone) {
        window.open(`tel:${lead.phone}`)
      } else {
        toast.info('Telefone nao cadastrado', { description: `${lead.name} nao possui telefone registrado.` })
      }
    } else if (channel === 'whatsapp') {
      const number = lead.whatsapp || lead.phone
      if (number) {
        const clean = number.replace(/\D/g, '')
        window.open(`https://wa.me/55${clean}`, '_blank')
      } else {
        toast.info('WhatsApp nao cadastrado', { description: `${lead.name} nao possui numero registrado.` })
      }
    } else {
      if (lead.email) {
        window.open(`mailto:${lead.email}`)
      } else {
        toast.info('E-mail nao cadastrado', { description: `${lead.name} nao possui e-mail registrado.` })
      }
    }
  }

  async function handleSaveCallLog() {
    if (!callLogLead) return
    setCallPending(true)
    try {
      const phone = callLogLead.phone || callLogLead.whatsapp || undefined
      const result = await createCallLog({
        leadId: callLogLead.id,
        phone,
        callType: 'goto_connect',
        outcome: callForm.outcome,
        durationMin: callForm.durationMin ? Number(callForm.durationMin) : null,
        recordingUrl: callForm.recordingUrl.trim() || null,
        notes: callForm.notes.trim() || null,
      })
      if (!result.success) {
        toast.error(result.error || 'Erro ao registrar ligacao.')
        return
      }
      toast.success('Ligacao registrada.')
      setCallLogLead(null)
      setCallForm({ outcome: 'atendeu', durationMin: '', recordingUrl: '', notes: '' })
    } finally {
      setCallPending(false)
    }
  }

  const openLeadTimeline = (lead: LeadType) => {
    setActiveTab('history')
    setSelectedLeadId(lead.id)
    void handleFetchIntelligence(lead.id)
  }

  const openIntelligence = (lead: LeadType) => {
    setActiveTab('intelligence')
    setSelectedLeadId(lead.id)
    void handleFetchIntelligence(lead.id)
  }

  async function handleFetchIntelligence(leadId: string) {
    setIntelligenceRecords([])
    const history = await getIntelligenceHistory(leadId)
    setIntelligenceRecords(history || [])
  }

  async function handleGenerateIntelligence(leadId: string) {
    setIntelligenceLoading(true)
    try {
      const result = await generateLeadIntelligence(leadId)
      if (result.success) {
        toast.success('Inteligência gerada com sucesso!')
        void handleFetchIntelligence(leadId)
        if (result.data) {
          setLeads(current => current.map(l => 
            l.id === leadId ? { 
              ...l, 
              ai_score: result.data.score || l.ai_score, 
              ai_status: 'avaliado', 
              ai_summary: result.data.dor_principal || result.data.prioridade || 'Análise concluída.'
            } : l
          ))
        }
      } else {
        toast.error('Erro ao gerar inteligência', { description: result.error })
      }
    } finally {
      setIntelligenceLoading(false)
    }
  }

  const openLeadMeeting = (lead: LeadType) => {
    setSelectedLeadId(lead.id)
    setMeetingDraft({
      lead_id: lead.id,
      title: `Reunião com ${lead.name}`,
      scheduled_for: '',
      ends_at: '',
      location: '',
      meeting_type: 'Presencial',
      objective: `Acompanhar a etapa ${stageDisplay[lead.stage].label.toLowerCase()} e registrar a pauta do lead.`,
      notes: '',
      next_step: '',
      next_contact_at: '',
      owner_profile_id: lead.consultant_id || '',
      requires_logistics: false,
    })
    setShowMeetingFollowUp(false)
    setMeetingOpen(true)
  }

  const closeLeadTimeline = () => {
    setSelectedLeadId(null)
  }

  async function handleGenerateMeetingPauta() {
    const lead = leads.find((item) => item.id === meetingDraft.lead_id)
    setMeetingPautaLoading(true)
    try {
      const response = await fetch('/api/assistant/pauta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: lead?.name || meetingDraft.title || 'Lead', recordingLink: '', additionalContext: meetingDraft.title || '' }),
      })
      const data = await response.json() as { pauta?: string; error?: string }
      if (!response.ok || data.error) { toast.error(data.error || 'Erro ao gerar pauta.'); return }
      setMeetingDraft((current) => ({ ...current, objective: data.pauta || current.objective }))
      toast.success('Pauta gerada pela IA. Revise antes de salvar.')
    } catch {
      toast.error('Falha ao conectar com a IA.')
    } finally {
      setMeetingPautaLoading(false)
    }
  }

  async function handleUploadMeetingRecording(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setMeetingAudioUploading(true)
    try {
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('lead_id', meetingDraft.lead_id || '')
      const response = await fetch('/api/meetings/transcribe', { method: 'POST', body: formData })
      const data = await response.json() as {
        transcription?: string
        transcript?: string
        text?: string
        pauta?: string
        summary?: string
        action_items?: string[] | string
        next_steps?: string[] | string
        next_step?: string
        error?: string
      }
      if (!response.ok || data.error) { toast.error(data.error || 'Erro ao transcrever a gravação.'); return }
      const actionItems = Array.isArray(data.action_items) ? data.action_items : data.action_items ? [data.action_items] : []
      const nextSteps = Array.isArray(data.next_steps) ? data.next_steps : data.next_steps ? [data.next_steps] : []
      const normalizedAgenda = data.pauta || data.transcription || data.transcript || data.text || ''
      const normalizedNextSteps = data.next_step || [...actionItems, ...nextSteps].filter(Boolean).join('\n')

      setMeetingDraft((current) => ({
        ...current,
        objective: current.objective || normalizedAgenda,
        notes: data.summary ? (current.notes ? `${current.notes}\n\nResumo da conversa:\n${data.summary}` : `Resumo da conversa:\n${data.summary}`) : current.notes,
        next_step: normalizedNextSteps || current.next_step,
      }))
      setShowMeetingFollowUp(true)
      toast.success('Gravação transcrita e resumida pela IA!')
    } catch {
      toast.error('Falha ao enviar o arquivo.')
    } finally {
      setMeetingAudioUploading(false)
      event.target.value = ''
    }
  }

  async function handleCreateLeadMeeting() {
    const lead = leads.find((item) => item.id === meetingDraft.lead_id)
    if (!lead) {
      toast.error('Selecione um lead para a reunião.')
      return
    }
    if (!meetingDraft.title.trim() || !meetingDraft.scheduled_for) {
      toast.error('Preencha titulo e data da reunião.')
      return
    }

    const result = await createMeeting({
      title: meetingDraft.title.trim(),
      scheduled_for: meetingDraft.scheduled_for,
      ends_at: meetingDraft.ends_at || null,
      location: meetingDraft.location || null,
      meeting_type: meetingDraft.meeting_type || 'Presencial',
      status: 'agendada',
      objective: meetingDraft.objective || null,
      notes: meetingDraft.notes || null,
      lead_id: lead.id,
      lead_name: lead.name,
      company_name: lead.company || null,
      next_step: meetingDraft.next_step || null,
      next_contact_at: meetingDraft.next_contact_at || null,
      owner_profile_id: meetingDraft.owner_profile_id || lead.consultant_id || null,
      requires_logistics: meetingDraft.requires_logistics,
    })

    if (!result.success) {
      toast.error('Erro ao criar reunião', { description: result.error })
      return
    }

    const owner = consultants.find((consultant) => consultant.id === (meetingDraft.owner_profile_id || lead.consultant_id))
    const nextMeeting: LeadMeetingTimeline = {
      id: result.data?.id || `local-${Date.now()}`,
      title: meetingDraft.title.trim(),
      scheduled_for: meetingDraft.scheduled_for,
      ends_at: meetingDraft.ends_at || null,
      location: meetingDraft.location || null,
      meeting_type: meetingDraft.meeting_type || 'Presencial',
      status: 'agendada',
      objective: meetingDraft.objective || null,
      notes: meetingDraft.notes || null,
      next_step: meetingDraft.next_step || null,
      next_contact_at: meetingDraft.next_contact_at || null,
      owner_name: owner?.name || lead.consultant || 'Sem responsavel',
      created_at: new Date().toISOString(),
    }

    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    setMeetingOpen(false)
    setShowMeetingFollowUp(false)
    setSelectedLeadId(lead.id)
    setMeetingDraft((current) => ({
      ...current,
      title: '',
      scheduled_for: '',
      ends_at: '',
      location: '',
      objective: '',
      notes: '',
      next_step: '',
      next_contact_at: '',
      requires_logistics: false,
    }))

    setTimelineState((current) => {
      const nextActivity: LeadActivityTimeline = {
        id: `local-activity-${Date.now()}`,
        activity_type: 'reuniao',
        subject: nextMeeting.title,
        agenda: nextMeeting.objective,
        summary: nextMeeting.notes,
        next_step: nextMeeting.next_step,
        next_contact_at: nextMeeting.next_contact_at,
        status: 'agendada',
        created_at: nextMeeting.created_at,
      }
      const leadTimeline = current.find((item) => item.leadId === lead.id)
      if (!leadTimeline) {
        return [
          {
            leadId: lead.id,
            meetings: [nextMeeting],
            activities: [nextActivity],
          },
          ...current,
        ]
      }

      return current.map((item) => {
        if (item.leadId !== lead.id) return item
        return {
          ...item,
          meetings: [nextMeeting, ...item.meetings],
          activities: [nextActivity, ...item.activities],
        }
      })
    })

    toast.success('Reunião registrada no lead e na Agenda.')
  }

  function openCreateLead(stage: Stage) {
    setDraftStage(stage)
    setDraftLead({ ...emptyDraft })
    setShowAdvancedFields(false)
    setShowCreateLead(true)
  }

  function openEditLead(lead: LeadType) {
    const linkedClient = lead.client_id ? clientes.find((cliente) => cliente.id === lead.client_id) : null
    const leadCnpj = formatCnpj(lead.cnpj || linkedClient?.documento || '')
    setEditingLead(lead)
    setShowAdvancedFields(Boolean(leadCnpj || lead.regime_tributario || lead.faturamento_estimado || lead.segmento_especifico))
    setDraftLead({
      name: lead.name,
      company: lead.company,
      product_id: lead.product_id,
      consultant_id: lead.consultant_id,
      value: String(lead.value),
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      cnpj: leadCnpj,
      client_id: lead.client_id || '',
      regime_tributario: (lead as LeadType & { regime_tributario?: string }).regime_tributario ?? '',
      next_contact_at: '',
      faturamento_estimado: (lead as LeadType & { faturamento_estimado?: number }).faturamento_estimado != null
        ? String((lead as LeadType & { faturamento_estimado?: number }).faturamento_estimado)
        : '',
      segmento_especifico: (lead as LeadType & { segmento_especifico?: string }).segmento_especifico ?? '',
      ai_status: lead.ai_status,
      ai_score: lead.ai_score ? String(lead.ai_score) : '',
      ai_source: lead.ai_source,
      ai_summary: lead.ai_summary,
      stage: lead.stage,
    })
    setShowEditLead(true)
  }

  async function handleCreateLead() {
    if (!draftLead.name.trim()) {
      toast.error('Informe pelo menos o nome do lead.')
      return
    }

    const result = await createLead({
      name: draftLead.name.trim(),
      company: draftLead.company.trim(),
      product_id: draftLead.product_id,
      consultant_id: draftLead.consultant_id,
      expected_value: Number(draftLead.value) || 0,
      stage: draftLead.stage || draftStage,
      phone: draftLead.phone.trim(),
      whatsapp: draftLead.whatsapp.trim(),
      email: draftLead.email.trim(),
      ai_status: draftLead.ai_status,
      ai_score: Number(draftLead.ai_score) || 0,
      ai_source: draftLead.ai_source.trim(),
      ai_summary: draftLead.ai_summary.trim(),
      cnpj: formatCnpj(draftLead.cnpj),
      client_id: draftLead.client_id || null,
      regime_tributario: draftLead.regime_tributario,
      faturamento_estimado: Number(draftLead.faturamento_estimado) || 0,
      segmento_especifico: draftLead.segmento_especifico.trim(),
    })

    if (!result.success) {
      toast.error('Erro ao criar lead', { description: result.error })
      return
    }

    const product = products.find((p) => p.id === draftLead.product_id)
    const consultant = consultants.find((c) => c.id === draftLead.consultant_id)

    const newLead: LeadType = {
      id: result.lead?.id || `local-${Date.now()}`,
      name: draftLead.name.trim(),
      company: draftLead.company.trim(),
      product: product?.name || 'Geral',
      product_id: draftLead.product_id,
      consultant: consultant?.name?.split(' ')[0] || 'Time Palin',
      consultant_id: draftLead.consultant_id,
      value: Number(draftLead.value) || 0,
      days: 0,
      stage: draftLead.stage || draftStage,
      phone: draftLead.phone.trim(),
      whatsapp: draftLead.whatsapp.trim(),
      email: draftLead.email.trim(),
      cnpj: formatCnpj(draftLead.cnpj),
      client_id: draftLead.client_id || undefined,
      regime_tributario: draftLead.regime_tributario,
      faturamento_estimado: Number(draftLead.faturamento_estimado) || null,
      segmento_especifico: draftLead.segmento_especifico.trim(),
      ai_status: draftLead.ai_status,
      ai_score: Number(draftLead.ai_score) || 0,
      ai_source: draftLead.ai_source.trim(),
      ai_summary: draftLead.ai_summary.trim(),
    }

    setLeads((current) => [newLead, ...current])
    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    setShowCreateLead(false)
    toast.success('Lead criado e salvo no sistema.')
  }

  async function handleEditLead() {
    if (!editingLead) return

    const result = await updateLead(editingLead.id, {
      name: draftLead.name.trim(),
      company: draftLead.company.trim(),
      product_id: draftLead.product_id || undefined,
      consultant_id: draftLead.consultant_id || undefined,
      expected_value: Number(draftLead.value) || 0,
      phone: draftLead.phone.trim(),
      whatsapp: draftLead.whatsapp.trim(),
      email: draftLead.email.trim(),
      ai_status: draftLead.ai_status,
      ai_score: Number(draftLead.ai_score) || 0,
      ai_source: draftLead.ai_source.trim(),
      ai_summary: draftLead.ai_summary.trim(),
      cnpj: formatCnpj(draftLead.cnpj),
      regime_tributario: draftLead.regime_tributario,
      faturamento_estimado: Number(draftLead.faturamento_estimado) || 0,
      segmento_especifico: draftLead.segmento_especifico.trim(),
    })

    if (!result.success) {
      toast.error('Erro ao atualizar lead', { description: result.error })
      return
    }

    // Se o estágio mudou manualmente no form, chama o updateLeadStage para disparar os efeitos colaterais
    if (draftLead.stage && draftLead.stage !== editingLead.stage) {
      await updateLeadStage(editingLead.id, draftLead.stage as Stage)
    }
    
    const product = products.find((p) => p.id === draftLead.product_id)
    const consultant = consultants.find((c) => c.id === draftLead.consultant_id)

    setLeads((current) =>
      current.map((lead) =>
        lead.id === editingLead.id
          ? {
              ...lead,
              name: draftLead.name.trim(),
              company: draftLead.company.trim(),
              product: product?.name || lead.product,
              product_id: draftLead.product_id,
              consultant: consultant?.name?.split(' ')[0] || lead.consultant,
              consultant_id: draftLead.consultant_id,
              value: Number(draftLead.value) || 0,
              stage: (draftLead.stage as Stage) || lead.stage,
              phone: draftLead.phone.trim(),
              whatsapp: draftLead.whatsapp.trim(),
              email: draftLead.email.trim(),
              cnpj: formatCnpj(draftLead.cnpj),
              regime_tributario: draftLead.regime_tributario,
              faturamento_estimado: Number(draftLead.faturamento_estimado) || null,
              segmento_especifico: draftLead.segmento_especifico.trim(),
              ai_status: draftLead.ai_status,
              ai_score: Number(draftLead.ai_score) || 0,
              ai_source: draftLead.ai_source.trim(),
              ai_summary: draftLead.ai_summary.trim(),
            }
          : lead
      )
    )

    setShowEditLead(false)
    setEditingLead(null)
    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    toast.success('Lead atualizado com sucesso.')
  }

  async function handleDeleteLead(lead: LeadType) {
    const result = await deleteLead(lead.id)
    if (!result.success) {
      toast.error('Erro ao remover lead', { description: result.error })
      return
    }
    setLeads((current) => current.filter((l) => l.id !== lead.id))
    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    toast.success(`${lead.name} removido do fluxo.`)
  }

  const priorityLeads = useMemo(() => {
    const leadsWithData = leads.map(lead => {
      const daysSinceContact = getDaysSinceContact(lead, leadTimelineMap.get(lead.id))
      const overdueDays = daysSinceContact - (CADENCE_DAYS[lead.stage] || 999)
      const isUrgent = ['Proposta'].includes(lead.stage || '')
      return { lead, overdueDays, isUrgent }
    }).filter(item => item.overdueDays > 0 || item.isUrgent)

    const sorted = leadsWithData.sort((a, b) => {
      if (a.isUrgent && !b.isUrgent) return -1
      if (!a.isUrgent && b.isUrgent) return 1
      return b.overdueDays - a.overdueDays
    })

    const grouped = {} as Record<string, typeof sorted>
    for (const item of sorted) {
      const stage = item.lead.stage as string
      if (!grouped[stage]) grouped[stage] = []
      if (grouped[stage].length < 15) grouped[stage].push(item)
    }

    return Object.values(grouped).flat().map(item => item.lead)
  }, [leads, leadTimelineMap])

  useEffect(() => {
    if (priorityLeads.length > 0) {
      const ids = priorityLeads.map(l => l.id)
      getUrgentLeadsActionPlans(ids).then(plans => {
        setUrgentActionPlans(plans)
      }).catch(err => {
        console.error('Erro ao buscar action plans de urgência:', err)
      })
    } else {
      setUrgentActionPlans({})
    }
  }, [priorityLeads])

  const isContatoInicial = !draftLead.stage || draftLead.stage === 'Contato Inicial'

  // CNPJ: se o lead já tem client_id, usa o documento do cliente (auto-preenchido)
  const linkedEditingClient = editingLead?.client_id ? clientes.find((cliente) => cliente.id === editingLead.client_id) : null
  const clientCnpj = formatCnpj(editingLead?.cnpj || linkedEditingClient?.documento || '')

  const leadFormFields = (
    <div style={{ display: 'grid', gap: '12px' }}>

      {!editingLead && (
        <label style={{ display: 'grid', gap: '6px' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 700 }}>Ja e cliente cadastrado?</span>
          <ClientSearchField
            clientes={clientes}
            selected={null}
            onSelect={(cliente) => setDraftLead((c) => ({
              ...c,
              name: cliente.nome,
              company: cliente.company_name || c.company,
              email: cliente.email || c.email,
              phone: cliente.phone || c.phone,
              client_id: cliente.id,
              cnpj: formatCnpj(cliente.documento || c.cnpj),
            }))}
            onClear={() => {}}
            placeholder="Buscar cliente cadastrado para preencher automaticamente"
          />
        </label>
      )}

      {/* BLOCO 1: Identificação — sempre visível */}
      <input
        className="input-field"
        placeholder="Nome do contato *"
        value={draftLead.name}
        onChange={(e) => setDraftLead((c) => ({ ...c, name: e.target.value }))}
      />
      <input
        className="input-field"
        placeholder="Empresa"
        value={draftLead.company}
        onChange={(e) => setDraftLead((c) => ({ ...c, company: e.target.value }))}
      />

      {/* BLOCO 2: Contato — sempre visível */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <input
          className="input-field"
          placeholder="Telefone / Ligação"
          value={draftLead.phone}
          onChange={(e) => setDraftLead((c) => ({ ...c, phone: e.target.value }))}
        />
        <input
          className="input-field"
          placeholder="WhatsApp"
          value={draftLead.whatsapp}
          onChange={(e) => setDraftLead((c) => ({ ...c, whatsapp: e.target.value }))}
        />
      </div>

      {/* BLOCO 3: Consultor + Produto — sempre visível */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <select
          className="input-field"
          value={draftLead.consultant_id}
          onChange={(e) => setDraftLead((c) => ({ ...c, consultant_id: e.target.value }))}
          style={{ background: 'var(--brand-surface)', color: draftLead.consultant_id ? '#e2e8f0' : '#64748b' }}
        >
          <option value="">Consultor responsável</option>
          {consultants.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="input-field"
          value={draftLead.product_id}
          onChange={(e) => setDraftLead((c) => ({ ...c, product_id: e.target.value }))}
          style={{ background: 'var(--brand-surface)', color: draftLead.product_id ? '#e2e8f0' : '#64748b' }}
        >
          <option value="">Produto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* BLOCO 4: Próximo contato — sempre visível, foco no acompanhamento */}
      <div style={{ display: 'grid', gap: '6px' }}>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📅 Próximo contato
        </div>
        <input
          className="input-field"
          type="datetime-local"
          value={draftLead.next_contact_at}
          onChange={(e) => setDraftLead((c) => ({ ...c, next_contact_at: e.target.value }))}
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {/* BLOCO 5: Observações — sempre visível, compacto */}
      <textarea
        className="input-field"
        placeholder={isContatoInicial ? 'Observações do contato (origem, interesse, dor mencionada...)' : 'Informações / Observações livres'}
        value={draftLead.ai_summary}
        onChange={(e) => setDraftLead((c) => ({ ...c, ai_summary: e.target.value }))}
        style={{ minHeight: '72px', resize: 'vertical' }}
      />

      {/* BLOCO 6: Etapa — sempre visível */}
      <select
        className="input-field"
        value={draftLead.stage}
        onChange={(e) => setDraftLead((c) => ({ ...c, stage: e.target.value as Stage }))}
        style={{ background: 'var(--brand-surface)', color: draftLead.stage ? '#e2e8f0' : '#64748b' }}
      >
        <option value="">Etapa (padrão: Contato Inicial)</option>
        {stages.map((s) => <option key={s} value={s}>{stageDisplay[s].label}</option>)}
        <option value="Perdido">Perdido</option>
      </select>

      {/* BLOCO 7: Dados avançados — colapsável, só mostra CNPJ automático se houver */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
        <button
          type="button"
          onClick={() => setShowAdvancedFields((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.7rem',
            color: '#64748b',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: 0,
          }}
        >
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showAdvancedFields ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          {showAdvancedFields ? 'Ocultar dados tributários' : 'Dados tributários (CNPJ, regime...)'}
        </button>

        {showAdvancedFields && (
          <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  placeholder="CNPJ"
                  value={formatCnpj(draftLead.cnpj || clientCnpj)}
                  onChange={(e) => setDraftLead((c) => ({ ...c, cnpj: formatCnpj(e.target.value) }))}
                />
                {clientCnpj && !draftLead.cnpj && (
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.6rem', color: '#86efac', fontWeight: 800 }}>✓ CLIENTE</span>
                )}
              </div>
              <select
                className="input-field"
                value={draftLead.regime_tributario}
                onChange={(e) => setDraftLead((c) => ({ ...c, regime_tributario: e.target.value }))}
                style={{ background: 'var(--brand-surface)' }}
              >
                <option value="">Regime Tributário</option>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
                <option value="Produtor Rural">Produtor Rural</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <input
                className="input-field"
                placeholder="Faturamento Anual (R$)"
                type="number"
                value={draftLead.faturamento_estimado}
                onChange={(e) => setDraftLead((c) => ({ ...c, faturamento_estimado: e.target.value }))}
              />
              <input
                className="input-field"
                placeholder="Segmento / CNAE"
                value={draftLead.segmento_especifico}
                onChange={(e) => setDraftLead((c) => ({ ...c, segmento_especifico: e.target.value }))}
              />
            </div>
            <input
              className="input-field"
              placeholder="E-mail"
              type="email"
              value={draftLead.email}
              onChange={(e) => setDraftLead((c) => ({ ...c, email: e.target.value }))}
            />
          </div>
        )}
      </div>

      {/* BLOCO 8: Diário de voz */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => {
            if (isVoiceRecording) {
              setIsVoiceRecording(false)
              const mockTranscription = '\n[CAMPO]: Cliente demonstrou interesse. Registrar próxima ação.'
              setDraftLead((prev) => ({ ...prev, ai_summary: (prev.ai_summary || '') + mockTranscription }))
            } else {
              setIsVoiceRecording(true)
            }
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: isVoiceRecording ? '#ef4444' : '#64748b' }}
        >
          <Mic size={13} style={{ color: isVoiceRecording ? '#ef4444' : 'var(--brand-primary)' }} />
          {isVoiceRecording ? 'Parar gravação' : 'Diário de voz'}
        </button>
      </div>
    </div>
  )

  async function handleConfirmContractUpload() {
    if (!pendingClosedLead) return
    setIsUploadingContract(true)
    
    // Simulate upload
    if (contractFile) {
      await new Promise(r => setTimeout(r, 1500))
    }

    const leadId = pendingClosedLead.id
    const newStage = 'Fechado'
    
    setLeads((previous) => previous.map((lead) => (lead.id === leadId ? { ...lead, stage: newStage } : lead)))

    const result = await updateLeadStage(leadId, newStage)
    
    setIsUploadingContract(false)
    setShowContractModal(false)
    setContractFile(null)
    setPendingClosedLead(null)

    if (!result.success) {
      setLeads((previous) => previous.map((lead) => (lead.id === leadId ? { ...lead, stage: pendingClosedLead.stage } : lead)))
      toast.error('Falha ao mover lead', { description: result.error })
      return
    }

    const isRural = /rural|cat 153|agronegocio/i.test(pendingClosedLead.name || '')
    triggerSaleConfetti(isRural)
    setAssistantServerAnalysis(null)
    setAssistantServerMeta(null)
    toast.success('Lead Fechado!', { description: `${pendingClosedLead.name} foi movido para Fechado e o contrato anexado.` })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <Link
          href="/dashboard/perfil-cliente"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'var(--brand-primary)',
            color: '#1e293b',
            fontSize: '0.8rem',
            fontWeight: 800,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          <UserSearch size={16} />
          Perfil Cliente
        </Link>
      </div>

      {/* Ações Prioritárias */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Wand2 size={20} color="#f59e0b" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#e2e8f0', letterSpacing: '0.02em' }}>Atenção Requerida</h2>
          <span style={{ padding: '4px 10px', borderRadius: '99px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 800 }}>
            {priorityLeads.length} leads
          </span>
        </div>
        
        {priorityLeads.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {['Proposta', 'Apresentacao', 'Qualificacao', 'Contato Inicial'].map(stageGroup => {
              const stageLeads = priorityLeads.filter(l => l.stage === stageGroup);
              if (stageLeads.length === 0) return null;
              
              return (
                <div key={stageGroup} style={{ background: 'rgba(15,23,42,0.4)', padding: '16px', borderRadius: '12px', border: `1px solid ${stageColors[stageGroup as Stage]}20` }}>
                  <div style={{ fontSize: '0.85rem', color: stageColors[stageGroup as Stage], fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stageColors[stageGroup as Stage] }}></div>
                    {stageDisplay[stageGroup as Stage]?.label || stageGroup} ({stageLeads.length})
                  </div>
                  <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px', scrollSnapType: 'x mandatory' }}>
                    {stageLeads.map(lead => {
                      const stageNorm = NORMALIZED_STAGE_MAP[lead.stage || ''] || lead.stage
                      const isProposta = stageNorm === 'Proposta'
                      const isApresentacao = stageNorm === 'Apresentacao'
                      const currentStageColor = stageColors[lead.stage as Stage] || 'var(--brand-border)'

                      const daysSinceContact = getDaysSinceContact(lead, leadTimelineMap.get(lead.id))
                      const overdueDays = daysSinceContact - (CADENCE_DAYS[lead.stage as Stage] || 999)
                      const isOverdue = overdueDays > 0

                      const pulseClass = isProposta ? 'pulse-red-border' : (isApresentacao ? 'pulse-amber-border' : '')
                      const leadBorderColor = currentStageColor
                      const leadBackground = isProposta 
                        ? 'linear-gradient(180deg, rgba(69,10,10,0.6), rgba(15,23,42,0.96))' 
                        : isApresentacao
                        ? 'linear-gradient(180deg, rgba(69,50,0,0.6), rgba(15,23,42,0.96))'
                        : `linear-gradient(180deg, ${currentStageColor}33, rgba(15,23,42,0.96))`
                        
                      const leadShadow = isProposta || isApresentacao
                        ? `0 0 25px ${currentStageColor}80, 0 0 10px ${currentStageColor}33`
                        : `0 0 15px ${currentStageColor}1A`

                      const stageBadge = (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: `${currentStageColor}40`, color: currentStageColor, padding: '2px 4px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', boxShadow: isProposta || isApresentacao ? `0 0 10px ${currentStageColor}80` : 'none' }}>
                          {isProposta ? <Target size={10}/> : isApresentacao ? <Sparkles size={10}/> : stageNorm === 'Qualificacao' ? <Wand2 size={10}/> : <History size={10}/>} 
                          {stageDisplay[lead.stage as Stage]?.label || lead.stage}
                        </div>
                      )
                      
                      const actionPlanBg = `${currentStageColor}1A`
                      const actionPlanBorder = `${currentStageColor}66`
                      const actionPlanColor = '#ffffff'
                      
                      const planData = urgentActionPlans[lead.id]
                      
                      // Regras Específicas de Ação Baseadas no Estágio
                      let specificAction = ''
                      if (lead.stage === 'Contato Inicial') specificAction = 'Ligar, qualificar o lead e avançar para Qualificação.'
                      else if (lead.stage === 'Qualificacao') specificAction = 'Apresentar a solução e identificar dores (SPIN).'
                      else if (lead.stage === 'Proposta') specificAction = 'Follow-up de proposta comercial. Fechamento.'
                      else if (lead.stage === 'Apresentacao') specificAction = 'Contornar objeções e ajustar contrato.'
                      else specificAction = 'Retomar contato e alinhar próximos passos.'

                      const baseFallbackUrgent = `Prioridade Máxima: ${specificAction}`
                      const baseFallbackOverdue = `Atrasado: ${specificAction}`
                      
                      let aiActionPlan = isProposta ? baseFallbackUrgent : baseFallbackOverdue;
                      if (planData && Array.isArray(planData.acoes_recomendadas) && planData.acoes_recomendadas.length > 0) {
                        aiActionPlan = planData.acoes_recomendadas.map((a: string, i: number) => `${i + 1}º ${a}`).join(' | ');
                      } else if (planData && planData.alerta_vermelho) {
                        aiActionPlan = 'ALERTA: ' + (planData.dor_principal || specificAction);
                      }

                      return (
                        <div
                          key={`priority-${lead.id}`}
                          className={pulseClass}
                          onClick={() => openLeadTimeline(lead)}
                          style={{
                            flexShrink: 0,
                            width: '210px',
                            background: leadBackground,
                            border: `2px solid ${leadBorderColor}`,
                            borderRadius: '8px',
                            padding: '4px 6px',
                            cursor: 'pointer',
                            boxShadow: leadShadow,
                            scrollSnapAlign: 'start',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 900, fontSize: '0.85rem', color: leadBorderColor, lineHeight: 1.1, textTransform: 'uppercase' }}>{lead.name}</div>
                            {stageBadge}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Estágio: <strong style={{ color: stageColors[lead.stage as Stage] }}>{stageDisplay[lead.stage as Stage]?.label || lead.stage}</strong></div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px', marginBottom: '2px' }}>
                            <button
                              type="button"
                              title="Ligar via GoTo"
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                const num = (lead.phone || lead.whatsapp || '').replace(/\D/g, '')
                                if (num) window.open(`tel:${num}`)
                                setCallLogLead(lead)
                              }}
                              style={{ background: 'rgba(34,197,94,0.1)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#22c55e', display: 'flex' }}
                            >
                              <PhoneCall size={12} />
                            </button>
                            <button
                              type="button"
                              title="Registrar ligacao"
                              onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setCallLogLead(lead); }}
                              style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#3b82f6', display: 'flex' }}
                            >
                              <Phone size={12} />
                            </button>
                            <button type="button" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleContactAction('whatsapp', lead); }} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#10b981', display: 'flex' }}>
                              <MessageSquare size={12} />
                            </button>
                            <button type="button" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleContactAction('email', lead); }} style={{ background: 'rgba(245,158,11,0.1)', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', color: '#f59e0b', display: 'flex' }}>
                              <Mail size={12} />
                            </button>
                          </div>


                          <div style={{ marginTop: 'auto', background: actionPlanBg, border: `1px solid ${actionPlanBorder}`, padding: '4px 6px', borderRadius: '6px', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: leadBorderColor, fontWeight: 900, textTransform: 'uppercase' }}>
                                <Sparkles size={10} color={leadBorderColor} className={pulseClass} />
                                AÇÃO
                              </div>
                              {isOverdue && (
                                <div style={{ fontSize: '0.65rem', color: leadBorderColor, fontWeight: 900, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.2)', padding: '2px 4px', borderRadius: '4px' }}>
                                  🚨 {overdueDays}d ATRASO
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: actionPlanColor, lineHeight: 1.2, fontWeight: 600 }}>
                              <div style={{ color: leadBorderColor, fontWeight: 900, display: 'block', marginBottom: '2px' }}>{aiActionPlan}</div>
                              {lead.ai_summary || getLeadNextAction(lead)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)', color: '#94a3b8' }}>
            <Sparkles size={24} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <div>Nenhuma ação urgente pendente. Seu funil está em dia!</div>
          </div>
        )}
      </div>

      {/* Legend & Count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            {leads.length} Leads no Quadro
          </div>
          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            {stages.map(s => (
               <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: stageColors[s] }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>{s}</span>
               </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Board */}
      <div id="pipeline-board" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', width: '100%', minWidth: '100%', justifyContent: 'center' }}>
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage)
          const isFechado = stage === 'Fechado'
          const avgDays = stageLeads.length ? Math.round(stageLeads.reduce((sum, l) => sum + l.days, 0) / stageLeads.length) : 0
          return (
            <div key={stage} style={{ flexShrink: 0, width: '250px' }} onDrop={(e) => handleDrop(e, stage)} onDragOver={handleDragOver}>
              
              {/* Resumo da Etapa Integrado na Coluna */}
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.58))',
                  border: `1px solid ${stageColors[stage]}35`,
                  borderRadius: '16px',
                  padding: '16px',
                  marginBottom: '20px',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: stageColors[stage], fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stageDisplay[stage].label}</div>
                <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: '12px', marginTop: '8px' }}>
                  <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff' }}>{stageLeads.length}</div>
                  {stageLeads.length > 0 && <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{avgDays}d médio</div>}
                </div>
                <div style={{ marginTop: '8px', display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{stageLeads.length ? stageDisplay[stage].detail : 'Sem oportunidades'}</div>
                </div>
              </div>
              <div
                style={{
                  padding: isFechado ? '16px 14px' : '12px 14px',
                  borderRadius: '14px 14px 0 0',
                  background: isFechado ? 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))' : `${stageColors[stage]}15`,
                  borderBottom: isFechado ? `3px solid ${stageColors[stage]}` : `2px solid ${stageColors[stage]}`,
                  borderTop: isFechado ? `1px solid rgba(255,255,255,0.1)` : 'none',
                  borderLeft: isFechado ? `1px solid rgba(255,255,255,0.1)` : 'none',
                  borderRight: isFechado ? `1px solid rgba(255,255,255,0.1)` : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ 
                        fontWeight: 800, 
                        fontSize: isFechado ? '0.95rem' : '0.85rem', 
                        color: isFechado ? '#10b981' : '#e2e8f0',
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase'
                      }}>
                        {stageDisplay[stage]?.label || stage}
                      </h3>
                    </div>
                  <span style={{ background: isFechado ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.1)', color: isFechado ? '#34d399' : '#cbd5e1', padding: '2px 8px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 800 }}>
                    {stageLeads.length}
                  </span>
                </div>
              </div>

              <div style={{ 
                display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '70vh', padding: '10px 0',
                background: isFechado ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.01)',
                borderLeft: isFechado ? '1px solid rgba(16,185,129,0.15)' : '1px dashed rgba(255,255,255,0.05)',
                borderRight: isFechado ? '1px solid rgba(16,185,129,0.15)' : '1px dashed rgba(255,255,255,0.05)',
                borderBottom: isFechado ? '1px solid rgba(16,185,129,0.15)' : '1px dashed rgba(255,255,255,0.05)',
                borderRadius: '0 0 14px 14px',
              }}>
                {stageLeads.length > 50 && (
                  <div style={{ fontSize: '0.65rem', color: '#f59e0b', textAlign: 'center', margin: '0 10px 8px', padding: '4px', background: 'rgba(245,158,11,0.1)', borderRadius: '4px' }}>
                    Mostrando 50 de {stageLeads.length}.
                  </div>
                )}
                {stageLeads.slice(0, 50).map((lead) => {
                  const temperature = getLeadTemperature(lead)
                  const attention = getLeadAttention(lead)
                  const assistantRanking = assistantRecommendationMap.get(lead.id)
                  const isAssistantRecommended = assistantRecommendationMap.has(lead.id)
                  
                  const isAssistantFocused = assistantFocusedLeadId === lead.id
                  const leadTimeline = leadTimelineMap.get(lead.id)
                  const overdueDays = lead.days - (CADENCE_DAYS[lead.stage] || 999)
                  const isOverdue = overdueDays > 0
                  const isWarning = !isOverdue && lead.days >= (CADENCE_DAYS[lead.stage] || 999) * 0.75

                  const stageNorm = NORMALIZED_STAGE_MAP[lead.stage || ''] || lead.stage
                  const isProposta = stageNorm === 'Proposta'
                  const isApresentacao = stageNorm === 'Apresentacao'
                  const currentStageColor = stageColors[stage] || 'var(--brand-border)'

                  const leadBorderColor = currentStageColor

                  const leadBackground = isAssistantRecommended
                    ? 'linear-gradient(180deg, rgba(44,38,14,0.96), rgba(15,23,42,0.96))'
                    : 'var(--brand-surface)'
                  const leadShadow = isProposta
                    ? '0 0 15px rgba(239,68,68,0.2), 0 18px 36px rgba(2,6,23,0.15)'
                    : isApresentacao
                    ? '0 0 15px rgba(245,158,11,0.2), 0 18px 36px rgba(2,6,23,0.15)'
                    : isAssistantRecommended
                      ? '0 0 0 1px rgba(251,191,36,0.15), 0 20px 40px rgba(251,191,36,0.12)'
                      : isAssistantFocused
                        ? '0 0 0 1px rgba(96,165,250,0.15), 0 20px 40px rgba(2,6,23,0.12)'
                        : `0 0 8px ${currentStageColor}33, 0 18px 36px rgba(2,6,23,0.10)`
                  const pulseClass = isProposta ? 'pulse-red-border' : (isApresentacao ? 'pulse-amber-border' : '')
                  return (
                    <div
                      id={`lead-card-${lead.id}`}
                      key={lead.id}
                      className={`lead-card ${pulseClass}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      style={{
                        background: leadBackground,
                        border: `1px solid ${leadBorderColor}`,
                        borderRadius: '14px',
                        padding: '14px',
                        cursor: 'grab',
                        transition: 'all 0.2s',
                        boxShadow: leadShadow,
                        position: 'relative',
                        zIndex: isProposta || isApresentacao ? 1 : 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = currentStageColor
                        e.currentTarget.style.boxShadow = `0 0 18px ${currentStageColor}66`
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = leadBorderColor
                        e.currentTarget.style.boxShadow = leadShadow
                        e.currentTarget.style.transform = 'none'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {isAssistantRecommended ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.12)', color: 'var(--brand-primary)', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            <Target size={11} />
                            Prioridade #{assistantRanking?.rank}
                          </div>
                        ) : null}
                        {isOverdue && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            <TimerReset size={11} />
                            Atrasado {overdueDays}d
                          </div>
                        )}
                        {isWarning && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(251,191,36,0.1)', color: 'var(--brand-primary)', fontSize: '0.64rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Próximo do limite
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: currentStageColor }}>{lead.name}</div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openEditLead(lead) }}
                            style={{ background: 'rgba(251,191,36,0.1)', border: 'none', borderRadius: '5px', padding: '3px', cursor: 'pointer', color: '#f59e0b', display: 'flex' }}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            type="button"
                            onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead) }}
                            style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '5px', padding: '3px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>

                      {lead.company && <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '6px' }}>{lead.company}</div>}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                        
                        {lead.contract_number ? (
                          <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: '#bfdbfe', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Contrato {lead.contract_number}
                          </span>
                        ) : null}
                        {lead.contract_valid_until ? (
                          <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: '#e2e8f0', background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Vence {new Date(lead.contract_valid_until).toLocaleDateString('pt-BR')}
                          </span>
                        ) : null}
                        {lead.contract_pdf_name ? (
                          <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            PDF ok
                          </span>
                        ) : null}
                        {lead.client_id ? (
                          <a
                            href={`/dashboard/clientes?cliente=${encodeURIComponent(lead.client_id)}`}
                            onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}
                            style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 900, color: '#bfdbfe', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <ExternalLink size={10} />
                            Abrir cliente
                          </a>
                        ) : null}
                        {lead.notes?.toLowerCase().includes('evento') ? (
                          <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: '#fcd34d', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.18)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Sparkles size={10} /> De Evento
                          </span>
                        ) : null}
                        <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: '#a7f3d0', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.18)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {String(leadTimeline?.meetings.length || 0).padStart(2, '0')} reunioes
                        </span>
                      </div>

                      {(() => {
                        const stalledDays = getStalledDays(leadTimeline)
                        const stalledStyle = getStalledStyle(stalledDays, lead.stage)
                        const prob = STAGE_PROBABILITY[lead.stage] ?? 0
                        const probColor = prob >= 70 ? '#4ade80' : prob >= 50 ? 'var(--brand-primary)' : prob >= 30 ? '#93c5fd' : '#94a3b8'

                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                            {/* Temperatura */}
                            <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: temperature.color, background: temperature.background, border: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                              {temperature.label}
                            </span>

                            {/* Dias sem contato */}
                            <span 
                              title="Dias desde a última atividade registrada" 
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: '999px', 
                                fontSize: stalledStyle.fontSize || '0.65rem', 
                                fontWeight: stalledStyle.fontWeight || 800, 
                                color: stalledStyle.color, 
                                background: stalledStyle.bg, 
                                border: `1px solid ${stalledStyle.color}40`, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '5px',
                                transition: 'all 0.3s ease',
                                boxShadow: stalledStyle.pulse ? `0 0 10px ${stalledStyle.color}40` : 'none'
                              }}
                              className={stalledStyle.pulse ? 'pulse-error' : ''}
                            >
                              {stalledStyle.icon} {stalledStyle.label}
                            </span>

                            {/* Probabilidade de fechamento */}
                            <span title={`Probabilidade média da etapa ${lead.stage}`} style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, color: probColor, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: 'var(--font-mono, monospace)' }}>
                              {prob}% fechamento
                            </span>
                          </div>
                        )
                      })()}

                      <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge badge-blue" style={{ fontSize: '0.68rem', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.product}
                          </span>
                        </div>

                        {(() => {
                          if (lead.stage === 'Fechado') {
                            return (
                              <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: '#34d399', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                                  <Sparkles size={12} color="#34d399" />
                                  Contrato Fechado
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {!archivedContracts.has(lead.id) && (
                                    <button
                                      type="button"
                                      onTouchStart={(e) => e.stopPropagation()}
                                      onTouchEnd={(e) => e.stopPropagation()}
                                      onClick={(e) => { e.stopPropagation(); setArchivedContracts(prev => new Set(prev).add(lead.id)); toast.success('Contrato confirmado! Siga para o Onboarding.') }}
                                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '7px 12px', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', width: '100%' }}
                                    >
                                      ✓ Confirmar Contrato Assinado
                                    </button>
                                  )}
                                  <Link
                                    href={`/dashboard/onboarding`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #eab308, #ca8a04)', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', width: '100%', textDecoration: 'none', textAlign: 'center' as const }}
                                  >
                                    🚀 Iniciar Onboarding
                                  </Link>
                                </div>
                              </div>
                            )
                          }

                          const planData = urgentActionPlans[lead.id]
                          const hasRealAiPlan = Boolean(planData && ((Array.isArray(planData.acoes_recomendadas) && planData.acoes_recomendadas.length > 0) || planData.alerta_vermelho))
                          let aiActionPlan = getPalinIAPrioritizedPlan(lead);
                          if (planData && Array.isArray(planData.acoes_recomendadas) && planData.acoes_recomendadas.length > 0) {
                            aiActionPlan = planData.acoes_recomendadas[0]; // Show the top priority action
                          } else if (planData && planData.alerta_vermelho) {
                            aiActionPlan = 'ALERTA: ' + (planData.dor_principal || 'Retome o contato urgente.');
                          }

                          const isUrgent = ['Proposta', 'Negociacao', 'Negociação'].includes(lead.stage || '')
                          return (
                            <div style={{ padding: '12px', borderRadius: '10px', background: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251,191,36,0.1)', border: isUrgent ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(251,191,36,0.3)', position: 'relative' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.65rem', color: isUrgent ? '#fca5a5' : '#fbbf24', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                                {hasRealAiPlan ? <Sparkles size={12} color={isUrgent ? '#f87171' : '#fbbf24'} /> : <Target size={12} color={isUrgent ? '#f87171' : '#fbbf24'} />}
                                {hasRealAiPlan ? 'Palin IA: Ação Sugerida' : 'Próximo passo sugerido'}
                              </div>
                              <div style={{ color: '#f8fafc', fontSize: '0.8rem', fontWeight: 700, lineHeight: 1.45 }}>
                                {aiActionPlan}
                              </div>
                            </div>
                          )
                        })()}

                        <div style={{ fontSize: '0.72rem', color: lead.days >= 20 || lead.ai_status === 'revisar' ? '#fca5a5' : '#94a3b8', lineHeight: 1.45 }}>
                          {attention}
                        </div>
                        {leadTimeline?.activities?.[0] ? (
                          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)' }}>
                            <div style={{ fontSize: '0.65rem', color: '#93c5fd', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ultimo andamento</div>
                            <div style={{ marginTop: '5px', color: '#dbe6f1', fontSize: '0.75rem', lineHeight: 1.45 }}>
                              {leadTimeline.activities[0].subject}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {(lead.ai_status || lead.ai_score > 0) ? (
                        <div style={{
                          display: 'grid',
                          gap: '4px',
                          padding: '8px',
                          borderRadius: '8px',
                          marginBottom: '10px',
                          background: 'rgba(251,191,36,0.06)',
                          border: '1px solid rgba(251,191,36,0.12)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                            <span style={{ color: 'var(--brand-primary)', fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>IA</span>
                            <span style={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800 }}>
                              {lead.ai_status || 'nao avaliado'} {lead.ai_score > 0 ? `- ${lead.ai_score}/100` : ''}
                            </span>
                          </div>
                          {lead.ai_summary ? (
                            <div style={{ color: '#94a3b8', fontSize: '0.7rem', lineHeight: 1.35 }}>
                              {lead.ai_summary}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            title="Ligar via GoTo"
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              const num = (lead.phone || lead.whatsapp || '').replace(/\D/g, '')
                              if (num) window.open(`tel:${num}`)
                              setCallLogLead(lead)
                            }}
                            style={{ background: 'rgba(34,197,94,0.1)', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#22c55e', display: 'flex' }}
                          >
                            <PhoneCall size={12} />
                          </button>
                          <button
                            type="button"
                            title="Registrar ligacao"
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setCallLogLead(lead);
                            }}
                            style={{ background: 'rgba(59,130,246,0.1)', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#3b82f6', display: 'flex' }}
                          >
                            <Phone size={12} />
                          </button>
                          <button type="button" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleContactAction('whatsapp', lead); }} style={{ background: 'rgba(16,185,129,0.1)', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#10b981', display: 'flex' }}>
                            <MessageSquare size={12} />
                          </button>
                          <button type="button" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); handleContactAction('email', lead); }} style={{ background: 'rgba(245,158,11,0.1)', border: 'none', borderRadius: '6px', padding: '4px', cursor: 'pointer', color: '#f59e0b', display: 'flex' }}>
                            <Mail size={12} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {lead.stage === 'Contato Inicial' ? (
                            <button
                              type="button"
                              onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
                              onClick={async (e) => {
                                e.stopPropagation()
                                const result = await updateLeadStage(lead.id, 'Qualificacao')
                                if (result.success) {
                                  setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage: 'Qualificacao' } : l))
                                  setAssistantServerAnalysis(null)
                                  setAssistantServerMeta(null)
                                  triggerSingleBoom()
                                  toast.success('Lead qualificado!', { description: `${lead.name} avançou para Qualificação.` })
                                } else {
                                  toast.error('Erro ao avançar lead', { description: result.error })
                                }
                              }}
                              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.15))', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', color: '#a5b4fc', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', fontWeight: 900 }}
                            >
                              <ChevronRight size={12} />
                              Qualificar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openLeadMeeting(lead); }}
                              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.16)', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: '#86efac', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', fontWeight: 800 }}
                            >
                              <CalendarDays size={12} />
                              Reunião
                            </button>
                          )}
                          <button
                            type="button"
                            onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openLeadTimeline(lead); }}
                            style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.16)', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: '#93c5fd', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', fontWeight: 800 }}
                          >
                            <History size={12} />
                            Histórico
                          </button>
                          <button
                            type="button"
                            onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); openIntelligence(lead); }}
                            style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.16)', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', fontWeight: 800 }}
                          >
                            <Brain size={12} />
                            IA
                          </button>
                          <span style={{ fontSize: '0.68rem', color: '#475569' }}>{lead.consultant}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <button
                  type="button"
                  onClick={() => openCreateLead(stage)}
                  style={{
                    background: 'rgba(30,58,95,0.15)',
                    border: '1px dashed rgba(30,58,95,0.5)',
                    borderRadius: '12px',
                    padding: '12px',
                    color: '#94a3b8',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <ActionDialog
        open={showCreateLead}
        title={`Novo lead em ${stageDisplay[draftStage].label}`}
        subtitle="Preencha a entrada do lead. Produto e consultor sao vinculados ao banco."
        onClose={() => setShowCreateLead(false)}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setShowCreateLead(false)}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleCreateLead}>Salvar lead</button>
          </>
        }
      >
        {leadFormFields}
      </ActionDialog>

      <ActionDialog
        open={showEditLead}
        title="Editar lead"
        subtitle={editingLead?.name || ''}
        onClose={() => { setShowEditLead(false); setEditingLead(null) }}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => { setShowEditLead(false); setEditingLead(null) }}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleEditLead}>Salvar alteracoes</button>
          </>
        }
      >
        {leadFormFields}
      </ActionDialog>

      <ActionDialog
        open={Boolean(selectedLead)}
        title={selectedLead ? `Histórico de ${selectedLead.name}` : 'Histórico do lead'}
        subtitle={selectedLead ? `${selectedLead.company || 'Sem empresa'} • ${stageDisplay[selectedLead.stage].label}` : 'Andamento do lead no CRM'}
        onClose={closeLeadTimeline}
        width="860px"
        footer={
          <>
            {selectedLead ? (
              <button type="button" className="btn-primary" onClick={() => openLeadMeeting(selectedLead)}>
                <CalendarDays size={16} />
                Nova reunião
              </button>
            ) : null}
            {selectedLead?.client_id ? (
              <a
                href={`/dashboard/clientes?cliente=${encodeURIComponent(selectedLead.client_id)}`}
                className="btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={16} />
                Abrir cliente
              </a>
            ) : null}
            <button type="button" className="btn-ghost" onClick={closeLeadTimeline}>Fechar</button>
          </>
        }
      >
        {selectedLead ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '2px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: activeTab === 'history' ? '#fff' : '#94a3b8',
                  borderBottom: activeTab === 'history' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Cronologia & CRM
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('intelligence')}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: activeTab === 'intelligence' ? '#fff' : '#94a3b8',
                  borderBottom: activeTab === 'intelligence' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--brand-primary)' }} />
                Inteligência Aura Pro
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('followup')
                  if (selectedLead && followUpSuggestions.length === 0) {
                    void handleGenerateFollowUp(selectedLead.id)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: activeTab === 'followup' ? '#fff' : '#94a3b8',
                  borderBottom: activeTab === 'followup' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={14} style={{ color: '#10b981' }} />
                Roteiro Sugerido
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('documents')
                  if (selectedLead) {
                    void handleFetchDocuments(selectedLead.id)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  color: activeTab === 'documents' ? '#fff' : '#94a3b8',
                  borderBottom: activeTab === 'documents' ? '2px solid var(--brand-primary)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Plus size={14} style={{ color: '#3b82f6' }} />
                Documentos
              </button>
            </div>

            {activeTab === 'history' ? (
              <>
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                  <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#86efac', fontWeight: 800 }}>Reuniões</div>
                    <div style={{ marginTop: '8px', fontSize: '1.1rem', fontWeight: 900, color: '#f8fafc' }}>{String(selectedLeadTimeline?.meetings.length || 0).padStart(2, '0')}</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#93c5fd', fontWeight: 800 }}>Último andamento</div>
                    <div style={{ marginTop: '8px', fontSize: '0.92rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.45 }}>
                      {selectedLeadTimeline?.activities?.[0]?.subject || 'Nenhuma atividade registrada ainda.'}
                    </div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.12)' }}>
                    <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand-primary)', fontWeight: 800 }}>Próximo passo</div>
                    <div style={{ marginTop: '8px', fontSize: '0.92rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.45 }}>
                      {selectedLeadTimeline?.activities?.[0]?.next_step || getLeadNextAction(selectedLead)}
                    </div>
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 1fr', 
                  gap: '12px',
                  padding: '16px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginTop: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>CNPJ</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, marginTop: '4px' }}>{formatCnpj(selectedLead.cnpj) || 'N\u00e3o informado'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Regime Tributário</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, marginTop: '4px' }}>{selectedLead.regime_tributario || 'Não informado'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800 }}>Segmento / CNAE</div>
                    <div style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, marginTop: '4px' }}>{selectedLead.segmento_especifico || 'Não informado'}</div>
                  </div>
                </div>
              </>
            ) : activeTab === 'followup' ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <MessageSquare size={18} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>Script de Vendas Personalizado</span>
                  </div>
                  {followUpLoading ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Gerando sugestões baseadas no estágio...</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {followUpSuggestions.map((suggestion, i) => (
                        <div key={i} style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', position: 'relative' }}>
                          <p style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '8px' }}>{suggestion}</p>
                          <button 
                            className="btn-ghost" 
                            style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                            onClick={() => {
                              navigator.clipboard.writeText(suggestion)
                              toast.success('Copiado!')
                            }}
                          >
                            Copiar para o WhatsApp
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'documents' ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#3b82f6', textTransform: 'uppercase' }}>Contratos e Documentos</span>
                  <label className="btn-primary" style={{ cursor: 'pointer', fontSize: '0.75rem', padding: '6px 12px' }}>
                    <Plus size={14} />
                    Fazer Upload
                    <input 
                      type="file" 
                      style={{ display: 'none' }} 
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !selectedLead) return
                        toast.info('Simulando upload...')
                        const result = await saveLeadDocument({
                          leadId: selectedLead.id,
                          fileName: file.name,
                          filePath: `leads/${selectedLead.id}/${file.name}`,
                          fileSize: file.size,
                          fileType: file.type
                        })
                        if (result.success) {
                          toast.success('Documento salvo!')
                          void handleFetchDocuments(selectedLead.id)
                        }
                      }}
                    />
                  </label>
                </div>
                {docsLoading ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Carregando documentos...</div>
                ) : leadDocs.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                    <FileText size={32} style={{ color: '#3b82f6', margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum documento anexado.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {leadDocs.map((doc) => (
                      <div key={doc.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <FileText size={18} style={{ color: '#3b82f6' }} />
                          <div>
                            <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 700 }}>{doc.file_name}</div>
                            <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{(doc.file_size / 1024 / 1024).toFixed(2)} MB • {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <button className="btn-ghost" style={{ padding: '6px' }}>
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ color: 'var(--brand-primary)', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase' }}>Analise de 4 Agentes (P&M)</div>
                   <button 
                     type="button" 
                     className="btn-primary" 
                     onClick={() => void handleGenerateIntelligence(selectedLead.id)}
                     disabled={intelligenceLoading}
                     style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                     {intelligenceLoading ? 'Processando...' : 'Re-analisar Lead'}
                   </button>
                </div>

                {intelligenceRecords.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(251,191,36,0.03)', border: '1px dashed rgba(251,191,36,0.2)', borderRadius: '16px' }}>
                    <Brain size={32} style={{ color: 'var(--brand-primary)', margin: '0 auto 12px', opacity: 0.5 }} />
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Nenhuma análise inteligente profunda disponível.</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Clique em re-analisar para ativar os 4 agentes.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                    {intelligenceRecords.map((record, idx) => (
                      <div key={record.id} style={{ padding: '20px', borderRadius: '16px', background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(251,191,36,0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                           <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                             Relatório #{intelligenceRecords.length - idx} • {new Date(record.created_at).toLocaleString('pt-BR')}
                           </span>
                           <div style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(34,197,94,0.1)', color: '#86efac' }}>
                                SCORE {String(record.report_json?.score ?? '')}
                              </span>
                              <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 900, background: 'rgba(59,130,246,0.1)', color: '#93c5fd' }}>
                                PRIORIDADE {String(record.report_json?.prioridade ?? '').toUpperCase()}
                              </span>
                           </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '3px solid var(--brand-primary)' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--brand-primary)', fontWeight: 900, marginBottom: '4px' }}>1. PROSPECÇÃO & QUALIFICAÇÃO</div>
                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>{record.report_json?.prospeccao_qualificacao || 'Análise em processamento...'}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                              <strong>Match ICP:</strong> {record.report_json?.match_icp || 'N/A'}
                            </div>
                          </div>

                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '3px solid #60a5fa' }}>
                            <div style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 900, marginBottom: '4px' }}>2. ESTRUTURA DE PIPELINE</div>
                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>{record.report_json?.estrutura_pipeline_crm || 'Aguardando definição estratégica...'}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                              <strong>Gancho:</strong> {record.report_json?.gancho_proxima_reuniao || 'Pendente'}
                            </div>
                          </div>

                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '3px solid #4ade80' }}>
                            <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 900, marginBottom: '4px' }}>3. CONTEXTO FINANCEIRO</div>
                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>{record.report_json?.kpis_metas_valor || 'Calculando potencial...'}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                              <strong>Potencial:</strong> {record.report_json?.potencial_financeiro_detalhado || 'Não estimado'}
                            </div>
                          </div>

                          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '3px solid #3b82f6' }}>
                            <div style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 900, marginBottom: '4px' }}>4. ESTRATÉGIA PÓS-VENDA</div>
                            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.5 }}>{record.report_json?.pos_venda_retencao || 'Planejando transição...'}</div>
                            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>
                              <strong>Dor Principal:</strong> {record.report_json?.dor_principal || 'N/A'}
                            </div>
                          </div>
                        </div>
                        <div
                          className="markdown-content"
                          style={{ color: '#dbe6f1', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
                        >
                          {record.full_markdown}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#86efac', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 900 }}>Reuniões no lead</div>
                <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                  {(selectedLeadTimeline?.meetings || []).length === 0 ? (
                    <div style={{ color: 'var(--brand-muted)', fontSize: '0.88rem' }}>Nenhuma reunião vinculada a este lead.</div>
                  ) : selectedLeadTimeline!.meetings.map((meeting) => (
                    <div key={meeting.id} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 850 }}>{meeting.title}</div>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            color: meeting.status === 'concluida'
                              ? '#cbd5e1'
                              : meeting.status === 'confirmada'
                                ? '#93c5fd'
                                : meeting.status === 'em deslocamento'
                                  ? '#86efac'
                                  : 'var(--brand-primary)',
                            background: meeting.status === 'concluida'
                              ? 'rgba(148,163,184,0.12)'
                              : meeting.status === 'confirmada'
                                ? 'rgba(96,165,250,0.12)'
                                : meeting.status === 'em deslocamento'
                                  ? 'rgba(34,197,94,0.12)'
                                  : 'rgba(245,158,11,0.12)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          {meeting.status}
                        </span>
                      </div>
                      <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '0.82rem' }}>
                        {new Date(meeting.scheduled_for).toLocaleString('pt-BR')} • {meeting.owner_name}
                      </div>
                      <div style={{ marginTop: '6px', color: '#dbe6f1', fontSize: '0.84rem', lineHeight: 1.5 }}>
                        {meeting.objective || 'Sem pauta registrada.'}
                      </div>
                      {meeting.next_step ? (
                        <div style={{ marginTop: '6px', color: '#86efac', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          Próximo passo: {meeting.next_step}
                        </div>
                      ) : null}
                      {meeting.next_contact_at ? (
                        <div style={{ marginTop: '4px', color: 'var(--brand-primary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                          Próximo contato: {new Date(meeting.next_contact_at).toLocaleString('pt-BR')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: '#93c5fd', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 900 }}>Linha do processo</div>
                <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                  {(selectedLeadTimeline?.activities || []).length === 0 ? (
                    <div style={{ color: 'var(--brand-muted)', fontSize: '0.88rem' }}>Nenhum registro comercial ainda.</div>
                  ) : selectedLeadTimeline!.activities.map((activity) => (
                    <div key={activity.id} style={{ padding: '12px', borderRadius: '14px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 850 }}>{activity.subject}</div>
                        <span style={{ color: '#93c5fd', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase' }}>{activity.activity_type || 'atividade'}</span>
                      </div>
                      <div style={{ marginTop: '6px', color: '#94a3b8', fontSize: '0.82rem' }}>
                        {activity.created_at ? new Date(activity.created_at).toLocaleString('pt-BR') : 'Sem data'}
                      </div>
                      <div style={{ marginTop: '6px', color: '#dbe6f1', fontSize: '0.84rem', lineHeight: 1.5 }}>
                        {activity.summary || activity.agenda || 'Sem resumo registrado.'}
                      </div>
                      {activity.next_step ? (
                        <div style={{ marginTop: '6px', color: '#86efac', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          Próximo passo: {activity.next_step}
                        </div>
                      ) : null}
                      {activity.next_contact_at ? (
                        <div style={{ marginTop: '4px', color: 'var(--brand-primary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                          Próximo contato: {new Date(activity.next_contact_at).toLocaleString('pt-BR')}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </ActionDialog>

      <ActionDialog
        open={meetingOpen}
        title="Nova reunião do lead"
        subtitle={selectedLead ? `Vinculada a ${selectedLead.name}` : 'Agende a reunião e defina a pauta com o lead.'}
        onClose={() => setMeetingOpen(false)}
        width="620px"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setMeetingOpen(false)}>Cancelar</button>
            <button
              type="button"
              className="btn-primary"
              disabled={!meetingDraft.title.trim() || !meetingDraft.scheduled_for}
              onClick={() => void handleCreateLeadMeeting()}
            >
              <CalendarDays size={16} />
              Agendar reunião
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '22px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="meeting-field-label">Título da reunião</span>
            <input
              className="input-field"
              placeholder="Ex.: Apresentação de proposta"
              value={meetingDraft.title}
              onChange={(event) => setMeetingDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <div style={{ display: 'grid', gap: '10px' }}>
            <span className="meeting-section-label" style={{ color: '#60a5fa' }}>Quando</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span className="meeting-field-label">Início</span>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={meetingDraft.scheduled_for}
                  onChange={(event) => setMeetingDraft((current) => ({ ...current, scheduled_for: event.target.value }))}
                />
              </label>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span className="meeting-field-label">Término</span>
                <input
                  className="input-field"
                  type="datetime-local"
                  value={meetingDraft.ends_at}
                  onChange={(event) => setMeetingDraft((current) => ({ ...current, ends_at: event.target.value }))}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { minutes: 30, label: '30 min' },
                { minutes: 60, label: '1h' },
                { minutes: 90, label: '1h30' },
                { minutes: 120, label: '2h' },
              ].map((option) => (
                <button
                  key={option.minutes}
                  type="button"
                  className="meeting-chip"
                  disabled={!meetingDraft.scheduled_for}
                  onClick={() => setMeetingDraft((current) => ({ ...current, ends_at: addMinutesToDateTimeLocal(current.scheduled_for, option.minutes) }))}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <span className="meeting-section-label" style={{ color: '#86efac' }}>Onde e como</span>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span className="meeting-field-label">Local ou link</span>
              <input
                className="input-field"
                placeholder="Endereço, Google Meet, telefone..."
                value={meetingDraft.location}
                onChange={(event) => setMeetingDraft((current) => ({ ...current, location: event.target.value }))}
              />
            </label>
            <div style={{ display: 'grid', gap: '6px' }}>
              <span className="meeting-field-label">Formato</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['Presencial', 'Online', 'Externa'].map((option) => {
                  const active = meetingDraft.meeting_type === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMeetingDraft((current) => ({ ...current, meeting_type: option }))}
                      style={{
                        flex: 1,
                        padding: '9px 8px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: `1px solid ${active ? 'rgba(134,239,172,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                        color: active ? '#86efac' : '#94a3b8',
                        transition: 'all 0.15s',
                      }}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={meetingDraft.requires_logistics}
                onChange={(event) => setMeetingDraft((current) => ({ ...current, requires_logistics: event.target.checked }))}
              />
              Precisa de apoio logístico (carro, deslocamento)
            </label>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span className="meeting-section-label" style={{ color: 'var(--brand-primary)' }}>Pauta da reunião</span>
              <button
                type="button"
                onClick={() => void handleGenerateMeetingPauta()}
                disabled={meetingPautaLoading}
                className="meeting-chip"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {meetingPautaLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Gerar com IA
              </button>
            </div>
            <textarea
              className="input-field"
              rows={3}
              placeholder="O que será tratado nesta reunião?"
              value={meetingDraft.objective}
              onChange={(event) => setMeetingDraft((current) => ({ ...current, objective: event.target.value }))}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowMeetingFollowUp((value) => !value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: '#93c5fd',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              <ChevronRight size={14} style={{ transform: showMeetingFollowUp ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
              Registrar conversa e próximo passo (opcional)
            </button>
            {showMeetingFollowUp ? (
              <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
                <p style={{ color: '#64748b', fontSize: '0.76rem', lineHeight: 1.5, margin: 0 }}>
                  Preencha estes campos depois que a reunião acontecer, ou deixe em branco por enquanto.
                </p>
                <label
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: meetingAudioUploading ? 'wait' : 'pointer',
                    color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700, background: 'rgba(96,165,250,0.08)',
                    border: '1px solid rgba(96,165,250,0.2)', padding: '10px 14px', borderRadius: '10px', width: 'fit-content',
                  }}
                >
                  {meetingAudioUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Enviar áudio ou vídeo da reunião (a IA resume)
                  <input type="file" accept="audio/*,video/*" onChange={(event) => void handleUploadMeetingRecording(event)} disabled={meetingAudioUploading} style={{ display: 'none' }} />
                </label>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span className="meeting-field-label">Resumo da conversa</span>
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="Resumo da conversa"
                    value={meetingDraft.notes}
                    onChange={(event) => setMeetingDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span className="meeting-field-label">Próximo passo comercial</span>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Qual a próxima ação com este lead?"
                    value={meetingDraft.next_step}
                    onChange={(event) => setMeetingDraft((current) => ({ ...current, next_step: event.target.value }))}
                  />
                </label>
                <label style={{ display: 'grid', gap: '6px' }}>
                  <span className="meeting-field-label">Próximo contato agendado</span>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={meetingDraft.next_contact_at}
                    onChange={(event) => setMeetingDraft((current) => ({ ...current, next_contact_at: event.target.value }))}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </ActionDialog>

      {assistantOpen ? (
        <div
          onClick={() => setAssistantOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.72)',
            zIndex: 60,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <aside
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100vw, 470px)',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-20px 0 50px rgba(2,6,23,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--brand-primary)', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    <Target size={14} />
                    Priorização de Leads
                  </div>
                  <div style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: 900, lineHeight: 1.3 }}>
                    Filtre e priorize seus leads.
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.45 }}>
                    Análise e priorização baseada em etapa, valor e aging.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAssistantOpen(false)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    color: '#e2e8f0',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <textarea
                  className="input-field"
                  rows={3}
                  value={assistantDraft}
                  onChange={(event) => setAssistantDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault()
                      void handleRunAssistant()
                    }
                  }}
                  placeholder="Pergunte algo como: Quais leads devo atacar hoje?"
                  style={{
                    resize: 'none',
                    minHeight: '96px',
                  }}
                />

                <button
                  type="button"
                  onClick={() => void handleRunAssistant()}
                  disabled={assistantLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(96,165,250,0.25)',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(14,165,233,0.88))',
                    color: '#f8fafc',
                    fontSize: '0.84rem',
                    fontWeight: 900,
                    letterSpacing: '0.02em',
                    boxShadow: '0 16px 32px rgba(59,130,246,0.24)',
                    cursor: assistantLoading ? 'wait' : 'pointer',
                    opacity: assistantLoading ? 0.78 : 1,
                  }}
                >
                  <Wand2 size={16} />
                  {assistantLoading ? 'Analisando...' : 'Analisar leads'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: '12px',
                  padding: '14px',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Escopo da analise
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { key: 'all', label: getAssistantScopeLabel('all') },
                    { key: 'mine', label: getAssistantScopeLabel('mine') },
                  ].map((option) => {
                    const active = assistantFilters.scope === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => updateAssistantFilters({ scope: option.key as 'all' | 'mine' })}
                        style={{
                          border: active ? '1px solid rgba(96,165,250,0.65)' : '1px solid rgba(255,255,255,0.08)',
                          background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                          borderRadius: '999px',
                          padding: '8px 12px',
                          color: active ? '#dbeafe' : '#e2e8f0',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>

                <label style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800 }}>Produto</span>
                  <select
                    className="input-field"
                    value={assistantFilters.productId}
                    onChange={(event) => updateAssistantFilters({ productId: event.target.value })}
                    style={{ background: 'var(--brand-surface)', color: assistantFilters.productId ? '#e2e8f0' : '#64748b' }}
                  >
                    <option value="">Todos os produtos</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 800 }}>Etapas</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {stages.map((stage) => {
                      const active = assistantFilters.stageFilter.includes(stage)
                      return (
                        <button
                          key={stage}
                          type="button"
                          onClick={() => toggleAssistantStage(stage)}
                          style={{
                            border: active ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            background: active ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)',
                            borderRadius: '999px',
                            padding: '7px 11px',
                            color: active ? '#fde68a' : '#e2e8f0',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          {stage}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#dbe6f1',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assistantFilters.includeClosed}
                    onChange={(event) => updateAssistantFilters({ includeClosed: event.target.checked })}
                  />
                  Incluir fechados e perdidos na leitura
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {assistantPrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => {
                      void handleRunAssistant(prompt.prompt)
                    }}
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      color: '#e2e8f0',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title={prompt.hint}
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ===== SCROLLABLE BODY ===== */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* Top lead resumo compacto */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ color: '#93c5fd', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {assistantLoading ? 'Analisando...' : `${assistantAnalysis.totalActive} leads ativos`}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="chip">{assistantAnalysis.source === 'server' ? 'Servidor' : 'Local'}</span>
                </div>
              </div>
              {assistantTopLead ? (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
                  <div style={{ color: '#e2e8f0', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Top: <strong style={{ color: '#f8fafc' }}>{assistantTopLead.lead.name}</strong> — {assistantTopLead.lead.stage}, {formatCompactCurrency(assistantTopLead.lead.value)}, {assistantTopLead.lead.days}d
                  </div>
                  {assistantTopLead.reasons.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {assistantTopLead.reasons.slice(0, 3).map((reason: string) => (
                        <span key={reason} className="chip">{reason}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.82rem' }}>Sem leads ativos para priorizar.</div>
              )}
            </div>

            <div style={{ padding: '18px 20px 22px', display: 'grid', gap: '12px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#f8fafc', fontSize: '0.92rem', fontWeight: 900 }}>Leads recomendados</div>
                <div style={{ color: '#94a3b8', fontSize: '0.74rem' }}>
                  Top {assistantAnalysis.insights.length}
                </div>
              </div>

              {assistantAnalysis.insights.length ? (
                assistantAnalysis.insights.map((insight) => (
                  <button
                    key={insight.lead.id}
                    type="button"
                    onClick={() => focusAssistantLead(insight.lead.id)}
                    style={{
                      display: 'grid',
                      gap: '10px',
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: '18px',
                      border: assistantFocusedLeadId === insight.lead.id ? '1px solid rgba(96,165,250,0.9)' : '1px solid rgba(255,255,255,0.08)',
                      background: assistantFocusedLeadId === insight.lead.id ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      boxShadow: assistantFocusedLeadId === insight.lead.id ? '0 0 0 1px rgba(96,165,250,0.12)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '4px 7px', borderRadius: '999px', background: 'rgba(251,191,36,0.12)', color: 'var(--brand-primary)', fontSize: '0.65rem', fontWeight: 900 }}>
                            #{insight.rank}
                          </span>
                          <span style={{ fontWeight: 900, fontSize: '0.92rem' }}>{insight.lead.name}</span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.76rem', lineHeight: 1.35 }}>
                          {insight.lead.company || 'Sem empresa'} - {insight.lead.product}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.35 }}>
                          {insight.lead.stage} - {insight.freshnessDays !== null ? `${insight.freshnessLabel} (${insight.freshnessDays}d)` : 'Sem freshness da IA'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'grid', gap: '4px' }}>
                        <div style={{ color: '#86efac', fontSize: '0.88rem', fontWeight: 900 }}>
                          {formatCompactCurrency(insight.lead.value)}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                          {insight.lead.days} dias
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ padding: '5px 8px', borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: '#dbe6f1', fontSize: '0.7rem', fontWeight: 700 }}>
                        {insight.signal}
                      </span>
                      <span style={{ padding: '5px 8px', borderRadius: '999px', background: 'rgba(16,185,129,0.1)', color: '#86efac', fontSize: '0.7rem', fontWeight: 700 }}>
                        {insight.nextAction}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#94a3b8', fontSize: '0.74rem' }}>
                      <Search size={13} />
                      <span>{insight.reasons.slice(0, 3).join(' - ')}</span>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand-primary)', fontSize: '0.72rem', fontWeight: 900 }}>
                      Abrir no board
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))
              ) : (
                <div style={{ padding: '18px', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.12)', color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Sem leads ativos para recomendar no momento. Tente abrir um novo ciclo ou ajustar o filtro mental do assistente.
                </div>
              )}
            </div>

            {/* ===== END SCROLLABLE BODY ===== */}
            </div>
          </aside>
        </div>
      ) : null}

      {/* Modal de registro de ligação GoTo */}
      {callLogLead && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 }}
          onClick={(e) => { if (e.target === e.currentTarget) setCallLogLead(null) }}
        >
          <div style={{ background: '#161b22', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', display: 'grid', gap: '14px' }}>
            <div style={{ fontWeight: 800, color: 'var(--brand-text)', fontSize: '0.95rem' }}>
              Registrar ligacao — {callLogLead.name}
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Resultado *</label>
              <select
                value={callForm.outcome}
                onChange={(e) => setCallForm((f) => ({ ...f, outcome: e.target.value as CallOutcome }))}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.82rem' }}
              >
                <option value="atendeu">Atendeu</option>
                <option value="nao_atendeu">Nao atendeu</option>
                <option value="recado">Deixou recado</option>
                <option value="reagendado">Reagendado</option>
              </select>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Duracao (min)</label>
              <input
                type="number" min={0} placeholder="Ex: 10"
                value={callForm.durationMin}
                onChange={(e) => setCallForm((f) => ({ ...f, durationMin: e.target.value }))}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.82rem' }}
              />
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Link da gravacao</label>
              <input
                placeholder="https://app.goto.com/..."
                value={callForm.recordingUrl}
                onChange={(e) => setCallForm((f) => ({ ...f, recordingUrl: e.target.value }))}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.82rem' }}
              />
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Observacoes</label>
              <textarea
                rows={2} placeholder="Resumo da conversa e proximos passos da ligacao"
                value={callForm.notes}
                onChange={(e) => setCallForm((f) => ({ ...f, notes: e.target.value }))}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px 10px', fontSize: '0.82rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCallLogLead(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCallLog()}
                disabled={callPending}
                style={{ background: 'var(--brand-primary)', border: 'none', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', color: '#0d1117', fontWeight: 800, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {callPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={13} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showContractModal && pendingClosedLead && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowContractModal(false) }}
        >
          <div style={{ background: '#161b22', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', display: 'grid', gap: '14px' }}>
            <div style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} />
              Arquivar Contrato
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '8px' }}>
              Parabéns pelo fechamento de <strong>{pendingClosedLead.name}</strong>! Antes de finalizar, arquive o contrato assinado para seguir ao Onboarding.
            </div>
            
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>Documento do Contrato *</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                style={{ background: '#0d1117', color: '#e2e8f0', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px', padding: '12px 10px', fontSize: '0.82rem', cursor: 'pointer' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button 
                type="button" 
                onClick={() => {
                  setShowContractModal(false)
                  setPendingClosedLead(null)
                  setContractFile(null)
                }} 
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '7px 14px', cursor: 'pointer', color: '#94a3b8', fontSize: '0.8rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmContractUpload}
                disabled={isUploadingContract || !contractFile}
                style={{ background: '#10b981', border: 'none', borderRadius: '8px', padding: '7px 16px', cursor: (isUploadingContract || !contractFile) ? 'not-allowed' : 'pointer', color: '#ffffff', fontWeight: 800, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: (isUploadingContract || !contractFile) ? 0.6 : 1 }}
              >
                {isUploadingContract ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={13} />}
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}




