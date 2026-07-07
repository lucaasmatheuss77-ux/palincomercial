ALTER TABLE public.onboarding
  ADD COLUMN client_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  ADD COLUMN filial_id UUID REFERENCES public.filiais(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX onboarding_client_id_key ON public.onboarding(client_id) WHERE client_id IS NOT NULL;
