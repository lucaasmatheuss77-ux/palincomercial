
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fixes = [
  { id: 'bc3e791e-483c-4c0e-9f8c-c5ecf0d6c003', name: 'Tese Tributária - ICMS ST' },
  { id: '764fc934-73eb-420b-b641-1b84853c310f', name: 'Tese Tributária - PIS/COFINS' },
  { id: '2463e5f7-6431-44f3-9f1c-3124c4d43894', name: 'Tese Tributária - CAT 83/CAT 207' },
  { id: '6bba9465-73e7-4f01-9ec0-fd939cfb47fa', name: 'Crédito Acumulado ICMS' },
  { id: 'da50c897-8ac7-487a-a97d-e8a38cb35ff0', name: 'Transferência de Crédito Acumulado' },
  { id: 'bde46fe1-a6f5-4e8e-a181-3dc0c6cfd562', name: 'Análise de Transferências Federais' },
  { id: '4758b522-1895-4c40-b15e-8a47de89cad7', name: 'Produtor Rural - Recuperação Tributária' },
  { id: '85c5b1b3-f9c3-4a82-982b-1f506b14ffe5', name: 'Compliance Fiscal' },
  { id: '26f6287c-b91f-4480-9867-c35869d2f7ae', name: 'Intermediação de Créditos' },
  { id: '3380241e-445a-47ee-ae3f-dcb685354e29', name: 'Cessão Recorrente de Créditos' },
  { id: '1d49c976-aed3-4ec4-9985-4636ad1e5c08', name: 'Consulta Tributária Especializada' },
  { id: 'a8b81529-4037-4079-9bf7-b6dc29f82350', name: 'Parceria Estratégica' }
];

async function run() {
  for (const f of fixes) {
    await supabase.from('products').update({ name: f.name }).eq('id', f.id);
  }
  console.log('Fixed names');
}
run();

