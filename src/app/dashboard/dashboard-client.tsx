'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, Zap, BarChart3, Activity, CalendarClock,
  Sparkles, Flame, Search, X,
  Target, Percent, Tv, AlertCircle, CheckCircle2
} from 'lucide-react'
import { useRouter } from 'next/navigation'



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
  color: string
  participation: number
  contractsMeta: number
  kpis: KPIData
  pipelineData: PipelineData
  revenueData: MonthlyData
  recentActivity: ActivityData
}

function CompactStatCard({ icon: Icon, label, value, sub, tone = 'var(--brand-primary)' }: {
  icon: React.ElementType; label: string; value: string; sub: string; tone?: string
}) {
  return (
    <div className="glass-card" style={{
      padding: '16px', minHeight: '85px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: `${tone}14`,
          border: `1px solid ${tone}1f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={16} color={tone} />
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 'clamp(1.3rem, 1.8vw, 1.6rem)', fontWeight: 900, color: 'var(--brand-text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.70rem', color: 'var(--brand-muted)', marginTop: '4px' }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })



export default function DashboardClient({
  kpis, pipelineData, productData, momentumData, recentActivity, productFocusData, contractsMonthly
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
  const [mounted, setMounted] = useState(false)
  const [focusMode, setFocusMode] = useState<'geral' | string>('geral')
  const [searchTerm, setSearchTerm] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [isTvMode, setIsTvMode] = useState(false)
  const router = useRouter()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isTvMode) return;
    const ids = ['geral', ...productFocusData.map(p => p.id)];
    const interval = setInterval(() => {
      setFocusMode(prev => {
        const currentIndex = ids.indexOf(prev);
        const nextIndex = (currentIndex + 1) % ids.length;
        return ids[nextIndex];
      });
    }, 12000); // Roda a cada 12 segundos
    return () => clearInterval(interval);
  }, [isTvMode, productFocusData]);

  // Auto-refresh logic for TV Mode and general dashboard freshness
  useEffect(() => {
    const intervalTime = isTvMode ? 30000 : 180000 // 30s for TV, 3m for regular
    const interval = setInterval(() => {
      router.refresh()
    }, intervalTime)
    return () => clearInterval(interval)
  }, [isTvMode, router])

  const selectedProductFocus = productFocusData.find((item) => item.id === focusMode)
  const isProductMode = Boolean(selectedProductFocus)
  const activeKpis = selectedProductFocus?.kpis || kpis
  const activePipelineData = selectedProductFocus?.pipelineData || pipelineData
  const activeRecentActivity = selectedProductFocus?.recentActivity || recentActivity
  const colors = ['var(--brand-primary)', '#fcd34d', 'var(--brand-muted)', '#484f58']
  const metaPercent = activeKpis.contractsMeta > 0 ? Math.round((activeKpis.contracts / activeKpis.contractsMeta) * 100) : 0
  const remainingContracts = Math.max(activeKpis.contractsMeta - activeKpis.contracts, 0)
  const missionStatus = metaPercent >= 100
    ? 'Meta batida'
    : metaPercent >= 70
      ? 'Em rota'
      : 'Pede reacao'
  const executiveImmediateCopy = remainingContracts > 0
    ? isProductMode
      ? `Faltam ${remainingContracts} contratos para ${selectedProductFocus?.name}. Prioridade: converter o CRM quente deste produto.`
      : `Faltam ${remainingContracts} contratos para a meta geral. Prioridade: virar em fechamento o que ja esta em Proposta e Negociacao.`
    : isProductMode
      ? `${selectedProductFocus?.name} ja bateu a meta. Agora vale proteger margem e manter recorrencia.`
      : 'A meta geral ja foi batida. Agora o foco passa a ser previsibilidade e qualidade de receita.'

  const maxPipelineCount = Math.max(...activePipelineData.map(d => d.count), 1)
  const pipelineColors = ['var(--brand-primary)', '#f59e0b', '#f97316', '#ef4444', '#14b8a6']
  const filteredProducts = productData.filter((p) => p.name.toLowerCase() !== 'geral' && p.name !== 'Sem leads ativos')
  const totalProductValue = filteredProducts.reduce((sum, item) => sum + Number(item.value || 0), 0)
  const donutSegments = filteredProducts.length
    ? filteredProducts.map((item, index) => {
        const start = filteredProducts.slice(0, index).reduce((sum, current) => sum + Number(current.value || 0), 0)
        const startPct = totalProductValue > 0 ? (start / totalProductValue) * 100 : 0
        const endPct = totalProductValue > 0 ? ((start + Number(item.value || 0)) / totalProductValue) * 100 : 0
        return `${item.color || colors[index % colors.length]} ${startPct}% ${endPct}%`
      })
    : []

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', display: 'grid', gap: '16px' }}>

      {/* LINHA 0 — Chips de foco */}
      {/* LINHA 0 — Barra de Pesquisa de Produto + Filtro Ativo */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} color="var(--brand-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Filtrar por nome do produto..."
            className="dashboard-search-input"
            value={searchTerm}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowResults(true)
            }}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '10px 12px 10px 38px',
              color: 'var(--brand-text)',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
          
          {showResults && searchTerm && (
            <div className="glass-card" style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 100,
              marginTop: '8px',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              border: '1px solid rgba(251, 191, 36, 0.2)'
            }}>
              {productFocusData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                productFocusData
                  .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setFocusMode(product.id)
                        setSearchTerm('')
                        setShowResults(false)
                      }}
                      className="search-result-item"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        textAlign: 'left',
                        borderRadius: '8px',
                        background: focusMode === product.id ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
                        color: focusMode === product.id ? 'var(--brand-primary)' : '#c9d1d9',
                        border: 'none',
                        fontSize: '0.8rem',
                        fontWeight: focusMode === product.id ? 800 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: product.color }} />
                      {product.name}
                    </button>
                  ))
              ) : (
                <div style={{ padding: '12px', color: 'var(--brand-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                  Nenhum produto encontrado
                </div>
              )}
            </div>
          )}
        </div>

        {focusMode !== 'geral' && !isTvMode && (
          <button
            onClick={() => setFocusMode('geral')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(251, 191, 36, 0.1)',
              color: 'var(--brand-primary)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            Filtro Ativo: {selectedProductFocus?.name}
            <X size={14} />
          </button>
        )}

        <button
          onClick={() => setIsTvMode(!isTvMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            background: isTvMode ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            color: isTvMode ? '#10b981' : 'var(--brand-muted)',
            border: `1px solid ${isTvMode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
            fontSize: '0.75rem',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginLeft: 'auto'
          }}
          title="Alternar Modo TV (Rotação Automática)"
        >
          <Tv size={15} />
          {isTvMode ? 'Modo TV: ON' : 'Modo TV: OFF'}
        </button>
      </div>


      {/* LINHA 1 — Hero (Centralizado e Maior) */}
      <div style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(251,191,36,0.12), transparent 70%), rgba(22,27,34,0.98)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: '16px',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '12px',
        marginBottom: '2px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            {missionStatus === 'Pede reacao' ? (
              <span
                className="badge animate-pulse-glow"
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  border: '2px solid rgba(239, 68, 68, 0.5)',
                  fontSize: '1rem',
                  padding: '8px 24px',
                  fontWeight: 950,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
                }}
              >
                <AlertCircle size={18} strokeWidth={3} />
                PRECISA DE REAÇÃO IMEDIATA
              </span>
            ) : (
              <span
                className="badge"
                style={{
                  background: metaPercent >= 100 
                    ? 'rgba(16,185,129,0.18)' 
                    : 'rgba(251,191,36,0.12)',
                  color: metaPercent >= 100 
                    ? '#10b981' 
                    : '#fbbf24',
                  border: `1px solid ${
                    metaPercent >= 100 
                      ? 'rgba(16,185,129,0.35)' 
                      : 'rgba(251,191,36,0.3)'
                  }`,
                  fontSize: '0.85rem',
                  padding: '6px 16px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {metaPercent >= 100 ? <CheckCircle2 size={14} /> : <TrendingUp size={14} />}
                {missionStatus}
              </span>
            )}
        </div>

        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--brand-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            CONTRATOS FECHADOS
          </div>
          <div style={{ fontSize: 'clamp(2.8rem, 4vw, 4rem)', fontWeight: 950, color: 'var(--brand-primary)', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {activeKpis.contracts}
            <span style={{ fontSize: '1.4rem', color: 'var(--brand-muted)', fontWeight: 700, marginLeft: '8px' }}>
              / {activeKpis.contractsMeta}
            </span>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '400px', margin: '8px 0' }}>
          <div className="progress-bar" style={{ height: '12px', background: 'rgba(255,255,255,0.06)' }}>
            <div className="progress-fill" style={{ width: mounted ? `${Math.min(metaPercent, 100)}%` : '0%', minWidth: metaPercent > 0 ? '8px' : 0 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--brand-primary)', fontWeight: 800 }}>{metaPercent}% da meta</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--brand-muted)' }}>Falta {remainingContracts} contratos</span>
          </div>
        </div>

        <div style={{
          fontSize: '0.85rem', color: 'var(--brand-muted)', marginTop: '8px',
          maxWidth: '600px',
          lineHeight: 1.5
        }}>
          {executiveImmediateCopy}
        </div>
      </div>

      {/* LINHA 2 — Grid de KPIs Menores */}
      <div className="dashboard-kpi-grid">
        {/* 7 CompactStatCards */}
        <CompactStatCard
          icon={Target}
          label="CRESC. LEADS"
          value={`${activeKpis.leadVelocity > 0 ? '+' : ''}${activeKpis.leadVelocity.toFixed(1)}%`}
          sub="Crescimento mensal"
          tone={activeKpis.leadVelocity >= 0 ? "var(--brand-primary)" : "#ef4444"}
        />
        <CompactStatCard
          icon={Percent}
          label="TAXA DE PERDA"
          value={`${activeKpis.lossRate.toFixed(1)}%`}
          sub="Negócios perdidos"
          tone="#ef4444"
        />
        <CompactStatCard
          icon={Sparkles}
          label="ROI DE EVENTOS"
          value={currency.format(activeKpis.eventsRoi)}
          sub={`${activeKpis.eventsContracts} negócios gerados`}
          tone="var(--brand-primary)"
        />
        <CompactStatCard
          icon={BarChart3}
          label="TAXA CONVERSÃO"
          value={`${activeKpis.conversionRate.toFixed(1)}%`}
          sub="Lead p/ contrato"
          tone="#10b981"
        />
        <CompactStatCard
          icon={Activity}
          label="TAXA DE GANHO"
          value={`${activeKpis.winRate.toFixed(1)}%`}
          sub="Ganhos vs Perdidos"
          tone="#14b8a6"
        />
        <CompactStatCard
          icon={TrendingUp}
          label="LEADS ATIVOS"
          value={`${activeKpis.activeLeads}`}
          sub="No CRM agora"
          tone="#38bdf8"
        />
        <CompactStatCard
          icon={Zap}
          label="OPORTUNIDADES"
          value={`${activeKpis.lateStageOpportunities}`}
          sub="Em negociação ativa"
          tone="#f97316"
        />
      </div>



      {/* LINHA 3 — 3 colunas: Funil | Ranking | Mix de Servicos */}
      <div className="dashboard-three-col">
        {/* Funil de Vendas */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-text)', letterSpacing: '0.02em' }}>FUNIL DE VENDAS</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.74rem', marginTop: '2px' }}>Volume por estagio do CRM</p>
          </div>
          <div style={{ display: 'grid', gap: '12px' }}>
            {activePipelineData.map((item, idx) => {
              const width = maxPipelineCount > 0 ? Math.max((item.count / maxPipelineCount) * 100, item.count > 0 ? 6 : 0) : 0
              return (
                <div key={item.stage} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 44px', gap: '10px', alignItems: 'center' }}>
                  <span style={{ color: '#c9d1d9', fontSize: '0.76rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.stage}</span>
                  <div style={{ height: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${width}%`, height: '100%', borderRadius: '999px', background: pipelineColors[idx % pipelineColors.length], transition: 'width 0.35s ease' }} />
                  </div>
                  <span style={{ textAlign: 'right', color: 'var(--brand-text)', fontSize: '0.78rem', fontWeight: 800 }}>{item.count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Card 1: Ritmo do Mês (Reuniões Marcadas) */}
          <div className="glass-card" style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '18px', textAlign: 'center' }}>
              <Flame size={26} color="#f97316" style={{ marginBottom: '4px' }} />
              <h3 style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--brand-text)', letterSpacing: '0.04em' }}>REUNIÕES MARCADAS</h3>
              <p style={{ color: '#f97316', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em' }}>RITMO DO MÊS</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {[
                { label: 'Hoje', value: momentumData.today, color: momentumData.today > 0 ? '#10b981' : 'var(--brand-muted)' },
                { label: 'Semana', value: momentumData.week, color: '#38bdf8' },
                { label: 'Mês', value: momentumData.month, color: 'var(--brand-primary)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  textAlign: 'center', padding: '16px 6px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: 'clamp(1.6rem, 2.5vw, 2.2rem)', fontWeight: 950, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--brand-muted)', fontWeight: 800, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--brand-primary)', fontWeight: 800 }}>
                  {momentumData.meta > 0 ? Math.round((momentumData.month / momentumData.meta) * 100) : 0}% da meta mensal
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--brand-muted)' }}>
                  {momentumData.month}/{momentumData.meta}
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '999px', background: 'var(--brand-primary)',
                  width: `${Math.min(momentumData.meta > 0 ? (momentumData.month / momentumData.meta) * 100 : 0, 100)}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mix de Servicos — Donut + legenda */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-text)', letterSpacing: '0.02em' }}>
              {isProductMode ? 'PARTICIPAÇÃO DO SERVIÇO' : 'MIX DE SERVIÇOS'}
            </h3>
            <span className="badge badge-gold">{isProductMode ? 'Foco' : 'Distribuição'}</span>
          </div>
          <p style={{ color: 'var(--brand-muted)', fontSize: '0.74rem', marginBottom: '14px' }}>
            {isProductMode ? 'Peso do serviço na operação atual' : 'Participação % de cada serviço no funil'}
          </p>
          {(() => {
            if (filteredProducts.length === 0) {
              return (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--brand-muted)', fontSize: '0.85rem' }}>
                  Nenhum lead ativo no momento.
                </div>
              )
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0, width: '150px', height: '150px', borderRadius: '50%', background: donutSegments.length ? `conic-gradient(${donutSegments.join(', ')})` : 'rgba(255,255,255,0.04)', padding: '14px', boxSizing: 'border-box' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#0d1117', border: '1px solid rgba(255,255,255,0.08)' }} />
                </div>
                <div style={{ flex: 1, minWidth: '100px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredProducts.map((item, idx) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,
                        background: item.color || colors[idx % colors.length],
                        boxShadow: `0 0 6px ${item.color || colors[idx % colors.length]}66`,
                      }} />
                      <span style={{ flex: 1, fontSize: '0.78rem', color: '#c9d1d9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--brand-primary)', fontWeight: 800, flexShrink: 0 }}>
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* LINHA 4 — Contratos/Mês | Pipeline por etapa */}
      <div className="dashboard-one-col">
        {/* Contratos por Mês */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--brand-text)', letterSpacing: '0.02em' }}>CONTRATOS POR MÊS</h3>
            <p style={{ color: 'var(--brand-muted)', fontSize: '0.74rem', marginTop: '2px' }}>Quantidade de contratos fechados nos últimos 6 meses</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px', minHeight: '180px', paddingTop: '12px' }}>
            {contractsMonthly.map((item) => {
              const maxContracts = Math.max(...contractsMonthly.map((month) => month.contratos), 1)
              const height = Math.max((item.contratos / maxContracts) * 100, item.contratos > 0 ? 8 : 4)
              return (
                <div key={item.mes} style={{ flex: 1, display: 'grid', gap: '8px', justifyItems: 'center' }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'end', justifyContent: 'center', minHeight: '130px' }}>
                    <div style={{ width: '40px', height: `${height}%`, minHeight: '8px', borderRadius: '12px 12px 4px 4px', background: 'var(--brand-primary)', boxShadow: '0 10px 18px rgba(251,191,36,0.18)' }} />
                  </div>
                  <span style={{ color: 'var(--brand-muted)', fontSize: '0.72rem', fontWeight: 700 }}>{item.mes}</span>
                  <span style={{ color: 'var(--brand-text)', fontSize: '0.78rem', fontWeight: 800 }}>{item.contratos}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* LINHA 5 — Atividade recente (4 colunas para TV) */}
      <div className="glass-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CalendarClock size={18} color="var(--brand-primary)" />
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--brand-text)', letterSpacing: '0.02em' }}>ÚLTIMAS MOVIMENTAÇÕES</h3>
        </div>
        {activeRecentActivity.length > 0 ? (
          <div className="dashboard-activity-grid">
            {activeRecentActivity.map((activity) => (
              <div
                key={`${activity.tipo}-${activity.desc}-${activity.tempo}`}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: 'rgba(251, 191, 36, 0.03)',
                  border: '1px solid rgba(251, 191, 36, 0.08)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-text)' }}>{activity.tipo}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--brand-muted)', fontWeight: 700, flexShrink: 0 }}>{activity.tempo}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--brand-muted)', lineHeight: 1.5 }}>{activity.desc}</p>
                <div style={{ marginTop: '8px', fontSize: '0.74rem', color: activity.cor, fontWeight: 800 }}>{activity.valor}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '18px', borderRadius: '12px', border: '1px dashed rgba(251, 191, 36, 0.12)', color: 'var(--brand-muted)', fontSize: '0.8rem' }}>
            Nenhuma movimentação registrada ainda.
          </div>
        )}
      </div>

      <style>{`
        .dashboard-mode-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          color: var(--brand-muted);
          font-size: 0.74rem;
          font-weight: 800;
          cursor: pointer;
          transition: color 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }

        .dashboard-mode-chip[data-active='true'] {
          background: rgba(251,191,36,0.12);
          border-color: rgba(251,191,36,0.22);
          color: var(--brand-primary);
        }

        .dashboard-mode-chip:hover {
          color: var(--brand-text);
          border-color: rgba(251,191,36,0.16);
        }

        .dashboard-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
          gap: 12px;
          margin-bottom: 8px;
        }

        .dashboard-three-col {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.85fr) minmax(0, 0.9fr);
          gap: 14px;
          align-items: start;
        }

        .dashboard-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          gap: 14px;
          align-items: start;
        }

        .dashboard-activity-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard-one-col {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        .dashboard-search-input {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 12px 10px 38px;
          color: var(--brand-text);
          font-size: 0.85rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .dashboard-search-input:focus {
          border-color: rgba(251, 191, 36, 0.4);
          box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.08);
        }

        .dashboard-search-input::placeholder {
          color: var(--brand-muted);
        }

        .search-result-item:hover {
          background: rgba(255,255,255,0.05) !important;
          color: var(--brand-text) !important;
        }

        @media (max-width: 1280px) {
          .dashboard-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
          .dashboard-three-col { grid-template-columns: 1fr 1fr !important; }
          .dashboard-activity-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }

        @media (max-width: 1100px) {
          .dashboard-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
          .dashboard-two-col { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 768px) {
          .dashboard-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .dashboard-three-col { grid-template-columns: 1fr !important; }
          .dashboard-activity-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
