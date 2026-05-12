'use server'

import { createClient } from '@/lib/supabase/server'

export async function getMyRole(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data } = await supabase
    .from('app_users')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .eq('is_active', true)
    .maybeSingle()

  return data?.role ?? null
}
