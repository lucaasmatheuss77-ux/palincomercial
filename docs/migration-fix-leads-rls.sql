-- Fix Row Level Security (RLS) for Leads so they show up in the CRM Dashboard
-- This grants full access to the leads table for authenticated users.
-- Since this is an MVP and all consultants share the CRM, this is the correct approach.

-- 1. Ensure authenticated users have privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;

-- 2. Create a policy that allows all authenticated users to view/edit all leads
DROP POLICY IF EXISTS leads_authenticated ON public.leads;
CREATE POLICY leads_authenticated ON public.leads
FOR ALL TO authenticated
USING (true)
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Just in case RLS wasn't enabled, enable it (this is best practice)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
