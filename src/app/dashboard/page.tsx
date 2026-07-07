import { createClient } from '@/lib/supabase/server'
import DashboardClient, {
  ActivityData,
  ContractsMonthlyData,
  KPIData,
  LastDealData,
  MomentumData,
  PipelineData,
  ProductData,
  ProductFocusData,
} from './dashboard-client'

export const dynamic = 'force-dynamic'

const STAGES = ['Contato Inicial', 'Qualificacao', 'Apresentacao', 'Proposta']
const NORMALIZED_STAGE_MAP: Record<string, string> = {
  'Contato Inicial': 'Contato Inicial',
  Lead: 'Contato Inicial',
  Qualificacao: 'Qualificacao',
  'Qualificação': 'Qualificacao',
  Qualificado: 'Qualificacao',
  Apresentacao: 'Apresentacao',
  'Apresentação': 'Apresentacao',
  Diagnostico: 'Apresentacao',
  'Diagnóstico': 'Apresentacao',
  'Reunião': 'Apresentacao',
  Reuniao: 'Apresentacao',
  Proposta: 'Proposta',
  Negociacao: 'Proposta',
  'Negociação': 'Proposta',
  'Negociaçãão': 'Proposta',
  Fechado: 'Fechado',
  Ganho: 'Fechado',
  Venda: 'Fechado',
  Ganhos: 'Fechado',
  Vendido: 'Fechado',
  Perdido: 'Perdido',
  Perda: 'Perdido',
}

type LeadRecord = {
  consultant_id?: string
  created_at?: string
  expected_value?: number | string
  id?: string
  name?: string
  product?: { category?: string | null; color?: string; name?: string } | null
  product_id?: string | null
  sub_product_id?: string | null
  stage?: string
  notes?: string | null
}

type ProfileRecord = {
  full_name?: string
  id: string
  role?: string
}

type XpLogRecord = {
  profile_id: string
  xp_amount: number
}

type AiQualificationRecord = {
  lead_id: string
  score?: number | string
  status?: string
}

type MonthlyData = { mes: string; receita: number; meta: number }[]

function buildRecentActivity(leads: LeadRecord[]): ActivityData {
  return leads
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4)
    .map((lead) => {
      const stage = lead.stage || 'Contato Inicial'
      const leadName = lead.name || 'Lead sem nome'
      const createdAt = lead.created_at ? new Date(lead.created_at) : null
      const tempo = createdAt
        ? createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : 'sem data'

      if (stage === 'Fechado') {
        return {
          tipo: 'Contrato fechado',
          desc: `${leadName} foi concluido com sucesso.`,
          valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(lead.expected_value || 0)),
          tempo,
          cor: '#10b981'
        }
      }

      if (stage === 'Perdido') {
        return {
          tipo: 'Negocio perdido',
          desc: `${leadName} foi encerrado como perdido.`,
          valor: stage,
          tempo,
          cor: '#ef4444'
        }
      }

      return {
        tipo: 'Lead movimentado',
        desc: `${leadName} esta no estagio ${stage}.`,
        valor: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(lead.expected_value || 0)),
        tempo,
        cor: 'var(--brand-primary)'
      }
    })
}

function buildContractsByMonth(closedDeals: LeadRecord[]): ContractsMonthlyData {
  const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  const countByMonth = new Map<string, number>()
  const lastSixMonths: { key: string; mes: string }[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const current = new Date()
    current.setDate(1)
    current.setHours(0, 0, 0, 0)
    current.setMonth(current.getMonth() - offset)
    const key = `${current.getFullYear()}-${current.getMonth()}`
    const mes = monthFormatter.format(current).replace('.', '')
    lastSixMonths.push({ key, mes: mes.charAt(0).toUpperCase() + mes.slice(1) })
    countByMonth.set(key, 0)
  }

  closedDeals.forEach((deal) => {
    if (!deal.created_at) return
    const date = new Date(deal.created_at)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (!countByMonth.has(key)) return
    countByMonth.set(key, (countByMonth.get(key) || 0) + 1)
  })

  return lastSixMonths.map(({ key, mes }) => ({
    mes,
    contratos: countByMonth.get(key) || 0
  }))
}

