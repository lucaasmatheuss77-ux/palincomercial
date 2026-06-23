import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import ProdutosClient from './produtos-client'

export const dynamic = 'force-dynamic'

export default async function ProdutosPage() {
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: products } = await adminSupabase
    .from('products')
    .select('id, name, slug, description, category, active')
    .eq('active', true)
    .order('name')

  const mapped = ((products || []) as {
    id: string
    name: string
    slug: string
    description: string | null
    category: string | null
    active: boolean
    emoji?: string | null
    color?: string | null
  }[]).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    emoji: p.emoji || '📦',
    color: p.color || '#0f4c81',
    description: p.description || '',
    category: p.category || '',
    active: p.active,
  }))

  return <ProdutosClient initialProducts={mapped} />
}
