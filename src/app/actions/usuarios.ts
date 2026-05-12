'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AppUser = {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  created_at: string
  updated_at: string
  phone?: string | null
  whatsapp?: string | null
  cargo_titulo?: string | null
  data_admissao?: string | null
  produto_foco?: string | null
  product_id?: string | null
  observacoes?: string | null
  avatar_skin?: number | null
}

export type UserPermission = {
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

export type PermissionInput = {
  module: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

const VALID_ROLES = ['Administrador', 'Gestor', 'Consultor', 'Assistente Comercial', 'SDR', 'Somente Leitura', 'Painel TV']
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function listUsers(): Promise<AppUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erro ao listar usuarios:', error)
    return []
  }
  return (data || []) as AppUser[]
}

export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_permissions')
    .select('module, can_view, can_edit, can_delete')
    .eq('user_id', userId)

  return (data || []) as UserPermission[]
}

export async function createUser(data: {
  full_name: string
  email: string
  role: string
  permissions: PermissionInput[]
  phone?: string
  whatsapp?: string
  cargo_titulo?: string
  data_admissao?: string
  produto_foco?: string
  product_id?: string
  observacoes?: string
  avatar_skin?: number
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!emailRegex.test(data.email.trim())) {
    return { success: false, error: 'Formato de e-mail invalido.' }
  }

  if (!VALID_ROLES.includes(data.role)) {
    return { success: false, error: 'Perfil invalido.' }
  }

  const emailNorm = data.email.trim().toLowerCase()

  const { data: existing } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'Ja existe um usuario com este e-mail.' }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('app_users')
    .insert({
      full_name: data.full_name.trim(),
      email: emailNorm,
      role: data.role,
      phone: data.phone?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      cargo_titulo: data.cargo_titulo?.trim() || null,
      data_admissao: data.data_admissao || null,
      produto_foco: data.produto_foco?.trim() || null,
      product_id: data.product_id?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      avatar_skin: data.avatar_skin ?? 0,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message || 'Erro ao criar usuario.' }
  }

  if (data.permissions.length > 0) {
    const perms = data.permissions.map((p) => ({
      user_id: inserted.id,
      module: p.module,
      can_view: p.can_view,
      can_edit: p.can_edit,
      can_delete: p.can_delete,
    }))
    await supabase.from('user_permissions').insert(perms)
  }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

export async function updateUser(
  id: string,
  data: {
    full_name: string
    email: string
    role: string
    permissions: PermissionInput[]
    phone?: string
    whatsapp?: string
    cargo_titulo?: string
    data_admissao?: string
    produto_foco?: string
    product_id?: string
    observacoes?: string
    avatar_skin?: number
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  if (!emailRegex.test(data.email.trim())) {
    return { success: false, error: 'Formato de e-mail invalido.' }
  }

  if (!VALID_ROLES.includes(data.role)) {
    return { success: false, error: 'Perfil invalido.' }
  }

  const emailNorm = data.email.trim().toLowerCase()

  const { data: conflict } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', emailNorm)
    .neq('id', id)
    .maybeSingle()

  if (conflict) {
    return { success: false, error: 'Outro usuario ja usa este e-mail.' }
  }

  const { error: updateError } = await supabase
    .from('app_users')
    .update({
      full_name: data.full_name.trim(),
      email: emailNorm,
      role: data.role,
      phone: data.phone?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      cargo_titulo: data.cargo_titulo?.trim() || null,
      data_admissao: data.data_admissao || null,
      produto_foco: data.produto_foco?.trim() || null,
      product_id: data.product_id?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      avatar_skin: data.avatar_skin ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  await supabase.from('user_permissions').delete().eq('user_id', id)

  if (data.permissions.length > 0) {
    const perms = data.permissions.map((p) => ({
      user_id: id,
      module: p.module,
      can_view: p.can_view,
      can_edit: p.can_edit,
      can_delete: p.can_delete,
    }))
    await supabase.from('user_permissions').insert(perms)
  }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

export async function toggleUserStatus(id: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const { error } = await supabase
    .from('app_users')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Nao autorizado.' }

  const { error } = await supabase
    .from('app_users')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracoes')
  return { success: true }
}