function buildRevenueData(closedDeals: LeadRecord[]): MonthlyData {
  const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
  const revenueByMonth = new Map<string, number>()
  const lastSixMonths: { key: string; mes: string }[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const current = new Date()
    current.setDate(1)
    current.setHours(0, 0, 0, 0)
    current.setMonth(current.getMonth() - offset)
    const key = `${current.getFullYear()}-${current.getMonth()}`
    const mes = monthFormatter.format(current).replace('.', '')
    lastSixMonths.push({ key, mes: mes.charAt(0).toUpperCase() + mes.slice(1) })
    revenueByMonth.set(key, 0)
  }

  closedDeals.forEach((deal) => {
    if (!deal.created_at) return
    const date = new Date(deal.created_at)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    if (!revenueByMonth.has(key)) return
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(deal.expected_value || 0))
  })

  return lastSixMonths.map(({ key, mes }) => ({
    mes,
    receita: revenueByMonth.get(key) || 0,
    meta: 0
  }))
}

function getPipelineData(activeLeads: LeadRecord[]): PipelineData {
  return STAGES.map((stage) => ({
    stage,
    count: activeLeads.filter((lead) => (NORMALIZED_STAGE_MAP[lead.stage || ''] || lead.stage) === stage).length
  }))
}

function getLateStageOpportunities(activeLeads: LeadRecord[]) {
  return activeLeads.filter((lead) => {
    const normalizedStage = NORMALIZED_STAGE_MAP[lead.stage || ''] || lead.stage
    return normalizedStage === 'Proposta' || normalizedStage === 'Negociacao'
  }).length
}

function getAveragePipelineDays(activeLeads: LeadRecord[]) {
  if (activeLeads.length === 0) return 0

  return activeLeads.reduce((sum, lead) => {
    const createdAt = lead.created_at ? new Date(lead.created_at).getTime() : Date.now()
    return sum + Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60 * 24))
  }, 0) / activeLeads.length
}

function getTopConsultant(team: ProfileRecord[], xpMap: Record<string, number>, contractsMap: Record<string, number>) {
  const levels = [
    { nome: 'Prospector', min: 0, max: 999 },
    { nome: 'Hunter', min: 1000, max: 2999 },
    { nome: 'Closer', min: 3000, max: 5999 },
    { nome: 'Elite', min: 6000, max: 9999 },
    { nome: 'Top Performer', min: 10000, max: 99999 },
  ]

  const ranking = team.map((profile) => {
    const xp = xpMap[profile.id] || 0
    const consultantContracts = contractsMap[profile.id] || 0
    const level = levels.find((item) => xp >= item.min && xp <= item.max) || levels[0]

    return {
      name: profile.full_name || 'Usuario',
      role: profile.role || '',
      xp,
      contratos: consultantContracts,
      nivel: level.nome,
      meta: 0
    }
  })

  ranking.sort((a, b) => b.contratos - a.contratos || b.xp - a.xp)
  return ranking[0] || { name: 'Sem dados', xp: 0 }
}

