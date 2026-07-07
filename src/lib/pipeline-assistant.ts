export type {
  PipelineAssistantAppliedFilter,
  PipelineAssistantAnalysis,
  PipelineAssistantInsight,
  PipelineAssistantMode,
  PipelineAssistantMeta,
  PipelineAssistantFreshnessMeta,
  PipelineAssistantFilterKey,
  PipelineAssistantFilterSource,
  PipelineAssistantFilterValue,
  PipelineAssistantRequest,
  PipelineAssistantResponse,
  PipelineAssistantPrompt,
  PipelineAssistantStage,
  PipelineLeadSnapshot,
} from './pipeline-assistant-contracts'

import type {
  PipelineAssistantAnalysis,
  PipelineAssistantMode,
  PipelineLeadSnapshot,
} from './pipeline-assistant-contracts'

export { PIPELINE_ASSISTANT_VERSION } from './pipeline-assistant-contracts'

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

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function getLeadTemperature(lead: PipelineLeadSnapshot) {
  if (lead.stage === 'Proposta' || lead.stage === 'Fechado') {
    return { label: 'Quente', color: '#f97316', background: 'rgba(249,115,22,0.12)' }
  }

  if (lead.ai_score >= 80) {
    return { label: 'Promissor', color: '#93c5fd', background: 'rgba(96,165,250,0.12)' }
  }

  const cadence = CADENCE_RULES[lead.stage]
  if (cadence && lead.days > cadence.days) {
    return { label: 'Atrasado', color: '#f59e0b', background: 'rgba(245,158,11,0.12)' }
  }

  if (lead.days >= 20) {
    return { label: 'Em risco', color: '#f87171', background: 'rgba(248,113,113,0.12)' }
  }

  return { label: 'Em aquecimento', color: '#86efac', background: 'rgba(34,197,94,0.12)' }
}

const CADENCE_RULES: Record<string, { days: number; action: string }> = {
  'Contato Inicial': { days: 3, action: 'Fazer primeiro contato agora — prazo de 3 dias ativo.' },
  Qualificacao: { days: 5, action: 'Agendar reunião urgente — 5 dias é o limite.' },
  Apresentacao: { days: 5, action: 'Apresentar solução ou reengajar o lead.' },
  Proposta: { days: 4, action: 'Enviar proposta e fazer follow-up urgente.' },
}

function getLeadNextAction(lead: PipelineLeadSnapshot) {
  if (lead.stage === 'Contato Inicial') return 'Fazer primeiro contato e validar interesse.'
  if (lead.stage === 'Qualificacao') return 'Confirmar dor, escopo e potencial de compra.'
  if (lead.stage === 'Apresentacao') return 'Amarrar necessidade e desenhar proposta aderente.'
  if (lead.stage === 'Proposta') return 'Ligar urgente, apresentar valor e remover objeções para fechar.'
  return 'Registrar aprendizados e preparar expansão da conta.'
}

function getAssistantMode(query: string): { mode: PipelineAssistantMode; label: string; summary: string; detail: string } {
  const normalized = normalizeText(query)

  if (normalized.includes('risco') || normalized.includes('esfri') || normalized.includes('trav')) {
    return {
      mode: 'risk',
      label: 'Risco operacional',
      summary: 'Foquei em sinais de esfriamento, travamento e perda de tracao.',
      detail: 'A leitura pesa aging, sinais fracos de IA e oportunidades que merecem resgate rapido.',
    }
  }

  if (normalized.includes('fechar') || normalized.includes('fechamento') || normalized.includes('ganhar') || normalized.includes('conversao')) {
    return {
      mode: 'close',
      label: 'Janela de fechamento',
      summary: 'Priorizei as oportunidades mais prontas para decisao e assinatura.',
      detail: 'A leitura valoriza Proposta e Negociacao, com bonus para IA recente e score forte.',
    }
  }

  if (normalized.includes('atacar') || normalized.includes('hoje') || normalized.includes('prior') || normalized.includes('forca')) {
    return {
      mode: 'attack',
      label: 'Prioridade comercial',
      summary: 'Ordenei por oportunidade de movimento imediato no funil.',
      detail: 'A leitura favorece leads que ainda podem avancar hoje, sem deixar valor e contexto de lado.',
    }
  }

  if (normalized.includes('gestao') || normalized.includes('gerente') || normalized.includes('dashboard') || normalized.includes('analise')) {
    return {
      mode: 'manager',
      label: 'Visao de gestao',
      summary: 'Destaquei os casos mais relevantes para leitura executiva.',
      detail: 'Usei um equilibrio maior entre valor, idade, fase e qualidade da analise de IA.',
    }
  }

  return {
    mode: 'balanced',
    label: 'Ranking equilibrado',
    summary: 'Usei estagio, valor, aging e score de IA para equilibrar a sugestao.',
    detail: 'Esse modo funciona bem quando a pergunta e ampla e ainda nao define uma intencao de acao especifica.',
  }
}

