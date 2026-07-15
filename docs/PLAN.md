# PLAN.md - Ajustes Mobile, Audio e Historico Comercial

## Goals
- Corrigir a proporcao do CRM mobile, especialmente o menu em semi-circulo em telas pequenas.
- Fazer audios gravados ou enviados pelo celular transcreverem corretamente.
- Garantir que audios/transcricoes virem historico no cadastro do cliente ou lead como reuniao, ligacao ou nota comercial.
- Padronizar todos os pontos do sistema que aceitam audio para usarem o mesmo fluxo confiavel.
- Deixar reunioes e ligacoes mais claras no texto, nos formularios e no historico: pauta, resumo, proximos passos e tipo de atividade.

## Scope
- Inclui mobile CRM, painel de clientes, detalhes do cliente, pipeline, agenda, APIs de audio/transcricao e actions de persistencia.
- Inclui ajustes de UX e nomenclatura para reuniao/ligacao.
- Inclui verificacao manual em viewport mobile e testes de API/action onde couber.
- Nao inclui redesenho completo do sistema, nova arquitetura de CRM, deploy, ou alteracoes fora dos fluxos de audio/mobile/historico.

## Affected Files
- `src/app/mobile/mobile-client.tsx`
- `src/app/dashboard/mobile-crm/mobile-client.tsx` se existir ou estiver ativo no roteamento
- `src/app/api/voice-note/route.ts`
- `src/app/api/meetings/transcribe/route.ts`
- `src/app/actions/commercial-activities.ts`
- `src/app/actions/agenda.ts`
- `src/app/actions/reunioes.ts`
- `src/app/dashboard/clientes/clientes-client.tsx`
- `src/app/dashboard/components/client-details-panel.tsx`
- `src/app/dashboard/pipeline/pipeline-board.tsx`
- `src/app/dashboard/agenda/agenda-manager.tsx`
- Arquivos de tipos, testes ou helpers compartilhados que ja existam para atividades comerciais, reunioes, leads/clientes e uploads.

## Investigation Checklist
- Confirmar qual componente mobile esta em uso na rota real e se ha duplicidade entre `src/app/mobile` e `src/app/dashboard/mobile-crm`.
- Mapear todos os botoes/campos de gravar ou subir audio e qual endpoint/action cada um chama.
- Verificar formato enviado pelo celular: MIME type, extensao, tamanho, `FormData`, blob gerado pelo `MediaRecorder` e compatibilidade iOS/Android.
- Conferir respostas e erros dos endpoints de transcricao, incluindo limites, idioma, nome do campo do arquivo e parsing do retorno.
- Verificar onde a transcricao deveria ser salva e se o cadastro do cliente/lead recebe `cliente_id`, `lead_id`, tipo de atividade e metadata corretos.
- Identificar labels atuais de reuniao/ligacao/pauta no UI e no banco para evitar divergencia de termos.
- Revisar logs/erros locais sem expor segredos de `.env.local`.

## Implementation Steps
1. Ajustar o layout mobile primeiro: reproduzir o problema do semi-circulo em viewport de celular, corrigir medidas responsivas e garantir que botoes nao saiam da tela nem sobreponham conteudo.
2. Unificar o fluxo de captura/upload de audio: normalizar nome do campo, MIME type aceito, validacao de tamanho, estado de loading/erro e envio por `FormData`.
3. Corrigir os endpoints de transcricao para aceitarem audios comuns de celular e retornarem estrutura consistente: texto, duracao quando disponivel, tipo sugerido e erro amigavel.
4. Corrigir persistencia: toda transcricao aprovada/salva deve criar atividade comercial vinculada ao cliente/lead correto, com tipo `reuniao`, `ligacao` ou `nota_audio`.
5. Atualizar UIs de cliente, pipeline e agenda para mostrar claramente se o registro e reuniao ou ligacao e separar pauta, resumo/notas e proximos passos.
6. Adicionar ou ajustar testes focados nos fluxos corrigidos e executar verificacoes manuais em mobile.

