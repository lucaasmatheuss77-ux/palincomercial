CREATE TABLE public.icms_operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_venda DATE NOT NULL,
  empresa TEXT,
  propriedade TEXT,
  cliente TEXT,
  nota_fiscal TEXT,
  valor_venda NUMERIC,
  valor_icms NUMERIC,
  porcentagem_honorarios NUMERIC,
  valor_honorarios NUMERIC,
  deferimento TEXT,
  month_year TEXT,
  status_fechamento TEXT DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.icms_operations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform operations
CREATE POLICY "Allow authenticated users to read icms_operations"
ON public.icms_operations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert icms_operations"
ON public.icms_operations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update icms_operations"
ON public.icms_operations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete icms_operations"
ON public.icms_operations
FOR DELETE
TO authenticated
USING (true);
