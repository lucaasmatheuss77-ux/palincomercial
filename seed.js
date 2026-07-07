
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const products = [
  { name: 'Tese Tributária - ICMS ST', slug: 'tese-tributaria-icms-st', description: 'Recuperação de ICMS ST', category: 'Teses', active: true },
  { name: 'Tese Tributária - PIS/COFINS', slug: 'tese-tributaria-pis-cofins', description: 'Recuperação de PIS/COFINS', category: 'Teses', active: true },
  { name: 'Tese Tributária - CAT 83/CAT 207', slug: 'tese-tributaria-cat83-cat207', description: 'CAT 83 e CAT 207', category: 'Teses', active: true },
  { name: 'Crédito Acumulado ICMS', slug: 'credito-acumulado-icms', description: 'Transformação de Crédito', category: 'Créditos', active: true },
  { name: 'Transferência de Crédito Acumulado', slug: 'transferencia-credito-acumulado', description: 'Venda de Crédito Acumulado', category: 'Créditos', active: true },
  { name: 'Análise de Transferências Federais', slug: 'analise-transferencias-federais', description: 'Análise Tributária', category: 'Consultoria', active: true },
  { name: 'Produtor Rural - Recuperação Tributária', slug: 'produtor-rural', description: 'Produtor Rural Bertoni', category: 'Rural', active: true },
  { name: 'Compliance Fiscal', slug: 'compliance-fiscal', description: 'Auditoria e Compliance', category: 'Auditoria', active: true },
  { name: 'Intermediação de Créditos', slug: 'intermediacao-creditos', description: 'Intermediação', category: 'Consultoria', active: true },
  { name: 'Cessão Recorrente de Créditos', slug: 'cessao-recorrente', description: 'Cessão recorrente', category: 'Créditos', active: true },
  { name: 'Consulta Tributária Especializada', slug: 'consulta-tributaria', description: 'Consultas especializadas', category: 'Consultoria', active: true },
  { name: 'Parceria Estratégica', slug: 'parceria-estrategica', description: 'Parceria', category: 'Outros', active: true }
];

async function run() {
  const { data, error } = await supabase.from('products').upsert(products, { onConflict: 'slug' });
  console.log('Seed finished:', error || 'Success');
}
run();

