import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import ProdutosClient from './produtos-client'

export const dynamic = 'force-dynamic'

type ProductRow = {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: string | null
  active: boolean | null
  emoji?: string | null
  color?: string | null
}

export default async function ProdutosPage() {
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fullResult = await adminSupabase
    .from('products')
    .select('id, name, slug, description, category, active, emoji, color')
    .order('name')

  let products = fullResult.data as ProductRow[] | null

  if (fullResult.error && /emoji|color/i.test(fullResult.error.message)) {
    const fallbackResult = await adminSupabase
      .from('products')
      .select('id, name, slug, description, category, active')
      .order('name')

    products = fallbackResult.data as ProductRow[] | null
  }

  const mapped = (products || []).map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug || '',
    emoji: product.emoji || '📦',
    color: product.color || '#0f4c81',
    description: product.description || '',
    category: product.category || '',
    active: product.active ?? true,
  }))

  return <ProdutosClient initialProducts={mapped} />
}
