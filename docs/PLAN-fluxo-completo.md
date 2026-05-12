# PLAN — Fluxo Completo: Cliente → Lead → CRM → Ligações → Fechamento

## Objetivo
Fechar todas as lacunas do processo comercial dentro do sistema:
1. Todo cliente cadastrado entra automaticamente no CRM como lead
2. Ligações via GoTo ficam registradas no histórico do lead/cliente
3. Notificações em tempo real quando o lead avança de etapa
4. Transcrição/pauta automática via IA para ligações e reuniões
5. Assinatura de documentos externa linkada ao contrato no sistema

---

## Problemas Atuais Identificados

| Problema | Onde | Impacto |
|----------|------|---------|
| Cliente criado sem CRM stage não vira lead automaticamente | `createClientRecord` só cria lead se `crmStage` for selecionado | Leads perdidos no sistema |
| Ligações GoTo não registradas no sistema | Nenhuma integração existe | Histórico comercial incompleto |
| Nenhuma notificação quando lead avança | Sem Supabase Realtime | Consultor perde contexto |
| Assinatura de documento (externa) não vinculada | Campo `pdf_path` existe mas link manual | Rastreabilidade quebrada |

---

## Solução 1 — Cliente → Lead Automático (Obrigatório)

### Comportamento atual
- Formulário de criação tem campo "Etapa no CRM" opcional
- Se não escolhido, cliente é criado SEM lead vinculado

### Comportamento novo
- Ao criar cliente, **sempre** cria um lead em `Contato Inicial`
- Campo "Etapa no CRM" vira "Etapa inicial" com default = `Contato Inicial`
- O consultor pode escolher uma etapa diferente se já estiver mais avançado
- Fluxo único: `Cliente criado → Lead em Contato Inicial → CRM`

### Arquivo alvo
- `src/app/actions/clientes.ts` → `createClientRecord`: remover condicional `if (crmStage)`, sempre criar lead com `Contato Inicial` como padrão
- `src/app/dashboard/clientes/clientes-client.tsx` → formulário: campo CRM com valor padrão `Contato Inicial`

---

## Solução 2 — Registro de Ligações GoTo

### Como o GoTo funciona
GoToConnect/GoToMeeting tem API REST mas requer OAuth corporativo.
**Abordagem pragmática**: botão "Registrar Ligação GoTo" dentro do card do lead/cliente que:
- Salva uma `commercial_activity` do tipo `ligacao_goto`
- Registra: duração, resultado (atendeu / não atendeu / recado), link da gravação (se houver)
- Aparece no histórico do lead e do cliente

### Nova tabela `call_logs` (extensão de commercial_activities)
Campos extras no registro de ligação:
- `call_type`: `goto_meeting` | `goto_connect` | `manual`
- `call_duration_min`: duração em minutos
- `call_outcome`: `atendeu` | `nao_atendeu` | `recado` | `reagendado`
- `goto_recording_url`: link da gravação no GoTo
- `goto_meeting_id`: ID da reunião no GoTo (opcional)

### Arquivos novos
- `src/app/actions/ligacoes.ts` → CRUD de ligações
- Botão "Ligar via GoTo" no card do lead (pipeline-board) → abre GoTo + registra log
- Botão "Ligar via GoTo" no drawer do cliente

### Deep link GoTo
GoToConnect suporta deep link: `gotomeeting://join?meetingId=XXX`
GoToConnect call: `tel:+NUMERO` abre discador GoTo se instalado

---

## Solução 3 — Notificações em Tempo Real (Supabase Realtime)

### Eventos que disparam notificação
| Evento | Notificado | Mensagem |
|--------|-----------|----------|
| Lead avança de etapa | Consultor responsável | "Lead [Nome] avançou para [Etapa]" |
| Reunião agendada | Consultor responsável | "Reunião com [Nome] em [Data]" |
| Contrato ativado | Gestor + Consultor | "Contrato de [Cliente] ativado" |
| Lead parado há 7+ dias | Consultor | "Lead [Nome] sem atividade há 7 dias" |

### Implementação
- `src/components/notification-bell.tsx` — ícone de sino no header com badge
- Supabase Realtime escutando `commercial_activities` INSERT
- Toast automático quando chega notificação relevante para o usuário logado
- Painel de notificações (últimas 20)

### Arquivos alvo
- `src/app/dashboard/layout.tsx` → adicionar `NotificationBell` no header
- `src/components/notification-bell.tsx` → novo componente
- `src/lib/supabase/realtime.ts` → helper de subscrição

---

## Solução 4 — Link de Assinatura Externa no Contrato

### Comportamento
- Campo `signing_url` no contrato → link da plataforma de assinatura (DocuSign, Clicksign, etc.)
- Status `aguardando_assinatura` → quando link foi gerado mas não foi assinado
- Botão "Abrir para assinar" → abre a plataforma externa
- Quando retorna assinado → consultor marca como `ativo` no sistema

### Arquivos alvo
- Extensão em `contracts` no Supabase: coluna `signing_url text`
- `src/app/actions/clientes.ts` → `saveClientContract` aceita `signing_url`
- Drawer do cliente → exibir link de assinatura

---

## Fluxo Completo Esperado Após Implementação

```
1. CADASTRO
   Novo cliente → cria automaticamente lead em "Contato Inicial"
   ↓
2. PRIMEIRO CONTATO
   Consultor clica "Ligar via GoTo" → abre GoTo → registra log da ligação
   Lead avança para "Qualificacao" → notificação ao consultor
   ↓
3. REUNIÃO
   Reunião agendada no sistema → aparece na Agenda
   Após reunião → cola link GoTo/Zoom na aba Reuniões → IA gera pauta
   Lead avança para "Apresentacao" → notificação
   ↓
4. PROPOSTA / NEGOCIAÇÃO
   Lead avança → notificações em cada etapa
   ↓
5. FECHAMENTO
   Lead vai para "Fechado" → deal + contrato criados automaticamente
   Consultor gera link de assinatura (Clicksign) → salva no contrato
   Botão "Abrir para assinar" → cliente assina externamente
   Consultor confirma → contrato ativado → cliente status = "ativo"
```

---

## Ordem de Implementação

| # | Solução | Impacto | Tempo estimado |
|---|---------|---------|----------------|
| 1 | Cliente → Lead automático | CRÍTICO | Pequeno |
| 2 | Notificações Realtime | ALTO | Médio |
| 3 | Registro de ligações GoTo | ALTO | Médio |
| 4 | Link de assinatura externa | MÉDIO | Pequeno |

---

## SQL Necessário

```sql
-- Coluna de URL de assinatura nos contratos
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signing_url text;

-- Índice para ligações por lead
CREATE INDEX IF NOT EXISTS idx_commercial_activities_type 
  ON commercial_activities(activity_type);
```
