-- ============================================================
-- Migração: SQLite → Supabase
-- Data: 2026-04-14
-- Descrição: Move meetings, tasks, logistics, events, app_users,
--            user_permissions, settings e lead_contacts do
--            banco local (SQLite) para o Supabase com RLS.
-- ============================================================

-- ─── SETTINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.settings (key, value) VALUES
  ('revenue_meta',   '0'),
  ('contracts_meta', '54')
ON CONFLICT (key) DO NOTHING;

-- ─── MEETINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meetings (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title                  TEXT NOT NULL,
  scheduled_for          TIMESTAMPTZ NOT NULL,
  ends_at                TIMESTAMPTZ,
  location               TEXT,
  meeting_type           TEXT DEFAULT 'Presencial',
  status                 TEXT NOT NULL DEFAULT 'agendada',
  lead_id                TEXT,
  lead_name              TEXT,
  company_name           TEXT,
  client_id              TEXT,
  deal_id                TEXT,
  contract_id            TEXT,
  objective              TEXT,
  notes                  TEXT,
  agenda                 TEXT,
  summary                TEXT,
  next_step              TEXT,
  next_contact_at        TIMESTAMPTZ,
  commercial_activity_id TEXT,
  owner_profile_id       TEXT,
  owner_name             TEXT,
  requires_logistics     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_lead_id          ON public.meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_client_id        ON public.meetings(client_id);
CREATE INDEX IF NOT EXISTS idx_meetings_deal_id          ON public.meetings(deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_owner_profile_id ON public.meetings(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_meetings_next_contact_at  ON public.meetings(next_contact_at);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_for    ON public.meetings(scheduled_for);

-- ─── MEETING TASKS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_tasks (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  meeting_id       TEXT REFERENCES public.meetings(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  due_at           TIMESTAMPTZ,
  priority         TEXT NOT NULL DEFAULT 'Media',
  status           TEXT NOT NULL DEFAULT 'aberta',
  owner_profile_id TEXT,
  owner_name       TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_tasks_meeting_id ON public.meeting_tasks(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_tasks_status     ON public.meeting_tasks(status);

-- ─── MEETING LOGISTICS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_logistics (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  meeting_id TEXT REFERENCES public.meetings(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  detail     TEXT,
  status     TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_logistics_meeting_id ON public.meeting_logistics(meeting_id);

-- ─── EVENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'proprio',
  date       TEXT NOT NULL DEFAULT 'A definir',
  local      TEXT NOT NULL DEFAULT 'A definir',
  capacidade INTEGER NOT NULL DEFAULT 30,
  inscritos  INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'planejamento',
  produto    TEXT NOT NULL DEFAULT 'Geral',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);

-- ─── APP USERS (equipe interna) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'Consultor',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  phone         TEXT,
  whatsapp      TEXT,
  cargo_titulo  TEXT,
  data_admissao DATE,
  produto_foco  TEXT,
  product_id    TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users(email);

-- ─── USER PERMISSIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  module     TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit   BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);

-- ─── LEAD CONTACTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_contacts (
  lead_id    TEXT PRIMARY KEY,
  phone      TEXT,
  whatsapp   TEXT,
  email      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BACKUPS LOG ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tables     TEXT[] NOT NULL,
  row_counts JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'ok',
  triggered_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS — Row Level Security
-- Todas as tabelas ficam acessíveis apenas para usuários
-- autenticados. Ajuste as policies conforme necessidade.
-- ============================================================

ALTER TABLE public.settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs       ENABLE ROW LEVEL SECURITY;

-- Política padrão: apenas usuários autenticados
CREATE POLICY "Autenticados podem ler settings"
  ON public.settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem editar settings"
  ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ler meetings"
  ON public.meetings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir meetings"
  ON public.meetings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem editar meetings"
  ON public.meetings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem deletar meetings"
  ON public.meetings FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem acessar meeting_tasks"
  ON public.meeting_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem acessar meeting_logistics"
  ON public.meeting_logistics FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem acessar events"
  ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ler app_users"
  ON public.app_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir app_users"
  ON public.app_users FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem editar app_users"
  ON public.app_users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem deletar app_users"
  ON public.app_users FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem acessar user_permissions"
  ON public.user_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem acessar lead_contacts"
  ON public.lead_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Autenticados podem ler backup_logs"
  ON public.backup_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role insere backup_logs"
  ON public.backup_logs FOR INSERT TO authenticated WITH CHECK (true);
