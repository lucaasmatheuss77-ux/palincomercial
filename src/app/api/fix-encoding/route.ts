import { NextResponse } from 'next/server'

const CORRECT_PRODUCTS: Record<string, { name: string; description: string; category: string }> = {
  'Análise de Transferências Federais': {
    name: 'Análise de Transferências Federais',
    description: 'Análise Tributária',
    category: 'Consultoria',
  },
  'Intermediação de Créditos': {
    name: 'Intermediação de Créditos',
    description: 'Intermediação',
    category: 'Consultoria',
  },
  'Cessão Recorrente de Créditos': {
    name: 'Cessão Recorrente de Créditos',
    description: 'Cessão recorrente',
    category: 'Créditos',
  },
  'Crédito Acumulado ICMS': {
    name: 'Crédito Acumulado ICMS',
    description: 'Transformação de Crédito',
    category: 'Créditos',
  },
  'Transferência de Crédito Acumulado': {
    name: 'Transferência de Crédito Acumulado',
    description: 'Venda de Crédito Acumulado',
    category: 'Créditos',
  },
  'Consulta Tributária Especializada': {
    name: 'Consulta Tributária Especializada',
    description: 'Consultas especializadas',
    category: 'Consultoria',
  },
}

type ProductRow = {
  id: string
  name: string | null
  description: string | null
  category: string | null
}

const MOJIBAKE_PATTERN = /Ã.|Â.|�|\?/

function repairMojibake(value: string | null | undefined) {
  if (!value) return ''

  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8')
    return repaired.includes('�') ? value : repaired
  } catch {
    return value
  }
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

function findCorrectProduct(product: ProductRow) {
  const repairedName = repairMojibake(product.name)
  const normalizedName = normalize(repairedName || product.name || '')

  return Object.entries(CORRECT_PRODUCTS).find(([key]) => {
    const normalizedKey = normalize(key)
    return normalizedKey.includes(normalizedName.slice(0, 8)) || normalizedName.includes(normalizedKey.slice(0, 8))
  })?.[1]
}

export async function GET() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias.' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, description, category')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const fixes: { id: string; before: string; after: string }[] = []

    for (const product of (products || []) as ProductRow[]) {
      const hasEncodingIssue = [product.name, product.description, product.category].some((value) =>
        MOJIBAKE_PATTERN.test(value || '')
      )
      const correct = findCorrectProduct(product)

      if (correct && hasEncodingIssue) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: correct.name,
            description: correct.description,
            category: correct.category,
          })
          .eq('id', product.id)

        if (!updateError) {
          fixes.push({ id: product.id, before: product.description || '', after: correct.description })
        }
      }
    }

    return NextResponse.json({
      success: true,
      productsChecked: products?.length ?? 0,
      fixesApplied: fixes.length,
      fixes,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
