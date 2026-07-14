'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ADMIN_ROLES = ['admin', 'gestor', 'manager']

async function getAuthUserRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null, supabase }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return { user, role: (profile?.role as string | null) ?? null, supabase }
}

// ── PARTE 3: Bônus de Fechamento (Pago na Assinatura) ──────────────────────
export async function calcularComissaoFixa(produtoSlug: string | null, comissaoFixaValor?: number): Promise<number> {
  if (comissaoFixaValor && comissaoFixaValor > 0) return comissaoFixaValor

  const slug = produtoSlug || ''
  
  if (slug === 'cessao-recorrente') return 70
  if (['produtor-rural', 'intermediacao-creditos', 'parceria-estrategica', 'consulta-tributaria', 'tese-tributaria-icms-st'].includes(slug)) return 90
  if (slug === 'analise-transferencias-federais') return 120
  if (slug === 'credito-acumulado-icms' || slug === 'transferencia-credito-acumulado') return 150
  if (slug === 'compliance-fiscal') return 180
  if (['tese-tributaria-pis-cofins', 'tese-tributaria-cat83-cat207'].includes(slug)) return 200

  return 90 // default fallback
}

// ── PARTE 1: Comissão Variável Escalonada (Só PF/crédito) ─────────────────
export async function calcularComissaoVariavel(produtoSlug: string | null, valorLiberacao: number): Promise<number> {
  const v = Math.max(0, valorLiberacao)
  const slug = produtoSlug || ''

  if (slug === 'tese-tributaria-icms-st') { // Análise de Crédito ICMS
    if (v <= 100000) return v * 0.025
    if (v <= 250000) return v * 0.020
    return v * 0.010
  }

  if (slug === 'tese-tributaria-cat83-cat207') { // CAT 83 + CAT 207
    if (v <= 50000) return v * 0.035
    if (v <= 150000) return v * 0.025
    return v * 0.015
  }

  if (slug === 'credito-acumulado-icms') { // Transformação Simples -> Acumulado
    if (v <= 50000) return v * 0.035
    if (v <= 100000) return v * 0.025
    return v * 0.015
  }

  if (slug === 'transferencia-credito-acumulado') { // Venda de Crédito Acumulado
    if (v <= 30000) return v * 0.040
    if (v <= 75000) return v * 0.030
    return v * 0.020
  }

  if (slug === 'tese-tributaria-pis-cofins') { // PIS/COFINS Federal
    if (v <= 30000) return v * 0.035
    if (v <= 75000) return v * 0.025
    return v * 0.015
  }

  if (slug === 'produtor-rural') { // Produtor Rural (PF - Bertoni)
    return v * 0.100
  }

  // Fallback default
  return 0
}

// ── PARTE 2: Comissionamento Fixo por Etapa do Funil ────────────────────────
export async function calcularComissaoPorEtapa(primeiraParcelaLiquida: number) {
  const baseDistribui = primeiraParcelaLiquida * 0.40
  
  return {
    totalDistribuido: baseDistribui,
    indicacao: baseDistribui * (5 / 40),      // Proporcional aos 40% (equivale a 5% do LÍQUIDO total)
    qualificacao: baseDistribui * (10 / 40),  // Equivale a 10% do LÍQUIDO total
    elaboracao: baseDistribui * (10 / 40),    // Equivale a 10% do LÍQUIDO total
    fechamento: baseDistribui * (15 / 40)     // Equivale a 15% do LÍQUIDO total
  }
}

// ── Registrar comissão variável na 1ª liberação ───────────────────────────────
export async function registrarComissaoVariavel(
  dealId: string,
  profileId: string,
  valorLiberacao: number,
  tipoComissao: string | null
) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Não autorizado.' }
  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false, error: 'Sem permissão para registrar comissão.' }
  }

  const { count } = await supabase
    .from('commissions')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)
    .eq('commission_type', 'VARIAVEL')

  if ((count ?? 0) > 0) {
    return { success: false, error: 'Comissão variável já registrada para este contrato.' }
  }

  const amount = await calcularComissaoVariavel(tipoComissao, valorLiberacao)
  if (amount <= 0) {
    return { success: true, skipped: true, message: 'Tipo sem comissão variável (apenas fixa).' }
  }

  const { error } = await supabase.from('commissions').insert({
    deal_id: dealId,
    profile_id: profileId,
    amount: Math.round(amount * 100) / 100,
    type: 'VARIAVEL',
    commission_type: 'VARIAVEL',
    valor_liberacao: valorLiberacao,
    status: 'pendente',
    variavel_paga: false,
  })

  if (error) {
    console.error('Erro ao registrar comissão variável:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  return { success: true, amount }
}

export async function markCommissionPaid(commissionId: string) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false, error: 'Sem permissao para marcar comissao como paga.' }
  }

  const { error } = await supabase
    .from('commissions')
    .update({ status: 'pago', variavel_paga: true })
    .eq('id', commissionId)

  if (error) {
    console.error('Erro ao marcar comissao como paga:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createManualCommission(input: {
  profileId: string
  productId: string | null
  amount: number
  status: 'pendente' | 'pago'
  notes: string | null
}) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }
  if (!role || !ADMIN_ROLES.includes(role)) return { success: false, error: 'Sem permissao para lancar comissao.' }

  if (!input.profileId) return { success: false, error: 'Selecione o consultor.' }
  if (!input.amount || input.amount <= 0) return { success: false, error: 'Informe um valor de comissao valido.' }

  const { error } = await supabase.from('commissions').insert({
    profile_id: input.profileId,
    product_id: input.productId || null,
    deal_id: null,
    amount: Math.round(input.amount * 100) / 100,
    type: 'MANUAL',
    commission_type: 'MANUAL',
    status: input.status,
    variavel_paga: input.status === 'pago',
    notes: input.notes || '',
  })

  if (error) {
    console.error('Erro ao lancar comissao manual:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createCommissionRule(data: any) {
  // Mantido igual ao original
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }
  if (!role || !ADMIN_ROLES.includes(role)) return { success: false, error: 'Sem permissao.' }

  const { error } = await supabase.from('commission_rules').insert(data)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}

export async function updateCommissionRule(ruleId: string, data: any) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }
  if (!role || !ADMIN_ROLES.includes(role)) return { success: false, error: 'Sem permissao.' }

  const { error } = await supabase.from('commission_rules').update(data).eq('id', ruleId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}

export async function deleteCommissionRule(ruleId: string) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }
  if (!role || !ADMIN_ROLES.includes(role)) return { success: false, error: 'Sem permissao.' }

  const { error } = await supabase.from('commission_rules').delete().eq('id', ruleId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}
