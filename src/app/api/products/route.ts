import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type ProductResponse = {
  id: string
  name: string
  slug: string | null
  description: string | null
  category: string | null
  active: boolean | null
  emoji?: string | null
  color?: string | null
}

function buildSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Campo "name" obrigatorio.' }, { status: 400 })
  }

  const name = body.name.trim()
  const slug = buildSlug(name)
  const now = new Date().toISOString()

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const payload = {
    name,
    slug,
    description: body.description || '',
    category: body.category || '',
    emoji: '📦',
    color: '#58a6ff',
    active: true,
    updated_at: now,
  }

  let { data: product, error } = await adminSupabase
    .from('products')
    .upsert(payload, { onConflict: 'slug' })
    .select('id, name, slug, description, category, active, emoji, color')
    .single<ProductResponse>()

  if (error && /emoji|color|updated_at/i.test(error.message)) {
    const fallbackPayload = {
      name,
      slug,
      description: body.description || '',
      category: body.category || '',
      active: true,
    }

  if (error && /unique|constraint|conflict/i.test(error.message)) {
    const { data: existing } = await adminSupabase
      .from('products')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    const manualResult = existing?.id
      ? await adminSupabase
        .from('products')
        .update({ name, description: body.description || '', category: body.category || '', active: true })
        .eq('id', existing.id)
        .select('id, name, slug, description, category, active')
        .single<ProductResponse>()
      : await adminSupabase
        .from('products')
        .insert({ name, slug, description: body.description || '', category: body.category || '', active: true })
        .select('id, name, slug, description, category, active')
        .single<ProductResponse>()

    product = manualResult.data
    error = manualResult.error
  }

    const fallbackResult = await adminSupabase
      .from('products')
      .upsert(fallbackPayload, { onConflict: 'slug' })
      .select('id, name, slug, description, category, active')
      .single<ProductResponse>()

    product = fallbackResult.data
    error = fallbackResult.error
  }

  if (error || !product) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar produto.' }, { status: 400 })
  }

  return NextResponse.json(product)
}
