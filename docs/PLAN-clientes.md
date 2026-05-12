# PLAN-clientes.md

## Objetivo
Criar uma camada de `Clientes` acima do CRM atual, de forma que:
- ao criar um lead, o sistema crie ou vincule automaticamente um cliente;
- ao fechar a oportunidade, o sistema gere um contrato pendente;
- ao preencher contrato + vigencia + PDF e ativar, o cliente passe a `ativo`;
- exista um menu `Clientes` com leitura executiva e operacional do contrato.

## Regras de Negocio
1. `Lead criado`:
- executa `upsert` em `clientes` para evitar duplicidade;
- cria o lead vinculado ao `client_id`;
- cliente nasce com `status_cliente = 'lead'` ou `aguardando_contrato`.

2. `Lead fechado`:
- continua criando `deal`;
- cria `contract` com status `pendente_assinatura` ou `rascunho`;
- ainda nao marca automaticamente como contrato ativo.

3. `Contrato ativado`:
- exige dados principais preenchidos: numero, produto, consultor, inicio, validade;
- permite upload/substituicao de PDF;
- muda `contracts.status = 'ativo'`;
- muda `clientes.status_cliente = 'ativo'`;
- atualiza `clientes.active_contract_id`.

4. `Ciclo posterior`:
- `a vencer` quando estiver dentro da janela de alerta;
- `vencido` quando passar da vigencia;
- `cancelado` e `renovado` preservam historico.

## Modelo de Dados
### Nova tabela `clientes`
- `id`
- `origin_lead_id`
- `name`
- `company_name`
- `documento`
- `email`
- `phone`
- `whatsapp`
- `status_cliente`
- `consultor_responsavel_id`
- `produto_foco_id`
- `active_contract_id`
- `created_at`
- `updated_at`

### Nova tabela `contract_documents`
- `id`
- `contract_id`
- `client_id`
- `kind`
- `bucket`
- `path`
- `file_name`
- `mime_type`
- `file_size`
- `version`
- `uploaded_by`
- `uploaded_at`

### Extensoes em `contracts`
- `client_id`
- `start_at`
- `end_at`
- `pdf_bucket`
- `pdf_path`
- `pdf_file_name`
- `pdf_mime_type`
- `pdf_uploaded_at`
- `cancellation_reason`

### Extensoes em `leads`
- `client_id`

## Backend
### Arquivos-alvo
- `docs/commercial-mvp-schema.sql`
- `src/app/actions/pipeline.ts`
- `src/app/actions/clientes.ts`

### Mudancas
1. Adaptar `createLead`:
- criar ou localizar cliente;
- persistir `client_id` no lead;
- retornar metadata para UI exibir `Cliente criado`.

2. Adaptar `updateLeadStage`:
- manter criacao de `deal`;
- criar contrato com `pendente_assinatura`;
- sincronizar status do cliente para `aguardando_contrato`.

3. Criar actions novas:
- `saveClientContract`
- `uploadContractPdf`
- `activateContract`
- `cancelContract`
- `renewContract`

4. Backfill:
- criar clientes a partir dos leads ja existentes;
- ligar contratos antigos a clientes.

## Frontend
### CRM
- manter o quadro atual;
- adicionar chip de status por card:
  `Cliente criado`, `Contrato pendente`, `Contrato ativo`, `A vencer`, `Vencido`;
- incluir atalho `Abrir cliente`;
- exibir validade quando existir.

### Novo menu `Clientes`
Criar `/dashboard/clientes` com:
- cards de resumo: total de clientes, ativos, a vencer, sem PDF;
- tabela com colunas:
  `Cliente`, `Empresa`, `Status`, `Consultor responsavel`, `Produto`, `Inicio`, `Validade`, `Valor`, `PDF`, `Atualizado em`, `Acoes`;
- filtros por nome, empresa, status, consultor, produto e validade.

### Edicao
- usar drawer lateral para:
  `Dados do cliente`, `Contrato`, `Arquivos`;
- upload e substituicao de PDF no drawer;
- no CRM mostrar apenas resumo e atalhos.

## Permissoes
- adicionar modulo `Clientes` no fluxo de permissoes local:
  `src/app/dashboard/configuracoes/usuarios-section.tsx`
- refletir o menu em:
  `src/app/dashboard/layout.tsx`

## Ordem de Implementacao
1. Migration de dados e schema.
2. Actions e transicoes de negocio.
3. Menu `Clientes` + listagem + drawer.
4. Indicadores e chips dentro do CRM.
5. Backfill e validacao dos dados antigos.

## Riscos
- duplicidade de cliente sem regra forte de deduplicacao;
- contratos antigos sem cliente vinculado;
- PDF sem bucket/politicas adequadas no Supabase;
- confusao entre `lead.stage`, `clientes.status_cliente` e `contracts.status` se a fonte de verdade nao ficar clara.

## Decisoes Consolidadas
- `CRM` continua sendo o funil comercial.
- `Clientes` vira a camada contratual e de relacionamento.
- Fechar lead nao ativa automaticamente o contrato.
- Contrato ativo depende do preenchimento contratual e ativacao explicita.
