import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
const PRODUTOS = [
  // ── TESES TRIBUTÁRIAS ─────────────────────────────────────
  {
    name: 'Tese Tributária - ICMS ST',
    slug: 'tese-tributaria-icms-st',
    category: 'Teses Tributárias',
    description: 'Recuperação de ICMS Substituição Tributária pago a maior. Análise, desenvolvimento e execução da tese.',
    emoji: '⚖️',
    color: '#f59e0b',
  },
  {
    name: 'Tese Tributária - PIS/COFINS',
    slug: 'tese-tributaria-pis-cofins',
    category: 'Teses Tributárias',
    description: 'Recuperação de créditos de PIS e COFINS não aproveitados ou calculados incorretamente.',
    emoji: '⚖️',
    color: '#f59e0b',
  },
  {
    name: 'Tese Tributária - CAT 83/CAT 207',
    slug: 'tese-tributaria-cat83-cat207',
    category: 'Teses Tributárias',
    description: 'Tese para recuperação de ICMS baseada nas portarias CAT 83 e CAT 207 do Estado de São Paulo.',
    emoji: '⚖️',
    color: '#f59e0b',
  },
  // ── CRÉDITO ACUMULADO ─────────────────────────────────────
  {
    name: 'Crédito Acumulado ICMS',
    slug: 'credito-acumulado-icms',
    category: 'Crédito Acumulado',
    description: 'Levantamento, habilitação e transferência de crédito acumulado de ICMS junto à SEFAZ-SP.',
    emoji: '💳',
    color: '#0ea5e9',
  },
  {
    name: 'Transferência de Crédito Acumulado',
    slug: 'transferencia-credito-acumulado',
    category: 'Crédito Acumulado',
    description: 'Transferência de crédito acumulado para terceiros (fornecedores, transportadoras, etc.).',
    emoji: '💳',
    color: '#0ea5e9',
  },
  // ── ANÁLISE DE TRANSFERÊNCIAS FEDERAIS ───────────────────
  {
    name: 'Análise de Transferências Federais',
    slug: 'analise-transferencias-federais',
    category: 'Transferências Federais',
    description: 'Análise e recuperação de tributos federais indevidos ou pagos a maior (IRPJ, CSLL, PIS, COFINS).',
    emoji: '🏛️',
    color: '#6366f1',
  },
  // ── PRODUTOR RURAL ────────────────────────────────────────
  {
    name: 'Produtor Rural - Recuperação Tributária',
    slug: 'produtor-rural',
    category: 'Produtor Rural',
    description: 'Serviço especializado para produtores rurais (PF e PJ). Recuperação de créditos e revisão fiscal.',
    emoji: '🌾',
    color: '#10b981',
  },
  // ── COMPLIANCE FISCAL ─────────────────────────────────────
  {
    name: 'Compliance Fiscal',
    slug: 'compliance-fiscal',
    category: 'Compliance',
    description: 'Auditoria preventiva e mapeamento de riscos tributários. Regularização de obrigações acessórias.',
    emoji: '🔍',
    color: '#0d9488',
  },
  // ── INTERMEDIAÇÃO ─────────────────────────────────────────
  {
    name: 'Intermediação de Créditos',
    slug: 'intermediacao-creditos',
    category: 'Intermediação',
    description: 'Intermediação na compra e venda de créditos tributários entre empresas.',
    emoji: '🤝',
    color: '#ec4899',
  },
  // ── CESSÃO RECORRENTE ─────────────────────────────────────
  {
    name: 'Cessão Recorrente de Créditos',
    slug: 'cessao-recorrente',
    category: 'Cessão',
    description: 'Contrato recorrente de cessão mensal de créditos tributários para compensação contínua.',
    emoji: '🔄',
    color: '#14b8a6',
  },
  // ── CONSULTA TRIBUTÁRIA ───────────────────────────────────
  {
    name: 'Consulta Tributária Especializada',
    slug: 'consulta-tributaria',
    category: 'Consultoria',
    description: 'Parecer técnico e consultoria pontual sobre temas tributários específicos.',
    emoji: '📋',
    color: '#64748b',
  },
  // ── PARCERIAS ────────────────────────────────────────────
  {
    name: 'Parceria Estratégica',
    slug: 'parceria-estrategica',
    category: 'Parceria',
    description: 'Modelo de parceria com contadores, advogados e escritórios para indicação e co-atuação em casos tributários.',
    emoji: '🏆',
    color: '#f97316',
  },
]

export async function GET() {
  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if products already exist
  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })

  if ((count ?? 0) > 0) {
    return NextResponse.json({
      message: `Já existem ${count} produtos cadastrados. Seed não executado.`,
      count,
    })
  }

  const { data, error } = await supabase
    .from('products')
    .insert(PRODUTOS.map(p => ({ ...p, active: true })))
    .select('id, name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: `${data?.length ?? 0} produtos inseridos com sucesso!`,
    products: data,
  })
}
