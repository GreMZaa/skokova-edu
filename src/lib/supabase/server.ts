import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

const DEFAULT_URL = 'https://wbwonqioklsojkmwieiq.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indid29ucWlva2xzb2prbXdpZWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODIwODgsImV4cCI6MjEwMDk1ODA4OH0.Ko2z1Q65DTi-TVSKLhMtrwDI_3M7zh2rYYq1jKtg2HQ';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indid29ucWlva2xzb2prbXdpZWlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTM4MjA4OCwiZXhwIjoyMTAwOTU4MDg4fQ.4zhVHpPLM_6dRyfMdv7UJaQDUxEdsqm8YDZdibk_otg';

export function getSupabaseConfig() {
  const envUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const envAnonKey = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const envServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const url = (envUrl && !envUrl.includes('your-project')) ? envUrl : DEFAULT_URL;
  const anonKey = (envAnonKey && !envAnonKey.includes('your-anon-key')) ? envAnonKey : DEFAULT_ANON_KEY;
  const serviceKey = (envServiceKey && !envServiceKey.includes('your-service-role-key')) ? envServiceKey : DEFAULT_SERVICE_ROLE_KEY;

  return { url, anonKey, serviceKey };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
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
  const { url, serviceKey } = getSupabaseConfig();

  return createSupabaseRawClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
