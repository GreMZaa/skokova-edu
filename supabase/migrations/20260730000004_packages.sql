-- Migration 20260730000004_packages.sql
-- Table for user lesson packages / subscriptions (without discount)

CREATE TABLE IF NOT EXISTS public.user_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_name TEXT,
    parent_phone TEXT,
    child_name TEXT,
    total_lessons INTEGER NOT NULL DEFAULT 4,
    remaining_lessons INTEGER NOT NULL DEFAULT 4,
    price_paid NUMERIC(10, 2) NOT NULL DEFAULT 2400.00,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own packages" ON public.user_packages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on packages" ON public.user_packages
    FOR ALL USING (true);
