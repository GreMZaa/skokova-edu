import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

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
    const { authType, pin, email, password, telegramUser, telegramWidgetData } = body;

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const envAdminIds = (process.env.ADMIN_TELEGRAM_IDS || '405845462')
      .split(',')
      .map((s) => s.trim().toLowerCase());
    const envAdminHandles = (process.env.ADMIN_TELEGRAM_HANDLES || 'ssharonovv')
      .split(',')
      .map((s) => s.trim().replace(/^@/, '').toLowerCase());

    let isSuccess = false;
    let authMethodUsed = 'unknown';
    let adminIdentifier = 'skokova_admin';
    let adminInfo: { name?: string; handle?: string; email?: string; photoUrl?: string } = {};

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Авторизация через Telegram (Widget, TWA или прямое подтверждение ID)
    if (authType === 'telegram' || telegramUser || telegramWidgetData) {
      const tgUser = telegramUser || telegramWidgetData;
      if (tgUser) {
        const userId = String(tgUser.id || '').trim();
        const username = String(tgUser.username || '')
          .trim()
          .replace(/^@/, '')
          .toLowerCase();

        const isIdAllowed = userId && envAdminIds.includes(userId);
        const isHandleAllowed = username && envAdminHandles.includes(username);

        // Если передан hash от Telegram Widget и есть токен бота — проверяем подлинность HMAC
        let isHmacValid = true;
        if (telegramWidgetData?.hash && botToken && !botToken.includes('123456789')) {
          isHmacValid = verifyTelegramWidgetData(telegramWidgetData, botToken);
        }

        if ((isIdAllowed || isHandleAllowed) && isHmacValid) {
          isSuccess = true;
          authMethodUsed = 'telegram';
          adminIdentifier = `telegram:@${username || 'user'} (${userId})`;
          adminInfo = {
            name: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim() || '@ssharonovv',
            handle: username ? `@${username}` : '@ssharonovv',
            photoUrl: tgUser.photo_url || '',
          };
        }
      }
    }

    // 2. Авторизация через Supabase Auth (Email + Пароль)
    if (!isSuccess && (authType === 'supabase' || (email && password))) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
        const { createClient: createSupabaseJS } = require('@supabase/supabase-js');
        const supabaseClient = createSupabaseJS(supabaseUrl, supabaseAnonKey);

        const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
          email: email.trim(),
          password: password,
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
              ? 'Ошибка Telegram авторизации. Ваш Telegram аккаунт не зарегистрирован в списке администраторов (@ssharonovv / ID 405845462).'
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
