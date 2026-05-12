import { createClient } from '@/lib/supabase/server'
import MetasClient from './metas-client'

export const dynamic = 'force-dynamic'

export default async function MetasPage() {
  const supabase = await createClient()

  const [
    { data: profiles },
    { data: leads },
    { data: products },
    { data: goals },
  ] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role').eq('active', true).order('full_name'),
    supabase.from('leads').select('id, name, consultant_id, product_id, stage, created_at'),
    supabase.from('products').select('id, name, emoji, color').eq('active', true).order('name'),
    supabase
      .from('sales_goals')
      .select('*, products(name, emoji, color), profiles(full_name)')
      .order('period', { ascending: false }),
  ])

  const team = profiles || []
  const allLeads = leads || []
  const allProducts = products || []
  const allGoals = goals || []

  const closedDeals = allLeads.filter((l) => l.stage === 'Fechado')
  const openLeads = allLeads.filter((l) => l.stage !== 'Fechado' && l.stage !== 'Perdido')
  const totalContracts = closedDeals.length
  const totalOpen = openLeads.length

  const byProduct = allProducts.map((p) => {
    const productLeads = allLeads.filter((l) => l.product_id === p.id)
    const productClosed = productLeads.filter((l) => l.stage === 'Fechado')
    const productOpen = productLeads.filter((l) => l.stage !== 'Fechado' && l.stage !== 'Perdido')

    return {
      ...p,
      totalLeads: productLeads.length,
      closed: productClosed.length,
      open: productOpen.length,
      subs: [] as { id: string; name: string }[],
    }
  })

  const memberRows = team.map((profile) => {
    const memberClosed = closedDeals.filter((l) => l.consultant_id === profile.id)
    const memberOpen = openLeads.filter((l) => l.consultant_id === profile.id)

    const byProd = allProducts.map((p) => ({
      productId: p.id,
      productName: p.name,
      emoji: p.emoji,
      closed: memberClosed.filter((l) => l.product_id === p.id).length,
      open: memberOpen.filter((l) => l.product_id === p.id).length,
    }))

    return {
      id: profile.id,
      name: profile.full_name || 'Usuário',
      role: profile.role || 'Comercial',
      contracts: memberClosed.length,
      open: memberOpen.length,
      byProduct: byProd.filter((bp) => bp.closed > 0 || bp.open > 0),
    }
  }).sort((a, b) => b.contracts - a.contracts)

  return (
    <MetasClient
      totalContracts={totalContracts}
      totalOpen={totalOpen}
      byProduct={byProduct}
      memberRows={memberRows}
      products={allProducts.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji || '📦' }))}
      consultants={team.map((t) => ({ id: t.id, name: t.full_name || 'Usuário' }))}
      goals={allGoals as Parameters<typeof MetasClient>[0]['goals']}
    />
  )
}
