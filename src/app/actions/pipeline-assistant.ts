'use server'

import { createClient } from '@/lib/supabase/server'
import {
  PIPELINE_ASSISTANT_VERSION,
  type PipelineAssistantAppliedFilter,
  buildPipelineAssistantInsights,
  type PipelineAssistantFilterSource,
  type PipelineAssistantFilterValue,
  type PipelineAssistantFreshnessMeta,
  type PipelineAssistantMeta,
  type PipelineAssistantRequest,
  type PipelineAssistantResponse,
  type PipelineAssistantStage,
  type PipelineLeadSnapshot,
} from '@/lib/pipeline-assistant'

type AiQualificationRow = {
  lead_id: string
  status: string | null
  score: number | string | null
  source: string | null
  summary: string | null
  updated_at: string | null
}

type LeadRow = {
  id: string
  name: string
  company: string | null
  stage: PipelineAssistantStage | string | null
  estimated_value: number | string | null
  created_at: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  product_id: string | null
  consultant_id: string | null
  product: { id?: string | null; name?: string | null } | { id?: string | null; name?: string | null }[] | null
  consultant: { id?: string | null; full_name?: string | null } | { id?: string | null; full_name?: string | null }[] | null
}

function normalizeStageFilter(stageFilter?: PipelineAssistantRequest['stageFilter']) {
  if (!Array.isArray(stageFilter)) return []

  return stageFilter.filter((stage): stage is PipelineAssistantStage =>
    stage === 'Contato Inicial' ||
    stage === 'Qualificacao' ||
    stage === 'Apresentacao' ||
    stage === 'Proposta' ||
    stage === 'Negociacao' ||
    stage === 'Fechado' ||
    stage === 'Perdido'
  )
}

function getLeadStage(stage: LeadRow['stage']): PipelineAssistantStage {
  if (stage === 'Contato Inicial' || stage === 'Lead') return 'Contato Inicial'
  if (stage === 'Qualificacao' || stage === 'Qualificado') return 'Qualificacao'
  if (stage === 'Apresentacao' || stage === 'Diagnostico' || stage === 'Diagnóstico') return 'Apresentacao'
  if (stage === 'Proposta') return 'Proposta'
  if (stage === 'Negociacao' || stage === 'Negociação') return 'Negociacao'
  if (stage === 'Fechado') return 'Fechado'
  return 'Perdido'
}

function formatLeadName(fullName?: string | null) {
  if (!fullName) return 'Time Palin'
  return fullName.split(' ')[0] || fullName
}

function formatFilterDisplayValue(value: PipelineAssistantFilterValue) {
  if (Array.isArray(value)) {
    if (!value.length) return 'Todos'
    return value.join(', ')
  }

  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Nao'
  }

  if (value === null || value === undefined || value === '') {
    return 'Todos'
  }

  return String(value)
}

function buildFilterEntry(input: {
  key: PipelineAssistantAppliedFilter['key']
  label: string
  value: PipelineAssistantFilterValue
  active?: boolean
  source?: PipelineAssistantFilterSource
  displayValue?: string
}) {
  const active = input.active ?? Boolean(input.value && (!Array.isArray(input.value) || input.value.length > 0))

  return {
    key: input.key,
    label: input.label,
    value: input.value,
    displayValue: input.displayValue || formatFilterDisplayValue(input.value),
    active,
    source: input.source || 'request',
  } satisfies PipelineAssistantAppliedFilter
}

