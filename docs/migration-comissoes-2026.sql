-- ============================================================
-- MIGRAÇÃO: PRODUTOS E COMISSÕES 2026 — PALIN & MARTINS
-- Executar no Supabase SQL Editor
-- Idempotente via ON CONFLICT (slug) DO UPDATE SET
-- ============================================================

-- 1. Adicionar colunas necessárias (seguro se já existirem)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tipo_comissao TEXT,
  ADD COLUMN IF NOT EXISTS comissao_fixa_valor NUMERIC DEFAULT 0;

ALTER TABLE commission_rules
  ADD COLUMN IF NOT EXISTS tipo_comissao TEXT,
  ADD COLUMN IF NOT EXISTS perfil_consultor TEXT DEFAULT 'PJ',
  ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS faixas_variavel JSONB;

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'FIXA',
  ADD COLUMN IF NOT EXISTS valor_liberacao NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variavel_paga BOOLEAN DEFAULT false;

-- 2. Inserir / Atualizar todos os produtos do portfólio
-- Estrutura: (name, slug, description, category, emoji, color, active, tipo_comissao, comissao_fixa_valor)

INSERT INTO products (name, slug, description, category, emoji, color, active, tipo_comissao, comissao_fixa_valor) VALUES

-- ════════════════════════════════════════════════════════════
-- ICMS — Crédito Acumulado
-- ════════════════════════════════════════════════════════════
('Recuperação CAT 207',
 'recuperacao-cat-207',
 'Levantamento e habilitação de crédito acumulado de ICMS via CAT 207',
 'ICMS', '💰', '#f59e0b', true, 'CRÉDITO_ACUM', 150.00),

('Recuperação CAT 83',
 'recuperacao-cat-83',
 'Levantamento e habilitação de crédito acumulado de ICMS via CAT 83',
 'ICMS', '💰', '#f59e0b', true, 'CRÉDITO_ACUM', 150.00),

-- ════════════════════════════════════════════════════════════
-- ICMS — Compliance Tributário
-- ════════════════════════════════════════════════════════════
('Auditoria extemporânea completa/amostragem',
 'auditoria-extemporanea-icms',
 'Revisão retroativa completa ou por amostragem de obrigações de ICMS',
 'ICMS', '🔍', '#6366f1', true, 'COMPLIANCE', 90.00),

('Auditoria trimestral completa/amostragem',
 'auditoria-trimestral-icms',
 'Monitoramento e revisão trimestral de obrigações de ICMS',
 'ICMS', '🔍', '#6366f1', true, 'COMPLIANCE', 90.00),

('Consulta Tributária ICMS',
 'consulta-tributaria-icms',
 'Opinião técnica pontual sobre questões de ICMS',
 'ICMS', '💡', '#6366f1', true, 'COMPLIANCE', 90.00),

('Denúncia Espontânea',
 'denuncia-espontanea',
 'Regularização tributária via denúncia espontânea perante o Fisco Estadual',
 'ICMS', '📋', '#6366f1', true, 'COMPLIANCE', 90.00),

('Atendimento de fiscalização/notificação',
 'atendimento-fiscalizacao-notificacao',
 'Suporte e resposta a fiscalizações e notificações do Fisco Estadual',
 'ICMS', '⚠️', '#6366f1', true, 'COMPLIANCE', 90.00),

('Análise e pagamento de auto de infração e imposição de multa',
 'analise-pagamento-auto-infracao',
 'Análise, defesa e pagamento de autos de infração e multas de ICMS',
 'ICMS', '⚔️', '#6366f1', true, 'COMPLIANCE', 90.00),

('Venda de crédito para empresa interdependente e não-interdependente',
 'venda-credito-empresa-interdependente',
 'Intermediação e formalização de venda de crédito acumulado de ICMS entre empresas',
 'ICMS', '🤝', '#6366f1', true, 'COMPLIANCE', 90.00),

('Recursos de créditos não liberados',
 'recursos-creditos-nao-liberados',
 'Elaboração de recursos administrativos para liberação de créditos de ICMS negados',
 'ICMS', '📝', '#6366f1', true, 'COMPLIANCE', 90.00),

-- ════════════════════════════════════════════════════════════
-- ICMS — Análise de Crédito de ICMS
-- ════════════════════════════════════════════════════════════
('Análise de créditos recebidos',
 'analise-creditos-recebidos',
 'Análise técnica de créditos de ICMS recebidos via transferência ou nota fiscal',
 'ICMS', '📊', '#f59e0b', true, 'CRÉDITO_ACUM', 120.00),

