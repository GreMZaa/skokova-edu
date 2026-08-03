import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, sanitizeError } from '@/lib/security';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// Хранение кодов в памяти процесса (и с фолбэком в Supabase & HMAC)
export const pendingTelegramCodes = new Map<string, { code: string; expiresAt: number }>();

export function generateCodeToken(code: string, expiresAt: number, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${code}:${expiresAt}`)
    .digest('hex');
}

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс. 3 запроса генерации кода за 5 минут с одного IP
    const rateCheck = checkRateLimit(`tg-code:${clientIp}`, 3, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Слишком много запросов кода. Пожалуйста, подождите 5 минут.',
        },
        { status: 429 }
      );
    }

    const botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '405845462,510510041')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const groupChatId = sanitizeEnv(process.env.TELEGRAM_TEACHER_CHAT_ID) || '-5128191766';

    if (!botToken || botToken.includes('123456789')) {
      return NextResponse.json(
        {
          success: false,
          error: 'TELEGRAM_BOT_TOKEN не настроен на сервере.',
        },
        { status: 500 }
      );
    }

    // Генерация 6-значного одноразового кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут

    const allChatTargets = Array.from(new Set([...adminIds, groupChatId])).filter(Boolean);

    for (const targetId of allChatTargets) {
      pendingTelegramCodes.set(targetId, { code, expiresAt });
    }

    // 1. Сохранение в Supabase DB в таблицу settings
    const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      try {
        const supabase = createAdminClient();
        await supabase.from('settings').upsert({
          id: 'admin_telegram_code',
          phone: code,
          card_number: String(expiresAt),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not save code to Supabase DB settings:', dbErr);
      }
    }

    // 2. Генерация HMAC-токена подписи
    const verificationToken = generateCodeToken(code, expiresAt, botToken);

    // 3. Отправка одноразового кода во все чаты администраторов (личные чаты + чат группы -5128191766)
    let sendSuccessCount = 0;
    let lastError = '';

    for (const chatId of allChatTargets) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🔐 *Одноразовый код входа в админ-панель:*\n\n\`${code}\`\n\n_Код действителен 5 минут. Никому не передавайте этот код!_`,
            parse_mode: 'Markdown',
          }),
        });

        const tgData = await tgRes.json();
        if (tgRes.ok && tgData.ok) {
          sendSuccessCount++;
        } else {
          lastError = tgData.description || 'Ошибка Telegram API';
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    if (sendSuccessCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Не удалось отправить код в Telegram (${lastError}). Убедитесь, что вы или бот состоите в чате администраторов.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      verificationToken,
      expiresAt,
      message: 'Одноразовый код подтверждения успешно отправлен в Telegram администраторам!',
    });
  } catch (error: any) {
    console.error('Send telegram code error:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

