ALTER TABLE public.icms_operations
  ADD COLUMN client_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL;

CREATE INDEX icms_operations_client_id_idx ON public.icms_operations(client_id);
