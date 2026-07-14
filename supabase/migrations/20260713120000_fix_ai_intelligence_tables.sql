-- ai_qualifications: a linha ja existe no banco, mas sem as colunas que o app
-- realmente le/escreve (status, source, reviewed_at). Sem isso, toda gravacao
-- e leitura de qualificacao de IA falha silenciosamente com "column not found".
ALTER TABLE public.ai_qualifications
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_qualifications_lead_id_key'
  ) THEN
    ALTER TABLE public.ai_qualifications ADD CONSTRAINT ai_qualifications_lead_id_key UNIQUE (lead_id);
  END IF;
END $$;

-- lead_intelligence_history: historico de relatorios gerados pela "Inteligencia Aura Pro".
-- Faltava por completo -- por isso "Gerar Inteligencia" e "Roteiro Sugerido" falhavam.
CREATE TABLE IF NOT EXISTS public.lead_intelligence_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  full_markdown TEXT,
  report_json JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_intelligence_history_lead_id_idx ON public.lead_intelligence_history(lead_id);

ALTER TABLE public.lead_intelligence_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read lead_intelligence_history"
ON public.lead_intelligence_history
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert lead_intelligence_history"
ON public.lead_intelligence_history
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update lead_intelligence_history"
ON public.lead_intelligence_history
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete lead_intelligence_history"
ON public.lead_intelligence_history
FOR DELETE
TO authenticated
USING (true);

-- lead_documents: arquivos/PDFs anexados a um lead (aba "Documentos" no Pipeline).
-- Tambem faltava por completo.
CREATE TABLE IF NOT EXISTS public.lead_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  category TEXT DEFAULT 'contract',
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_documents_lead_id_idx ON public.lead_documents(lead_id);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read lead_documents"
ON public.lead_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert lead_documents"
ON public.lead_documents
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update lead_documents"
ON public.lead_documents
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete lead_documents"
ON public.lead_documents
FOR DELETE
TO authenticated
USING (true);