function getStageScore(stage: PipelineLeadSnapshot['stage']) {
  if (stage === 'Proposta') return 40
  if (stage === 'Apresentacao') return 24
  if (stage === 'Qualificacao') return 18
  if (stage === 'Contato Inicial') return 10
  return 0
}

function getFreshnessInfo(aiUpdatedAt?: string | null, now = Date.now()) {
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

  const days = Math.max(0, Math.floor((now - updatedAt.getTime()) / (1000 * 60 * 60 * 24)))

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

function getAssistantModeWeights(mode: PipelineAssistantMode) {
  if (mode === 'risk') {
    return { stage: 0.26, value: 0.18, timing: 0.34, aiScore: 0.1, freshness: 0.06, aiStatus: 0.06, contact: 0.02 }
  }
  if (mode === 'close') {
    return { stage: 0.38, value: 0.22, timing: 0.12, aiScore: 0.18, freshness: 0.06, aiStatus: 0.02, contact: 0.02 }
  }
  if (mode === 'attack') {
    return { stage: 0.34, value: 0.22, timing: 0.2, aiScore: 0.12, freshness: 0.06, aiStatus: 0.03, contact: 0.03 }
  }
  if (mode === 'manager') {
    return { stage: 0.3, value: 0.24, timing: 0.16, aiScore: 0.14, freshness: 0.08, aiStatus: 0.04, contact: 0.02 }
  }
  return { stage: 0.3, value: 0.22, timing: 0.2, aiScore: 0.12, freshness: 0.06, aiStatus: 0.05, contact: 0.02 }
}

function getValueScore(lead: PipelineLeadSnapshot, maxValue: number) {
  if (!maxValue || !lead.value) return 0
  return Math.round((lead.value / maxValue) * 20)
}

function getTimingScore(lead: PipelineLeadSnapshot, mode: PipelineAssistantMode) {
  if (mode === 'risk') {
    if (lead.days >= 35) return 24
    if (lead.days >= 25) return 22
    if (lead.days >= 18) return 18
    if (lead.days >= 10) return 10
    return 4
  }

  if (mode === 'close') {
    if (lead.days >= 35) return 4
    if (lead.days >= 25) return 8
    if (lead.days >= 15) return 16
    if (lead.days >= 8) return 12
    return 6
  }

  if (mode === 'attack') {
    if (lead.days >= 28) return 18
    if (lead.days >= 18) return 15
    if (lead.days >= 10) return 10
    if (lead.days >= 4) return 8
    return 5
  }

  if (lead.days >= 30) return 18
  if (lead.days >= 20) return 16
  if (lead.days >= 10) return 10
  if (lead.days >= 4) return 6
  return 4
}

function getAiScoreNorm(lead: PipelineLeadSnapshot) {
  if (!lead.ai_score) return 0
  return Math.round((Math.max(0, Math.min(lead.ai_score, 100)) / 100) * 15)
}

function getAiStatusScore(lead: PipelineLeadSnapshot, mode: PipelineAssistantMode) {
  const status = normalizeText(lead.ai_status)

  if (status === 'aprovado' || status === 'approved') {
    return mode === 'risk' ? 2 : 10
  }
  if (status === 'revisar' || status === 'review' || status === 'revisao') {
    return mode === 'risk' ? 5 : 2
  }
  if (status === 'reprovado' || status === 'rejected') {
    return mode === 'risk' ? 8 : -8
  }
  if (status === 'manual') {
    return 1
  }
  return 0
}

function getLeadBandScore(lead: PipelineLeadSnapshot, mode: PipelineAssistantMode) {
  if (mode === 'risk') {
    if (lead.days >= 35) return 14
    if (lead.days >= 20) return 10
    if (lead.days >= 10) return 5
    return 0
  }

  if (mode === 'close') {
    if (lead.stage === 'Proposta') return 14
    if (lead.stage === 'Apresentacao') return 6
    return 0
  }

  if (mode === 'attack') {
    if (lead.stage === 'Proposta') return 12
    if (lead.stage === 'Apresentacao') return 6
    if (lead.stage === 'Qualificacao') return 3
    return 0
  }

  if (lead.stage === 'Proposta') return 9
  if (lead.stage === 'Apresentacao') return 4
  return 0
}

function getContactScore(lead: PipelineLeadSnapshot) {
  return lead.whatsapp || lead.phone || lead.email ? 2 : 0
}

function getAssistantNextAction(lead: PipelineLeadSnapshot, mode: PipelineAssistantMode) {
  const cadence = CADENCE_RULES[lead.stage]
  if (cadence && lead.days > cadence.days) {
    return cadence.action
  }

  if (mode === 'risk') {
    if (lead.stage === 'Proposta') return 'Retome com urgência e valide a pendência principal.'
    if (lead.stage === 'Apresentacao') return 'Reaqueça a conversa e destrave a próxima etapa.'
    return 'Reabra o contato com uma mensagem objetiva.'
  }

  if (mode === 'close') {
    if (lead.stage === 'Proposta') return 'Acelere a decisão com follow-up comercial direto.'
    return 'Avance a oportunidade para fase quente.'
  }

  if (mode === 'attack') {
    if (lead.stage === 'Proposta') return 'Faça contato agora e empurre para definição.'
    if (lead.days >= 20) return 'Vale reacender o lead com abordagem objetiva.'
    return 'Confirme o interesse e a próxima janela de ação.'
  }

  if (mode === 'manager') {
    if (lead.stage === 'Proposta') return 'Apoie o consultor e destrave o avanço.'
    return 'Revise contexto e confirme o próximo passo.'
  }

  return getLeadNextAction(lead)
}

function getAssistantLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 5
  return Math.max(1, Math.min(Math.floor(limit), 20))
}