export default async function DashboardPage(props: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const searchParams = await props.searchParams;
  const filterMonth = searchParams.month;
  const filterYear = searchParams.year;
  try {
    const supabase = await createClient()

    const [leadsResult, teamResult, xpLogsResult, aiResult, productsResult, subProductsResult, settingsResult, goalsResult] = await Promise.allSettled([
      supabase.from('leads').select('*, product:products(name, category, color), sub_product:sub_products(name, id)').limit(10000),
      supabase.from('profiles').select('*'),
      supabase.from('xp_logs').select('profile_id, xp_amount'),
      supabase.from('ai_qualifications').select('lead_id, status, score'),
      supabase.from('products').select('*'),
      supabase.from('sub_products').select('*'),
      supabase.from('settings').select('key, value'),
      supabase.from('sales_goals').select('goal_contracts, period')
    ])

    const leads = leadsResult.status === 'fulfilled' ? (leadsResult.value.data ?? []) : []
    const team = teamResult.status === 'fulfilled' ? (teamResult.value.data ?? []) : []
    const xpLogs = xpLogsResult.status === 'fulfilled' ? (xpLogsResult.value.data ?? []) : []
    const aiData = aiResult.status === 'fulfilled' ? (aiResult.value.data ?? []) : []
    const dbProducts = (productsResult.status === 'fulfilled' ? productsResult.value.data : null) ?? []
    const dbSubProducts = (subProductsResult.status === 'fulfilled' ? subProductsResult.value.data : null) ?? []

    const settingsRows = (settingsResult.status === 'fulfilled' ? settingsResult.value.data : []) ?? []
    const settingsMap = new Map((settingsRows as { key: string; value: string }[]).map((s) => [s.key, s.value]))

    // Logic for dynamic meta from sales_goals (Sum of all month goals)
    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const dbGoals = (goalsResult.status === 'fulfilled' ? goalsResult.value.data : []) ?? []
    
    const activeGoalsTotal = (dbGoals as { period?: string; goal_contracts?: number | string | null }[])
      .filter(g => g.period === currentPeriod)
      .reduce((sum, g) => sum + (Number(g.goal_contracts) || 0), 0)

    const CONTRACTS_META = activeGoalsTotal > 0
      ? activeGoalsTotal
      : 0
      
    const REVENUE_META = Number(settingsMap.get('revenue_meta') ?? '0')

    const allLeads = (leads || []) as LeadRecord[]
    const allTeam = (team || []) as ProfileRecord[]
    const allXpLogs = (xpLogs || []) as XpLogRecord[]
    const aiQualifications = (aiData || []) as AiQualificationRecord[]
    const aiByLead = new Map(aiQualifications.map((item) => [item.lead_id, item]))

    const activeLeads = allLeads.filter((lead) => lead.stage !== 'Fechado' && lead.stage !== 'Perdido')
    const closedDeals = allLeads.filter((lead) => lead.stage === 'Fechado')
    const lostDeals = allLeads.filter((lead) => lead.stage === 'Perdido')

    const revenue = closedDeals.reduce((sum, deal) => sum + Number(deal.expected_value || 0), 0)
    const contracts = closedDeals.length
    const totalLeads = allLeads.length
    const conversionRate = totalLeads > 0 ? (contracts / totalLeads) * 100 : 0
    const averageTicket = contracts > 0 ? revenue / contracts : 0
    const resolvedDeals = contracts + lostDeals.length
    const winRate = resolvedDeals > 0 ? (contracts / resolvedDeals) * 100 : 0
    const averagePipelineDays = getAveragePipelineDays(activeLeads)
    const lateStageOpportunities = getLateStageOpportunities(activeLeads)
    const pipelineData = getPipelineData(activeLeads)
    const aiQualifiedLeads = aiQualifications.filter((item) => item.status && item.status !== 'nao_avaliado').length
    const aiApprovedLeads = aiQualifications.filter((item) => ['aprovado', 'qualificado'].includes(String(item.status || '').toLowerCase())).length
    const aiApprovalRate = aiQualifiedLeads > 0 ? (aiApprovedLeads / aiQualifiedLeads) * 100 : 0
    const aiClosedDeals = closedDeals.filter((deal) => aiByLead.has(deal.id || '')).length
    const aiToClosedRate = aiQualifiedLeads > 0 ? (aiClosedDeals / aiQualifiedLeads) * 100 : 0

    const eventClosedDeals = closedDeals.filter((deal) => deal.notes?.toLowerCase().includes('evento'))
    const eventsContracts = eventClosedDeals.length
    const eventsRoi = eventClosedDeals.reduce((sum, deal) => sum + Number(deal.expected_value || 0), 0)

    const mixLeads = allLeads.filter(lead => {
      const isMixStage = lead.stage !== 'Fechado' && lead.stage !== 'Perdido';
      if (!isMixStage) return false;
      if (filterMonth && filterYear && lead.created_at) {
        const d = new Date(lead.created_at);
        if (d.getMonth() + 1 !== parseInt(filterMonth, 10) || d.getFullYear() !== parseInt(filterYear, 10)) {
          return false;
        }
      }
      return true;
    });

    const productMap: Record<string, { value: number; color: string }> = {}
    mixLeads.forEach((lead) => {
      const productName = lead.product?.name || 'Geral'
      const color = lead.product?.color || '#3b82f6'
      if (!productMap[productName]) productMap[productName] = { value: 0, color }
      productMap[productName].value += 1
    })

    const totalMixLeads = mixLeads.length || 1
    const productData: ProductData = Object.entries(productMap).map(([name, data]) => ({
      name,
      value: Math.round((data.value / totalMixLeads) * 100),
      color: data.color
    }))

    const xpMap: Record<string, number> = {}
    allXpLogs.forEach((log) => {
      xpMap[log.profile_id] = (xpMap[log.profile_id] || 0) + log.xp_amount
    })

    const contractsMap: Record<string, number> = {}
    closedDeals.forEach((deal) => {
      if (!deal.consultant_id) return
      contractsMap[deal.consultant_id] = (contractsMap[deal.consultant_id] || 0) + 1
    })

    const levels = [
      { nome: 'Prospector', min: 0, max: 999 },
      { nome: 'Hunter', min: 1000, max: 2999 },
      { nome: 'Closer', min: 3000, max: 5999 },
      { nome: 'Elite', min: 6000, max: 9999 },
      { nome: 'Top Performer', min: 10000, max: 99999 },
    ]

    const realRanking = allTeam.map((profile) => {
      const xp = xpMap[profile.id] || 0
      const consultantContracts = contractsMap[profile.id] || 0
      const level = levels.find((item) => xp >= item.min && xp <= item.max) || levels[0]

      return {
        name: profile.full_name || 'Usuario',
        role: profile.role || '',
        xp,
        contratos: consultantContracts,
        nivel: level.nome,
        meta: 0
      }
    })

    realRanking.sort((a, b) => b.xp - a.xp || b.contratos - a.contratos)
    const topConsultantName = realRanking[0]?.name || 'Sem dados'
    const topConsultantXp = realRanking[0]?.xp || 0

    // const now = new Date() (reusing the one declared at the top)
    const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthKey = `${prevDate.getFullYear()}-${prevDate.getMonth()}`
    const revenueByMonth: Record<string, number> = {}
    closedDeals.forEach((deal) => {
      if (!deal.created_at) return
      const d = new Date(deal.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(deal.expected_value || 0)
    })
    const currentMonthRevenue = revenueByMonth[currentMonthKey] || 0
    const prevMonthRevenue = revenueByMonth[prevMonthKey] || 0
    const revenueTrend = prevMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : currentMonthRevenue > 0 ? 100 : 0

    // Lead Velocity Calculation
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthLeads = allLeads.filter(l => l.created_at && new Date(l.created_at) >= monthStart).length
    const prevMonthLeadsStart = new Date(monthStart)
    prevMonthLeadsStart.setMonth(prevMonthLeadsStart.getMonth() - 1)
    const prevMonthLeads = allLeads.filter(l => 
      l.created_at && 
      new Date(l.created_at) >= prevMonthLeadsStart && 
      new Date(l.created_at) < monthStart
    ).length
    const leadVelocity = prevMonthLeads > 0 
      ? Math.round(((currentMonthLeads - prevMonthLeads) / prevMonthLeads) * 100)
      : currentMonthLeads > 0 ? 100 : 0

    // Loss Rate Calculation
    const lossRate = resolvedDeals > 0 ? (lostDeals.length / resolvedDeals) * 100 : 0

    const kpis: KPIData = {
      revenue,
      revenueMeta: REVENUE_META,
      revenueTrend,
      contracts,
      contractsMeta: CONTRACTS_META,
      activeLeads: activeLeads.length,
      teamSize: allTeam.length,
      topConsultant: topConsultantName,
      topConsultantXp,
      conversionRate,
      averageTicket,
      winRate,
      leadVelocity,
      lossRate,
      lostDeals: lostDeals.length,
      averagePipelineDays,
      lateStageOpportunities,
      aiQualifiedLeads,
      aiApprovalRate,
      aiToClosedRate,
      eventsContracts,
      eventsRoi
    }

    if (productData.length === 0) {
      productData.push({ name: 'Sem leads ativos', value: 100, color: '#64748b' })
    }

    const recentActivity = buildRecentActivity(allLeads)
    const revenueData = buildRevenueData(closedDeals)
    const contractsMonthly = buildContractsByMonth(closedDeals)

    // Momentum Data
    const todayStart = new Date()
    todayStart.setHours(0,0,0,0)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)


    const momentumData: MomentumData = {
      today: closedDeals.filter(d => d.created_at && new Date(d.created_at) >= todayStart).length,
      week: closedDeals.filter(d => d.created_at && new Date(d.created_at) >= weekStart).length,
      month: closedDeals.filter(d => d.created_at && new Date(d.created_at) >= monthStart).length,
      meta: CONTRACTS_META
    }

    const profileNameMap = new Map(allTeam.map(p => [p.id, p.full_name?.split(' ')[0] || 'Consultor']))
    const lastClosedLead = [...closedDeals].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] || null
    const lastDeal: LastDealData = lastClosedLead ? {
      leadName: lastClosedLead.name || 'Lead',
      consultantName: lastClosedLead.consultant_id ? (profileNameMap.get(lastClosedLead.consultant_id) || 'Equipe') : 'Equipe',
      value: Number(lastClosedLead.expected_value || 0),
      closedAt: lastClosedLead.created_at || null,
    } : null

    const buildFocusData = (leadsSource: LeadRecord[], name: string, color: string, id: string, category = '') => {
      const pLeads = leadsSource
      const pActive = pLeads.filter((l) => l.stage !== 'Fechado' && l.stage !== 'Perdido')
      const pClosed = pLeads.filter((l) => l.stage === 'Fechado')
      const pLost = pLeads.filter((l) => l.stage === 'Perdido')
      const pRevenue = pClosed.reduce((s, d) => s + Number(d.expected_value || 0), 0)
      const pContracts = pClosed.length
      const pResolved = pContracts + pLost.length
      const pParticipation = totalLeads > 0 ? Math.round((pLeads.length / totalLeads) * 100) : 0
      const pMeta = CONTRACTS_META
      
      const pLeadIds = new Set(pLeads.map((l) => l.id).filter(Boolean))
      const pAiQuals = aiQualifications.filter((q) => pLeadIds.has(q.lead_id))
      const pAiQualified = pAiQuals.filter((q) => q.status && q.status !== 'nao_avaliado').length
      const pAiApproved = pAiQuals.filter((q) => ['aprovado', 'qualificado'].includes(String(q.status || '').toLowerCase())).length
      const pAiApprovalRate = pAiQualified > 0 ? (pAiApproved / pAiQualified) * 100 : 0
      const pAiClosed = pClosed.filter((d) => aiByLead.has(d.id || '')).length
      const pAiToClosedRate = pAiQualified > 0 ? (pAiClosed / pAiQualified) * 100 : 0

      const pContractsMap: Record<string, number> = {}
      pClosed.forEach((d) => {
        if (!d.consultant_id) return
        pContractsMap[d.consultant_id] = (pContractsMap[d.consultant_id] || 0) + 1
      })

      const pTop = getTopConsultant(allTeam, xpMap, pContractsMap)

      const pStaleLeads = pActive.filter((l) => {
        const createdAt = l.created_at ? new Date(l.created_at).getTime() : Date.now()
        const daysStale = (Date.now() - createdAt) / (1000 * 60 * 60 * 24)
        return daysStale > 3
      }).map(l => ({
        id: l.id || '',
        name: l.name || 'Sem nome',
        stage: l.stage || '',
        days_stale: Math.floor((Date.now() - (l.created_at ? new Date(l.created_at).getTime() : Date.now())) / (1000 * 60 * 60 * 24))
      })).sort((a, b) => b.days_stale - a.days_stale)

      return {
        id,
        name,
        category,
        color,
        participation: pParticipation,
        contractsMeta: pMeta,
        kpis: {
          revenue: pRevenue,
          revenueMeta: 0,
          revenueTrend: 0,
          contracts: pContracts,
          contractsMeta: pMeta,
          activeLeads: pActive.length,
          teamSize: allTeam.length,
          topConsultant: pTop.name,
          topConsultantXp: pTop.xp,
          conversionRate: pLeads.length > 0 ? (pContracts / pLeads.length) * 100 : 0,
          averageTicket: pContracts > 0 ? pRevenue / pContracts : 0,
          winRate: pResolved > 0 ? (pContracts / pResolved) * 100 : 0,
          leadVelocity: 0, // Simplified for focus mode
          lossRate: pResolved > 0 ? (pLost.length / pResolved) * 100 : 0,
          lostDeals: pLost.length,
          averagePipelineDays: getAveragePipelineDays(pActive),
          lateStageOpportunities: getLateStageOpportunities(pActive),
          aiQualifiedLeads: pAiQualified,
          aiApprovalRate: pAiApprovalRate,
          aiToClosedRate: pAiToClosedRate,
          eventsContracts: 0,
          eventsRoi: 0
        },
        pipelineData: getPipelineData(pActive),
        revenueData: buildRevenueData(pClosed),
        recentActivity: buildRecentActivity(pLeads),
        staleLeads: pStaleLeads
      }
    }

    const productFocusData: ProductFocusData[] = []
    
    // Process Products
    dbProducts.forEach(prod => {
      const prodLeads = allLeads.filter(l => {
        if (l.product_id !== prod.id) return false;
        if (filterMonth && filterYear && l.created_at) {
          const d = new Date(l.created_at);
          if (d.getMonth() + 1 !== parseInt(filterMonth as string, 10) || d.getFullYear() !== parseInt(filterYear as string, 10)) return false;
        }
        return true;
      });
      productFocusData.push(buildFocusData(prodLeads, prod.name, prod.color, prod.id, prod.category || ''))
      
      // Process Sub-products for this product
      const subProds = dbSubProducts.filter(s => s.product_id === prod.id)
      subProds.forEach(sub => {
        const subLeads = allLeads.filter(l => {
          if (l.sub_product_id !== sub.id) return false;
          if (filterMonth && filterYear && l.created_at) {
            const d = new Date(l.created_at);
            if (d.getMonth() + 1 !== parseInt(filterMonth as string, 10) || d.getFullYear() !== parseInt(filterYear as string, 10)) return false;
          }
          return true;
        });
        if (subLeads.length > 0) {
          productFocusData.push(buildFocusData(subLeads, `> ${sub.name}`, prod.color, sub.id, prod.category || ''))
        }
      })
    })

    return (
      <DashboardClient
        kpis={kpis}
        pipelineData={pipelineData}
        productData={productData}
        momentumData={momentumData}
        lastDeal={lastDeal}
        recentActivity={recentActivity}
        revenueData={revenueData}
        productFocusData={productFocusData}
        contractsMonthly={contractsMonthly}
      />
    )
  } catch (error) {
    console.error('Falha ao montar o dashboard:', error)
    return (
      <DashboardClient
        kpis={{
          revenue: 0,
          revenueMeta: 0,
          revenueTrend: 0,
          contracts: 0,
          contractsMeta: 0,
          activeLeads: 0,
          teamSize: 0,
          topConsultant: 'Sem dados',
          topConsultantXp: 0,
          conversionRate: 0,
          averageTicket: 0,
          winRate: 0,
          leadVelocity: 0,
          lossRate: 0,
          lostDeals: 0,
          averagePipelineDays: 0,
          lateStageOpportunities: 0,
          aiQualifiedLeads: 0,
          aiApprovalRate: 0,
          aiToClosedRate: 0,
          eventsContracts: 0,
          eventsRoi: 0,
        }}
        pipelineData={[]}
        productData={[{ name: 'Sem leads ativos', value: 100, color: '#64748b' }]}
        momentumData={{ today: 0, week: 0, month: 0, meta: 0 }}
        lastDeal={null}
        recentActivity={[]}
        revenueData={[]}
        productFocusData={[]}
        contractsMonthly={[]}
      />
    )
  }
}
