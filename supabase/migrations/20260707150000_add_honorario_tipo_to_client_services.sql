ALTER TABLE public.client_services
  ADD COLUMN IF NOT EXISTS tipo_honorario TEXT NOT NULL DEFAULT 'percentual',
  ADD COLUMN IF NOT EXISTS base_calculo TEXT;
