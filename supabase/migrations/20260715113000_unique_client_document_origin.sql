CREATE UNIQUE INDEX IF NOT EXISTS clientes_documento_unique_idx
  ON public.clientes (regexp_replace(documento, '\D', '', 'g'))
  WHERE documento IS NOT NULL AND regexp_replace(documento, '\D', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clientes_origin_lead_id_unique_idx
  ON public.clientes (origin_lead_id)
  WHERE origin_lead_id IS NOT NULL;
