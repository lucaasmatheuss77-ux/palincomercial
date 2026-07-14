-- Varias telas do sistema (Metas, Comissoes, Planejamento) foram escritas contra
-- tabelas que nunca chegaram a ser migradas de verdade. Por isso "criar/editar"
-- nessas telas falhava silenciosamente. Esta migration cria o que falta.

-- ═══════════════════════════════════════════════════════════════════════════
-- METAS: tabela sales_goals (cards "Metas criadas no sistema" em /dashboard/metas)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  goal_contracts INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_goals_period_idx ON public.sales_goals(period);

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read sales_goals"
ON public.sales_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert sales_goals"
ON public.sales_goals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update sales_goals"
ON public.sales_goals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete sales_goals"
ON public.sales_goals FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- COMISSOES: commission_rules (regras por produto) + commissions (lancamentos)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  base_rate NUMERIC DEFAULT 0,
  base_fixed NUMERIC DEFAULT 0,
  recurrent_rate NUMERIC DEFAULT 0,
  sdr_rate NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read commission_rules"
ON public.commission_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert commission_rules"
ON public.commission_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update commission_rules"
ON public.commission_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete commission_rules"
ON public.commission_rules FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'MANUAL',
  commission_type TEXT DEFAULT 'MANUAL',
  valor_liberacao NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  variavel_paga BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commissions_deal_id_idx ON public.commissions(deal_id);
CREATE INDEX IF NOT EXISTS commissions_profile_id_idx ON public.commissions(profile_id);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read commissions"
ON public.commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert commissions"
ON public.commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update commissions"
ON public.commissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete commissions"
ON public.commissions FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- PLANEJAMENTO ESTRATEGICO: itens/metas que o usuario pode criar e acompanhar
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.strategic_plan_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'geral',
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_path TEXT,
  file_name TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategic_plan_items_status_idx ON public.strategic_plan_items(status);

ALTER TABLE public.strategic_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read strategic_plan_items"
ON public.strategic_plan_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert strategic_plan_items"
ON public.strategic_plan_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update strategic_plan_items"
ON public.strategic_plan_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete strategic_plan_items"
ON public.strategic_plan_items FOR DELETE TO authenticated USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- CLUBE / JORNADA: anexos (documento, audio, video) por etapa da jornada
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.club_onboarding_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.club_members(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_onboarding_attachments_member_step_idx ON public.club_onboarding_attachments(member_id, step_id);

ALTER TABLE public.club_onboarding_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read club_onboarding_attachments"
ON public.club_onboarding_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert club_onboarding_attachments"
ON public.club_onboarding_attachments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update club_onboarding_attachments"
ON public.club_onboarding_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users to delete club_onboarding_attachments"
ON public.club_onboarding_attachments FOR DELETE TO authenticated USING (true);

-- Bucket de storage para os anexos da jornada (documentos/audio/video)
INSERT INTO storage.buckets (id, name, public)
VALUES ('clube-jornada', 'clube-jornada', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to read clube-jornada objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clube-jornada');

CREATE POLICY "Allow authenticated users to upload clube-jornada objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clube-jornada');

CREATE POLICY "Allow authenticated users to delete clube-jornada objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clube-jornada');

-- Bucket de storage para os documentos anexados aos itens do Planejamento Estrategico
INSERT INTO storage.buckets (id, name, public)
VALUES ('strategic-plan', 'strategic-plan', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated users to read strategic-plan objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'strategic-plan');

CREATE POLICY "Allow authenticated users to upload strategic-plan objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'strategic-plan');

CREATE POLICY "Allow authenticated users to delete strategic-plan objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'strategic-plan');
