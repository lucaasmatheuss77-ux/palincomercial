'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ElementType } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Flame,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Tv,
  Users,
  Zap,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export type MomentumData = { today: number; week: number; month: number; meta: number }
export type LastDealData = { leadName: string; consultantName: string; value: number; closedAt: string | null } | null

export type KPIData = {
  revenue: number
  revenueMeta: number
  revenueTrend: number
  contracts: number
  contractsMeta: number
  activeLeads: number
  teamSize: number
  topConsultant: string
  topConsultantXp: number
  conversionRate: number
  averageTicket: number
  winRate: number
  averagePipelineDays: number
  lateStageOpportunities: number
  aiQualifiedLeads: number
  aiApprovalRate: number
  aiToClosedRate: number
  eventsContracts: number
  eventsRoi: number
  leadVelocity: number
  lossRate: number
  lostDeals: number
}

export type PipelineData = { stage: string; count: number }[]
export type ProductData = { name: string; value: number; color: string }[]
export type RankingData = { name: string; role: string; xp: number; contratos: number; nivel: string; meta: number }[]
export type ActivityData = { tipo: string; desc: string; valor: string; tempo: string; cor: string }[]
export type MonthlyData = { mes: string; receita: number; meta: number }[]
export type ContractsMonthlyData = { mes: string; contratos: number }[]
export type ProductFocusData = {
  id: string
  name: string
  category: string
  color: string
  participation: number
  contractsMeta: number
  kpis: KPIData
  pipelineData: PipelineData
  revenueData: MonthlyData
  recentActivity: ActivityData
  staleLeads: { id: string; name: string; stage: string; days_stale: number }[]
}

const STAGE_LABELS: Record<string, string> = {
  'Contato Inicial': 'Contato Inicial',
  Qualificacao: 'Qualificação',
  Apresentacao: 'Apresentação',
  Proposta: 'Proposta',
  Fechado: 'Fechamento',
}

const STAGE_COLORS: Record<string, string> = {
  'Contato Inicial': '#9ca3af',
  Qualificacao: '#3b82f6',
  Apresentacao: '#eab308',
  Proposta: '#ef4444',
  Fechado: '#3b82f6',
}

const CATEGORY_DEFINITIONS = [
  {
    key: 'tributario',
    label: 'Tributário',
    tone: '#eab308',
    terms: ['tribut', 'icms', 'pis', 'cofins', 'irpj', 'csll', 'fiscal', 'credito', 'crédito', 'cat 83'],
  },
  {
    key: 'educacional',
    label: 'Educacional',
    tone: '#38bdf8',
    terms: ['educ', 'trein', 'curso', 'mentoria', 'workshop', 'palestra'],
  },
  {
    key: 'saude-mental',
    label: 'Integramente',
    tone: '#c084fc',
    terms: ['saude mental', 'saúde mental', 'psic', 'nr1', 'nr-1', 'bem-estar', 'bem estar'],
  },
  {
    key: 'rural',
    label: 'Rural',
    tone: '#22c55e',
    terms: ['rural', 'agro', 'agric', 'fazenda', 'campo', 'produtor', 'agronegocio', 'agronegócio'],
  },
  {
    key: 'tecnologia',
    label: 'Tecnologia',
    tone: '#06b6d4',
    terms: ['tech', 'tecnolog', 'software', 'sistema', 'automacao', 'automação', 'dados'],
  },
]

