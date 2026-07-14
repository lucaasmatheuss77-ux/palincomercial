import { getMyProfile } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/server'
import { listStrategicPlanItems } from '@/app/actions/planejamento'
import PlanejamentoClient from './planejamento-client'

type PlanningPermission = {
  module?: string
  can_edit?: boolean
  can_create?: boolean
  can_delete?: boolean
}

type ContractRow = {
  id: string
  status: string | null
  value: number | string | null
  product_id: string | null
  start_date: string | null
  end_date: string | null
  created_at: string | null
}

type ProductRow = {
  id: string
  category: string | null
}

export const metadata = {
  title: 'Planejamento Estrategico 2026',
}

export default async function PlanejamentoPage() {
  const supabase = await createClient()
  const profile = await getMyProfile()
  const role = profile?.role?.toLowerCase()
  const canEditByRole = ['admin', 'gestor', 'administrador', 'manager'].includes(role || '')
  const canEditByPermission = Array.isArray(profile?.permissions)
    ? (profile.permissions as PlanningPermission[]).some((permission) =>
        permission.module === 'Planejamento' &&
        (permission.can_edit || permission.can_create || permission.can_delete)
      )
    : false

  const now = new Date()
  const currentYear = now.getFullYear()
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`

  const [contractsRes, productsRes, activeClientsRes, avencerRes, honorariosRes, icmsRes, ownersRes, planItems] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, status, value, product_id, start_date, end_date, created_at')
      .gte('created_at', yearStart)
      .lte('created_at', `${yearEnd}T23:59:59`),
    supabase.from('products').select('id, category'),
    supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('status_cliente', 'ativo'),
    supabase.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ativo').not('end_date', 'is', null).lte('end_date', new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('client_services').select('tipo_honorario, honorario_valor').eq('status', 'ativo'),
    supabase.from('icms_operations').select('valor_icms').gte('data_venda', yearStart).lte('data_venda', yearEnd),
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    listStrategicPlanItems(),
  ])

  const owners = ((ownersRes.data || []) as { id: string; full_name: string | null }[]).map((p) => ({ id: p.id, name: p.full_name || 'Sem nome' }))

  const contracts = (contractsRes.data || []) as ContractRow[]
  const products = (productsRes.data || []) as ProductRow[]
  const productCategoryById = new Map(products.map((product) => [product.id, product.category || 'Tributário']))

  const decidedContracts = contracts.filter((contract) => contract.status !== 'pendente_assinatura')
  const ruralContracts = decidedContracts.filter((contract) => productCategoryById.get(contract.product_id || '') === 'Rural')
  const pjContracts = decidedContracts.filter((contract) => productCategoryById.get(contract.product_id || '') !== 'Rural')
  const activeContracts = decidedContracts.filter((contract) => contract.status === 'ativo')
  const monthsElapsed = Math.max(1, now.getMonth() + 1)

  const monthlyCounts = Array.from({ length: 12 }, () => 0)
  for (const contract of decidedContracts) {
    const dateSource = contract.start_date || contract.created_at
    if (!dateSource) continue
    // Parseia o mes direto da string (YYYY-MM-DD...) para nao sofrer com fuso horario
    // deslocando uma data tipo DATE (sem horario) para o mes anterior/seguinte.
    const month = Number(dateSource.slice(5, 7)) - 1
    if (month >= 0 && month < 12) monthlyCounts[month] += 1
  }

  const renewalRate = decidedContracts.length > 0
    ? Math.round((activeContracts.length / decidedContracts.length) * 100)
    : 0

  const honorarioRows = (honorariosRes.data || []) as { tipo_honorario: string; honorario_valor: number | null }[]
  const totalHonorariosFixosAtivos = honorarioRows
    .filter((row) => row.tipo_honorario === 'fixo')
    .reduce((sum, row) => sum + (row.honorario_valor || 0), 0)
  const trabalhosVariaveisAtivos = honorarioRows.filter((row) => row.tipo_honorario === 'percentual').length
  const totalIcmsLiberado = (icmsRes.data || []).reduce((sum: number, row: { valor_icms: number | null }) => sum + (Number(row.valor_icms) || 0), 0)

  const stats = {
    contratosPj: pjContracts.length,
    contratosRurais: ruralContracts.length,
    mediaPjMes: Math.round((pjContracts.length / monthsElapsed) * 10) / 10,
    renovacaoPj: renewalRate,
    creditoIcmsLiberado: totalIcmsLiberado,
    honorariosFixosAtivos: totalHonorariosFixosAtivos,
    trabalhosVariaveisAtivos,
    clientesAtivos: activeClientsRes.count || 0,
    clientesAvencer: avencerRes.count || 0,
    monthlyCounts,
  }

  return <PlanejamentoClient canEdit={canEditByRole || canEditByPermission} stats={stats} items={planItems} owners={owners} />
}
