import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { pendingTelegramCodes, generateCodeToken } from '../telegram-code/route';
import {
  checkRateLimit,
  getClientIp,
  generateAdminSessionToken,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  getAdminSessionFromRequest,
  sanitizeError,
  ALLOWED_ADMIN_EMAILS,
} from '@/lib/security';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

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
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // 12.9 Rate Limiting: макс. 5 попыток входа в минуту с одного IP
    const rateCheck = checkRateLimit(`admin-login:${clientIp}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Слишком много попыток входа. Пожалуйста, подождите 1 минуту.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { authType, email, password, code, verificationToken, expiresAt, telegramWidgetData } = body;

    const targetAdminChatIds = (process.env.ADMIN_TELEGRAM_IDS || '405845462,510510041').split(',').map((id) => id.trim()).filter(Boolean);
    const targetAdminChatId = targetAdminChatIds[0];
    const targetAdminHandle = (process.env.ADMIN_TELEGRAM_HANDLES || 'ssharonovv,vasilina_original').split(',')[0].trim().replace(/^@/, '');

    let isSuccess = false;
    let authMethodUsed = 'unknown';
    let adminIdentifier = 'skokova_admin';
    let adminInfo: { name?: string; handle?: string; email?: string; photoUrl?: string } = {};

    const botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);

    // 1. АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM
    if (authType === 'telegram') {
      // А. Проверка 6-значного одноразового кода
      if (code && String(code).trim().length > 0) {
        const inputCode = String(code).trim();
        let validCode = false;

        // 1. Проверка HMAC токена (бессерверная проверка 100% точности без задержек DB)
        if (verificationToken && expiresAt && botToken) {
          const expectedToken = generateCodeToken(inputCode, Number(expiresAt), botToken);
          if (expectedToken === verificationToken && Date.now() <= Number(expiresAt)) {
            validCode = true;
          }
        }

        // 2. Проверка в памяти процесса
        if (!validCode) {
          const memoryEntry = pendingTelegramCodes.get(targetAdminChatId);
          if (memoryEntry && memoryEntry.code === inputCode && Date.now() <= memoryEntry.expiresAt) {
            validCode = true;
            pendingTelegramCodes.delete(targetAdminChatId);
          }
        }

        // 3. Фолбэк: проверка в Supabase DB
        if (!validCode) {
          const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
          const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
          if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
            try {
              const supabase = createAdminClient();
              const { data: dbSettings } = await supabase
                .from('settings')
                .select('phone, card_number')
                .eq('id', 'admin_telegram_code')
                .maybeSingle();

              if (dbSettings?.phone && dbSettings?.card_number) {
                const storedCode = dbSettings.phone;
                const expTime = Number(dbSettings.card_number);
                if (storedCode === inputCode && Date.now() <= expTime) {
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
      const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
      const supabaseAnonKey = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

      if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')) {
        const { createClient: createSupabaseJS } = require('@supabase/supabase-js');
        const supabaseClient = createSupabaseJS(supabaseUrl, supabaseAnonKey);

        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanPassword = String(password || '').trim();

        const allowedEmails = ALLOWED_ADMIN_EMAILS.concat(
          (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
        );

        if (allowedEmails.length > 0 && !allowedEmails.includes(cleanEmail)) {
          return NextResponse.json(
            { success: false, error: 'У вас нет прав администратора' },
            { status: 403 }
          );
        }

        const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!authErr && authData?.user) {
          isSuccess = true;
          authMethodUsed = 'supabase';
          adminIdentifier = `supabase:${authData.user.email}`;
          adminInfo = {
            email: authData.user.email,
            name: authData.user.user_metadata?.full_name || authData.user.email,
          };
        } else if (authErr) {
          console.warn('Supabase signInWithPassword error:', authErr.message);
        }
      }
    }

    // Журналирование попытки входа в таблицу admin_login_logs в Supabase DB
    const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    // 12.1 Генерация криптографически подписанной серверной сессии
    const sessionToken = generateAdminSessionToken(adminIdentifier, authMethodUsed);

    const response = NextResponse.json({
      success: true,
      authMethod: authMethodUsed,
      adminInfo,
      token: sessionToken,
      message: `Авторизация успешна (${authMethodUsed})`,
    });

    // Устанавливаем HTTP-only защищённую cookie
    setAdminSessionCookie(response, sessionToken);

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    // 12.2 Проверка прав админа для чтения логов
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Сессия администратора завершена',
    });
    clearAdminSessionCookie(response);
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

