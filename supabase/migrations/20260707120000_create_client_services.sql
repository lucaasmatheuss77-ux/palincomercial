CREATE TABLE public.client_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  honorario_valor NUMERIC,
  honorario_percentual NUMERIC,
  status TEXT NOT NULL DEFAULT 'ativo',
  data_inicio DATE,
  data_fim DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX client_services_client_id_idx ON public.client_services(client_id);

ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read client_services"
ON public.client_services
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert client_services"
ON public.client_services
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update client_services"
ON public.client_services
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete client_services"
ON public.client_services
FOR DELETE
TO authenticated
USING (true);
