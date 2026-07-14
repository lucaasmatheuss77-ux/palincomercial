'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const STRATEGIC_PLAN_BUCKET = 'strategic-plan'

export type StrategicPlanItem = {
  id: string
  title: string
  description: string | null
  category: string | null
  target_value: number | null
  current_value: number | null
  unit: string | null
  due_date: string | null
  status: string
  owner_id: string | null
  owner_name?: string | null
  file_path: string | null
  file_name: string | null
  file_signed_url?: string | null
  created_at: string
}

export async function listStrategicPlanItems(): Promise<StrategicPlanItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('strategic_plan_items')
    .select('*, owner:profiles(full_name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao buscar itens do planejamento:', error)
    return []
  }

  const rows = (data || []) as Array<StrategicPlanItem & { owner: { full_name: string | null } | null }>

  const withUrls = await Promise.all(
    rows.map(async (row) => {
      let signedUrl: string | null = null
      if (row.file_path) {
        const { data: signed } = await supabase.storage.from(STRATEGIC_PLAN_BUCKET).createSignedUrl(row.file_path, 60 * 60)
        signedUrl = signed?.signedUrl || null
      }
      return { ...row, owner_name: row.owner?.full_name || null, file_signed_url: signedUrl }
    })
  )

  return withUrls
}

export async function createStrategicPlanItem(input: {
  title: string
  description?: string | null
  category?: string | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
  due_date?: string | null
  status?: string
  owner_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!input.title?.trim()) return { success: false, error: 'Informe o titulo do item.' }

  const { data, error } = await supabase
    .from('strategic_plan_items')
    .insert({
      title: input.title.trim(),
      description: input.description || '',
      category: input.category || 'geral',
      target_value: input.target_value ?? null,
      current_value: input.current_value ?? 0,
      unit: input.unit || '',
      due_date: input.due_date || null,
      status: input.status || 'em_andamento',
      owner_id: input.owner_id || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao criar item do planejamento:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/planejamento')
  return { success: true, data }
}

export async function updateStrategicPlanItem(id: string, input: {
  title?: string
  description?: string | null
  category?: string | null
  target_value?: number | null
  current_value?: number | null
  unit?: string | null
  due_date?: string | null
  status?: string
  owner_id?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.description !== undefined) payload.description = input.description
  if (input.category !== undefined) payload.category = input.category
  if (input.target_value !== undefined) payload.target_value = input.target_value
  if (input.current_value !== undefined) payload.current_value = input.current_value
  if (input.unit !== undefined) payload.unit = input.unit
  if (input.due_date !== undefined) payload.due_date = input.due_date
  if (input.status !== undefined) payload.status = input.status
  if (input.owner_id !== undefined) payload.owner_id = input.owner_id

  const { error } = await supabase.from('strategic_plan_items').update(payload).eq('id', id)

  if (error) {
    console.error('Erro ao atualizar item do planejamento:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/planejamento')
  return { success: true }
}

export async function deleteStrategicPlanItem(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const { data: item } = await supabase.from('strategic_plan_items').select('file_path').eq('id', id).maybeSingle()
  if (item?.file_path) {
    await supabase.storage.from(STRATEGIC_PLAN_BUCKET).remove([item.file_path]).catch(() => {})
  }

  const { error } = await supabase.from('strategic_plan_items').delete().eq('id', id)

  if (error) {
    console.error('Erro ao excluir item do planejamento:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/planejamento')
  return { success: true }
}

export async function uploadStrategicPlanFile(formData: FormData) {
  const itemId = String(formData.get('item_id') || '').trim()
  const file = formData.get('file')

  if (!itemId) return { success: false, error: 'Item nao informado.' }
  if (!(file instanceof File) || file.size <= 0) return { success: false, error: 'Selecione um arquivo valido.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${itemId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage.from(STRATEGIC_PLAN_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const { error } = await supabase
    .from('strategic_plan_items')
    .update({ file_path: path, file_name: file.name })
    .eq('id', itemId)

  if (error) {
    await supabase.storage.from(STRATEGIC_PLAN_BUCKET).remove([path]).catch(() => {})
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/planejamento')
  return { success: true }
}
