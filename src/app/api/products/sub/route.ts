import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { error } = await supabase.from('sub_products').insert({
    product_id: body.product_id,
    name: body.name,
    description: body.description || null,
    has_fixed_value: body.has_fixed_value || false,
    fixed_value: body.fixed_value || null,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
