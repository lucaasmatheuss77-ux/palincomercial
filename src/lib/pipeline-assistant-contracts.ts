export type PipelineAssistantSource = 'local' | 'server'

export type PipelineAssistantMode = 'balanced' | 'attack' | 'close' | 'risk' | 'manager'

export type PipelineAssistantFilterKey = string

export type PipelineAssistantFilterSource = 'request' | 'derived' | 'default'

export type PipelineAssistantFilterValue = string | number | boolean | string[] | null

export type PipelineAssistantAppliedFilter = {
  key: PipelineAssistantFilterKey
  label: string
  value: PipelineAssistantFilterValue
  displayValue: string
  active: boolean
  source: PipelineAssistantFilterSource
}

export type PipelineAssistantStage =
  | 'Contato Inicial'
  | 'Qualificacao'
  | 'Apresentacao'
  | 'Proposta'
  | 'Negociacao'
  | 'Fechado'
  | 'Perdido'

export type PipelineLeadSnapshot = {
  id: string
  name: string
  company: string
  product: string
  product_id: string
  consultant: string
  consultant_id: string
  value: number
  days: number
  stage: PipelineAssistantStage
  phone: string
  whatsapp: string
  email: string
  notes?: string | null
  ai_status: string
  ai_score: number
  ai_source: string
  ai_summary: string
  ai_updated_at?: string | null
}

export type PipelineAssistantPrompt = {
  label: string
  prompt: string
  hint: string
}

export type PipelineAssistantInsight = {
  lead: PipelineLeadSnapshot
  rank: number
  score: number
  reasons: string[]
  nextAction: string
  signal: string
  freshnessLabel: string
  freshnessDays: number | null
}

export type PipelineAssistantAnalysis = {
  label: string
  summary: string
  detail: string
  mode: PipelineAssistantMode
  insights: PipelineAssistantInsight[]
  totalActive: number
}

export type PipelineAssistantFreshnessMeta = {
  freshestAiUpdatedAt: string | null
  freshLeadCount: number
  staleLeadCount: number
  trackedLeadCount?: number
  unknownLeadCount?: number
  freshLeadRatio?: number
  staleLeadRatio?: number
  freshThresholdDays?: number
  staleThresholdDays?: number
  hasAiData?: boolean
}

export type PipelineAssistantMeta = {
  query: string
  limit: number
  scope: 'all' | 'mine'
  consultantId?: string | null
  stageFilter: PipelineAssistantStage[]
  productId?: string | null
  includeClosed: boolean
  filtersApplied: PipelineAssistantAppliedFilter[]
  totalLeads: number
  filteredLeads: number
  activeLeads: number
  freshness: PipelineAssistantFreshnessMeta
  generatedAt: string
  version: string
}

export type PipelineAssistantRecommendationContract = {
  leadId: string
  score?: number
  reasons?: string[]
  nextAction?: string
  signal?: string
  freshnessLabel?: string
  freshnessDays?: number | null
  rank?: number
}

export type PipelineAssistantAnalysisContract = {
  source?: PipelineAssistantSource
  version?: string
  generatedAt?: string | null
  mode?: PipelineAssistantMode
  label?: string
  summary?: string
  detail?: string
  totalActive?: number
  recommendations?: PipelineAssistantRecommendationContract[]
}

export type PipelineAssistantAnalysisView = {
  source: PipelineAssistantSource
  version: string
  generatedAt: string | null
  mode: PipelineAssistantMode
  label: string
  summary: string
  detail: string
  totalActive: number
  insights: PipelineAssistantInsight[]
  filters?: PipelineAssistantAppliedFilter[]
  meta?: PipelineAssistantMeta
}

export type PipelineAssistantRequest = {
  query?: string
  limit?: number
  scope?: 'all' | 'mine'
  consultantId?: string | null
  stageFilter?: PipelineAssistantStage[]
  productId?: string | null
  includeClosed?: boolean
}

export type PipelineAssistantSuccessResponse = {
  success: true
  query: string
  generatedAt: string
  version: string
  analysis: PipelineAssistantAnalysis
  meta: PipelineAssistantMeta
  metrics: {
    totalLeads: number
    filteredLeads: number
    activeLeads: number
    freshAiLeads: number
    staleAiLeads: number
    aiRecords: number
    latestAiUpdatedAt: string | null
  }
}

export type PipelineAssistantErrorResponse = {
  success: false
  error: string
  meta: PipelineAssistantMeta
}

export type PipelineAssistantResponse =
  | PipelineAssistantSuccessResponse
  | PipelineAssistantErrorResponse

export type PipelineAssistantActionResponse = PipelineAssistantResponse

export const PIPELINE_ASSISTANT_VERSION = 'pipeline-assistant-v1'
