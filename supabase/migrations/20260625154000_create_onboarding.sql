CREATE TABLE public.onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id TEXT,
  client_name TEXT,
  contact_info TEXT,
  contract_link TEXT,
  status TEXT DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read onboarding"
ON public.onboarding FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert onboarding"
ON public.onboarding FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update onboarding"
ON public.onboarding FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
