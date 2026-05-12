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

// ── Cálculo de Comissão Fixa por tipo de produto ──────────────────────────────
export async function calcularComissaoFixa(tipoComissao: string | null, comissaoFixaValor?: number): Promise<number> {
  if (comissaoFixaValor && comissaoFixaValor > 0) return comissaoFixaValor

  const fixos: Record<string, number> = {
    TESE: 200,
    'CRÉDITO_ACUM': 150,
    PIS_COFINS: 120,
    SUBVENÇÃO: 120,
    RURAL: 90,
    COMPLIANCE: 90,
    OUTRO: 70,
  }
  return fixos[tipoComissao ?? ''] ?? 90
}

// ── Cálculo de Comissão Variável Escalonada por tipo ─────────────────────────
export async function calcularComissaoVariavel(tipoComissao: string | null, valorLiberacao: number): Promise<number> {
  const v = Math.max(0, valorLiberacao)

  switch (tipoComissao) {
    case 'TESE':
      return Math.min(v, 50000) * 0.08
        + Math.max(0, Math.min(v, 200000) - 50000) * 0.05
        + Math.max(0, Math.min(v, 500000) - 200000) * 0.03
        + Math.max(0, v - 500000) * 0.015

    case 'CRÉDITO_ACUM':
      return Math.min(v, 50000) * 0.06
        + Math.max(0, Math.min(v, 200000) - 50000) * 0.04
        + Math.max(0, Math.min(v, 500000) - 200000) * 0.025
        + Math.max(0, v - 500000) * 0.01

    case 'PIS_COFINS':
      return Math.min(v, 50000) * 0.06
        + Math.max(0, Math.min(v, 200000) - 50000) * 0.04
        + Math.max(0, v - 200000) * 0.02

    case 'SUBVENÇÃO':
      return Math.min(v, 100000) * 0.05
        + Math.max(0, v - 100000) * 0.025

    case 'RURAL':
      return Math.min(v, 100000) * 0.10
        + Math.max(0, Math.min(v, 200000) - 100000) * 0.07
        + Math.max(0, v - 200000) * 0.05

    // COMPLIANCE, OUTRO e demais: sem comissão variável
    default:
      return 0
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

  // Anti-recorrência: bloqueia se já existe comissão variável para este deal
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

// ── Marcar comissão como paga ─────────────────────────────────────────────────
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

// ── CRUD de Regras de Comissão ────────────────────────────────────────────────
export async function createCommissionRule(data: {
  product_id: string
  base_rate: number
  base_fixed: number
  recurrent_rate: number
  sdr_rate: number
  notes: string
}) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false, error: 'Sem permissao para criar regras de comissao.' }
  }

  const { error } = await supabase.from('commission_rules').insert({
    product_id: data.product_id || null,
    base_rate: data.base_rate || 0,
    base_fixed: data.base_fixed || 0,
    recurrent_rate: data.recurrent_rate || 0,
    sdr_rate: data.sdr_rate || 0,
    notes: data.notes || null,
  })

  if (error) {
    console.error('Erro ao criar regra:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}

export async function updateCommissionRule(ruleId: string, data: {
  product_id: string
  base_rate: number
  base_fixed: number
  recurrent_rate: number
  sdr_rate: number
  notes: string
}) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false, error: 'Sem permissao para editar regras de comissao.' }
  }

  const { error } = await supabase.from('commission_rules').update({
    product_id: data.product_id || null,
    base_rate: data.base_rate || 0,
    base_fixed: data.base_fixed || 0,
    recurrent_rate: data.recurrent_rate || 0,
    sdr_rate: data.sdr_rate || 0,
    notes: data.notes || null,
  }).eq('id', ruleId)

  if (error) {
    console.error('Erro ao atualizar regra:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}

export async function deleteCommissionRule(ruleId: string) {
  const { user, role, supabase } = await getAuthUserRole()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!role || !ADMIN_ROLES.includes(role)) {
    return { success: false, error: 'Sem permissao para remover regras de comissao.' }
  }

  const { error } = await supabase.from('commission_rules').delete().eq('id', ruleId)

  if (error) {
    console.error('Erro ao remover regra:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/comissoes')
  return { success: true }
}