function buildFiltersApplied(input: {
  query: string
  scope: PipelineAssistantRequest['scope']
  consultantId: string | null
  stageFilter: PipelineAssistantStage[]
  productId: string | null
  includeClosed: boolean
  limit: number
  consultantResolved: boolean
}) {
  return [
    buildFilterEntry({
      key: 'query',
      label: 'Pergunta',
      value: input.query,
      active: true,
      displayValue: input.query,
      source: input.query === 'Quais leads devo atacar hoje?' ? 'default' : 'request',
    }),
    buildFilterEntry({
      key: 'scope',
      label: 'Escopo',
      value: input.scope || 'all',
      active: input.scope === 'mine',
      displayValue: input.scope === 'mine' ? 'Meus leads' : 'Todos os leads',
      source: 'request',
    }),
    buildFilterEntry({
      key: 'consultantId',
      label: 'Consultor',
      value: input.consultantId,
      active: Boolean(input.consultantId) || input.consultantResolved,
      displayValue: input.consultantId || (input.consultantResolved ? 'Consultor logado' : 'Todos os consultores'),
      source: input.consultantResolved ? 'derived' : 'request',
    }),
    buildFilterEntry({
      key: 'stageFilter',
      label: 'Etapas',
      value: input.stageFilter,
      active: input.stageFilter.length > 0,
      displayValue: input.stageFilter.length ? input.stageFilter.join(', ') : 'Todas as etapas',
      source: 'request',
    }),
    buildFilterEntry({
      key: 'productId',
      label: 'Produto',
      value: input.productId,
      active: Boolean(input.productId),
      displayValue: input.productId || 'Todos os produtos',
      source: 'request',
    }),
    buildFilterEntry({
      key: 'includeClosed',
      label: 'Fechados',
      value: input.includeClosed,
      active: input.includeClosed,
      displayValue: input.includeClosed ? 'Inclui fechados' : 'Apenas abertos',
      source: 'request',
    }),
    buildFilterEntry({
      key: 'limit',
      label: 'Limite',
      value: input.limit,
      active: input.limit !== 5,
      displayValue: `${input.limit} leads`,
      source: 'request',
    }),
  ]
}

function buildAssistantMeta(params: {
  query: string
  limit: number
  scope: PipelineAssistantRequest['scope']
  consultantId: string | null
  stageFilter: PipelineAssistantStage[]
  productId: string | null
  includeClosed: boolean
  generatedAt: string
  version: string
  totalLeads: number
  filteredLeads: number
  activeLeads: number
  freshness: PipelineAssistantFreshnessMeta
  filtersApplied: PipelineAssistantAppliedFilter[]
}) {
  const meta: PipelineAssistantMeta = {
    query: params.query,
    limit: params.limit,
    scope: params.scope || 'all',
    consultantId: params.consultantId,
    stageFilter: params.stageFilter,
    productId: params.productId,
    includeClosed: params.includeClosed,
    filtersApplied: params.filtersApplied,
    totalLeads: params.totalLeads,
    filteredLeads: params.filteredLeads,
    activeLeads: params.activeLeads,
    freshness: params.freshness,
    generatedAt: params.generatedAt,
    version: params.version,
  }

  return meta
}

function buildFreshnessMeta(leads: PipelineLeadSnapshot[], referenceTime: number): PipelineAssistantFreshnessMeta {
  const freshThresholdDays = 7
  const staleThresholdDays = 15
  const trackedLeadCount = leads.reduce((count, lead) => {
    if (!lead.ai_updated_at) return count
    const parsed = new Date(lead.ai_updated_at)
    if (Number.isNaN(parsed.getTime())) return count
    return count + 1
  }, 0)

  const freshnessAts = leads
    .map((lead) => lead.ai_updated_at)
    .filter((value): value is string => Boolean(value))
    .filter((value) => !Number.isNaN(new Date(value).getTime()))

  const freshLeadCount = freshnessAts.filter((value) => {
    const parsed = new Date(value)
    const ageDays = Math.max(0, Math.floor((referenceTime - parsed.getTime()) / (1000 * 60 * 60 * 24)))
    return ageDays <= freshThresholdDays
  }).length

  const staleLeadCount = freshnessAts.filter((value) => {
    const parsed = new Date(value)
    const ageDays = Math.max(0, Math.floor((referenceTime - parsed.getTime()) / (1000 * 60 * 60 * 24)))
    return ageDays > staleThresholdDays
  }).length

  const freshestAiUpdatedAt = freshnessAts.reduce<string | null>((latest, current) => {
    if (!latest) return current
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest
  }, null)

  const unknownLeadCount = Math.max(0, leads.length - trackedLeadCount)
  const divisor = trackedLeadCount || 0

  return {
    freshestAiUpdatedAt,
    freshLeadCount,
    staleLeadCount,
    trackedLeadCount,
    unknownLeadCount,
    freshLeadRatio: divisor > 0 ? freshLeadCount / divisor : 0,
    staleLeadRatio: divisor > 0 ? staleLeadCount / divisor : 0,
    freshThresholdDays,
    staleThresholdDays,
    hasAiData: trackedLeadCount > 0,
  }
}

