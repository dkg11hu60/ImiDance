-- Migration: 004_house_rules_privacy_link.sql
-- Description: Ensures policies and policy_acceptances tables exist and inserts/updates the current policy with the required privacy policy link.

CREATE TABLE IF NOT EXISTS public.policies (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_current BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.policy_acceptances (
    id SERIAL PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    policy_id INTEGER NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
    policy_version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (profile_id, policy_version)
);

-- Enable RLS if not already enabled
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

-- Allow public read access on policies
DROP POLICY IF EXISTS "Allow public read access" ON public.policies;
CREATE POLICY "Allow public read access" ON public.policies FOR SELECT USING (true);

-- Allow public read/insert access on policy_acceptances
DROP POLICY IF EXISTS "Allow public read access" ON public.policy_acceptances;
CREATE POLICY "Allow public read access" ON public.policy_acceptances FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.policy_acceptances;
CREATE POLICY "Allow public insert access" ON public.policy_acceptances FOR INSERT WITH CHECK (true);

-- Set previous policies to not current
UPDATE public.policies SET is_current = false;

-- Insert the new policy version
INSERT INTO public.policies (version, title, sections, is_current)
VALUES (
    COALESCE((SELECT MAX(version) FROM public.policies), 0) + 1,
    'Tánciskolai Házirend',
    '[
        {
            "key": "adatvedelem",
            "heading": "Adatvédelem és Adatkezelés",
            "body": "A megadott személyes adatokat kizárólag a működéshez szükséges mértékben kezeljük, a <a href=\"/adatkezelesi_tajekoztato.html\" target=\"_blank\">vonatkozó szabályok</a> szerint."
        }
    ]'::jsonb,
    true
)
ON CONFLICT (version) DO UPDATE 
SET title = EXCLUDED.title, sections = EXCLUDED.sections, is_current = true;
