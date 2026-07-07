ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS active_contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;