## Data Persistence Plan
- Usar `commercial-activities` como fonte principal de historico comercial quando ja for o padrao do projeto.
- Persistir no minimo: `client_id` ou `lead_id`, tipo da atividade, titulo claro, transcricao/resumo, pauta quando informada, proximos passos, origem `audio`, data/hora e usuario responsavel quando disponivel.
- Para reunioes vindas da agenda, manter relacionamento com a reuniao original se ja houver campo/ID para isso; caso contrario, salvar metadata suficiente para rastrear origem.
- Evitar criar historicos duplicados quando o usuario tenta reenviar o mesmo audio apos falha parcial.
- Garantir que o painel do cliente carregue atividades criadas por audio junto com o restante do historico.

## UI/Mobile Plan
- Corrigir o menu em semi-circulo usando limites por viewport: area maxima, safe-area mobile, tamanho minimo de toque e posicionamento que nao dependa de largura fixa.
- Validar em larguras de 360, 390, 430 e desktop estreito.
- Tornar estados de audio obvios: gravando, processando, transcrito, salvo no historico e falha recuperavel.
- Renomear secoes/labels para reduzir ambiguidade:
  - `Pauta da reuniao`
  - `Pauta da ligacao`
  - `Resumo da conversa`
  - `Proximos passos`
  - `Registrar como reuniao`
  - `Registrar como ligacao`
- Evitar cards aninhados e sobreposicoes; manter controles compactos e legiveis para uso recorrente no celular.

## Audio/Transcription Plan
- Verificar suporte a `audio/webm`, `audio/mp4`, `audio/m4a`, `audio/aac` e formatos gerados por Safari/Chrome mobile.
- Se necessario, ajustar a captura para escolher o melhor MIME type suportado pelo navegador.
- Centralizar tratamento de erros de transcricao: arquivo ausente, formato invalido, resposta vazia, limite excedido e falha da API externa.
- Padronizar retorno dos endpoints para todos os pontos de upload consumirem a mesma forma.
- Garantir que a transcricao em portugues seja priorizada quando o provedor aceitar idioma ou prompt/contexto.

## Verification Plan
- Rodar verificacao de build/lint/testes disponiveis no projeto apos implementacao.
- Testar manualmente no browser com viewport mobile:
  - abrir CRM mobile e confirmar semi-circulo/menu sem cortes ou sobreposicoes;
  - gravar audio curto e conferir transcricao;
  - salvar como ligacao e confirmar historico no cliente/lead;
  - salvar como reuniao e confirmar pauta/resumo/proximos passos;
  - enviar audio nos pontos de cliente, pipeline e agenda.
- Testar endpoints de audio com arquivos pequenos representando formatos de celular.
- Confirmar que erros aparecem de forma clara e que nova tentativa nao duplica historico.
- No fim da Fase 2, executar os scripts exigidos pelo workflow se existirem no workspace: `security_scan.py` e `lint_runner.py`; se nao existirem, registrar a ausencia e executar os comandos equivalentes do projeto.

## Risks/Questions
- Qual provedor/modelo de transcricao esta configurado e quais formatos ele aceita no ambiente atual?
- O banco ja tem campos suficientes para diferenciar pauta, resumo e proximos passos, ou sera preciso armazenar parte em metadata/texto estruturado?
- Existem dois componentes mobile parecidos; sera necessario confirmar a rota ativa antes de editar.
- Audios reais de iPhone podem chegar em formato diferente do Chrome desktop; a validacao precisa cobrir isso.
- Regras de permissao/RLS podem impedir criacao de historico dependendo do usuario logado.

## Agent Phase 2 Assignment Map
- `frontend-specialist`: corrigir layout mobile/semi-circulo, estados de gravacao/upload, labels de ligacao/reuniao e exibicao do historico nos paineis.
- `backend-specialist`: corrigir endpoints de transcricao, normalizacao de audio, actions de persistencia e vinculo com cliente/lead/reuniao.
- `test-engineer`: montar casos de verificacao, testar endpoints/actions, validar mobile por viewport e executar build/lint/testes.
- `database-architect`: revisar esquema/relacionamentos de atividades, reunioes, clientes e leads para evitar duplicidade e perda de historico.
- `security-auditor`: revisar upload de audio, tamanho/formato aceito, autenticacao, permissao de escrita e exposicao de dados sensiveis.
- `devops-engineer`: validar variaveis de ambiente de transcricao e preparar checklist de deploy/verificacao sem executar deploy antes de aprovacao.
