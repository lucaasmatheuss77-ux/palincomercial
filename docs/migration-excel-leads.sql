-- Migration to add columns required by the Excel OCR ingestion
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS task_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_lead TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS confianca TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS responsavel TEXT;

-- CLEAR INCOMPLETE LEADS TO RE-IMPORT WITH FULL DATA
-- (This only deletes leads from the Excel import, keeping manually created ones safe)
DELETE FROM public.leads WHERE origem = 'Importação Excel';

-- NOTE: existing columns that map:
-- "Nome / Razão Social" -> name / company_name
-- "Cidade" -> cidade
-- "Telefone(s)" -> phone
-- "E-mail" -> email
-- "Estágio" -> stage
