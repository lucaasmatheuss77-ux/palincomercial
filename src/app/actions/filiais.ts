'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FilialRecord = {
  id: string
  client_id: string
  nome: string
  documento: string | null
  cidade: string | null
  estado: string | null
  created_at?: string
  updated_at?: string
}

export type FilialInput = {
  client_id: string
  nome: string
  documento?: string | null
  cidade?: string | null
  estado?: string | null
}

export async function listFiliaisByClient(clientId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('filiais')
    .select('*')
    .eq('client_id', clientId)
    .order('nome', { ascending: true })

  if (error) {
    console.error('Error listing filiais:', error)
    return []
  }

  return (data || []) as FilialRecord[]
}

export async function listFiliaisByClients(clientIds: string[]) {
  if (clientIds.length === 0) return [] as FilialRecord[]
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('filiais')
    .select('*')
    .in('client_id', clientIds)
    .order('nome', { ascending: true })

  if (error) {
    console.error('Error listing filiais by clients:', error)
    return []
  }

  return (data || []) as FilialRecord[]
}

export async function createFilial(input: FilialInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('filiais')
    .insert([{
      client_id: input.client_id,
      nome: input.nome,
      documento: input.documento || null,
      cidade: input.cidade || null,
      estado: input.estado || null,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating filial:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/onboarding')
  return { success: true, data: data as FilialRecord }
}

export async function updateFilial(id: string, input: Partial<FilialInput>) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('filiais')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating filial:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/onboarding')
  return { success: true, data: data as FilialRecord }
}

export async function deleteFilial(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('filiais').delete().eq('id', id)

  if (error) {
    console.error('Error deleting filial:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath('/dashboard/onboarding')
  return { success: true }
}

export async function setOnboardingFilial(clientId: string, filialId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('onboarding')
    .upsert(
      { client_id: clientId, filial_id: filialId, updated_at: new Date().toISOString() },
      { onConflict: 'client_id' }
    )

  if (error) {
    console.error('Error setting onboarding filial:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/onboarding')
  return { success: true }
}

export async function getOnboardingFiliais(clientIds: string[]) {
  if (clientIds.length === 0) return {} as Record<string, string>
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('onboarding')
    .select('client_id, filial_id')
    .in('client_id', clientIds)

  if (error) {
    console.error('Error loading onboarding filiais:', error)
    return {} as Record<string, string>
  }

  const map: Record<string, string> = {}
  for (const row of data || []) {
    if (row.client_id && row.filial_id) map[row.client_id] = row.filial_id
  }
  return map
}
