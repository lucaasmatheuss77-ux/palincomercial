import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function getAdminSupabase() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await getAdminSupabase()
    .from('products')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  const { id } = await params
  const { name, description, category, active } = await request.json()

  const adminSupabase = getAdminSupabase()

  let { data, error } = await adminSupabase
    .from('products')
    .update({ name, description, category, active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error && /updated_at/i.test(error.message)) {
    const fallbackResult = await adminSupabase
      .from('products')
      .update({ name, description, category, active })
      .eq('id', id)
      .select()
      .single()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(data)
}
