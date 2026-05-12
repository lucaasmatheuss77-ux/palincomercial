-- ============================================================
-- SCHEMA: Histórico de Reuniões por Cliente
-- Rodar no Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS client_meetings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  meeting_date   date NOT NULL,
  title          text NOT NULL,
  recording_link text,
  pauta          text,
  notes          text,
  participants   text,
  duration_min   integer,
  ai_generated   boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_client_meetings_client_id
  ON client_meetings(client_id);

CREATE INDEX IF NOT EXISTS idx_client_meetings_date
  ON client_meetings(client_id, meeting_date DESC);

-- RLS
ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler e inserir
CREATE POLICY "client_meetings_select"
  ON client_meetings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "client_meetings_insert"
  ON client_meetings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "client_meetings_update"
  ON client_meetings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Exclusão: apenas o criador ou admin (filtro de role feito na action)
CREATE POLICY "client_meetings_delete"
  ON client_meetings FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION update_client_meetings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_meetings_updated_at
  BEFORE UPDATE ON client_meetings
  FOR EACH ROW EXECUTE FUNCTION update_client_meetings_updated_at();
