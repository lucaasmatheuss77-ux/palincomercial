CREATE TABLE public.filiais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  documento TEXT,
  cidade TEXT,
  estado TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX filiais_client_id_idx ON public.filiais(client_id);

ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read filiais"
ON public.filiais
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert filiais"
ON public.filiais
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update filiais"
ON public.filiais
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete filiais"
ON public.filiais
FOR DELETE
TO authenticated
USING (true);
