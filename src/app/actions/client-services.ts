'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type HonorarioTipo = 'percentual' | 'fixo'

export type ClientServiceRecord = {
  id: string
  client_id: string
  product_id: string | null
  nome: string
  tipo_honorario: HonorarioTipo
  honorario_valor: number | null
  honorario_percentual: number | null
  base_calculo: string | null
  status: string
  data_inicio: string | null
  data_fim: string | null
  notas: string | null
  created_at?: string
  updated_at?: string
}

export type ClientServiceInput = {
  client_id: string
  product_id?: string | null
  nome: string
  tipo_honorario?: HonorarioTipo
  honorario_valor?: number | null
  honorario_percentual?: number | null
  base_calculo?: string | null
  status?: string
  data_inicio?: string | null
  data_fim?: string | null
  notas?: string | null
}

export async function listClientServices(clientId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_services')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error listing client services:', error)
    return []
  }

  return (data || []) as ClientServiceRecord[]
}

export async function listClientServicesByClients(clientIds: string[]) {
  if (clientIds.length === 0) return [] as ClientServiceRecord[]
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_services')
    .select('*')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error listing client services by clients:', error)
    return []
  }

  return (data || []) as ClientServiceRecord[]
}

export async function createClientService(input: ClientServiceInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('client_services')
    .insert([{
      client_id: input.client_id,
      product_id: input.product_id || null,
      nome: input.nome,
      tipo_honorario: input.tipo_honorario || 'percentual',
      honorario_valor: input.tipo_honorario === 'fixo' ? (input.honorario_valor ?? null) : null,
      honorario_percentual: input.tipo_honorario === 'fixo' ? null : (input.honorario_percentual ?? null),
      base_calculo: input.base_calculo || null,
      status: input.status || 'ativo',
      data_inicio: input.data_inicio || null,
      data_fim: input.data_fim || null,
      notas: input.notas || null,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating client service:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true, data: data as ClientServiceRecord }
}

export async function updateClientService(id: string, input: Partial<ClientServiceInput>) {
  const supabase = await createClient()

  const payload: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() }
  if (input.tipo_honorario === 'fixo') {
    payload.honorario_percentual = null
  } else if (input.tipo_honorario === 'percentual') {
    payload.honorario_valor = null
  }

  const { data, error } = await supabase
    .from('client_services')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating client service:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true, data: data as ClientServiceRecord }
}

export async function deleteClientService(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('client_services').delete().eq('id', id)

  if (error) {
    console.error('Error deleting client service:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  return { success: true }
}