export function buildPipelineAssistantInsights(
  leads: PipelineLeadSnapshot[],
  query: string,
  options?: {
    limit?: number
    now?: number
  }
): PipelineAssistantAnalysis {
  const activeLeads = leads.filter((lead) => lead.stage !== 'Fechado' && lead.stage !== 'Perdido')
  const normalizedQuery = normalizeText(query)
  const { mode, label, summary, detail } = getAssistantMode(query)
  const maxValue = activeLeads.reduce((max, lead) => Math.max(max, lead.value || 0), 0)
  const referenceTime = options?.now ?? Date.now()
  const limit = getAssistantLimit(options?.limit)

  if (!activeLeads.length) {
    return {
      label,
      summary: 'Nao ha leads ativos suficientes para ranking no momento.',
      detail,
      mode,
      insights: [],
      totalActive: 0,
    }
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter((token) => token.length > 2)

  const insights = activeLeads
    .map((lead) => {
      const reasons: string[] = []
      const weights = getAssistantModeWeights(mode)
      const freshness = getFreshnessInfo(lead.ai_updated_at, referenceTime)
      let score = 0

      const stageScore = Math.round(getStageScore(lead.stage) * weights.stage) + getLeadBandScore(lead, mode)
      if (stageScore > 0) {
        score += stageScore
        if (lead.stage === 'Proposta') {
          reasons.push(`fase quente em ${lead.stage.toLowerCase()}`)
        } else {
          reasons.push(`em ${lead.stage.toLowerCase()}`)
        }
      }

      const valueScore = Math.round(getValueScore(lead, maxValue) * weights.value)
      if (valueScore > 0) {
        score += valueScore
        reasons.push(`valor de ${formatCompactCurrency(lead.value)}`)
      }

      const timingScore = Math.round(getTimingScore(lead, mode) * weights.timing)
      if (timingScore > 0) {
        score += timingScore
        if (mode === 'risk') {
          reasons.push(`${lead.days} dias sem movimento`)
        } else if (lead.days >= 20) {
          reasons.push(`${lead.days} dias no pipeline`)
        } else {
          reasons.push(`${lead.days} dias em andamento`)
        }
      }

      // Pontuação de Cadência
      const cadence = CADENCE_RULES[lead.stage]
      if (cadence && lead.days > cadence.days) {
        if (mode === 'risk') {
          score += 18
          reasons.push(`prazo de cadência vencido (${cadence.days}d)`)
        } else if (mode === 'balanced' || mode === 'attack') {
          score -= 10
          reasons.push('alerta de cadência: contato pendente')
        }
      }

      const aiScore = Math.round(getAiScoreNorm(lead) * weights.aiScore)
      if (aiScore > 0) {
        score += aiScore
        reasons.push(`score IA ${lead.ai_score}`)
      }

      const aiStatusScore = Math.round(getAiStatusScore(lead, mode) * weights.aiStatus)
      if (aiStatusScore !== 0) {
        score += aiStatusScore
      }

      const normalizedStatus = normalizeText(lead.ai_status)
      if (normalizedStatus === 'aprovado' || normalizedStatus === 'approved') {
        reasons.push('IA aprovou a oportunidade')
      } else if (normalizedStatus === 'revisar' || normalizedStatus === 'review' || normalizedStatus === 'revisao') {
        reasons.push('IA pediu revisao')
      } else if (normalizedStatus === 'reprovado' || normalizedStatus === 'rejected') {
        reasons.push('IA sinalizou baixa aderencia')
      }

      const freshnessScore = Math.round(freshness.score * weights.freshness)
      if (freshnessScore !== 0) {
        score += freshnessScore
      }
      if (freshness.days !== null) {
        if (freshness.isFresh) {
          reasons.push(`analise IA fresca ha ${freshness.days} dias`)
        } else if (freshness.isStale) {
          reasons.push(`analise IA antiga ha ${freshness.days} dias`)
        } else {
          reasons.push(`analise IA ha ${freshness.days} dias`)
        }
      } else {
        reasons.push(freshness.reason)
      }

      const contactScore = Math.round(getContactScore(lead) * weights.contact)
      if (contactScore > 0) {
        score += contactScore
        reasons.push('canal de contato pronto')
      }

      if (mode === 'attack') {
        if (lead.stage === 'Proposta') {
          reasons.push('boa para forca imediata')
        }
        if (lead.days >= 15) {
          reasons.push('janela boa para retomada hoje')
        }
      }

      if (mode === 'close') {
        if (lead.stage === 'Proposta') {
          reasons.push('janela de fechamento aberta, pronta para fechamento assistido')
        }
        if (freshness.isFresh) {
          reasons.push('analise IA recente apoia a decisao')
        }
      }

      if (mode === 'risk') {
        if (lead.days >= 20) {
          reasons.push('sinal de esfriamento')
        }
        if (normalizedStatus === 'revisar' || normalizedStatus === 'reprovado' || normalizedStatus === 'rejected') {
          reasons.push('precisa de revisao')
        }
        if (freshness.isStale) {
          reasons.push('IA desatualizada aumenta o risco operacional')
        }
      }

      if (mode === 'manager' && (lead.stage === 'Proposta')) {
        reasons.push('impacto comercial relevante')
      }

      if (mode === 'balanced' && freshness.isFresh) {
        reasons.push('boa confianca na analise atual')
      }

      const normalizedLeadText = [lead.name, lead.company, lead.product, lead.consultant, lead.ai_summary, lead.ai_source]
        .filter(Boolean)
        .map((item) => normalizeText(item))
        .join(' ')

      const queryMatches = normalizedQuery
        ? queryTokens.some((token) => normalizedLeadText.includes(token)) || normalizedLeadText.includes(normalizedQuery)
        : false

      if (queryMatches) {
        score += 10
        reasons.push('corresponde ao termo da pergunta')
      }

      return {
        lead,
        score,
        reasons,
        nextAction: getAssistantNextAction(lead, mode),
        signal: getLeadTemperature(lead).label,
        freshnessLabel: freshness.label,
        freshnessDays: freshness.days,
      }
    })
    .sort((a, b) => {
      const scoreDelta = b.score - a.score
      if (scoreDelta !== 0) return scoreDelta
      const stageDelta = getStageScore(b.lead.stage) - getStageScore(a.lead.stage)
      if (stageDelta !== 0) return stageDelta
      const valueDelta = b.lead.value - a.lead.value
      if (valueDelta !== 0) return valueDelta
      const freshnessDelta = (a.freshnessDays ?? Number.POSITIVE_INFINITY) - (b.freshnessDays ?? Number.POSITIVE_INFINITY)
      if (freshnessDelta !== 0) return freshnessDelta
      return a.lead.days - b.lead.days
    })
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }))

  return {
    label,
    summary,
    detail,
    mode,
    insights,
    totalActive: activeLeads.length,
  }
}



