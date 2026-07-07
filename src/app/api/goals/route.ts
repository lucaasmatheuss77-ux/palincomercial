import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const { data, error } = await supabase
    .from('sales_goals')
    .select('*, products(name, emoji, color), profiles(full_name)')
    .order('period', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const body = await request.json()

  if (!body.period || typeof body.period !== 'string') {
    return NextResponse.json({ error: 'Campo "period" obrigatorio.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sales_goals')
    .insert({
      period: body.period.trim(),
      product_id: body.product_id || null,
      consultant_id: body.consultant_id || null,
      goal_contracts: Number(body.goal_contracts) || 0,
      notes: body.notes ?? '',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })

  const body = await request.json()

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Campo "id" obrigatorio.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sales_goals')
    .update({
      period: String(body.period || '').trim(),
      product_id: body.product_id || null,
      consultant_id: body.consultant_id || null,
      goal_contracts: Number(body.goal_contracts) || 0,
      notes: body.notes ?? '',
    })
    .eq('id', body.id)
    .select('*, products(name, emoji, color), profiles(full_name)')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Campo "id" obrigatorio.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sales_goals')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
