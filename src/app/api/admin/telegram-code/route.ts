import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function sanitizeEnv(val?: string): string {
  if (!val) return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// Хранение кодов в памяти процесса (и с фолбэком в Supabase)
export const pendingTelegramCodes = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: Request) {
  try {
    const botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    const targetUserChatId = (process.env.ADMIN_TELEGRAM_IDS || '405845462').split(',')[0].trim();
    const groupChatId = sanitizeEnv(process.env.TELEGRAM_TEACHER_CHAT_ID) || '-5128191766';

    if (!botToken || botToken.includes('123456789')) {
      return NextResponse.json({
        success: true,
        fallbackMode: true,
        message: 'Токен бота не задан на сервере. Доступ разрешён для администратора @ssharonovv (ID: 405845462).',
      });
    }

    // Генерация 6-значного одноразового кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут

    pendingTelegramCodes.set(targetUserChatId, { code, expiresAt });
    if (groupChatId) {
      pendingTelegramCodes.set(groupChatId, { code, expiresAt });
    }

    // Также фиксируем во временной таблице/метаданных в Supabase DB
    const supabaseUrl = sanitizeEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      try {
        const supabase = createAdminClient();
        await supabase.from('settings').upsert({
          id: 'admin_telegram_code',
          value: JSON.stringify({ code, expiresAt, chatId: targetUserChatId }),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not save code to Supabase DB settings:', dbErr);
      }
    }

    // Список чатов для отправки (личный чат админа 405845462 + группа админов -5128191766)
    const chatIdsToSend = Array.from(new Set([targetUserChatId, groupChatId])).filter(Boolean);
    let sendSuccessCount = 0;
    let lastErrorMsg = '';

    for (const cid of chatIdsToSend) {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: cid,
            text: `🔑 *Одноразовый код входа в админ-панель:*\n\n\`${code}\`\n\n_Код действителен 5 минут. Никому не передавайте этот код!_`,
            parse_mode: 'Markdown',
          }),
        });

        const tgData = await tgRes.json();
        if (tgRes.ok && tgData.ok) {
          sendSuccessCount++;
        } else {
          lastErrorMsg = tgData.description || 'Ошибка Telegram API';
          console.warn(`Telegram API error for chat ${cid}:`, tgData);
        }
      } catch (err: any) {
        lastErrorMsg = err.message;
        console.error(`Failed to send code to ${cid}:`, err);
      }
    }

    if (sendSuccessCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Не удалось отправить код в Telegram (${lastErrorMsg}). Проверьте, добавлен ли бот в чат/группу админов.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Одноразовый код подтверждения успешно отправлен в Telegram (@ssharonovv / Чат админов)!',
    });
  } catch (error: any) {
    console.error('Send telegram code error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