('Análise e transformação em crédito acumulado',
 'analise-transformacao-credito-acumulado',
 'Análise e transformação de saldo credor de ICMS em crédito acumulado utilizável',
 'ICMS', '🔄', '#f59e0b', true, 'CRÉDITO_ACUM', 120.00),

('Recuperação de clientes inadimplentes (PDD)',
 'recuperacao-pdd-icms',
 'Recuperação de crédito de ICMS decorrente de perdas com clientes inadimplentes (PDD)',
 'ICMS', '💰', '#f59e0b', true, 'CRÉDITO_ACUM', 120.00),

('Comercialização de crédito ICMS',
 'comercializacao-credito-icms',
 'Comercialização e transferência de crédito acumulado de ICMS entre empresas',
 'ICMS', '🏦', '#f59e0b', true, 'CRÉDITO_ACUM', 90.00),

-- ════════════════════════════════════════════════════════════
-- ICMS — Produtor Rural (e-CredRural)
-- ════════════════════════════════════════════════════════════
('Recuperação de crédito simples (e-CredRural)',
 'ecredrural-simples',
 'Habilitação e liberação de crédito acumulado de ICMS para produtor rural — modalidade simples',
 'ICMS', '🌾', '#84cc16', true, 'RURAL', 90.00),

('Recuperação de crédito PDD (e-CredRural)',
 'ecredrural-pdd',
 'e-CredRural com Perda Definitiva de Devedor — recuperação avançada',
 'ICMS', '🌾', '#84cc16', true, 'RURAL', 90.00),

('Regime Especial (centralização)',
 'regime-especial-centralizacao',
 'Regime Especial ICMS para centralização de apuração de produtor rural',
 'ICMS', '🌾', '#84cc16', true, 'RURAL', 90.00),

('Planejamento Tributário - Reforma Tributária (Rural)',
 'planejamento-tributario-reforma-rural',
 'Planejamento tributário para produtor rural no contexto da Reforma Tributária',
 'ICMS', '🌾', '#84cc16', true, 'RURAL', 90.00),

('Comercialização dos créditos rurais',
 'comercializacao-creditos-rurais',
 'Comercialização e negociação de créditos acumulados de ICMS do produtor rural',
 'ICMS', '🌾', '#84cc16', true, 'RURAL', 90.00),

-- ════════════════════════════════════════════════════════════
-- TRIBUTOS FEDERAIS — PIS/COFINS
-- ════════════════════════════════════════════════════════════
('Recuperação dos Créditos de PIS/COFINS',
 'recuperacao-creditos-pis-cofins',
 'Levantamento e recuperação de créditos de PIS/COFINS pagos indevidamente',
 'Tributos Federais', '🔄', '#3b82f6', true, 'PIS_COFINS', 120.00),

('Ressarcimento e Compensação PIS/COFINS',
 'ressarcimento-compensacao-pis-cofins',
 'Ressarcimento e compensação de créditos de PIS/COFINS junto à Receita Federal',
 'Tributos Federais', '🔄', '#3b82f6', true, 'PIS_COFINS', 120.00),

('Revisão e Auditoria EFD Contribuições',
 'revisao-auditoria-efd-contribuicoes',
 'Revisão completa da EFD-Contribuições e identificação de créditos não aproveitados',
 'Tributos Federais', '🔍', '#3b82f6', true, 'PIS_COFINS', 120.00),

('Exclusão do ICMS da Base de Cálculo do PIS/COFINS',
 'exclusao-icms-base-pis-cofins',
 'Exclusão administrativa do ICMS da base de cálculo de PIS/COFINS',
 'Tributos Federais', '🔄', '#3b82f6', true, 'PIS_COFINS', 120.00),

-- ════════════════════════════════════════════════════════════
-- TRIBUTOS FEDERAIS — IPI
-- ════════════════════════════════════════════════════════════
('Recuperação dos Créditos Tributários IPI',
 'recuperacao-creditos-ipi',
 'Levantamento e recuperação de créditos de IPI sobre insumos e matérias-primas',
 'Tributos Federais', '🔄', '#3b82f6', true, 'PIS_COFINS', 120.00),

('Ressarcimento e Compensação IPI',
 'ressarcimento-compensacao-ipi',
 'Ressarcimento e compensação de créditos de IPI junto à Receita Federal',
 'Tributos Federais', '🔄', '#3b82f6', true, 'PIS_COFINS', 120.00),

('Classificação de NCM',
 'classificacao-ncm',
 'Análise e enquadramento correto de produtos na Nomenclatura Comum do Mercosul',
 'Tributos Federais', '📦', '#3b82f6', true, 'PIS_COFINS', 90.00),