async function loadAssistantData(input: Required<Pick<PipelineAssistantRequest, 'query' | 'limit' | 'includeClosed'>> & {
  scope: PipelineAssistantRequest['scope']
  consultantId: string | null
  stageFilter: PipelineAssistantStage[]
  productId: string | null
}) {
  const supabase = await createClient()
  const referenceTime = Date.now()

  let resolvedConsultantId = input.consultantId
  if (input.scope === 'mine' && !resolvedConsultantId) {
    const { data: userData } = await supabase.auth.getUser()
    resolvedConsultantId = userData.user?.id || null
  }

  let leadsQuery = supabase
    .from('leads')
    .select(`
      id, name, company, stage, estimated_value, created_at,
      phone, whatsapp, email,
      product_id, consultant_id,
      product:products(id, name),
      consultant:profiles(id, full_name)
    `)
    .order('created_at', { ascending: false })

  if (!input.includeClosed) {
    leadsQuery = leadsQuery.not('stage', 'in', '("Fechado","Perdido")')
  }

  if (resolvedConsultantId) {
    leadsQuery = leadsQuery.eq('consultant_id', resolvedConsultantId)
  }

  if (input.productId) {
    leadsQuery = leadsQuery.eq('product_id', input.productId)
  }

  if (input.stageFilter.length) {
    leadsQuery = leadsQuery.in('stage', input.stageFilter)
  }

  const [{ count: totalLeadsCount, error: totalLeadsError }, { data: leadsData, error: leadsError }, { data: aiData, error: aiError }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    leadsQuery,
    supabase.from('ai_qualifications').select('lead_id, status, score, source, summary, updated_at'),
  ])

  if (totalLeadsError) {
    return {
      ok: false as const,
      error: totalLeadsError.message,
    }
  }

  if (leadsError) {
    return {
      ok: false as const,
      error: leadsError.message,
    }
  }

  if (aiError) {
    console.warn('Qualificacao IA indisponivel:', aiError.message)
  }

  const aiRecords = (aiData || []) as AiQualificationRow[]
  const aiByLead = new Map(aiRecords.map((item) => [item.lead_id, item]))

  const leads = ((leadsData || []) as LeadRow[]).map((lead) => {
    const ai = aiByLead.get(lead.id)
    const createdAt = lead.created_at ? new Date(lead.created_at) : null
    const product = Array.isArray(lead.product) ? lead.product[0] : lead.product
    const consultant = Array.isArray(lead.consultant) ? lead.consultant[0] : lead.consultant

    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || '',
      product: product?.name || 'Geral',
      product_id: lead.product_id || '',
      consultant: formatLeadName(consultant?.full_name || null),
      consultant_id: lead.consultant_id || '',
      value: Number(lead.estimated_value) || 0,
      days: createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(0, Math.floor((referenceTime - createdAt.getTime()) / (1000 * 60 * 60 * 24)))
        : 0,
      stage: getLeadStage(lead.stage),
      phone: lead.phone || '',
      whatsapp: lead.whatsapp || '',
      email: lead.email || '',
      ai_status: ai?.status || '',
      ai_score: Number(ai?.score || 0),
      ai_source: ai?.source || '',
      ai_summary: ai?.summary || '',
      ai_updated_at: ai?.updated_at || null,
    } satisfies PipelineLeadSnapshot
  })

  const freshness = buildFreshnessMeta(leads, referenceTime)

  return {
    ok: true as const,
    referenceTime,
    resolvedConsultantId,
    totalLeads: totalLeadsCount || 0,
    leads,
    aiRecords,
    freshness,
  }
}

