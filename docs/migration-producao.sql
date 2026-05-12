-- ============================================================
-- MIGRAÇÃO DE PRODUÇÃO — Palin Commercial Hub
-- Rodar no Supabase > SQL Editor
-- Ordem: execute bloco a bloco ou tudo de uma vez (são idempotentes)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. COLUNA signing_url NA TABELA contracts
-- ─────────────────────────────────────────────────────────────
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS signing_url text;

-- ─────────────────────────────────────────────────────────────
-- 2. NOVOS CAMPOS EM ai_qualifications (inteligência de 4 agentes)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ai_qualifications
  ADD COLUMN IF NOT EXISTS match_icp                    integer,
  ADD COLUMN IF NOT EXISTS prioridade_comercial         text CHECK (prioridade_comercial IN ('baixa','media','alta')),
  ADD COLUMN IF NOT EXISTS dor_principal                text,
  ADD COLUMN IF NOT EXISTS potencial_financeiro_detalhado text;

-- ─────────────────────────────────────────────────────────────
-- 3. TABELA lead_intelligence_history (histórico de análises da IA)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_intelligence_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  full_markdown text,
  report_json   jsonb,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_intelligence_lead_id
  ON lead_intelligence_history(lead_id, created_at DESC);

ALTER TABLE lead_intelligence_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_intelligence_authenticated" ON lead_intelligence_history;
CREATE POLICY "lead_intelligence_authenticated"
  ON lead_intelligence_history FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_intelligence_history TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. TABELA client_meetings (histórico de reuniões por cliente)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_meetings (
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

CREATE INDEX IF NOT EXISTS idx_client_meetings_client_id
  ON client_meetings(client_id);

CREATE INDEX IF NOT EXISTS idx_client_meetings_date
  ON client_meetings(client_id, meeting_date DESC);

ALTER TABLE client_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_meetings_select" ON client_meetings;
CREATE POLICY "client_meetings_select"
  ON client_meetings FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_meetings_insert" ON client_meetings;
CREATE POLICY "client_meetings_insert"
  ON client_meetings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_meetings_update" ON client_meetings;
CREATE POLICY "client_meetings_update"
  ON client_meetings FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "client_meetings_delete" ON client_meetings;
CREATE POLICY "client_meetings_delete"
  ON client_meetings FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_client_meetings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_meetings_updated_at ON client_meetings;
CREATE TRIGGER trg_client_meetings_updated_at
  BEFORE UPDATE ON client_meetings
  FOR EACH ROW EXECUTE FUNCTION update_client_meetings_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_meetings TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. ÍNDICES DE PERFORMANCE
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_commercial_activities_type
  ON commercial_activities(activity_type);

CREATE INDEX IF NOT EXISTS idx_commercial_activities_lead_created
  ON commercial_activities(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_stage
  ON leads(stage);

CREATE INDEX IF NOT EXISTS idx_leads_consultant
  ON leads(consultant_id);

CREATE INDEX IF NOT EXISTS idx_contracts_signing_url
  ON contracts(signing_url) WHERE signing_url IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- FIM DA MIGRAÇÃO
-- ============================================================