-- ════════════════════════════════════════════════════════════
-- TRIBUTOS FEDERAIS — IRPJ / CSLL
-- ════════════════════════════════════════════════════════════
('Subvenção para investimentos (extemporâneo)',
 'subvencao-investimentos-extemporaneo',
 'Enquadramento retroativo de benefícios fiscais estaduais como subvenção para investimentos',
 'Tributos Federais', '📈', '#10b981', true, 'SUBVENÇÃO', 120.00),

('Prejuízo Fiscal (REFIS)',
 'prejuizo-fiscal-refis',
 'Aproveitamento de prejuízo fiscal e base negativa de CSLL, inclusive em programas de parcelamento',
 'Tributos Federais', '📈', '#10b981', true, 'SUBVENÇÃO', 120.00),

('Saldo Negativo IRPJ e CSLL',
 'saldo-negativo-irpj-csll',
 'Levantamento e compensação de saldo negativo de IRPJ e CSLL',
 'Tributos Federais', '📈', '#10b981', true, 'SUBVENÇÃO', 120.00),

-- ════════════════════════════════════════════════════════════
-- TRIBUTOS FEDERAIS — Adm Previdenciário
-- ════════════════════════════════════════════════════════════
('Verbas Indenizatórias (Previdenciário)',
 'verbas-indenizatorias-prev',
 'Revisão e recuperação de contribuições previdenciárias sobre verbas indenizatórias',
 'Tributos Federais', '🛡️', '#6366f1', true, 'COMPLIANCE', 90.00),

('Retenção de 11% (INSS)',
 'retencao-11-inss',
 'Análise e recuperação de retenção indevida de 11% de INSS sobre serviços',
 'Tributos Federais', '🛡️', '#6366f1', true, 'COMPLIANCE', 90.00),

('CPRB – Desoneração da Folha',
 'cprb-desoneração-folha',
 'Contribuição Previdenciária sobre a Receita Bruta — análise e aplicação da desoneração',
 'Tributos Federais', '🛡️', '#6366f1', true, 'COMPLIANCE', 90.00),

('Planejamento Previdenciário (Funrural / SAT / Desoneração)',
 'planejamento-previdenciario',
 'Planejamento previdenciário: Funrural, SAT x FAP e desoneração da folha de pagamento',
 'Tributos Federais', '🛡️', '#6366f1', true, 'COMPLIANCE', 90.00),

-- ════════════════════════════════════════════════════════════
-- TRIBUTOS FEDERAIS — Outros trabalhos federais
-- ════════════════════════════════════════════════════════════
('Adesão Transação Tributária RFB e PGFN',
 'adesao-transacao-rfb-pgfn',
 'Adesão a programas de transação tributária da Receita Federal e PGFN',
 'Tributos Federais', '📋', '#3b82f6', true, 'COMPLIANCE', 90.00),

('Revisão de Ofício de Créditos Tributários',
 'revisao-oficio-creditos',
 'Revisão e impugnação de lançamentos de ofício de créditos tributários federais',
 'Tributos Federais', '📋', '#3b82f6', true, 'COMPLIANCE', 90.00),

('Solução de Consulta COSIT',
 'solucao-consulta-cosit',
 'Elaboração de consulta formal à COSIT para esclarecimento de questões tributárias',
 'Tributos Federais', '💡', '#3b82f6', true, 'COMPLIANCE', 90.00),

('Planejamento Tributário - Reforma Tributária (Federal)',
 'planejamento-tributario-reforma-federal',
 'Planejamento tributário para empresas no contexto da Reforma Tributária federal',
 'Tributos Federais', '📊', '#3b82f6', true, 'COMPLIANCE', 90.00),

