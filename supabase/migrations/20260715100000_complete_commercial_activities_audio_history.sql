-- Completa o historico comercial para audio, reunioes e ligacoes.
-- Idempotente: pode rodar mais de uma vez no Supabase SQL Editor.

ALTER TABLE public.commercial_activities
  ADD COLUMN IF NOT EXISTS lead_id UUID,
  ADD COLUMN IF NOT EXISTS deal_id UUID,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS contract_id UUID,
  ADD COLUMN IF NOT EXISTS meeting_id UUID,
  ADD COLUMN IF NOT EXISTS activity_type TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS agenda TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS next_step TEXT,
  ADD COLUMN IF NOT EXISTS next_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'registrada',
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS consultant_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS commercial_activities_lead_id_idx
  ON public.commercial_activities(lead_id);

CREATE INDEX IF NOT EXISTS commercial_activities_client_id_idx
  ON public.commercial_activities(client_id);

CREATE INDEX IF NOT EXISTS commercial_activities_meeting_id_idx
  ON public.commercial_activities(meeting_id);

CREATE INDEX IF NOT EXISTS commercial_activities_next_contact_at_idx
  ON public.commercial_activities(next_contact_at);

CREATE INDEX IF NOT EXISTS commercial_activities_created_at_idx
  ON public.commercial_activities(created_at DESC);