function pct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : '0.0'}%`
}

function matchCategory(name: string, explicitCategory?: string | null) {
  const normalized = `${explicitCategory || ''} ${name}`.toLowerCase()
  return CATEGORY_DEFINITIONS.find((category) => category.terms.some((term) => normalized.includes(term))) || CATEGORY_DEFINITIONS[0]
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'var(--brand-primary)',
}: {
  icon: ElementType
  label: string
  value: string | number
  detail: string
  tone?: string
}) {
  return (
    <div className="glass-card dash-stat-card">
      <div className="dash-stat-top">
        <span>{label}</span>
        <Icon size={17} color={tone} aria-hidden="true" />
      </div>
      <strong style={{ color: tone }}>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function CommandMetric({
  label,
  value,
  caption,
  tone,
}: {
  label: string
  value: string | number
  caption: string
  tone: string
}) {
  return (
    <div className="dash-command-metric" style={{ borderColor: `${tone}36`, background: `${tone}0f` }}>
      <span style={{ color: tone }}>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  )
}

export default function DashboardClient({
  kpis,
  pipelineData,
  productData,
  momentumData,
  recentActivity,
  productFocusData,
  contractsMonthly,
}: {
  kpis: KPIData
  pipelineData: PipelineData
  productData: ProductData
  momentumData: MomentumData
  lastDeal: LastDealData
  recentActivity: ActivityData
  revenueData: MonthlyData
  productFocusData: ProductFocusData[]
  contractsMonthly: ContractsMonthlyData
}) {
  const [focusMode, setFocusMode] = useState<'geral' | string>('geral')
  const [isTvMode, setIsTvMode] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentMonth = searchParams.get('month') || (new Date().getMonth() + 1).toString()
  const currentYear = searchParams.get('year') || new Date().getFullYear().toString()

  const selectedProductFocus = productFocusData.find((item) => item.id === focusMode)
  const activeKpis = selectedProductFocus?.kpis || kpis
  const activePipelineData = selectedProductFocus?.pipelineData || pipelineData
  const activeRecentActivity = selectedProductFocus?.recentActivity || recentActivity
  const activeStaleLeads = selectedProductFocus
    ? selectedProductFocus.staleLeads
    : productFocusData.flatMap((product) => product.staleLeads).filter((lead, index, array) => array.findIndex((item) => item.id === lead.id) === index)

  const maxPipelineCount = Math.max(...activePipelineData.map((item) => item.count), 1)
  const leadingProduct = productData
    .filter((item) => item.name.toLowerCase() !== 'geral' && item.name !== 'Sem leads ativos')
    .sort((left, right) => right.value - left.value)[0]

  const categoryBase = new Map(CATEGORY_DEFINITIONS.map((category) => [
    category.key,
    {
      ...category,
      activeLeads: 0,
      contracts: 0,
      proposals: 0,
      stale: 0,
      participation: 0,
      services: [] as string[],
    },
  ]))

  productFocusData.forEach((product) => {
    const category = matchCategory(product.name, product.category)
    const bucket = categoryBase.get(category.key)
    if (!bucket) return
    bucket.activeLeads += product.kpis.activeLeads
    bucket.contracts += product.kpis.contracts
    bucket.proposals += product.kpis.lateStageOpportunities
    bucket.stale += product.staleLeads.length
    bucket.participation += product.participation
    if (!product.name.startsWith('>')) bucket.services.push(product.name)
  })

  const categoryGoals = Array.from(categoryBase.values()).map((category, index) => ({
    ...category,
    services: category.services.slice(0, 3),
    order: index,
  }))

  const categoryAttention = categoryGoals
    .map((category) => {
      const pressure = category.proposals * 3 + category.stale * 2 + category.activeLeads
      return {
        ...category,
        pressure,
        message:
          category.proposals > 0
            ? `${category.proposals} proposta${category.proposals > 1 ? 's' : ''} para fechar agora`
            : category.stale > 0
              ? `${category.stale} lead${category.stale > 1 ? 's' : ''} parado${category.stale > 1 ? 's' : ''}`
              : 'categoria sob controle',
      }
    })
    .sort((left, right) => right.pressure - left.pressure)
  const remainingContracts = Math.max(activeKpis.contractsMeta - activeKpis.contracts, 0)
  const hottestCategory = categoryAttention[0]
  const commandMode = activeStaleLeads.length > 0 ? 'resgatar' : activeKpis.lateStageOpportunities > 0 ? 'fechar' : 'prospectar'
  const commandNow = commandMode === 'resgatar' ? 'Resgatar' : commandMode === 'fechar' ? 'Fechar' : 'Prospectar'
  const commandCaption = commandMode === 'resgatar'
    ? `${activeStaleLeads.length} cliente(s) em risco`
    : commandMode === 'fechar'
      ? `${activeKpis.lateStageOpportunities} proposta(s) abertas`
      : 'criar novas oportunidades'
  const currentPeriodDate = new Date(Number(currentYear), Number(currentMonth) - 1, 1)
  const currentPeriodLabel = currentPeriodDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  const contractsHistoryTotal = contractsMonthly.reduce((sum, item) => sum + Number(item.contratos || 0), 0)
  const today = new Date()
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const elapsedMonthDays = today.getDate()
  const remainingMonthDays = Math.max(daysInCurrentMonth - elapsedMonthDays + 1, 1)
  const expectedByToday = momentumData.meta > 0
    ? Math.ceil((momentumData.meta / daysInCurrentMonth) * elapsedMonthDays)
    : 0
  const remainingMonthContracts = Math.max(momentumData.meta - momentumData.month, 0)
  const neededDailyPace = momentumData.meta > 0
    ? Math.ceil(remainingMonthContracts / remainingMonthDays)
    : 0
  const goToMonth = (offset: number) => {
    const date = new Date(Number(currentYear), Number(currentMonth) - 1 + offset, 1)
    router.push(`?month=${date.getMonth() + 1}&year=${date.getFullYear()}`)
  }

  useEffect(() => {
    if (!isTvMode) return
    const ids = ['geral', ...productFocusData.map((product) => product.id)]
    const interval = window.setInterval(() => {
      setFocusMode((current) => {
        const currentIndex = ids.indexOf(current)
        return ids[(currentIndex + 1) % ids.length]
      })
    }, 12000)
    return () => window.clearInterval(interval)
  }, [isTvMode, productFocusData])

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh()
    }, isTvMode ? 30000 : 180000)
    return () => window.clearInterval(interval)
  }, [isTvMode, router])

  return (
    <div className="dashboard-v3">
      <section className="dash-command">
        <div className="dash-command-copy">
          <span className="dash-eyebrow">
            <Sparkles size={14} aria-hidden="true" />
            Painel de decisão comercial
          </span>
          <h1>O que precisamos fazer agora para vender mais e não perder cliente?</h1>
        </div>
        <button
          type="button"
          className="dash-tv-toggle"
          data-active={isTvMode}
          onClick={() => setIsTvMode((current) => !current)}
          aria-label={isTvMode ? 'Modo TV ligado' : 'Modo TV desligado'}
          title={isTvMode ? 'TV ligada' : 'Modo TV'}
        >
          <Tv size={16} aria-hidden="true" />
        </button>
      </section>

      <section className="dash-alert-grid">
        <div className="glass-card dash-actions-card dash-actions-card-hot">
          <div className="dash-section-title">
            <div>
              <h2>Comando do dia</h2>
              <p>Meta geral distribuída nos 5 focos</p>
            </div>
            <AlertCircle size={24} color="#ef4444" aria-hidden="true" />
          </div>
          <div className="dash-action-list">
            <CommandMetric
              label="Faltam"
              value={remainingContracts}
              caption="contratos para a meta"
              tone="#ef4444"
            />
            <CommandMetric
              label="Foco"
              value={hottestCategory?.label || 'Geral'}
              caption="categoria prioritária"
              tone="var(--brand-primary)"
            />
            <CommandMetric
              label="Agora"
              value={commandNow}
              caption={commandCaption}
              tone="#38bdf8"
            />
          </div>
        </div>
      </section>

      <section className="dash-category-grid">
        {categoryGoals.map((category) => {
          const volume = category.contracts + category.activeLeads + category.proposals
          const percent = Math.min(volume * 12, 100)
          return (
            <div key={category.key} className="glass-card dash-category-card" style={{ '--category-tone': category.tone } as CSSProperties}>
              <div className="dash-category-head">
                <span />
                <strong>{category.label}</strong>
              </div>
              <div className="dash-category-metric">
                <b>{category.contracts}</b>
                <small>contratos</small>
              </div>
              <div className="dash-category-bar"><i style={{ width: `${percent}%` }} /></div>
              <div className="dash-category-foot">
                <span>{category.activeLeads} leads</span>
                <span>{category.proposals} propostas</span>
                <span>{category.stale} risco</span>
              </div>
            </div>
          )
        })}
      </section>

      <section className="dash-risk-strip glass-card">
        <div className="dash-risk-card dash-risk-card-hot">
          <div className="dash-section-title">
            <div>
              <h2>Risco de perda</h2>
              <p>{activeStaleLeads.length > 0 ? 'clientes que precisam de resgate' : 'sem cliente parado agora'}</p>
            </div>
            <ShieldAlert size={24} color="#ef4444" aria-hidden="true" />
          </div>
          <strong>{activeStaleLeads.length}</strong>
          <p>{activeStaleLeads.length > 0 ? 'acionar antes de perder' : 'sem cliente parado agora'}</p>
          {activeStaleLeads.slice(0, 2).map((lead) => (
            <div key={lead.id || lead.name} className="dash-stale-row">
              <span>{lead.name}</span>
              <b>{lead.days_stale}d</b>
            </div>
          ))}
        </div>
      </section>

      <section className="dash-health-grid">
        <StatCard icon={Users} label="Leads ativos" value={activeKpis.activeLeads} detail="oportunidades em movimento" tone="#38bdf8" />
        <StatCard icon={Flame} label="Propostas abertas" value={activeKpis.lateStageOpportunities} detail="precisam de fechamento" tone="#ef4444" />
        <StatCard icon={CheckCircle2} label="Contratos fechados" value={activeKpis.contracts} detail={`meta operacional: ${activeKpis.contractsMeta}`} tone="#22c55e" />
        <StatCard icon={Target} label="Conversão" value={pct(activeKpis.conversionRate)} detail="lead para contrato" tone="var(--brand-primary)" />
        <StatCard icon={Activity} label="Ciclo médio" value={`${Math.round(activeKpis.averagePipelineDays)}d`} detail="média de idade dos leads ativos" tone="#f97316" />
        <StatCard icon={TrendingUp} label="Serviço líder" value={leadingProduct ? `${leadingProduct.value}%` : '0%'} detail={leadingProduct?.name || 'sem volume ativo'} tone={leadingProduct?.color || '#94a3b8'} />
      </section>

      <section className="dash-main-grid">
        <div className="glass-card dash-pipeline-card">
          <div className="dash-section-title">
            <div>
              <h2>Funil em 5 etapas</h2>
              <p>Onde está travando</p>
            </div>
            <BarChart3 size={20} color="var(--brand-primary)" aria-hidden="true" />
          </div>
          <div className="dash-pipeline-list">
            {activePipelineData.map((stage) => {
              const color = STAGE_COLORS[stage.stage] || 'var(--brand-primary)'
              const width = Math.max((stage.count / maxPipelineCount) * 100, stage.count > 0 ? 8 : 0)
              return (
                <div key={stage.stage} className="dash-pipeline-row">
                  <div>
                    <span style={{ background: color }} />
                    <strong>{STAGE_LABELS[stage.stage] || stage.stage}</strong>
                  </div>
                  <div>
                    <i style={{ width: `${width}%`, background: color }} />
                  </div>
                  <b>{stage.count}</b>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="dash-secondary-grid">
        <div className="glass-card dash-service-card">
          <div className="dash-section-title">
            <div>
              <h2>Mix de serviços</h2>
              <p>Volume por serviço</p>
            </div>
            <Zap size={20} color="#38bdf8" aria-hidden="true" />
          </div>
          <div className="dash-service-list">
            {(() => {
              const realProducts = productData.filter(
                (product) =>
                  product.name.toLowerCase() !== 'geral' &&
                  product.name.toLowerCase() !== 'sem leads ativos'
              ).sort((left, right) => right.value - left.value).slice(0, 5)
              if (realProducts.length === 0) {
                return <div className="dash-empty">Nenhum serviço com volume ativo no momento.</div>
              }
              return realProducts.map((product, index) => (
                <div key={product.name} className="dash-service-row dash-service-row-card">
                  <em>{index + 1}</em>
                  <span style={{ background: product.color }} />
                  <strong>{product.name}</strong>
                  <div><i style={{ width: `${Math.min(product.value, 100)}%`, background: product.color }} /></div>
                  <b>{product.value}%</b>
                </div>
              ))
            })()}
          </div>
        </div>

        <div className="glass-card dash-rhythm-card">
          <div className="dash-section-title">
            <div>
              <h2>Ritmo do mês</h2>
              <p>Fechamentos registrados</p>
            </div>
            <CalendarClock size={20} color="var(--brand-primary)" aria-hidden="true" />
          </div>
          <div className="dash-rhythm-grid">
            <div><em style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔥</em><strong>{momentumData.today}</strong><span>Hoje</span></div>
            <div><em style={{ fontSize: '1.5rem', lineHeight: 1 }}>📅</em><strong>{momentumData.week}</strong><span>7 dias</span></div>
            <div><em style={{ fontSize: '1.5rem', lineHeight: 1 }}>🎯</em><strong>{momentumData.month}</strong><span>Mês</span></div>
          </div>
          <div className="dash-rhythm-progress">
            <div>
              <span>Ritmo contra meta</span>
              <b>{momentumData.meta > 0 ? Math.round((momentumData.month / momentumData.meta) * 100) : 0}%</b>
            </div>
            <i>
              <span style={{ width: `${Math.min(momentumData.meta > 0 ? (momentumData.month / momentumData.meta) * 100 : 0, 100)}%` }} />
            </i>
          </div>
          <div className="dash-month-nav">
            <button type="button" onClick={() => goToMonth(-1)} aria-label="Mês anterior">‹</button>
            <span>{currentPeriodLabel.charAt(0).toUpperCase() + currentPeriodLabel.slice(1)}</span>
            <button type="button" onClick={() => goToMonth(1)} aria-label="Próximo mês">›</button>
          </div>
        </div>

      </section>

      <section className="glass-card dash-activity-card">
        <div className="dash-section-title">
          <div>
            <h2>Últimas movimentações</h2>
            <p>O que mudou recentemente</p>
          </div>
          <ArrowRight size={20} color="var(--brand-primary)" aria-hidden="true" />
        </div>
        {activeRecentActivity.length > 0 ? (
          <div className="dash-activity-grid">
            {activeRecentActivity.map((activity) => (
              <div key={`${activity.tipo}-${activity.desc}-${activity.tempo}`}>
                <div>
                  <strong>{activity.tipo}</strong>
                  <span>{activity.tempo}</span>
                </div>
                <p>{activity.desc}</p>
                <small style={{ color: activity.cor }}>{activity.valor}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dash-empty">Nenhuma movimentação registrada ainda.</div>
        )}
      </section>

      <section className="glass-card dash-contracts-card">
        <div className="dash-section-title">
          <div>
            <h2>Histórico de contratos</h2>
            <p>Total somado: {contractsHistoryTotal} contratos nos últimos meses</p>
          </div>
          <Target size={20} color="#22c55e" aria-hidden="true" />
        </div>
        <div className="dash-contract-bars">
          {contractsMonthly.map((month) => {
            const maxContracts = Math.max(...contractsMonthly.map((item) => item.contratos), 1)
            const height = Math.max((month.contratos / maxContracts) * 100, month.contratos > 0 ? 10 : 3)
            return (
              <div key={month.mes}>
                <div><span style={{ height: `${height}%` }} /></div>
                <b>{month.contratos}</b>
                <small>{month.mes}</small>
              </div>
            )
          })}
        </div>
      </section>

      <style>{`
        .dashboard-v3 {
          width: 100%;
          max-width: 1600px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }

        .dash-command {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          padding-right: 44px;
        }

        .dash-command-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          max-width: 1120px;
        }

        .dash-command-copy h1 {
          color: var(--brand-text);
          font-family: 'Arial Narrow', 'Roboto Condensed', 'Inter Tight', 'Segoe UI', sans-serif;
          font-size: clamp(1.25rem, 1.75vw, 1.95rem);
          font-weight: 900;
          line-height: 1.05;
          margin: 8px 0 4px;
          max-width: none;
          letter-spacing: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dash-command-copy p,
        .dash-section-title p {
          color: var(--brand-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .dash-command-copy p {
          display: none;
          max-width: 720px;
          font-size: 0.92rem;
          color: #9fb1cc;
          padding-left: 12px;
          border-left: 2px solid rgba(212,160,23,0.75);
        }

        .dash-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--brand-primary);
          font-size: 0.72rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .dash-tv-toggle {
          position: absolute;
          top: 0;
          right: 0;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 7px;
          background: rgba(255,255,255,0.035);
          color: var(--brand-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          font-weight: 900;
          cursor: pointer;
        }

        .dash-tv-toggle[data-active='true'] {
          border-color: rgba(34,197,94,0.34);
          background: rgba(34,197,94,0.12);
          color: #86efac;
        }

        .dash-health-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
        }

        .dash-stat-card {
          min-height: 96px;
          padding: 13px;
          display: grid;
          align-content: space-between;
          gap: 8px;
          background: rgba(255,255,255,0.018) !important;
        }

        .dash-stat-top,
        .dash-section-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .dash-stat-top span {
          color: var(--brand-muted);
          font-family: var(--font-label);
          font-size: 0.7rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .dash-stat-card strong {
          font-size: 1.45rem;
          line-height: 1;
        }

        .dash-stat-card small {
          color: var(--brand-muted);
          font-size: 0.76rem;
          line-height: 1.35;
        }

        .dash-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }

        .dash-alert-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 0;
        }

        .dash-category-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .dash-actions-card,
        .dash-pipeline-card,
        .dash-service-card,
        .dash-rhythm-card,
        .dash-risk-card,
        .dash-risk-strip,
        .dash-activity-card,
        .dash-contracts-card {
          padding: 16px;
          display: grid;
          gap: 12px;
        }

        .dash-actions-card {
          padding: 14px 16px;
        }

        .dash-actions-card-hot {
          border-color: rgba(239,68,68,0.26) !important;
          background: linear-gradient(135deg, rgba(69,10,10,0.24), rgba(8,11,16,0.98)) !important;
          box-shadow: 0 14px 34px rgba(127,29,29,0.12);
        }

        .dash-risk-card-hot {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) auto minmax(220px, 1.2fr);
          align-items: center;
          gap: 14px;
          padding: 0;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none;
        }

        .dash-risk-card-hot .dash-section-title {
          align-items: center;
        }

        .dash-risk-card-hot .dash-section-title h2 {
          color: #fecaca;
        }

        .dash-risk-card-hot .dash-section-title p {
          display: block;
        }

        .dash-risk-card-hot > strong {
          color: #ef4444;
          font-size: 1.8rem;
          text-align: center;
        }

        .dash-risk-card-hot > p {
          color: #fecaca;
          margin-top: 0;
          display: none;
        }

        .dash-section-title h2 {
          color: var(--brand-text);
          font-size: 0.98rem;
          font-weight: 900;
          margin: 0 0 3px;
        }

        .dash-action-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .dash-command-metric {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 4px 12px;
          border: 1px solid;
          border-radius: 8px;
          padding: 11px 12px;
          min-height: 70px;
          align-content: center;
          align-items: center;
          min-width: 0;
        }

        .dash-command-metric > span {
          font-size: 0.68rem;
          font-weight: 950;
          text-transform: uppercase;
          grid-column: 1 / -1;
        }

        .dash-command-metric strong {
          color: var(--brand-text);
          font-size: clamp(1.15rem, 1.55vw, 1.65rem);
          line-height: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dash-command-metric small {
          color: var(--brand-muted);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .dash-activity-grid strong {
          color: var(--brand-text);
          font-size: 1rem;
          line-height: 1.25;
          display: block;
        }

        .dash-activity-grid p,
        .dash-activity-grid span,
        .dash-activity-grid small {
          color: var(--brand-muted);
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .dash-category-card {
          padding: 12px;
          display: grid;
          gap: 9px;
          border-color: color-mix(in srgb, var(--category-tone), transparent 74%) !important;
          background: linear-gradient(160deg, color-mix(in srgb, var(--category-tone), transparent 92%), rgba(8,11,16,0.94)) !important;
        }

        .dash-category-head {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dash-category-head span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: var(--category-tone);
        }

        .dash-category-head strong {
          color: var(--brand-text);
          font-size: 0.86rem;
        }

        .dash-category-metric {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .dash-category-metric b {
          color: var(--category-tone);
          font-size: 1.55rem;
          line-height: 1;
        }

        .dash-category-metric small {
          color: var(--brand-muted);
          font-size: 0.76rem;
        }

        .dash-category-bar {
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          overflow: hidden;
        }

        .dash-category-bar i {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: var(--category-tone);
        }

        .dash-category-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .dash-category-foot span {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          color: #9aa8ba;
          padding: 3px 6px;
          font-size: 0.64rem;
          font-weight: 800;
        }

        .dash-pipeline-list,
        .dash-service-list {
          display: grid;
          gap: 9px;
        }

        .dash-pipeline-row {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr) 34px;
          gap: 12px;
          align-items: center;
        }

        .dash-pipeline-row > div:first-child {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .dash-pipeline-row span {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }

        .dash-pipeline-row strong,
        .dash-service-row strong {
          color: #c9d1d9;
          font-size: 0.82rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dash-pipeline-row > div:nth-child(2),
        .dash-service-row > div {
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.055);
          overflow: hidden;
        }

        .dash-pipeline-row i,
        .dash-service-row i {
          display: block;
          height: 100%;
          border-radius: 999px;
        }

        .dash-pipeline-row b,
        .dash-service-row b {
          color: var(--brand-text);
          text-align: right;
          font-size: 0.82rem;
        }

        .dash-secondary-grid {
          display: grid;
          grid-template-columns: minmax(300px, 0.8fr) minmax(420px, 1.2fr);
          gap: 18px;
          align-items: start;
        }

        .dash-rhythm-card {
          order: 2;
          justify-self: center;
          width: 100%;
          max-width: 720px;
        }

        .dash-service-card {
          order: 1;
          align-self: start;
        }

        .dash-service-row {
          display: grid;
          grid-template-columns: 24px 8px minmax(110px, 190px) minmax(0, 1fr) 40px;
          gap: 8px;
          align-items: center;
        }

        .dash-service-row-card {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          background: rgba(255,255,255,0.025);
          padding: 8px;
        }

        .dash-service-row em {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.06);
          color: #c9d1d9;
          font-style: normal;
          font-weight: 900;
          font-size: 0.74rem;
        }

        .dash-service-row > span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
        }

        .dash-rhythm-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .dash-rhythm-grid div {
          position: relative;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          padding: 16px 8px 12px;
          text-align: center;
          overflow: hidden;
        }

        .dash-rhythm-grid em {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: rgba(212,160,23,0.09);
          color: var(--brand-primary);
          line-height: 1;
          margin: 0 auto 10px;
          font-style: normal;
        }

        .dash-rhythm-grid strong,
        .dash-risk-card > strong {
          display: block;
          color: var(--brand-primary);
          font-size: 1.8rem;
          line-height: 1;
        }

        .dash-rhythm-grid span,
        .dash-risk-card p {
          display: block;
          color: var(--brand-muted);
          font-size: 0.72rem;
          margin-top: 6px;
        }

        .dash-rhythm-progress {
          display: grid;
          gap: 8px;
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 8px;
          background: rgba(212,160,23,0.06);
          padding: 12px;
        }

        .dash-rhythm-scope {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .dash-rhythm-scope span {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          background: rgba(255,255,255,0.025);
          padding: 8px 6px;
          color: var(--brand-muted);
          font-size: 0.66rem;
          font-weight: 900;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .dash-rhythm-scope b {
          display: block;
          color: var(--brand-text);
          font-size: 0.95rem;
          line-height: 1;
          margin-bottom: 3px;
        }

        .dash-rhythm-progress div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--brand-muted);
          font-size: 0.76rem;
          font-weight: 800;
        }

        .dash-rhythm-progress b {
          color: var(--brand-primary);
        }

        .dash-rhythm-progress i {
          display: block;
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          overflow: hidden;
        }

        .dash-rhythm-progress i span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--brand-primary), #facc15);
        }

        .dash-month-nav {
          height: 44px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.035);
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) 42px;
          align-items: center;
          overflow: hidden;
        }

        .dash-month-nav button {
          height: 100%;
          border: 0;
          background: rgba(255,255,255,0.035);
          color: var(--brand-primary);
          font-size: 1.45rem;
          font-weight: 900;
          cursor: pointer;
        }

        .dash-month-nav span {
          color: var(--brand-text);
          text-align: center;
          font-weight: 900;
          font-size: 0.92rem;
        }

        .dash-stale-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid rgba(255,255,255,0.07);
          padding-top: 9px;
          color: #c9d1d9;
          font-size: 0.78rem;
        }

        .dash-stale-row b {
          color: #ef4444;
        }

        .dash-stale-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dash-activity-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .dash-activity-grid > div {
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          background: rgba(255,255,255,0.025);
          padding: 13px;
        }

        .dash-activity-grid > div > div {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
        }

        .dash-empty {
          border: 1px dashed rgba(255,255,255,0.12);
          border-radius: 8px;
          color: var(--brand-muted);
          padding: 18px;
        }

        .dash-contract-bars {
          min-height: 150px;
          display: flex;
          align-items: end;
          gap: 18px;
        }

        .dash-contract-bars > div {
          flex: 1;
          display: grid;
          justify-items: center;
          gap: 6px;
        }

        .dash-contract-bars > div > div {
          width: 100%;
          height: 110px;
          display: flex;
          align-items: end;
          justify-content: center;
        }

        .dash-contract-bars span {
          display: block;
          width: 34px;
          min-height: 5px;
          border-radius: 8px 8px 3px 3px;
          background: var(--brand-primary);
        }

        .dash-contract-bars b {
          color: var(--brand-text);
          font-size: 0.8rem;
        }

        .dash-contract-bars small {
          color: var(--brand-muted);
          font-size: 0.72rem;
        }

        @media (max-width: 1200px) {
          .dash-command {
            padding-right: 0;
          }
          .dash-tv-toggle {
            position: static;
            justify-self: start;
          }
          .dash-health-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .dash-main-grid,
          .dash-secondary-grid,
          .dash-command {
            grid-template-columns: 1fr;
          }
          .dash-risk-card-hot {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .dash-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .dash-activity-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .dash-health-grid,
          .dash-activity-grid {
            grid-template-columns: 1fr;
          }
          .dash-action-list {
            grid-template-columns: 1fr;
          }
          .dash-pipeline-row {
            grid-template-columns: 120px minmax(0, 1fr) 30px;
          }
          .dash-service-row {
            grid-template-columns: 28px 10px minmax(0, 1fr) 42px;
          }
          .dash-service-row > div {
            grid-column: 3 / -1;
          }
          .dash-category-grid {
            grid-template-columns: 1fr;
          }
          .dash-rhythm-scope {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  )
}
