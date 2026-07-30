-- 8. Журнал авторизаций и входов администратора в Supabase
CREATE TABLE IF NOT EXISTS public.admin_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.admin_login_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_login_logs' AND policyname = 'Allow admin logs insert'
    ) THEN
        CREATE POLICY "Allow admin logs insert" ON public.admin_login_logs FOR INSERT WITH CHECK (TRUE);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'admin_login_logs' AND policyname = 'Allow admin logs view'
    ) THEN
        CREATE POLICY "Allow admin logs view" ON public.admin_login_logs FOR SELECT USING (TRUE);
    END IF;
END $$;
