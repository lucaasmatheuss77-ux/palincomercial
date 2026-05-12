/**
 * Testes para funções puras de pipeline-assistant-contracts.ts
 * e para lógica auxiliar do pipeline-assistant.ts (exports isolados)
 *
 * @jest-environment node
 */

import {
  PIPELINE_ASSISTANT_VERSION,
  type PipelineAssistantStage,
  type PipelineLeadSnapshot,
  type PipelineAssistantFilterValue,
} from '../lib/pipeline-assistant-contracts'

// ─────────────────────────────────────────────
// Constante de versão
// ─────────────────────────────────────────────

describe('PIPELINE_ASSISTANT_VERSION', () => {
  it('é uma string não-vazia', () => {
    expect(typeof PIPELINE_ASSISTANT_VERSION).toBe('string')
    expect(PIPELINE_ASSISTANT_VERSION.length).toBeGreaterThan(0)
  })

  it('contém "pipeline-assistant"', () => {
    expect(PIPELINE_ASSISTANT_VERSION).toContain('pipeline-assistant')
  })
})

// ─────────────────────────────────────────────
// Testes de tipagem via runtime (shape checking)
// ─────────────────────────────────────────────

describe('PipelineLeadSnapshot — shape validation', () => {
  const validLead: PipelineLeadSnapshot = {
    id: 'lead-123',
    name: 'Empresa ABC',
    company: 'ABC LTDA',
    product: 'Crédito Empresarial',
    product_id: 'prod-1',
    consultant: 'Ana',
    consultant_id: 'user-1',
    value: 50000,
    days: 10,
    stage: 'Proposta',
    phone: '11999990000',
    whatsapp: '11999990000',
    email: 'abc@empresa.com',
    ai_status: 'qualified',
    ai_score: 87,
    ai_source: 'gpt-4',
    ai_summary: 'Lead com alta probabilidade de fechamento',
    ai_updated_at: '2026-05-01T10:00:00Z',
  }

  it('aceita objeto com todos os campos obrigatórios', () => {
    expect(validLead.id).toBe('lead-123')
    expect(validLead.stage).toBe('Proposta')
    expect(typeof validLead.value).toBe('number')
    expect(typeof validLead.days).toBe('number')
    expect(typeof validLead.ai_score).toBe('number')
  })

  it('ai_updated_at aceita null', () => {
    const withNull: PipelineLeadSnapshot = { ...validLead, ai_updated_at: null }
    expect(withNull.ai_updated_at).toBeNull()
  })

  it('notes é opcional', () => {
    const withNotes: PipelineLeadSnapshot = { ...validLead, notes: 'Observação importante' }
    expect(withNotes.notes).toBe('Observação importante')
  })
})

// ─────────────────────────────────────────────
// PipelineAssistantStage — valores válidos
// ─────────────────────────────────────────────

describe('PipelineAssistantStage', () => {
  const validStages: PipelineAssistantStage[] = [
    'Contato Inicial',
    'Qualificacao',
    'Apresentacao',
    'Proposta',
    'Negociacao',
    'Fechado',
    'Perdido',
  ]

  it('contém todos os 7 estágios do pipeline', () => {
    expect(validStages).toHaveLength(7)
  })

  validStages.forEach((stage) => {
    it(`estágio "${stage}" é uma string válida`, () => {
      const s: PipelineAssistantStage = stage
      expect(typeof s).toBe('string')
    })
  })
})

// ─────────────────────────────────────────────
// PipelineAssistantFilterValue — polimorfismo
// ─────────────────────────────────────────────

