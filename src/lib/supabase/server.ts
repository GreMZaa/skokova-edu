import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Игнорируем в серверных компонентах
        }
      },
    },
  });
}

// Административный клиент для серверных роутов (использует Service Role Key)
export function createAdminClient() {
  const { createClient: createSupabaseRawClient } = require('@supabase/supabase-js');
  const url = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return createSupabaseRawClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
