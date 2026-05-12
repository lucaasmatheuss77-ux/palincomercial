import { createClient } from '@/lib/supabase/server'
import ProdutosClient from './produtos-client'

export const dynamic = 'force-dynamic'

export default async function ProdutosPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, emoji, color, description, category, active')
    .eq('active', true)
    .order('name')

  const mapped = ((products || []) as {
    id: string
    name: string
    slug: string
    emoji: string | null
    color: string | null
    description: string | null
    category: string | null
    active: boolean
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