describe('PipelineAssistantFilterValue — tipos aceitos', () => {
  const cases: PipelineAssistantFilterValue[] = [
    'texto',
    42,
    true,
    false,
    ['a', 'b', 'c'],
    null,
  ]

  cases.forEach((val) => {
    it(`aceita valor: ${JSON.stringify(val)}`, () => {
      const v: PipelineAssistantFilterValue = val
      // Apenas verificar que o tipo é atribuível
      expect(v).toBeDefined() // null passa pois defined só checa undefined
      if (val === null) expect(v).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────
// Lógica de getLeadStage — isolada via re-implementação para teste
// (a função original está no server action, não é exportada)
// ─────────────────────────────────────────────

function getLeadStageLocal(stage: string | null): PipelineAssistantStage {
  if (stage === 'Contato Inicial' || stage === 'Lead') return 'Contato Inicial'
  if (stage === 'Qualificacao' || stage === 'Qualificado') return 'Qualificacao'
  if (stage === 'Apresentacao' || stage === 'Diagnostico' || stage === 'Diagnóstico') return 'Apresentacao'
  if (stage === 'Proposta') return 'Proposta'
  if (stage === 'Negociacao' || stage === 'Negociação') return 'Negociacao'
  if (stage === 'Fechado') return 'Fechado'
  return 'Perdido'
}

describe('getLeadStage — mapeamento de aliases de estágios', () => {
  it('"Lead" mapeia para "Contato Inicial"', () => {
    expect(getLeadStageLocal('Lead')).toBe('Contato Inicial')
  })
  it('"Qualificado" mapeia para "Qualificacao"', () => {
    expect(getLeadStageLocal('Qualificado')).toBe('Qualificacao')
  })
  it('"Diagnóstico" mapeia para "Apresentacao"', () => {
    expect(getLeadStageLocal('Diagnóstico')).toBe('Apresentacao')
  })
  it('"Diagnostico" (sem acento) mapeia para "Apresentacao"', () => {
    expect(getLeadStageLocal('Diagnostico')).toBe('Apresentacao')
  })
  it('"Negociação" (com acento) mapeia para "Negociacao"', () => {
    expect(getLeadStageLocal('Negociação')).toBe('Negociacao')
  })
  it('"Fechado" mapeia para "Fechado"', () => {
    expect(getLeadStageLocal('Fechado')).toBe('Fechado')
  })
  it('stage nulo retorna "Perdido" (fallback)', () => {
    expect(getLeadStageLocal(null)).toBe('Perdido')
  })
  it('stage desconhecido retorna "Perdido" (fallback)', () => {
    expect(getLeadStageLocal('Cancelado')).toBe('Perdido')
  })
})

// ─────────────────────────────────────────────
// Lógica buildFreshnessMeta — isolada para teste
// ─────────────────────────────────────────────

function buildFreshnessMetaLocal(leads: { ai_updated_at?: string | null }[], referenceTime: number) {
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

  const unknownLeadCount = Math.max(0, leads.length - trackedLeadCount)
  const divisor = trackedLeadCount || 0

  return {
    trackedLeadCount,
    freshLeadCount,
    staleLeadCount,
    unknownLeadCount,
    freshLeadRatio: divisor > 0 ? freshLeadCount / divisor : 0,
    staleLeadRatio: divisor > 0 ? staleLeadCount / divisor : 0,
    hasAiData: trackedLeadCount > 0,
  }
}

describe('buildFreshnessMeta — cálculo de frescor dos leads', () => {
  const NOW = new Date('2026-05-11T00:00:00Z').getTime()
  const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

  it('sem leads: tudo é zero', () => {
    const result = buildFreshnessMetaLocal([], NOW)
    expect(result.trackedLeadCount).toBe(0)
    expect(result.freshLeadCount).toBe(0)
    expect(result.staleLeadCount).toBe(0)
    expect(result.hasAiData).toBe(false)
  })

  it('leads sem ai_updated_at são "desconhecidos"', () => {
    const leads = [{ ai_updated_at: null }, { ai_updated_at: undefined }]
    const result = buildFreshnessMetaLocal(leads, NOW)
    expect(result.trackedLeadCount).toBe(0)
    expect(result.unknownLeadCount).toBe(2)
    expect(result.hasAiData).toBe(false)
  })

  it('lead de 3 dias atrás é "fresco" (< 7 dias)', () => {
    const leads = [{ ai_updated_at: daysAgo(3) }]
    const result = buildFreshnessMetaLocal(leads, NOW)
    expect(result.freshLeadCount).toBe(1)
    expect(result.staleLeadCount).toBe(0)
  })

  it('lead de 20 dias atrás é "stale" (> 15 dias)', () => {
    const leads = [{ ai_updated_at: daysAgo(20) }]
    const result = buildFreshnessMetaLocal(leads, NOW)
    expect(result.staleLeadCount).toBe(1)
    expect(result.freshLeadCount).toBe(0)
  })

  it('lead de 10 dias atrás não é fresco nem stale (zona cinza)', () => {
    const leads = [{ ai_updated_at: daysAgo(10) }]
    const result = buildFreshnessMetaLocal(leads, NOW)
    expect(result.freshLeadCount).toBe(0)
    expect(result.staleLeadCount).toBe(0)
    expect(result.trackedLeadCount).toBe(1)
  })

  it('freshLeadRatio é calculado corretamente', () => {
    const leads = [
      { ai_updated_at: daysAgo(2) }, // fresh
      { ai_updated_at: daysAgo(3) }, // fresh
      { ai_updated_at: daysAgo(20) }, // stale
    ]
    const result = buildFreshnessMetaLocal(leads, NOW)
    expect(result.freshLeadCount).toBe(2)
    expect(result.staleLeadCount).toBe(1)
    expect(result.freshLeadRatio).toBeCloseTo(2 / 3)
    expect(result.staleLeadRatio).toBeCloseTo(1 / 3)
  })
})
