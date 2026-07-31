import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { pendingTelegramCodes } from '../telegram-code/route';

function verifyTelegramWidgetData(data: Record<string, any>, botToken: string): boolean {
  if (!data || !data.hash) return false;
  try {
    const { hash, ...rest } = data;
    const dataCheckString = Object.keys(rest)
      .sort()
      .map((key) => `${key}=${rest[key]}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    return hmac.toLowerCase() === String(hash).toLowerCase();
  } catch (err) {
    console.error('Telegram HMAC verification error:', err);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { authType, email, password, code, telegramWidgetData } = body;

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const targetAdminChatId = (process.env.ADMIN_TELEGRAM_IDS || '405845462').split(',')[0].trim();
    const targetAdminHandle = (process.env.ADMIN_TELEGRAM_HANDLES || 'ssharonovv').split(',')[0].trim().replace(/^@/, '');

    let isSuccess = false;
    let authMethodUsed = 'unknown';
    let adminIdentifier = 'skokova_admin';
    let adminInfo: { name?: string; handle?: string; email?: string; photoUrl?: string } = {};

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 1. АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM
    if (authType === 'telegram') {
      // А. Проверка 6-значного одноразового кода, отправленного ботом
      if (code && String(code).trim().length > 0) {
        const inputCode = String(code).trim();
        let validCode = false;

        // Проверка в памяти сервера
        const memoryEntry = pendingTelegramCodes.get(targetAdminChatId);
        if (memoryEntry && memoryEntry.code === inputCode && Date.now() <= memoryEntry.expiresAt) {
          validCode = true;
          pendingTelegramCodes.delete(targetAdminChatId);
        }

        // Фолбэк: проверка в Supabase DB
        if (!validCode) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
            try {
              const supabase = createAdminClient();
              const { data: dbSettings } = await supabase
                .from('settings')
                .select('value')
                .eq('id', 'admin_telegram_code')
                .maybeSingle();

              if (dbSettings?.value) {
                const parsed = JSON.parse(dbSettings.value);
                if (parsed.code === inputCode && Date.now() <= parsed.expiresAt) {
                  validCode = true;
                }
              }
            } catch (e) {
              console.warn('DB code check error:', e);
            }
          }
        }

        if (validCode) {
          isSuccess = true;
          authMethodUsed = 'telegram';
          adminIdentifier = `telegram:@${targetAdminHandle} (${targetAdminChatId})`;
          adminInfo = {
            name: 'Сергей Шаронов',
            handle: `@${targetAdminHandle}`,
          };
        }
      }

      // Б. Проверка официального виджета Telegram Widget с криптографической HMAC подписью
      if (!isSuccess && telegramWidgetData?.hash && botToken) {
        const userId = String(telegramWidgetData.id || '').trim();
        const username = String(telegramWidgetData.username || '').trim().replace(/^@/, '').toLowerCase();

        const isIdMatch = userId === targetAdminChatId;
        const isHandleMatch = username === targetAdminHandle.toLowerCase();

        if ((isIdMatch || isHandleMatch) && verifyTelegramWidgetData(telegramWidgetData, botToken)) {
          isSuccess = true;
          authMethodUsed = 'telegram';
          adminIdentifier = `telegram:@${username || targetAdminHandle} (${userId})`;
          adminInfo = {
            name: `${telegramWidgetData.first_name || ''} ${telegramWidgetData.last_name || ''}`.trim() || 'Сергей Шаронов',
            handle: `@${username || targetAdminHandle}`,
            photoUrl: telegramWidgetData.photo_url || '',
          };
        }
      }
    }

    // 2. АВТОРИЗАЦИЯ ЧЕРЕЗ SUPABASE AUTH (EMAIL + ПАРОЛЬ)
    if (!isSuccess && (authType === 'supabase' || (email && password))) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
        const { createClient: createSupabaseJS } = require('@supabase/supabase-js');
        const supabaseClient = createSupabaseJS(supabaseUrl, supabaseAnonKey);

        const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
          email: String(email).trim(),
          password: String(password),
        });

        if (!authErr && authData?.user) {
          isSuccess = true;
          authMethodUsed = 'supabase';
          adminIdentifier = `supabase:${authData.user.email}`;
          adminInfo = {
            email: authData.user.email,
            name: authData.user.user_metadata?.full_name || authData.user.email,
          };
        }
      }
    }

    // Журналирование попытки входа в таблицу admin_login_logs в Supabase DB
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      try {
        const supabase = createAdminClient();
        await supabase.from('admin_login_logs').insert({
          ip_address: clientIp,
          user_agent: userAgent,
          status: isSuccess ? `success (${authMethodUsed})` : 'failed',
          email: adminIdentifier,
        });
      } catch (logError) {
        console.error('Failed to log admin access to Supabase DB:', logError);
      }
    }

    if (!isSuccess) {
      return NextResponse.json(
        {
          success: false,
          error:
            authType === 'telegram'
              ? 'Неверный или истёкший одноразовый код из Telegram. Пожалуйста, запросите новый код.'
              : 'Неверный email или пароль Supabase Auth',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authMethod: authMethodUsed,
      adminInfo,
      token: `admin-session-${authMethodUsed}-${Date.now()}`,
      message: `Авторизация успешна (${authMethodUsed})`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, logs: [] });
    }

    const supabase = createAdminClient();
    const { data: logs, error } = await supabase
      .from('admin_login_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