-- ════════════════════════════════════════════════════════════
-- JURÍDICO — Teses Federais
-- ════════════════════════════════════════════════════════════
('Exclusão do ICMS sobre os créditos de PIS/COFINS',
 'tese-exclusao-icms-creditos-pis-cofins',
 'Tese judicial para exclusão do ICMS na apuração dos créditos de PIS/COFINS',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Crédito de PIS/COFINS sobre combustível para revenda',
 'tese-credito-pis-cofins-combustivel',
 'Tese para creditamento de PIS/COFINS sobre combustível utilizado em revenda',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Equiparação às clínicas médicas para redução do IRPJ',
 'tese-clinicas-medicas-irpj',
 'Tese de equiparação a clínicas médicas para redução da alíquota de IRPJ/CSLL',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Inconstitucionalidade da MP 1185 (subvenção a partir de 2024)',
 'tese-mp-1185-subvencao',
 'Tese de inconstitucionalidade da MP 1185 para manutenção do benefício de subvenção',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Exclusão do ISS da base de cálculo do PIS/COFINS',
 'tese-exclusao-iss-pis-cofins',
 'Tese judicial para exclusão do ISS da base de cálculo do PIS/COFINS',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Exclusão do PIS/COFINS da própria base',
 'tese-exclusao-pis-cofins-base',
 'Tese de exclusão do PIS/COFINS da própria base de cálculo (exclusão circular)',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Creditamento PIS/COFINS sobre insumos – IPVA/DPVAT/frota',
 'tese-creditamento-pis-cofins-insumos',
 'Creditamento de PIS/COFINS sobre insumos: IPVA, Licenciamento, DPVAT e frota própria',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Mandado de segurança – créditos tributários federais (360 dias)',
 'tese-mandado-seguranca-360',
 'Ação de mandado de segurança para liberação de créditos tributários federais em 360 dias',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Majoração PIS/COFINS – Lei 224/2025 (alíquota zero insumos agro)',
 'tese-majoracao-pis-cofins-lei224-agro',
 'Tese de majoração PIS/COFINS conforme Lei 224/2025 — alíquota zero insumos agronegócio',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Majoração IRPJ/CSLL – Lei 224/2025 (lucro presumido)',
 'tese-majoracao-irpj-csll-lei224',
 'Tese de majoração de IRPJ/CSLL conforme Lei 224/2025 para empresas no lucro presumido',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Majoração crédito presumido PIS/COFINS – Lei 224/2025',
 'tese-majoracao-credito-presumido-lei224',
 'Tese de majoração do crédito presumido de PIS/COFINS conforme Lei 224/2025',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

-- ════════════════════════════════════════════════════════════
-- JURÍDICO — Teses Estaduais
-- ════════════════════════════════════════════════════════════
('Creditamento de ICMS sobre produtos intermediários',
 'tese-creditamento-icms-produtos-intermediarios',
 'Tese estadual de creditamento de ICMS sobre insumos e produtos intermediários',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Pauta Fiscal',
 'tese-pauta-fiscal',
 'Contestação de pauta fiscal e valor arbitrado de ICMS pelo Fisco Estadual',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

-- ════════════════════════════════════════════════════════════
-- JURÍDICO — Outros Trabalhos Jurídicos
-- ════════════════════════════════════════════════════════════
('Verbas Indenizatórias (Jurídico)',
 'verbas-indenizatorias-juridico',
 'Ação judicial para não incidência de INSS e IR sobre verbas indenizatórias',
 'Jurídico', '⚔️', '#8b5cf6', true, 'TESE', 200.00),

('Tese Judicial – INSS sobre horas extras',
 'tese-inss-horas-extras',
 'Ação judicial contestando incidência de INSS sobre horas extras e adicionais',
 'Jurídico', '⚖️', '#8b5cf6', true, 'TESE', 200.00),

('Análise de viabilidade de transação tributária',
 'analise-viabilidade-transacao',
 'Estudo de viabilidade para transação tributária junto à PGFN ou Receita Federal',
 'Jurídico', '📊', '#8b5cf6', true, 'COMPLIANCE', 90.00),

('Defesas de auto de infração',
 'defesas-auto-infracao',
 'Elaboração de impugnações e recursos em processos administrativos tributários',
 'Jurídico', '⚔️', '#8b5cf6', true, 'COMPLIANCE', 90.00),

('Consultoria Reforma Tributária',
 'consultoria-reforma-tributaria',
 'Consultoria especializada sobre impactos e oportunidades da Reforma Tributária',
 'Jurídico', '💡', '#8b5cf6', true, 'COMPLIANCE', 90.00),

('Regimes Especiais',
 'regimes-especiais-juridico',
 'Elaboração e acompanhamento de pedidos de Regime Especial junto ao Fisco',
 'Jurídico', '📋', '#8b5cf6', true, 'COMPLIANCE', 90.00),

-- ════════════════════════════════════════════════════════════
-- EDUCACIONAL
-- ════════════════════════════════════════════════════════════
('Workshop Mundo Agro',
 'workshop-mundo-agro',
 'Workshop especializado em tributação e créditos do agronegócio',
 'Educacional', '📚', '#84cc16', true, 'OUTRO', 70.00),

('Workshop Mundo Tributário',
 'workshop-mundo-tributario',
 'Workshop completo sobre recuperação de créditos tributários',
 'Educacional', '📚', '#f59e0b', true, 'OUTRO', 70.00),

('Workshop Integraday',
 'workshop-integraday',
 'Workshop intensivo de imersão tributária — formato Integraday',
 'Educacional', '📚', '#3b82f6', true, 'OUTRO', 70.00),

('Workshop Mundo Business (gestão)',
 'workshop-mundo-business',
 'Workshop focado em gestão empresarial e planejamento estratégico',
 'Educacional', '📚', '#6366f1', true, 'OUTRO', 70.00),

('Encontro exclusivo',
 'encontro-exclusivo',
 'Evento exclusivo para clientes e parceiros estratégicos da Palin & Martins',
 'Educacional', '⭐', '#f59e0b', true, 'OUTRO', 70.00),

('Insider Club',
 'insider-club',
 'Programa de assinatura com conteúdos exclusivos e networking tributário',
 'Educacional', '💎', '#f59e0b', true, 'OUTRO', 70.00),

('Agro Flow',
 'agro-flow',
 'Programa de acompanhamento e fluxo de processos para o agronegócio',
 'Educacional', '🌱', '#84cc16', true, 'OUTRO', 70.00),

('Mentoria e-CredRural',
 'mentoria-ecredrural',
 'Mentoria especializada para produtores rurais no processo e-CredRural',
 'Educacional', '🎓', '#84cc16', true, 'OUTRO', 70.00)

ON CONFLICT (slug) DO UPDATE SET
  name              = EXCLUDED.name,
  description       = EXCLUDED.description,
  category          = EXCLUDED.category,
  emoji             = EXCLUDED.emoji,
  color             = EXCLUDED.color,
  tipo_comissao     = EXCLUDED.tipo_comissao,
  comissao_fixa_valor = EXCLUDED.comissao_fixa_valor,
  active            = EXCLUDED.active;

-- 3. Regras de comissão variável por tipo (uma regra global por tipo_comissao)
INSERT INTO commission_rules (tipo_comissao, base_fixed, recorrente, faixas_variavel, notes)
SELECT tipo, fixa, false, faixas::jsonb, descricao
FROM (VALUES
  ('TESE', 200.00,
   '[{"min":0,"max":50000,"pct":0.08},{"min":50001,"max":200000,"pct":0.05},{"min":200001,"max":500000,"pct":0.03},{"min":500001,"max":null,"pct":0.015}]',
   'Tese jurídica federal/estadual — 8%/5%/3%/1,5% escalonado'),

  ('CRÉDITO_ACUM', 150.00,
   '[{"min":0,"max":50000,"pct":0.06},{"min":50001,"max":200000,"pct":0.04},{"min":200001,"max":500000,"pct":0.025},{"min":500001,"max":null,"pct":0.01}]',
   'Crédito acumulado ICMS — 6%/4%/2,5%/1% escalonado'),

  ('PIS_COFINS', 120.00,
   '[{"min":0,"max":50000,"pct":0.06},{"min":50001,"max":200000,"pct":0.04},{"min":200001,"max":null,"pct":0.02}]',
   'Recuperação PIS/COFINS e IPI — 6%/4%/2% escalonado'),

  ('SUBVENÇÃO', 120.00,
   '[{"min":0,"max":100000,"pct":0.05},{"min":100001,"max":null,"pct":0.025}]',
   'Subvenção investimentos / IRPJ-CSLL — 5%/2,5% escalonado'),

  ('RURAL', 90.00,
   '[{"min":0,"max":100000,"pct":0.10},{"min":100001,"max":200000,"pct":0.07},{"min":200001,"max":null,"pct":0.05}]',
   'Produtor rural e-CredRural — 10%/7%/5% sobre liberação SEFAZ'),

  ('COMPLIANCE', 90.00, NULL,
   'Compliance/Consulta/Auditoria — comissão fixa apenas, sem variável'),

  ('OUTRO', 70.00, NULL,
   'Workshops, mentorias, educacional — comissão fixa apenas')
) AS t(tipo, fixa, faixas, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM commission_rules WHERE tipo_comissao = t.tipo AND product_id IS NULL
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_products_tipo_comissao ON products(tipo_comissao);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_commissions_deal_type ON commissions(deal_id, commission_type);

-- ════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO:
-- ✅ 64 produtos inseridos/atualizados em 4 categorias
-- ✅ ICMS: 19 produtos (Créd. Acumulado, Compliance, Análise, Produtor Rural)
-- ✅ Tributos Federais: 18 produtos (PIS/COFINS, IPI, IRPJ, Prev, Outros)
-- ✅ Jurídico: 19 produtos (Teses Federais, Estaduais, Outros Jurídicos)
-- ✅ Educacional: 8 produtos (Workshops, Insider Club, Mentorias)
-- ✅ 7 regras de comissão variável por tipo criadas
-- ════════════════════════════════════════════════════════════
