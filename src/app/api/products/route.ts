import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Campo "name" obrigatorio.' }, { status: 400 })
  }

  const name = body.name.trim()
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      name,
      slug,
      description: body.description || '',
      category: body.category || '',
      emoji: '📦',
      color: '#58a6ff',
    })
    .select('id')
    .single()

  if (error || !product) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar produto' }, { status: 400 })
  }

  return NextResponse.json({ id: product.id })
}
