ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS regime_tributario TEXT,
  ADD COLUMN IF NOT EXISTS faturamento_estimado NUMERIC,
  ADD COLUMN IF NOT EXISTS segmento_especifico TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_cnpj_digits_idx
  ON public.leads (regexp_replace(cnpj, '\D', '', 'g'))
  WHERE cnpj IS NOT NULL;