export async function analyzePipelineAssistant(input: PipelineAssistantRequest = {}): Promise<PipelineAssistantResponse> {
  const query = (input.query?.trim() || 'Quais leads devo atacar hoje?').trim()
  const limit = typeof input.limit === 'number' ? Math.max(1, Math.min(Math.floor(input.limit), 20)) : 5
  const scope = input.scope || 'all'
  const consultantId = typeof input.consultantId === 'string' && input.consultantId.trim() ? input.consultantId.trim() : null
  const stageFilter = normalizeStageFilter(input.stageFilter)
  const productId = typeof input.productId === 'string' && input.productId.trim() ? input.productId.trim() : null
  const includeClosed = Boolean(input.includeClosed)
  const generatedAt = new Date().toISOString()
  const filtersApplied = buildFiltersApplied({
    query,
    scope,
    consultantId,
    stageFilter,
    productId,
    includeClosed,
    limit,
    consultantResolved: scope === 'mine' && !consultantId,
  })

  const loaded = await loadAssistantData({
    query,
    limit,
    scope,
    consultantId,
    stageFilter,
    productId,
    includeClosed,
  })

  if (!loaded.ok) {
    return {
      success: false,
      error: loaded.error,
      meta: {
        query,
        limit,
        scope,
        consultantId,
        stageFilter,
        productId,
        includeClosed,
        filtersApplied,
        totalLeads: 0,
        filteredLeads: 0,
        activeLeads: 0,
        freshness: {
          freshestAiUpdatedAt: null,
          freshLeadCount: 0,
          staleLeadCount: 0,
          trackedLeadCount: 0,
          unknownLeadCount: 0,
          freshLeadRatio: 0,
          staleLeadRatio: 0,
          freshThresholdDays: 7,
          staleThresholdDays: 15,
          hasAiData: false,
        },
        generatedAt,
        version: PIPELINE_ASSISTANT_VERSION,
      },
    }
  }

  const analysis = buildPipelineAssistantInsights(loaded.leads, query, { limit, now: loaded.referenceTime })
  const activeLeads = loaded.leads.filter((lead) => lead.stage !== 'Fechado' && lead.stage !== 'Perdido')
  const meta = buildAssistantMeta({
    query,
    limit,
    scope,
    consultantId: loaded.resolvedConsultantId,
    stageFilter,
    productId,
    includeClosed,
    generatedAt,
    version: PIPELINE_ASSISTANT_VERSION,
    totalLeads: loaded.totalLeads,
    filteredLeads: loaded.leads.length,
    activeLeads: activeLeads.length,
    freshness: loaded.freshness,
    filtersApplied,
  })

  return {
    success: true,
    query,
    generatedAt,
    version: PIPELINE_ASSISTANT_VERSION,
    analysis,
    metrics: {
      totalLeads: loaded.totalLeads,
      filteredLeads: loaded.leads.length,
      activeLeads: activeLeads.length,
      aiRecords: loaded.aiRecords.length,
      freshAiLeads: loaded.freshness.freshLeadCount,
      staleAiLeads: loaded.freshness.staleLeadCount,
      latestAiUpdatedAt: loaded.freshness.freshestAiUpdatedAt,
    },
    meta,
  }
}

export async function generateFollowUpSuggestion(leadId: string) {
  const supabase = await createClient()
  
  const { data: lead } = await supabase
    .from('leads')
    .select(`
      id, name, stage, 
      ai_qualifications(summary, status, score)
    `)
    .eq('id', leadId)
    .single()

  if (!lead) return { success: false, error: 'Lead nao encontrado' }

  const stage = lead.stage
  
  const suggestions: Record<string, string[]> = {
    'Contato Inicial': [
      `Olá ${lead.name}, tudo bem? Notei seu interesse na Palin e gostaria de entender melhor como podemos ajudar sua empresa hoje. Teria 5 minutos?`,
      `Oi ${lead.name}, sou da equipe Palin. Recebemos seu contato e vi que você busca soluções. Podemos conversar?`
    ],
    'Qualificacao': [
      `Fala ${lead.name}, baseado no que conversamos sobre seu perfil, montei um diagnóstico inicial. Podemos validar?`,
      `${lead.name}, tenho algumas dúvidas técnicas sobre o seu projeto para avançarmos. Consegue falar agora?`
    ],
    'Apresentacao': [
      `${lead.name}, a apresentação que preparei foca exatamente na sua dor. Qual o melhor horário para você?`,
      `Oi ${lead.name}, o que achou da solução que desenhamos? Ficou alguma dúvida sobre o escopo?`
    ],
    'Proposta': [
      `${lead.name}, a proposta está na mesa! Conseguiu revisar os valores? Estou pronto para negociar os termos finais com você.`,
      `Oi ${lead.name}, nossa proposta expira em breve. Vamos garantir essa condição especial para você?`
    ],
    'Negociacao': [
      `${lead.name}, o que falta para fecharmos? Se o problema for o prazo ou parcelamento, vamos resolver isso agora.`,
      `Oi ${lead.name}, autorizei uma condição única para fecharmos hoje. Podemos assinar?`
    ]
  }

  const selected = suggestions[stage as keyof typeof suggestions] || [
    `Olá ${lead.name}, gostaria de dar continuidade ao nosso atendimento. Como podemos avançar?`
  ]

  return { success: true, suggestions: selected }
}
