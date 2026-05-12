'use client'

import { useState } from 'react'
import {
  Wheat, Factory, Truck, Sprout, Briefcase,
  HeartPulse, Ship, Building2, ChevronDown,
  CheckSquare, Square, Zap, AlertTriangle,
  Sparkles, BarChart3, TrendingUp, Tag,
  CheckCircle2, Users, BookOpen
} from 'lucide-react'

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type Segmento = 'rural' | 'industria' | 'distribuidora' | 'insumos_agro' | 'servicos' | 'clinica' | 'exportadora' | 'outros_pj'
type Regime   = 'pf' | 'simples' | 'presumido' | 'real'
type Prio     = 'Alta' | 'Média'

interface Oportunidade {
  numero: number
  consultor?: string
  titulo: string
  dept: string
  descricao: string
  bonus: string
  prioridade: Prio
  condicao?: string
}

// ─── Segmentos — 8 hues completamente distintas ────────────────────────────────
// Flat Design: cada segmento tem hue única na roda de cores (150-200ms transitions)
const SEGS = [
  { id: 'rural',         label: 'Rural',                   sub: 'Prod. Físico / Agro',        Icon: Wheat,      accent: '#22c55e', reg: 'pf'        }, // verde
  { id: 'industria',     label: 'Indústria / Frigorífico', sub: 'Manufatura / Processamento', Icon: Factory,    accent: '#f97316', reg: 'real'      }, // laranja
  { id: 'distribuidora', label: 'Distribuidora',           sub: 'Distribuição / Revenda',     Icon: Truck,      accent: '#3b82f6', reg: 'real'      }, // azul vivo
  { id: 'insumos_agro',  label: 'Insumos Agro',           sub: 'Revendedor Agropecuário',    Icon: Sprout,     accent: '#eab308', reg: 'real'      }, // amarelo (≠ verde)
  { id: 'servicos',      label: 'Prestador de Serviços',  sub: 'Serviços PJ',                Icon: Briefcase,  accent: '#10b981', reg: 'presumido' }, // roxo vivo
  { id: 'clinica',       label: 'Clínica Médica',         sub: 'Saúde / Lucro Presumido',    Icon: HeartPulse, accent: '#e11d48', reg: 'presumido' }, // vermelho/rosa
  { id: 'exportadora',   label: 'Exportadora',            sub: 'Exportação / Comércio Ext.', Icon: Ship,       accent: '#06b6d4', reg: 'real'      }, // ciano (≠ azul)
  { id: 'outros_pj',    label: 'Outros PJ',              sub: 'Demais empresas',            Icon: Building2,  accent: '#6366f1', reg: 'real'      }, // índigo
] as const

const REGIMES = [
  { id: 'pf',        label: 'Pessoa Física',    accent: '#22c55e'  },
  { id: 'real',      label: 'Lucro Real',       accent: '#f97316'  },
  { id: 'presumido', label: 'Lucro Presumido',  accent: '#38bdf8'  },
  { id: 'simples',   label: 'Simples Nacional', accent: '#94a3b8'  },
] as const

const FATURAMENTO  = ['Selecione o porte','Até R$360k (Micro)','R$360k – R$4,8M (Pequeno)','R$4,8M – R$30M (Médio)','Acima de R$30M (Grande)']
const FISCAL       = ['Selecione','Regular','Débitos em aberto','Autuado','Desconhecido']
const FUNCIONARIOS = ['Selecione','Produtor individual / Sem CLT','1 – 10','11 – 50','50+']
const ESTADOS      = ['SP (São Paulo)','MT (Mato Grosso)','PR (Paraná)','Outro estado']

