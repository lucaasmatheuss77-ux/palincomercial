# PLAN — Histórico de Reuniões por Cliente

## Objetivo
Adicionar ao cadastro de cada cliente uma aba **Reuniões** com:
- registro de reuniões vinculadas ao cliente
- link da gravação
- pauta gerada por IA (ou manual) com base no conteúdo da reunião
- sequência cronológica das reuniões com datas

---

## Regras de Negócio

1. Uma reunião pertence a um cliente (`client_id`).
2. Cada reunião tem: data, título, link da gravação, pauta (texto livre ou gerado por IA), participantes e notas adicionais.
3. A listagem deve ser ordenada por `meeting_date DESC` — mais recente primeiro.
4. O botão **"Gerar Pauta com IA"** envia o link + contexto do cliente para a OpenAI e retorna um resumo estruturado.
5. Qualquer usuário autenticado pode registrar reunião; apenas admin/gestor pode excluir.
6. A pauta gerada pela IA é editável antes de salvar.

---

## Modelo de Dados

### Nova tabela `client_meetings`

```sql
CREATE TABLE client_meetings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  meeting_date    date NOT NULL,
  title           text NOT NULL,
  recording_link  text,
  pauta           text,
  notes           text,
  participants    text,
  duration_min    integer,
  ai_generated    boolean DEFAULT false,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Índice para buscas por cliente
CREATE INDEX idx_client_meetings_client_id ON client_meetings(client_id);
CREATE INDEX idx_client_meetings_date      ON client_meetings(client_id, meeting_date DESC);

-- RLS
ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_users" ON client_meetings
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## Backend

### Arquivo novo: `src/app/actions/reunioes.ts`

Funções a implementar:

| Função | Descrição |
|--------|-----------|
| `listClientMeetings(clientId)` | Lista reuniões do cliente ordenadas por data DESC |
| `createClientMeeting(clientId, data)` | Cria nova reunião |
| `updateClientMeeting(meetingId, data)` | Atualiza reunião existente |
| `deleteClientMeeting(meetingId)` | Exclui reunião (apenas admin/gestor) |

### Arquivo novo: `src/app/api/assistant/pauta/route.ts`

- Recebe: `{ clientName, recordingLink, additionalContext? }`
- Chama OpenAI (gpt-4o-mini) com prompt especializado
- Retorna: pauta estruturada em markdown com tópicos, decisões e próximos passos

---

## Frontend

### Tipo novo em `clientes-client.tsx`

```ts
export type MeetingRow = {
  id: string
  meetingDate: string
  title: string
  recordingLink: string | null
  pauta: string | null
  notes: string | null
  participants: string | null
  durationMin: number | null
  aiGenerated: boolean
  createdAt: string
}
```

### Aba "Reuniões" no drawer do cliente

O drawer atual já tem abas (Dados / Contrato / Arquivos / Histórico).
Adicionar nova aba **Reuniões** com:

1. **Header**: contador de reuniões + botão "Nova Reunião"
2. **Lista cronológica**: cards com data, título, link (ícone externo), preview da pauta
3. **Formulário inline** (expande ao clicar "Nova Reunião"):
   - Data da reunião
   - Título
   - Link da gravação
   - Participantes
   - Duração (min)
   - Pauta (textarea editável)
   - Botão **"Gerar Pauta com IA"** → chama `/api/assistant/pauta` e preenche o campo
4. **Card de cada reunião**: expansível para ver a pauta completa

### Fluxo do botão "Gerar Pauta com IA"

```
Usuário preenche link → clica "Gerar Pauta"
  → POST /api/assistant/pauta
  → OpenAI retorna texto estruturado
  → Campo pauta é preenchido automaticamente
  → Usuário revisa e salva
```

---

## Ordem de Implementação

| # | Etapa | Arquivo(s) |
|---|-------|------------|
| 1 | SQL da tabela | `docs/reunioes-schema.sql` |
| 2 | Server actions CRUD | `src/app/actions/reunioes.ts` |
| 3 | API route IA pauta | `src/app/api/assistant/pauta/route.ts` |
| 4 | Tipos no cliente-client | `clientes-client.tsx` (MeetingRow) |
| 5 | Aba Reuniões no drawer | `clientes-client.tsx` (nova aba) |
| 6 | Integrar dados na page | `src/app/dashboard/clientes/page.tsx` |

---

## Riscos e Decisões

| Risco | Decisão |
|-------|---------|
| Link de gravação pode ser Google Meet, Zoom, Loom — IA não acessa o vídeo | IA usa apenas o link + contexto do cliente para gerar pauta sugerida; usuário complementa |
| Pauta muito longa | Limitar a 800 tokens na resposta da IA |
| Exclusão acidental | Confirmar exclusão com dialog antes de deletar |
| Muitas reuniões por cliente | Paginação simples com "mostrar mais" |
