import { createClient } from '@/lib/supabase/server'
import RelatoriosClient, { MonthlyDataPoint } from './relatorios-client'

export const dynamic = 'force-dynamic'

function getLastSixMonths(): Array<{ year: number; month: number; label: string }> {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    }
  })
}

export default async function RelatoriosPage() {
  const supabase = await createClient()

  const [
    { data: leadsData },
    { data: profilesData },
    { data: commissionsData },
    { data: productsData },
  ] = await Promise.all([
    supabase
      .from('leads')
      .select('id, stage, estimated_value, created_at, consultant_id, product:products(name)'),
    supabase
      .from('profiles')
      .select('id, full_name, role'),
    supabase
      .from('commissions')
      .select('id, amount, status, created_at, profile:profiles(full_name), deal:deals(value, product:products(name))'),
    supabase
      .from('products')
      .select('id, name'),
  ])

  const leads = (leadsData || []) as unknown as Array<{
    id: string
    stage: string
    estimated_value: number | string | null
    created_at: string
    consultant_id: string | null
    product: { name: string } | null
  }>

  const profiles = (profilesData || []) as Array<{ id: string; full_name: string | null; role: string | null }>
  const products = (productsData || []) as Array<{ id: string; name: string }>

  // ── Monthly aggregation (by lead creation date) ──────────────
  const months = getLastSixMonths()

  const allMonthlyData: MonthlyDataPoint[] = months.map(({ year, month, label }) => {
    const monthLeads = leads.filter((l) => {
      const d = new Date(l.created_at)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const closed = monthLeads.filter((l) => l.stage === 'Fechado')
    const lost = monthLeads.filter((l) => l.stage === 'Perdido')
    const total = closed.length + lost.length

    return {
      mes: label,
      contratos: closed.length,
      receita: closed.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0),
      taxa: total > 0 ? Math.round((closed.length / total) * 1000) / 10 : 0,
    }
  })

  const totalLeads = leads.length
  const totalClosed = leads.filter((l) => l.stage === 'Fechado').length

  // ── Team export ───────────────────────────────────────────────
  const closedLeads = leads.filter((l) => l.stage === 'Fechado')

  const teamExport = [
    'Consultor;Cargo;Contratos;Receita (R$)',
    ...profiles.map((p) => {
      const mine = closedLeads.filter((l) => l.consultant_id === p.id)
      const revenue = mine.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0)
      return `${p.full_name ?? 'Sem nome'};${p.role ?? ''};${mine.length};${revenue.toFixed(2)}`
    }),
  ].join('\n')

  // ── Products export ───────────────────────────────────────────
  const productsExport = [
    'Produto;Contratos;Receita (R$)',
    ...products.map((prod) => {
      const mine = closedLeads.filter((l) => l.product?.name === prod.name)
      const revenue = mine.reduce((sum, l) => sum + Number(l.estimated_value ?? 0), 0)
      return `${prod.name};${mine.length};${revenue.toFixed(2)}`
    }),
  ].join('\n')

  // ── Commissions export ────────────────────────────────────────
  const commissions = (commissionsData || []) as unknown as Array<{
    id: string
    amount: number | null
    status: string
    created_at: string
    profile: { full_name: string } | null
    deal: { value: number | null; product: { name: string } | null } | null
  }>

  const commissionsExport = [
    'Consultor;Produto;Comissao (R$);Status;Data',
    ...commissions.map((c) => {
      const date = new Date(c.created_at).toLocaleDateString('pt-BR')
      return `${c.profile?.full_name ?? 'Desconhecido'};${c.deal?.product?.name ?? 'Venda'};${Number(c.amount ?? 0).toFixed(2)};${c.status};${date}`
    }),
  ].join('\n')

  return (
    <RelatoriosClient
      allMonthlyData={allMonthlyData}
      teamExport={teamExport}
      productsExport={productsExport}
      commissionsExport={commissionsExport}
      totalLeads={totalLeads}
      totalClosed={totalClosed}
    />
  )
}
