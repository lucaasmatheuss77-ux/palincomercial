-- ============================================================
-- PALIN COMMERCIAL HUB — SCHEMA MASTER
-- Execute TUDO de uma vez no SQL Editor do Supabase
-- URL: https://bjdjgnfxbacbbmbqnuxj.supabase.co
-- ============================================================

-- ─── HELPER: updated_at trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN new.updated_at = timezone('utc', now()); RETURN new; END; $$;

-- ============================================================
-- 1. PROFILES (base — sempre primeiro)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  email         TEXT,
  role          TEXT DEFAULT 'consultor',
  avatar_url    TEXT,
  avatar_skin   TEXT,
  phone         TEXT,
  whatsapp      TEXT,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self ON public.profiles;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  ) ON CONFLICT (id) DO NOTHING;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE,
  description TEXT,
  price       NUMERIC(12,2),
  category    TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_auth ON public.products;
CREATE POLICY products_auth ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed básico de produtos
INSERT INTO public.products (name, slug, description, active)
VALUES
  ('Insider Club', 'insider-club', 'Programa de mentoria e assessoria tributária', TRUE),
  ('Planejamento Tributário', 'planejamento-tributario', 'Consultoria de planejamento fiscal', TRUE),
  ('Assessoria Completa', 'assessoria-completa', 'Assessoria tributária completa', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. LEADS (CRM pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  whatsapp              TEXT,
  company_name          TEXT,
  stage                 TEXT DEFAULT 'Contato Inicial',
  score                 INTEGER DEFAULT 0,
  temperature           TEXT DEFAULT 'morno',
  product_id            UUID REFERENCES public.products(id),
  consultant_id         UUID REFERENCES public.profiles(id),
  segmento              TEXT,
  segmento_especifico   TEXT,
  origem                TEXT,
  cidade                TEXT,
  estado                TEXT,
  notas                 TEXT,
  expected_value        NUMERIC(12,2),
  probability           INTEGER DEFAULT 0,
  last_contact_at       TIMESTAMPTZ,
  next_contact_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_stage_idx       ON public.leads(stage);
CREATE INDEX IF NOT EXISTS leads_consultant_idx  ON public.leads(consultant_id);
CREATE INDEX IF NOT EXISTS leads_created_at_idx  ON public.leads(created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leads_auth ON public.leads;
CREATE POLICY leads_auth ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. CLIENTES (clientes do Clube / CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clientes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  whatsapp          TEXT,
  company_name      TEXT,
  documento         TEXT,
  segmento          TEXT,
  cidade            TEXT,
  estado            TEXT,
  status_cliente    TEXT DEFAULT 'ativo',
  origin_lead_id    UUID REFERENCES public.leads(id),
  product_id        UUID REFERENCES public.products(id),
  consultant_id     UUID REFERENCES public.profiles(id),
  notas             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clientes_status_idx       ON public.clientes(status_cliente);
CREATE INDEX IF NOT EXISTS clientes_consultant_idx   ON public.clientes(consultant_id);
CREATE INDEX IF NOT EXISTS clientes_email_idx        ON public.clientes(lower(email)) WHERE email IS NOT NULL;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clientes_auth ON public.clientes;
CREATE POLICY clientes_auth ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS clientes_updated_at ON public.clientes;
CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. DEALS (negócios)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id),
  client_id       UUID REFERENCES public.clientes(id),
  consultant_id   UUID REFERENCES public.profiles(id),
  product_id      UUID REFERENCES public.products(id),
  value           NUMERIC(12,2),
  stage           TEXT DEFAULT 'aberto',
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deals_auth ON public.deals;
CREATE POLICY deals_auth ON public.deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 6. CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id),
  client_id       UUID REFERENCES public.clientes(id),
  deal_id         UUID REFERENCES public.deals(id),
  consultant_id   UUID REFERENCES public.profiles(id),
  product_id      UUID REFERENCES public.products(id),
  value           NUMERIC(12,2),
  status          TEXT DEFAULT 'ativo',
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contracts_status_idx    ON public.contracts(status);
CREATE INDEX IF NOT EXISTS contracts_client_idx    ON public.contracts(client_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contracts_auth ON public.contracts;
CREATE POLICY contracts_auth ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS contracts_updated_at ON public.contracts;
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. COMMERCIAL ACTIVITIES (histórico de interações)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.commercial_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id),
  client_id       UUID REFERENCES public.clientes(id),
  deal_id         UUID REFERENCES public.deals(id),
  contract_id     UUID REFERENCES public.contracts(id),
  consultant_id   UUID REFERENCES public.profiles(id),
  created_by      UUID REFERENCES public.profiles(id),
  activity_type   TEXT NOT NULL DEFAULT 'nota',
  subject         TEXT,
  summary         TEXT,
  description     TEXT,
  next_step       TEXT,
  status          TEXT DEFAULT 'registrada',
  next_contact_at TIMESTAMPTZ,
  meeting_id      UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activities_lead_idx   ON public.commercial_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activities_client_idx ON public.commercial_activities(client_id, created_at DESC);

ALTER TABLE public.commercial_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activities_auth ON public.commercial_activities;
CREATE POLICY activities_auth ON public.commercial_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS activities_updated_at ON public.commercial_activities;
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.commercial_activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. MEETINGS / AGENDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meetings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  scheduled_for          TIMESTAMPTZ NOT NULL,
  ends_at                TIMESTAMPTZ,
  location               TEXT,
  meeting_type           TEXT DEFAULT 'Presencial',
  status                 TEXT NOT NULL DEFAULT 'agendada',
  lead_id                UUID REFERENCES public.leads(id),
  lead_name              TEXT,
  company_name           TEXT,
  client_id              UUID REFERENCES public.clientes(id),
  deal_id                UUID REFERENCES public.deals(id),
  contract_id            UUID REFERENCES public.contracts(id),
  objective              TEXT,
  notes                  TEXT,
  agenda                 TEXT,
  summary                TEXT,
  next_step              TEXT,
  next_contact_at        TIMESTAMPTZ,
  owner_profile_id       UUID REFERENCES public.profiles(id),
  owner_name             TEXT,
  requires_logistics     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meetings_scheduled_idx  ON public.meetings(scheduled_for);
CREATE INDEX IF NOT EXISTS meetings_owner_idx      ON public.meetings(owner_profile_id);
CREATE INDEX IF NOT EXISTS meetings_lead_idx       ON public.meetings(lead_id);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_auth ON public.meetings;
CREATE POLICY meetings_auth ON public.meetings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 9. EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  date        TEXT NOT NULL DEFAULT 'A definir',
  location    TEXT,
  status      TEXT DEFAULT 'planejamento',
  type        TEXT DEFAULT 'proprio',
  capacity    INTEGER DEFAULT 30,
  enrolled    INTEGER DEFAULT 0,
  product_id  UUID REFERENCES public.products(id),
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS events_auth ON public.events;
CREATE POLICY events_auth ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 10. CLUB MEMBERS (Insider Club)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.club_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contract_start  DATE,
  contract_end    DATE,
  status          TEXT NOT NULL DEFAULT 'ativo'
                    CHECK (status IN ('ativo','em_renovacao','inativo')),
  tier            TEXT NOT NULL DEFAULT 'standard'
                    CHECK (tier IN ('standard','plus','vip')),
  mentor_id       UUID REFERENCES public.profiles(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS club_members_status_idx ON public.club_members(status);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS club_members_auth ON public.club_members;
CREATE POLICY club_members_auth ON public.club_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS club_members_updated_at ON public.club_members;
CREATE TRIGGER club_members_updated_at BEFORE UPDATE ON public.club_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 11. CLUB DELIVERABLES (entregas, tarefas, treinamentos)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.club_deliverables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'mentoria'
                CHECK (category IN ('mentoria','conteudo','material','evento')),
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','concluido','atrasado')),
  is_global   BOOLEAN DEFAULT TRUE,
  member_id   UUID REFERENCES public.club_members(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS club_deliverables_member_idx ON public.club_deliverables(member_id);
CREATE INDEX IF NOT EXISTS club_deliverables_status_idx ON public.club_deliverables(status);

ALTER TABLE public.club_deliverables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS club_deliverables_auth ON public.club_deliverables;
CREATE POLICY club_deliverables_auth ON public.club_deliverables FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS club_deliverables_updated_at ON public.club_deliverables;
CREATE TRIGGER club_deliverables_updated_at BEFORE UPDATE ON public.club_deliverables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 12. GOALS & TARGETS (metas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          TEXT DEFAULT 'ativo',
  consultant_id   UUID REFERENCES public.profiles(id),
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goals_auth ON public.goals;
CREATE POLICY goals_auth ON public.goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.goal_targets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id     UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  metric      TEXT NOT NULL,
  target      NUMERIC(12,2) NOT NULL,
  current     NUMERIC(12,2) DEFAULT 0,
  scope_type  TEXT DEFAULT 'individual',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.goal_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS goal_targets_auth ON public.goal_targets;
CREATE POLICY goal_targets_auth ON public.goal_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 13. AI QUALIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_qualifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  score           INTEGER DEFAULT 0,
  summary         TEXT,
  strengths       TEXT[],
  weaknesses      TEXT[],
  recommendation  TEXT,
  model_used      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_qualifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_qual_auth ON public.ai_qualifications;
CREATE POLICY ai_qual_auth ON public.ai_qualifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 14. LEAD STAGE EVENTS (histórico de pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_stage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  from_stage    TEXT,
  to_stage      TEXT NOT NULL,
  changed_by    UUID REFERENCES public.profiles(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lead_stage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_stage_events_auth ON public.lead_stage_events;
CREATE POLICY lead_stage_events_auth ON public.lead_stage_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 15. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.settings (key, value) VALUES
  ('revenue_meta',   '0'),
  ('contracts_meta', '54')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_auth ON public.settings;
CREATE POLICY settings_auth ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 16. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT DEFAULT 'info',
  read        BOOLEAN DEFAULT FALSE,
  link        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 17. STORAGE — bucket para PDFs de contratos
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-pdfs', 'contract-pdfs', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_deliverables    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_targets         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_qualifications    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_stage_events    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications        TO authenticated;

-- ============================================================
-- FIM — Schema Palin Commercial Hub
-- ============================================================
