'use server'

import { Profile } from '@/lib/types'

export async function getMyProfile(): Promise<Profile | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, xp, level, class')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
}

export async function updateProfileName(full_name: string): Promise<{ success: boolean; error?: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: full_name.trim() })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

export async function uploadAvatar(formData: FormData): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const file = formData.get('avatar') as File
  if (!file || file.size === 0) return { success: false, error: 'Nenhum arquivo selecionado' }
  if (file.size > 5 * 1024 * 1024) return { success: false, error: 'Arquivo muito grande (máximo 5MB)' }

  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext) || !ALLOWED_MIME.includes(file.type)) {
    return { success: false, error: 'Formato inválido. Use JPG, PNG, WEBP ou GIF.' }
  }

  // Buscar avatar atual para remover do storage depois
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const path = `${user.id}/avatar.${ext}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { success: false, error: uploadError.message }

  // Remover arquivo antigo se era de extensao diferente
  if (currentProfile?.avatar_url) {
    try {
      const oldUrl = new URL(currentProfile.avatar_url)
      const oldPathMatch = oldUrl.pathname.match(/\/avatars\/(.+?)(\?|$)/)
      const oldPath = oldPathMatch?.[1]
      if (oldPath && oldPath !== path) {
        await supabase.storage.from('avatars').remove([decodeURIComponent(oldPath)]).catch(() => {})
      }
    } catch {}
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

  // Update profile with avatar URL + cache-busting timestamp
  const avatarUrl = `${publicUrl}?t=${Date.now()}`
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/configuracoes')
  return { success: true, avatarUrl }
}

export async function saveAvatarSkin(
  skin: number,
  accessory: string
): Promise<{ success: boolean; error?: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  // Tenta salvar skin + accessory; se accessory não existir, salva só skin
  const { error } = await supabase
    .from('app_users')
    .update({ avatar_skin: skin })
    .eq('email', user.email!.toLowerCase())

  if (error) return { success: false, error: error.message }

  // Tenta salvar accessory separado (coluna opcional — ignora erro)
  try {
    await supabase
      .from('app_users')
      .update({ avatar_accessory: accessory } as Record<string, unknown>)
      .eq('email', user.email!.toLowerCase())
  } catch {
    // coluna avatar_accessory pode não existir — ignorar silenciosamente
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/configuracoes')
  revalidatePath('/dashboard/equipe')
  return { success: true }
}

export async function removeAvatar(): Promise<{ success: boolean; error?: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const { revalidatePath } = await import('next/cache')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}
