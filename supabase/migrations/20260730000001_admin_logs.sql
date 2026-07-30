-- 8. Журнал авторизаций и входов администратора в Supabase
CREATE TABLE IF NOT EXISTS public.admin_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    user_agent TEXT,
    status TEXT NOT NULL, -- 'success' | 'failed'
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.admin_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin logs insert"
    ON public.admin_login_logs FOR INSERT
    WITH CHECK (TRUE);

CREATE POLICY "Allow admin logs view"
    ON public.admin_login_logs FOR SELECT
    USING (TRUE);