const PRODUTOS: Record<Segmento,{id:string;label:string}[]> = {
  rural:        [{id:'ecredrural_simples',label:'e-CredRural Simples (CAT 153)'},{id:'ecredrural_pdd',label:'e-CredRural PDD'},{id:'regime_especial',label:'Regime Especial (centralização)'},{id:'comercializacao_rural',label:'Comercialização dos créditos rurais'},{id:'reforma_tributaria',label:'Planejamento / Reforma Tributária'}],
  industria:    [{id:'cat207',label:'CAT 207 / CAT 83 (Crédito Acumulado)'},{id:'pis_cofins',label:'Recuperação PIS/COFINS'},{id:'ipi',label:'Recuperação / Ressarcimento IPI'},{id:'subvencao',label:'Subvenção para Investimentos (IRPJ/CSLL)'},{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'compliance',label:'Compliance / Auditoria Tributária'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  distribuidora:[{id:'cat207',label:'CAT 207 / CAT 83 (Crédito Acumulado)'},{id:'auditoria',label:'Auditoria Extemporânea / Trimestral'},{id:'analise_credito',label:'Análise de Créditos Recebidos'},{id:'pdd',label:'Recuperação de Inadimplentes (PDD)'},{id:'comercializacao',label:'Comercialização de Crédito ICMS'},{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  insumos_agro: [{id:'majoracao_224',label:'Majoração PIS/COFINS – Lei 224/2025'},{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'pis_cofins',label:'Recuperação PIS/COFINS'},{id:'compliance',label:'Auditoria / Compliance Tributário'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  servicos:     [{id:'exclusao_iss',label:'Exclusão ISS da Base PIS/COFINS'},{id:'verbas_indeniz',label:'Verbas Indenizatórias (INSS/IR)'},{id:'cprb',label:'CPRB – Contribuição s/ Receita Bruta'},{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  clinica:      [{id:'equiparacao',label:'Equiparação Clínicas – Redução IRPJ'},{id:'verbas_indeniz',label:'Verbas Indenizatórias'},{id:'exclusao_iss',label:'Exclusão ISS da Base PIS/COFINS'},{id:'cprb',label:'CPRB – Contribuição s/ Receita Bruta'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  exportadora:  [{id:'cat207',label:'CAT 207 / CAT 83 (Crédito Acumulado)'},{id:'constituicao',label:'Constituição do Crédito (Exportação/Isenção)'},{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'subvencao',label:'Subvenção para Investimentos'},{id:'mandado_seg',label:'Mandado de Segurança – Liberação Créditos'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
  outros_pj:   [{id:'exclusao_icms',label:'Exclusão ICMS da Base PIS/COFINS'},{id:'verbas_indeniz',label:'Verbas Indenizatórias (INSS/IR)'},{id:'compliance',label:'Compliance / Auditoria Tributária'},{id:'subvencao',label:'Subvenção para Investimentos'},{id:'reforma_tributaria',label:'Consultoria Reforma Tributária'}],
}

// ─── Lógica de qualificação ─────────────────────────────────────────────────────
function qualificar(s:Segmento,r:Regime,ativos:string[],fiscal:string,func:string,fat:string,incentivo=false,frota=false):Oportunidade[]{
  const no=(id:string)=>!ativos.includes(id)
  const deb=['Débitos em aberto','Autuado'].includes(fiscal)
  const gr50=func==='50+'
  const gPorte=fat.includes('4,8M')||fat.includes('30M')
  const ops:Omit<Oportunidade,'numero'>[]=[]

  if(s==='rural'){
    if(no('ecredrural_simples'))ops.push({titulo:'e-CredRural Simples (CAT 153)',dept:'Comercial',descricao:'Habilitação e liberação de crédito acumulado de ICMS para produtor rural — produto principal do segmento.',bonus:'R$150',prioridade:'Alta',consultor:'Bertoni / Ana Julia'})
    if(no('ecredrural_pdd'))ops.push({titulo:'e-CredRural PDD – Recuperação Inadimplentes',dept:'Comercial',descricao:'Recuperação avançada via Perda Definitiva de Devedor. Para produtores com clientes inadimplentes.',bonus:'R$150',prioridade:'Alta',consultor:'Bertoni / Ana Julia'})
    if(no('regime_especial'))ops.push({titulo:'Regime Especial (Centralização) ICMS',dept:'Crédito Acumulado',descricao:'Centralização de apuração ICMS para produtor rural — reduz complexidade e amplia crédito aproveitado.',bonus:'R$150',prioridade:'Alta',consultor:'Bertoni / Ana Julia'})
    if(no('comercializacao_rural'))ops.push({titulo:'Comercialização de Créditos Rurais',dept:'Comercial',descricao:'Negociação e venda do crédito acumulado de ICMS do produtor rural com liquidez imediata.',bonus:'Variável',prioridade:'Alta',consultor:'Ingrid / Eddi'})
    if(no('reforma_tributaria'))ops.push({titulo:'Planejamento Tributário – Reforma (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'A Reforma Tributária impacta diretamente o agronegócio a partir de 2026. Planejamento urgente.',bonus:'R$180',prioridade:'Alta',consultor:'Qualquer consultor'})
    if(frota)ops.push({titulo:'Créditos sobre Insumos (IPVA, Frota, Combustível)',dept:'Crédito Acumulado',descricao:'Produtor com frota ou maquinário tem direito a créditos de ICMS sobre combustível e IPVA — confirmado.',bonus:'R$150',prioridade:'Alta',consultor:'Bertoni / Ana Julia'})
    else ops.push({titulo:'Créditos sobre Insumos (IPVA, Frota, Combustível)',dept:'Crédito Acumulado',descricao:'Verificar se produtor tem frota ou maquinário — há potencial de crédito de ICMS sobre combustível e IPVA.',bonus:'R$150',prioridade:'Média',consultor:'Bertoni / Ana Julia'})
    ops.push({titulo:'Denúncia Espontânea – Regularização SEFAZ',dept:'Jurídico',descricao:'Regularização com multa reduzida antes de fiscalização. Fiscalização SEFAZ-SP 2026 em alta no agro.',bonus:'R$150',prioridade:'Alta',consultor:'Carina / Fernanda'})
    if(deb)ops.push({titulo:'Transação Tributária Estadual',dept:'Jurídico',descricao:'Negociação de débitos com SEFAZ-SP com parcelamento e redução de multas e juros.',bonus:'R$150',prioridade:'Alta',consultor:'Carina / Bertoni'})
  }
  if(s==='industria'){
    if(no('cat207'))ops.push({titulo:'CAT 207 / CAT 83 – Crédito Acumulado ICMS',dept:'Crédito Acumulado',descricao:'Frigoríficos e indústrias geram crédito acumulado constantemente — produto essencial.',bonus:'R$150',prioridade:'Alta',consultor:'Carina / Fernanda'})
    if(no('pis_cofins'))ops.push({titulo:'Recuperação dos Créditos de PIS/COFINS',dept:'Tributos Federais',descricao:'Indústrias com uso de equipamentos e insumos têm alto potencial. Processo em todos os estados.',bonus:'R$120',prioridade:'Alta',consultor:'Carina / Fernanda'})
    if(no('ipi'))ops.push({titulo:'Recuperação / Ressarcimento de IPI',dept:'Tributos Federais',descricao:'Para indústrias com créditos de IPI sobre insumos e matérias-primas não aproveitados.',bonus:'R$120',prioridade:'Alta',consultor:'Carina / Fernanda'})
    ops.push({titulo:'Creditamento ICMS sobre Produtos Intermediários',dept:'Jurídico Estadual',descricao:'Tese estadual de alto valor. Indústrias têm crédito de ICMS sobre insumos e produtos intermediários.',bonus:'R$150',prioridade:'Alta',consultor:'Carina'})
    if(no('exclusao_icms'))ops.push({titulo:'Exclusão ICMS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Tese consolidada STJ/STF. Grandes volumes de NF resultam em recuperação expressiva.',bonus:'R$200',prioridade:'Alta',consultor:'Carina / Fernanda / Juliana'})
    ops.push({titulo:'Creditamento PIS/COFINS sobre Insumos (Essencialidade)',dept:'Jurídico Federal',descricao:'Indústrias podem ampliar o conceito de insumo para créditos PIS/COFINS — jurisprudência favorável.',bonus:'R$200',prioridade:'Alta',consultor:'Carina / Fernanda'})
    if(no('subvencao')&&r==='real'&&incentivo)ops.push({titulo:'Subvenção para Investimentos – IRPJ/CSLL (MP 1185)',dept:'Jurídico Federal',descricao:'Indústria tem incentivo fiscal estadual confirmado — Subvenção para investimentos é prioritária.',bonus:'R$200',prioridade:'Alta',consultor:'Fernanda'})
    else if(no('subvencao')&&r==='real'&&!incentivo)ops.push({titulo:'Verificar: Subvenção para Investimentos (MP 1185)',dept:'Jurídico Federal',descricao:'Se a empresa possui incentivo fiscal estadual (ex: PRODEPRO, ICMS reduzido), existe potencial de recuperação IRPJ/CSLL.',bonus:'R$200',prioridade:'Média',condicao:'Confirmar incentivo fiscal estadual',consultor:'Fernanda'})
    if(gPorte)ops.push({titulo:'Mandado de Segurança – Liberação Créditos (360d)',dept:'Jurídico Federal',descricao:'Para indústrias com crédito bloqueado no SEFAZ. Resultado em até 360 dias.',bonus:'R$200',prioridade:'Média',consultor:'Fernanda / Carina'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Indústrias são as mais impactadas pela Reforma. Planejamento não pode esperar para 2026.',bonus:'R$180',prioridade:'Alta',consultor:'Qualquer consultor'})
    if(deb)ops.push({titulo:'Transação Tributária Federal (PGFN/RFB)',dept:'Tributos Federais',descricao:'Negociação de passivos com a Receita Federal com desconto de multas e juros.',bonus:'R$150',prioridade:'Alta',consultor:'Fernanda'})
    if(gr50)ops.push({titulo:'INSS sobre Horas Extras / Verbas Indenizatórias',dept:'Tributos Federais',descricao:'Empresa com grande folha tem alto potencial de recuperação de contribuições previdenciárias.',bonus:'R$150',prioridade:'Alta',consultor:'Carina'})
  }
  if(s==='distribuidora'){
    if(no('cat207')&&r==='real')ops.push({titulo:'CAT 207 / CAT 83 – Crédito Acumulado ICMS',dept:'Crédito Acumulado',descricao:'Distribuidoras com ICMS acumulado podem habilitar e utilizar ou comercializar o crédito.',bonus:'R$150',prioridade:'Alta'})
    if(no('auditoria'))ops.push({titulo:'Auditoria Extemporânea / Trimestral ICMS',dept:'Crédito Acumulado',descricao:'Revisão retroativa da escrita fiscal — distribuidoras frequentemente têm créditos não identificados.',bonus:'R$120',prioridade:'Alta'})
    if(no('analise_credito'))ops.push({titulo:'Análise e Transformação em Crédito Acumulado',dept:'Crédito Acumulado',descricao:'Para empresas que recebem crédito de fornecedores — conversão em crédito acumulado utilizável.',bonus:'R$120',prioridade:'Alta'})
    if(no('pdd'))ops.push({titulo:'Recuperação de Inadimplentes (PDD) – ICMS',dept:'Crédito Acumulado',descricao:'Redução de PDD usando crédito ICMS. Ideal para distribuidoras com volume de inadimplência.',bonus:'R$150',prioridade:'Alta'})
    if(no('exclusao_icms'))ops.push({titulo:'Exclusão ICMS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Distribuidoras com faturamento >R$5M têm retorno expressivo — tese já consolidada.',bonus:'R$200',prioridade:'Alta'})
    ops.push({titulo:'Revisão e Auditoria EFD Contribuições',dept:'Tributos Federais',descricao:'Identificação de créditos de PIS/COFINS não aproveitados na escrituração fiscal digital.',bonus:'R$120',prioridade:'Média'})
    if(r==='real')ops.push({titulo:'Inconstitucionalidade MP 1185 (Subvenção 2024)',dept:'Jurídico Federal',descricao:'Distribuidoras e revendedoras de máquinas/implementos com incentivos fiscais estaduais.',bonus:'R$200',prioridade:'Alta',condicao:'Lucro Real + incentivo fiscal estadual'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Impacto direto nas alíquotas e créditos do segmento. Urgência para 2026.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Adesão Transação Tributária RFB / PGFN',dept:'Tributos Federais',descricao:'Regularização de passivos federais com condições vantajosas.',bonus:'R$150',prioridade:'Alta'})
  }
  if(s==='insumos_agro'){
    if(no('majoracao_224'))ops.push({titulo:'Majoração PIS/COFINS – Lei 224/2025 (Insumos Agro)',dept:'Jurídico Federal',descricao:'Produto específico para revendas de insumos agropecuários — alíquota zero retroativa.',bonus:'R$180',prioridade:'Alta',condicao:'Revenda de insumos agro + Lucro Real'})
    if(no('exclusao_icms'))ops.push({titulo:'Exclusão ICMS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Tese consolidada. Revendas com grande volume têm alto potencial de recuperação.',bonus:'R$200',prioridade:'Alta'})
    if(no('pis_cofins'))ops.push({titulo:'Recuperação e Ressarcimento de PIS/COFINS',dept:'Tributos Federais',descricao:'Revendedores de insumos têm créditos sobre aquisição para revenda não aproveitados.',bonus:'R$120',prioridade:'Alta'})
    ops.push({titulo:'Crédito PIS/COFINS sobre Combustível para Revenda',dept:'Jurídico Federal',descricao:'Revendedoras de combustível têm direito a crédito de PIS/COFINS sobre as aquisições.',bonus:'R$200',prioridade:'Alta'})
    if(no('cat207'))ops.push({titulo:'CAT 207 / CAT 83 – Crédito Acumulado ICMS',dept:'Crédito Acumulado',descricao:'Revendedoras com ICMS acumulado podem habilitar e utilizar ou comercializar.',bonus:'R$150',prioridade:'Alta'})
    if(no('compliance'))ops.push({titulo:'Auditoria Extemporânea ICMS',dept:'Crédito Acumulado',descricao:'Revisão retroativa identifica créditos perdidos em operações anteriores.',bonus:'R$120',prioridade:'Média'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Setor de insumos agro sofre impacto direto das mudanças de alíquota a partir de 2026.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Adesão Transação Tributária RFB / PGFN',dept:'Tributos Federais',descricao:'Regularização com desconto em multas e juros junto à Receita Federal.',bonus:'R$150',prioridade:'Alta'})
  }
  if(s==='servicos'){
    if(no('exclusao_iss'))ops.push({titulo:'Exclusão ISS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Tese análoga à do ICMS — consolidada na jurisprudência. Obrigatória para toda prestadora.',bonus:'R$200',prioridade:'Alta'})
    ops.push({titulo:'Exclusão PIS/COFINS da Própria Base',dept:'Jurídico Federal',descricao:'Exclusão de PIS/COFINS da própria base de cálculo — base circular. Todos os regimes.',bonus:'R$200',prioridade:'Alta'})
    if(no('verbas_indeniz'))ops.push({titulo:'Verbas Indenizatórias – INSS / IR',dept:'Tributos Federais',descricao:'Revisão de INSS e IR sobre verbas indenizatórias. Alto potencial para empresas com folha.',bonus:'R$150',prioridade:'Alta'})
    if(no('cprb'))ops.push({titulo:'CPRB – Contribuição Previdenciária s/ Receita Bruta',dept:'Tributos Federais',descricao:'Análise de viabilidade de migração para CPRB — pode reduzir significativamente a carga prev.',bonus:'R$150',prioridade:'Alta'})
    if(r==='presumido')ops.push({titulo:'Majoração IRPJ/CSLL – Lei 224/2025 (Lucro Presumido)',dept:'Jurídico Federal',descricao:'Recuperação de valores pagos a maior em IRPJ/CSLL em 2025 pelo Lucro Presumido.',bonus:'R$180',prioridade:'Alta'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Prestadores de serviço são impactados por novas alíquotas IBS/CBS a partir de 2026.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Adesão Transação Tributária RFB / PGFN',dept:'Tributos Federais',descricao:'Regularização com desconto em multas e juros.',bonus:'R$150',prioridade:'Alta'})
    if(gr50)ops.push({titulo:'Retenção 11% INSS – Revisão',dept:'Tributos Federais',descricao:'Revisão de retenções de INSS sobre serviços prestados a outras empresas.',bonus:'R$150',prioridade:'Média'})
  }
  if(s==='clinica'){
    if(no('equiparacao'))ops.push({titulo:'Equiparação às Clínicas Médicas – Redução IRPJ',dept:'Jurídico Federal',descricao:'Produto EXCLUSIVO para clínicas. Redução significativa de alíquota de IRPJ via equiparação.',bonus:'R$200',prioridade:'Alta',condicao:'Clínica médica / Lucro Presumido'})
    if(no('exclusao_iss'))ops.push({titulo:'Exclusão ISS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Obrigatório para toda clínica. Tese consolidada na jurisprudência — recuperação retroativa.',bonus:'R$200',prioridade:'Alta'})
    ops.push({titulo:'Majoração IRPJ/CSLL – Lei 224/2025 (Lucro Presumido)',dept:'Jurídico Federal',descricao:'Clínicas Lucro Presumido pagaram a maior em 2025. Prescrição de 5 anos.',bonus:'R$180',prioridade:'Alta'})
    if(no('verbas_indeniz'))ops.push({titulo:'Verbas Indenizatórias – INSS / IR',dept:'Tributos Federais',descricao:'Clínicas com médicos na folha têm alto potencial de recuperação de INSS sobre verbas.',bonus:'R$150',prioridade:'Alta'})
    if(no('cprb'))ops.push({titulo:'CPRB – Contribuição Previdenciária s/ Receita Bruta',dept:'Tributos Federais',descricao:'Análise de migração da contribuição previdenciária para base de receita bruta.',bonus:'R$150',prioridade:'Média'})
    ops.push({titulo:'Exclusão PIS/COFINS da Própria Base',dept:'Jurídico Federal',descricao:'Exclusão de PIS/COFINS da própria base de cálculo. Aplica-se a todos os regimes.',bonus:'R$200',prioridade:'Alta'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Setor de saúde tem tratamento específico na Reforma Tributária. Planejamento urgente.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Análise de Viabilidade de Transação Tributária',dept:'Jurídico',descricao:'Estudo para transação com PGFN ou Receita Federal com desconto em débitos.',bonus:'R$150',prioridade:'Alta'})
  }
  if(s==='exportadora'){
    if(no('cat207'))ops.push({titulo:'CAT 207 / CAT 83 – Crédito Acumulado ICMS',dept:'Crédito Acumulado',descricao:'Exportadoras geram crédito acumulado continuamente em SP — produto essencial.',bonus:'R$150',prioridade:'Alta'})
    if(no('constituicao'))ops.push({titulo:'Constituição do Crédito (Exportação / Isenção)',dept:'Crédito Acumulado',descricao:'Crédito de ICMS sobre saídas com isenção ou diferimento para exportação não aproveitado.',bonus:'R$150',prioridade:'Alta'})
    if(no('exclusao_icms'))ops.push({titulo:'Exclusão ICMS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Exportadoras com grande volume de NF têm alto potencial de recuperação desta tese.',bonus:'R$200',prioridade:'Alta'})
    if(no('subvencao'))ops.push({titulo:'Subvenção para Investimentos – IRPJ/CSLL (MP 1185)',dept:'Jurídico Federal',descricao:'Exportadoras Lucro Real com incentivos fiscais estaduais têm alto potencial de recuperação.',bonus:'R$200',prioridade:'Alta',condicao:'Lucro Real + incentivo fiscal estadual'})
    ops.push({titulo:'Creditamento PIS/COFINS sobre Insumos (Essencialidade)',dept:'Jurídico Federal',descricao:'Ampliação do conceito de insumo para créditos PIS/COFINS — jurisprudência atual favorável.',bonus:'R$200',prioridade:'Alta'})
    if(no('mandado_seg')&&gPorte)ops.push({titulo:'Mandado de Segurança – Liberação Créditos (360d)',dept:'Jurídico Federal',descricao:'Para exportadoras com crédito bloqueado no SEFAZ. Processo com resultado em 360 dias.',bonus:'R$200',prioridade:'Média'})
    ops.push({titulo:'Pauta Fiscal / Regimes Especiais ICMS',dept:'Jurídico Estadual',descricao:'Contestação de pauta fiscal e formalização de regime especial para exportação.',bonus:'R$150',prioridade:'Alta'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Exportadoras têm impacto direto das novas regras de crédito IBS/CBS a partir de 2026.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Transação Tributária Federal (PGFN/RFB)',dept:'Tributos Federais',descricao:'Negociação de passivos federais com redução de multas e juros.',bonus:'R$150',prioridade:'Alta'})
  }
  if(s==='outros_pj'){
    if(no('exclusao_icms')&&['real','presumido'].includes(r))ops.push({titulo:'Exclusão ICMS da Base de Cálculo PIS/COFINS',dept:'Jurídico Federal',descricao:'Tese aplicável a praticamente toda empresa PJ — jurisprudência consolidada no STJ/STF.',bonus:'R$200',prioridade:'Alta'})
    ops.push({titulo:'Exclusão PIS/COFINS da Própria Base',dept:'Jurídico Federal',descricao:'Exclusão de PIS/COFINS da própria base de cálculo. Aplica-se a todos os regimes PJ.',bonus:'R$200',prioridade:'Alta'})
    if(no('verbas_indeniz')&&gr50)ops.push({titulo:'Verbas Indenizatórias / INSS s/ Horas Extras',dept:'Tributos Federais',descricao:'Empresas com 50+ funcionários têm alto potencial de recuperação de contribuições prev.',bonus:'R$150',prioridade:'Alta'})
    if(r==='real'&&no('subvencao'))ops.push({titulo:'Subvenção para Investimentos – IRPJ/CSLL',dept:'Jurídico Federal',descricao:'Empresas Lucro Real com incentivos fiscais estaduais — potencial alto de recuperação retroativa.',bonus:'R$200',prioridade:'Alta',condicao:'Lucro Real + incentivo fiscal estadual'})
    if(r==='presumido')ops.push({titulo:'Majoração IRPJ/CSLL – Lei 224/2025',dept:'Jurídico Federal',descricao:'Recuperação de valores pagos a maior em 2025. Prescrição de 5 anos corre desde já.',bonus:'R$180',prioridade:'Alta'})
    if(r==='real')ops.push({titulo:'Majoração Crédito Presumido PIS/COFINS – Lei 224/2025',dept:'Jurídico Federal',descricao:'Empresas Lucro Real pagaram a maior em PIS/COFINS em 2025.',bonus:'R$180',prioridade:'Alta'})
    if(no('compliance'))ops.push({titulo:'Auditoria / Compliance Tributário',dept:'Crédito Acumulado',descricao:'Revisão completa de escrita fiscal para identificar créditos e irregularidades.',bonus:'R$120',prioridade:'Média'})
    if(no('reforma_tributaria'))ops.push({titulo:'Consultoria Reforma Tributária (IBS/CBS)',dept:'Jurídico + Compliance',descricao:'Toda empresa PJ precisa de planejamento para a transição IBS/CBS 2026.',bonus:'R$180',prioridade:'Alta'})
    if(deb)ops.push({titulo:'Adesão Transação Tributária RFB / PGFN',dept:'Tributos Federais',descricao:'Regularização de passivos federais com desconto em multas e juros.',bonus:'R$150',prioridade:'Alta'})
  }
  return ops.map((o,i)=>({...o,numero:i+1}))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const deptColor=(d:string)=>d.includes('Federal')?'#3b82f6':d.includes('Estadual')?'#22d3ee':d.includes('Compliance')?'#818cf8':d.includes('Crédito')?'#fbbf24':d.includes('Federais')?'#60a5fa':d.includes('Comercial')?'#34d399':'#94a3b8'

const selectCss:React.CSSProperties={width:'100%',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 32px 10px 12px',color:'var(--brand-text)',fontSize:'0.85rem',outline:'none',appearance:'none',cursor:'pointer'}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function PerfilClientePage(){
  const [nome,setNome]=useState('')
  const [consultor,setConsultor]=useState('')
  const [seg,setSeg]=useState<Segmento|null>(null)
  const [regime,setRegime]=useState<Regime|null>(null)
  const [fat,setFat]=useState(FATURAMENTO[0])
  const [fiscal,setFiscal]=useState(FISCAL[0])
  const [func,setFunc]=useState(FUNCIONARIOS[0])
  const [estado,setEstado]=useState(ESTADOS[0])
  const [temIncentivo,setTemIncentivo]=useState(false)
  const [temFrota,setTemFrota]=useState(false)
  const [obs,setObs]=useState('')
  const [ativos,setAtivos]=useState<string[]>([])
  const [opps,setOpps]=useState<Oportunidade[]|null>(null)
  const [pitch,setPitch]=useState('')
  const [gerando,setGerando]=useState(false)
  const [erro,setErro]=useState('')

  const escolherSeg=(id:Segmento)=>{
    setSeg(id); setAtivos([]); setOpps(null); setPitch('')
    const c=SEGS.find(s=>s.id===id)
    if(c) setRegime(c.reg as Regime)
  }

  const toggle=(id:string)=>setAtivos(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])

  const run=()=>{
    if(!seg||!regime||!nome.trim()){setErro('Preencha o nome, selecione o segmento e o regime tributário.');return}
    setErro('')
    setOpps(qualificar(seg,regime,ativos,fiscal,func,fat,temIncentivo,temFrota))
    setPitch('')
    setTimeout(()=>document.getElementById('res')?.scrollIntoView({behavior:'smooth'}),100)
  }

  const gerarPitch=async()=>{
    if(!opps?.length)return
    setGerando(true); setPitch('')
    try{
      const segConf=SEGS.find(s=>s.id===seg)
      const regConf=REGIMES.find(r=>r.id===regime)
      const extras=[temIncentivo?'tem incentivo fiscal estadual':'',temFrota?'tem frota/maquinário':'',estado!==ESTADOS[0]?`estado: ${estado}`:'' ].filter(Boolean).join(', ')
      const msg=`/pitch cliente:"${nome}" | consultor:${consultor||'não informado'} | segmento:${segConf?.label} | regime:${regConf?.label} | faturamento:${fat} | fiscal:${fiscal} | funcionários:${func} | estado:${estado} | extras:${extras||'nenhum'} | produtos atuais:${ativos.join(', ')||'nenhum'} | oportunidades:${opps.map(o=>o.titulo).join(' | ')} | obs:${obs||'nenhuma'}`
      const res=await fetch('/api/assistant/agenda',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,history:[]})})
      const data=await res.json()
      setPitch(data.reply||'Não foi possível gerar o pitch.')
    }catch{setPitch('Erro ao gerar pitch. Verifique a conexão com a IA.')}
    finally{setGerando(false)}
  }

  const segConf=SEGS.find(s=>s.id===seg)
  const alta=opps?.filter(o=>o.prioridade==='Alta').length??0
  const media=opps?.filter(o=>o.prioridade==='Média').length??0
  const prods=seg?PRODUTOS[seg]:[]

  return(
    <div style={{maxWidth:920,margin:'0 auto'}}>

      {/* Header */}
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:'1.4rem',fontWeight:900,color:'var(--brand-text)',margin:0,display:'flex',alignItems:'center',gap:10}}>
          <BookOpen size={22} color="var(--brand-primary)" />
          Perfil do Cliente
        </h1>
        <p style={{color:'var(--brand-muted)',fontSize:'0.82rem',marginTop:4}}>
          Identifique oportunidades de cross-sell por regime tributário e segmento
        </p>
      </div>

      {/* ══ SEÇÃO 1 — DADOS ══ */}
      <div className="glass-card" style={{marginBottom:12,overflow:'hidden',padding:0}}>
        {/* Header da seção */}
        <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid rgba(255,255,255,0.06)',borderLeft:'3px solid var(--brand-primary)'}}>
          <div style={{width:24,height:24,borderRadius:'50%',background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',fontWeight:900,color:'var(--brand-primary)',flexShrink:0}}>1</div>
          <span style={{fontWeight:800,fontSize:'0.82rem',color:'var(--brand-text)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Dados do Cliente</span>
        </div>

        <div style={{padding:'20px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {/* Nome do cliente */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Nome do cliente / Razão Social</label>
            <input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Ex: João Silva / Fazenda São Bento Ltda"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'var(--brand-text)',fontSize:'0.88rem',outline:'none',transition:'border-color 0.2s'}}
              onFocus={e=>e.target.style.borderColor='rgba(251,191,36,0.4)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'} />
          </div>
          {/* Consultor */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Consultor(a) responsável</label>
            <input value={consultor} onChange={e=>setConsultor(e.target.value)} placeholder="Seu nome"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'var(--brand-text)',fontSize:'0.88rem',outline:'none',transition:'border-color 0.2s'}}
              onFocus={e=>e.target.style.borderColor='rgba(251,191,36,0.4)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'} />
          </div>
          {/* Faturamento */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Faturamento anual estimado</label>
            <div style={{position:'relative'}}>
              <select value={fat} onChange={e=>setFat(e.target.value)} style={selectCss}>
                {FATURAMENTO.map(f=><option key={f} style={{background:'#0d1117'}}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--brand-muted)',pointerEvents:'none'}} />
            </div>
          </div>
          {/* Funcionários */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Número de funcionários</label>
            <div style={{position:'relative'}}>
              <select value={func} onChange={e=>setFunc(e.target.value)} style={selectCss}>
                {FUNCIONARIOS.map(f=><option key={f} style={{background:'#0d1117'}}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--brand-muted)',pointerEvents:'none'}} />
            </div>
          </div>
          {/* Estado fiscal */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Estado fiscal atual</label>
            <div style={{position:'relative'}}>
              <select value={fiscal} onChange={e=>setFiscal(e.target.value)} style={selectCss}>
                {FISCAL.map(f=><option key={f} style={{background:'#0d1117'}}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--brand-muted)',pointerEvents:'none'}} />
            </div>
          </div>
          {/* Observações */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Observações / contexto</label>
            <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
              placeholder="Ex: tem frota, exporta, autuado SEFAZ, recebeu notificação..."
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px 14px',color:'var(--brand-text)',fontSize:'0.82rem',outline:'none',resize:'vertical',fontFamily:'inherit',transition:'border-color 0.2s'}}
              onFocus={e=>e.target.style.borderColor='rgba(251,191,36,0.4)'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.1)'} />
          </div>

          {/* Estado / UF */}
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Estado / UF</label>
            <div style={{position:'relative'}}>
              <select value={estado} onChange={e=>setEstado(e.target.value)} style={selectCss}>
                {ESTADOS.map(f=><option key={f} style={{background:'#0d1117'}}>{f}</option>)}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--brand-muted)',pointerEvents:'none'}} />
            </div>
          </div>

          {/* Toggles rápidos */}
          <div style={{display:'flex',flexDirection:'column',gap:7}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Situação específica</label>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {[
                {key:'incentivo',val:temIncentivo,set:setTemIncentivo,label:'Tem incentivo fiscal estadual (PRODEPRO, ICMS reduzido, etc.)',cor:'#f97316'},
                {key:'frota',val:temFrota,set:setTemFrota,label:'Tem frota própria ou maquinário agrícola (IPVA/DPVAT)',cor:'#06b6d4'},
              ].map(t=>(
                <button key={t.key} onClick={()=>t.set(!t.val)} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                  borderRadius:8,cursor:'pointer',textAlign:'left',
                  border:t.val?`1px solid ${t.cor}50`:'1px solid rgba(255,255,255,0.07)',
                  background:t.val?`${t.cor}10`:'rgba(255,255,255,0.02)',
                  transition:'all 0.15s ease',
                }}>
                  <div style={{width:18,height:18,borderRadius:4,background:t.val?t.cor:'transparent',border:`1.5px solid ${t.val?t.cor:'rgba(255,255,255,0.2)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.15s'}}>
                    {t.val&&<svg width={10} height={10} viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <span style={{fontSize:'0.78rem',color:t.val?'var(--brand-text)':'var(--brand-muted)',fontWeight:t.val?600:400}}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Segmento ── */}
          <div style={{gridColumn:'1 / -1',display:'flex',flexDirection:'column',gap:10}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>Segmento principal</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {SEGS.map(s=>{
                const ativo=seg===s.id
                const Icon=s.Icon
                return(
                  <button
                    key={s.id}
                    onClick={()=>escolherSeg(s.id as Segmento)}
                    aria-label={s.label}
                    aria-pressed={ativo}
                    style={{
                      padding:'16px 8px 14px',borderRadius:12,cursor:'pointer',
                      border:ativo?`2px solid ${s.accent}70`:`1px solid ${s.accent}22`,
                      background:ativo?`${s.accent}12`:`${s.accent}06`,
                      display:'flex',flexDirection:'column',alignItems:'center',gap:10,
                      transition:'all 0.18s ease',
                      boxShadow:ativo?`0 0 20px ${s.accent}22, inset 0 1px 0 ${s.accent}15`:`0 0 0 ${s.accent}00`,
                      outline:'none',
                    }}
                  >
                    {/* Ícone colorido — sempre visível */}
                    <div style={{
                      width:52,height:52,borderRadius:14,
                      background:ativo?`${s.accent}20`:`${s.accent}12`,
                      border:`1.5px solid ${ativo?s.accent+'55':s.accent+'28'}`,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      transition:'all 0.18s ease',
                      boxShadow:ativo?`0 4px 14px ${s.accent}25`:'none',
                    }}>
                      <Icon
                        size={24}
                        color={ativo?s.accent:`${s.accent}cc`}
                        strokeWidth={1.6}
                      />
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{
                        fontSize:'0.63rem',fontWeight:900,
                        color:ativo?s.accent:`${s.accent}bb`,
                        textTransform:'uppercase',letterSpacing:'0.04em',lineHeight:1.3,
                      }}>{s.label}</div>
                      <div style={{fontSize:'0.58rem',color:'var(--brand-muted)',marginTop:3,lineHeight:1.3}}>{s.sub}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Regime ── */}
          <div style={{gridColumn:'1 / -1',display:'flex',flexDirection:'column',gap:7}}>
            <label style={{fontSize:'0.7rem',color:'var(--brand-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.12em'}}>
              Regime Tributário <span style={{color:'rgba(148,163,184,0.5)',fontWeight:400,textTransform:'none',letterSpacing:0}}>— sugerido automaticamente, pode ajustar</span>
            </label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {REGIMES.map(r=>{
                const ativo=regime===r.id
                return(
                  <button key={r.id} onClick={()=>setRegime(r.id as Regime)} style={{
                    padding:'7px 18px',borderRadius:24,cursor:'pointer',
                    border:ativo?`1.5px solid ${r.accent}60`:'1px solid rgba(255,255,255,0.08)',
                    background:ativo?`${r.accent}12`:'rgba(255,255,255,0.03)',
                    color:ativo?r.accent:'var(--brand-muted)',
                    fontSize:'0.8rem',fontWeight:ativo?800:500,
                    transition:'all 0.15s ease',
                  }}>{r.label}</button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ SEÇÃO 2 — PRODUTOS QUE JÁ TEM ══ */}
      {prods.length>0&&(
        <div className="glass-card" style={{marginBottom:12,overflow:'hidden',padding:0}}>
          <div style={{padding:'12px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid rgba(255,255,255,0.06)',borderLeft:`3px solid ${segConf?.accent??'#14b8a6'}`}}>
            <div style={{width:24,height:24,borderRadius:'50%',background:`${segConf?.accent??'#14b8a6'}18`,border:`1px solid ${segConf?.accent??'#14b8a6'}50`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',fontWeight:900,color:segConf?.accent??'#14b8a6',flexShrink:0}}>2</div>
            <span style={{fontWeight:800,fontSize:'0.82rem',color:'var(--brand-text)',textTransform:'uppercase',letterSpacing:'0.07em'}}>Produtos que o cliente já tem — marque todos que se aplicam</span>
          </div>
          <div style={{padding:'14px 22px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            {prods.map(p=>{
              const on=ativos.includes(p.id)
              return(
                <button key={p.id} onClick={()=>toggle(p.id)} style={{
                  display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                  borderRadius:8,cursor:'pointer',textAlign:'left',
                  border:on?'1px solid rgba(20,184,166,0.4)':'1px solid rgba(255,255,255,0.06)',
                  background:on?'rgba(20,184,166,0.07)':'rgba(255,255,255,0.02)',
                  transition:'all 0.15s ease',
                }}>
                  {on?<CheckSquare size={15} color="#14b8a6"/>:<Square size={15} color="rgba(255,255,255,0.2)"/>}
                  <span style={{fontSize:'0.8rem',color:on?'var(--brand-text)':'var(--brand-muted)',fontWeight:on?600:400}}>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Erro */}
      {erro&&(
        <div style={{display:'flex',alignItems:'center',gap:9,padding:'11px 16px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:9,marginBottom:12}}>
          <AlertTriangle size={15} color="#ef4444"/>
          <span style={{fontSize:'0.83rem',color:'#ef4444'}}>{erro}</span>
        </div>
      )}

      {/* ── Botão qualificar ── */}
      <button onClick={run} style={{
        width:'100%',padding:15,borderRadius:12,cursor:'pointer',
        background:segConf
          ? `linear-gradient(90deg,${segConf.accent}22 0%,${segConf.accent}10 100%)`
          : 'rgba(255,255,255,0.04)',
        border:`1.5px solid ${segConf?segConf.accent+'40':'rgba(251,191,36,0.2)'}`,
        color:'var(--brand-text)',fontWeight:900,fontSize:'0.9rem',
        textTransform:'uppercase',letterSpacing:'0.08em',
        display:'flex',alignItems:'center',justifyContent:'center',gap:10,
        boxShadow:segConf?`0 4px 24px ${segConf.accent}18`:'0 4px 20px rgba(0,0,0,0.25)',
        marginBottom:24,transition:'all 0.2s ease',
      }}
      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow=segConf?`0 8px 32px ${segConf.accent}28`:'0 6px 24px rgba(0,0,0,0.35)'}}
      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow=segConf?`0 4px 24px ${segConf.accent}18`:'0 4px 20px rgba(0,0,0,0.25)'}}>
        <Zap size={17} color={segConf?.accent??'var(--brand-primary)'}/>
        Qualificar Cliente e Ver Oportunidades
      </button>

      {/* ══ RESULTADO ══ */}
      {opps&&(
        <div id="res" style={{display:'flex',flexDirection:'column',gap:14}}>

          {/* Header resultado */}
          <div className="glass-card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                {segConf&&<segConf.Icon size={18} color={segConf.accent} strokeWidth={1.75}/>}
                <span style={{fontWeight:900,fontSize:'1rem',color:'var(--brand-text)'}}>Resultado da Qualificação — {nome}</span>
              </div>
              <div style={{background:alta>3?'rgba(239,68,68,0.15)':'rgba(245,158,11,0.15)',border:`1px solid ${alta>3?'rgba(239,68,68,0.35)':'rgba(245,158,11,0.35)'}`,color:alta>3?'#ef4444':'var(--brand-primary)',padding:'4px 16px',borderRadius:20,fontSize:'0.78rem',fontWeight:900}}>
                {opps.length} oportunidades
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)'}}>
              {[
                {label:'Total',value:opps.length,color:'var(--brand-text)',Icon:BarChart3},
                {label:'Alta prioridade',value:alta,color:'#ef4444',Icon:TrendingUp},
                {label:'Média prioridade',value:media,color:'#f59e0b',Icon:Tag},
                {label:'Produtos atuais',value:ativos.length,color:'#22c55e',Icon:CheckCircle2},
                {label:'Segmento',value:segConf?.label.split('/')[0].trim()??'',color:segConf?.accent??'#94a3b8',Icon:Users},
              ].map((s,i)=>(
                <div key={i} style={{padding:'14px 10px',textAlign:'center',borderRight:i<4?'1px solid rgba(255,255,255,0.05)':'none'}}>
                  <s.Icon size={13} color={s.color} style={{marginBottom:4}} />
                  <div style={{fontSize:'1.3rem',fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:'0.58rem',color:'var(--brand-muted)',textTransform:'uppercase',marginTop:3,letterSpacing:'0.08em',lineHeight:1.3}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cards oportunidades */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9}}>
            {opps.map(op=>{
              const isAlta=op.prioridade==='Alta'
              const dc=deptColor(op.dept)
              return(
                <div key={op.numero} className="glass-card" style={{
                  padding:0,overflow:'hidden',
                  border:`1px solid ${isAlta?'rgba(239,68,68,0.18)':'rgba(245,158,11,0.12)'}`,
                }}>
                  {/* Header do card */}
                  <div style={{padding:'9px 14px',background:isAlta?'rgba(239,68,68,0.05)':'rgba(245,158,11,0.03)',display:'flex',alignItems:'flex-start',gap:9,borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                    <span style={{fontSize:'0.88rem',fontWeight:900,color:isAlta?'#ef4444':'#f59e0b',minWidth:22,flexShrink:0}}>{String(op.numero).padStart(2,'0')}</span>
                    <span style={{fontSize:'0.8rem',fontWeight:800,color:'var(--brand-text)',lineHeight:1.35}}>{op.titulo}</span>
                  </div>
                  {/* Corpo do card */}
                  <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:7}}>
                    <span style={{fontSize:'0.68rem',fontWeight:700,color:dc,background:`${dc}12`,padding:'2px 8px',borderRadius:4,display:'inline-block'}}>{op.dept}</span>
                    <p style={{fontSize:'0.76rem',color:'var(--brand-muted)',margin:0,lineHeight:1.55}}>{op.descricao}</p>
                    {op.condicao&&(
                      <div style={{fontSize:'0.66rem',color:'#f59e0b',background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',padding:'3px 9px',borderRadius:5}}>
                        ⚠ {op.condicao}
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:5,borderTop:'1px solid rgba(255,255,255,0.05)'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:2}}>
                        <span style={{fontSize:'0.7rem',color:'var(--brand-muted)'}}>Bônus: <strong style={{color:'var(--brand-text)'}}>{op.bonus}</strong></span>
                        {op.consultor&&<span style={{fontSize:'0.65rem',color:'#3b82f6'}}>👤 {op.consultor}</span>}
                      </div>
                      <span style={{fontSize:'0.62rem',fontWeight:800,padding:'2px 10px',borderRadius:12,
                        background:isAlta?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',
                        color:isAlta?'#ef4444':'#f59e0b',
                        border:`1px solid ${isAlta?'rgba(239,68,68,0.25)':'rgba(245,158,11,0.25)'}`}}>
                        {isAlta?'● Alta':'● Média'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gerar pitch */}
          <div className="glass-card" style={{padding:'16px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Sparkles size={15} color="var(--brand-primary)"/>
                <span style={{fontWeight:800,fontSize:'0.9rem',color:'var(--brand-text)'}}>PITCH com PALIN AI</span>
              </div>
              <p style={{fontSize:'0.73rem',color:'var(--brand-muted)',margin:'3px 0 0'}}>Gera script de abordagem personalizado com base nas oportunidades identificadas</p>
            </div>
            <button onClick={gerarPitch} disabled={gerando} style={{
              padding:'10px 22px',borderRadius:8,cursor:gerando?'not-allowed':'pointer',
              background:gerando?'rgba(255,255,255,0.05)':'var(--brand-primary)',
              border:'none',color:gerando?'var(--brand-muted)':'#0d1117',
              fontWeight:900,fontSize:'0.83rem',whiteSpace:'nowrap',
              display:'flex',alignItems:'center',gap:7,flexShrink:0,
              boxShadow:gerando?'none':'0 4px 16px rgba(251,191,36,0.2)',
              transition:'all 0.2s ease',
            }}>
              <Sparkles size={14}/>{gerando?'Gerando...':'Gerar Pitch'}
            </button>
          </div>

          {/* Pitch resultado */}
          {pitch&&(
            <div className="glass-card" style={{padding:20,borderColor:'rgba(251,191,36,0.15)'}}>
              <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,paddingBottom:12,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                <Sparkles size={15} color="var(--brand-primary)"/>
                <span style={{fontWeight:800,color:'var(--brand-primary)',fontSize:'0.9rem'}}>PALIN AI — Pitch para {nome}</span>
              </div>
              <div style={{fontSize:'0.84rem',color:'#c9d1d9',lineHeight:1.85,whiteSpace:'pre-wrap'}}>{pitch}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
