# Dicionário de colunas — leads_clickup_palin.csv

Arquivo: `leads_clickup_palin.csv` (9.401 linhas, UTF-8 com BOM, separador vírgula, 1ª linha = cabeçalho)

Salve este arquivo na pasta do projeto (ex: `palin-commercial-hub\leads_clickup_palin.csv`) e informe esse nome para o agente alterar o `ingest_leads.js` a ler e importar para o Supabase.

## Colunas

| Coluna | Descrição |
|---|---|
| `task_id` | ID original da tarefa no ClickUp (usar como referência/chave externa, não duplicar se já existir) |
| `nome_razao_social` | Nome da empresa/lead — usar como nome principal do registro |
| `nome_fantasia` | Nome fantasia/grupo, quando capturado |
| `cnpj_cpf` | CNPJ ou CPF, quando capturado (a maioria está vazio — normal, fase de prospecção raramente captura isso) |
| `cidade` | Cidade/UF |
| `telefones` | Um ou mais telefones já formatados, separados por `; ` |
| `email` | E-mail (já validado quanto ao formato) |
| `site` | Site da empresa, quando capturado |
| `socios` | Sócios, quando capturado |
| `cnae` | CNAE, quando capturado |
| `regime_tributario` | Regime tributário, quando capturado |
| `status_funil_origem` | Status da tarefa no CRM antigo (ex.: "em andamento", "suspenso") — guardar como histórico, não é o estágio novo |
| `tipo_lead_origem` | Tag de tipo de lead no CRM antigo (ex.: "Qualificado", "Sem Sucesso", "Cliente Palin") |
| `origem_lead` | Origem do lead no CRM antigo (ex.: "Pré-Vendas", "Agrishow") |
| `responsavel` | Quem atendia esse lead/cliente no CRM antigo |
| `data_criacao` | Data de criação da tarefa no CRM antigo (formato AAAA-MM-DD) |
| `tags` | Tags adicionais do CRM antigo |
| `duplicado_nome` | "Sim"/"Não" — indica se esse nome aparece em mais de uma linha do arquivo (normalmente porque a mesma empresa tem mais de uma frente de serviço: ICMS, PIS/COFINS, Rural etc. — não é erro de duplicidade, é informativo) |
| `tipo_registro` | "Cliente", "Cliente (inativo)" ou "Lead" |
| `estagio_kanban` | **Estágio de destino — ver mapeamento abaixo** |
| `importar_funil_ativo` | "Sim"/"Não" — quando "Não", o registro era "Sem Sucesso" no CRM antigo; decida se ele entra como arquivado/perdido ou se não entra no Supabase |
| `confianca_mapeamento` | "Alta", "Média" ou "Baixa" — confiança de que o `estagio_kanban` está correto. "Média"/"Baixa" merece revisão manual depois |
| `observacao_mapeamento` | Por que esse registro caiu nesse estágio |

## Mapeamento `estagio_kanban` → coluna real do Kanban

| Valor no CSV | Coluna no Kanban (Supabase) | Quantidade |
|---|---|---|
| `FECHAMENTO` | FECHAMENTO | 126 |
| `QUALIFICACAO` | QUALIFICAÇÃO | 208 |
| `CONTATO_INICIAL` | CONTATO INICIAL | 6.568 |
| `FORA_DO_FUNIL` | (não é uma das 5 colunas ativas — ver `importar_funil_ativo`) | 2.499 |

## Regras importantes para o script

1. **Não duplicar**: usar `task_id` como chave de controle de importação, e também checar `nome_razao_social` (normalizado, sem acento/maiúsculas) contra registros já existentes no Supabase antes de inserir.
2. Registros com `estagio_kanban = FECHAMENTO` devem ser tratados como **conta/cliente**, não como oportunidade nova no funil.
3. Registros com `estagio_kanban = FORA_DO_FUNIL` (2.499 linhas) **não devem ser inseridos nas 5 colunas ativas do Kanban**. Se o Supabase tiver uma tabela/status de "arquivado" ou "perdido", usar esse; senão, pular essas linhas e reportar a quantidade.
4. Ao final, gerar um relatório com: quantos registros foram inseridos por estágio, quantos foram pulados por duplicidade, quantos não tinham telefone nem e-mail.
