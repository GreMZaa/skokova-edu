import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Хранение кодов в памяти процесса (и с фолбэком в Supabase)
export const pendingTelegramCodes = new Map<string, { code: string; expiresAt: number }>();

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = (process.env.ADMIN_TELEGRAM_IDS || '405845462').split(',')[0].trim();

    if (!botToken || botToken.includes('123456789')) {
      return NextResponse.json(
        {
          success: false,
          error:
            'В файле .env.local не указан токен Telegram-бота (TELEGRAM_BOT_TOKEN). Пожалуйста, добавьте токен вашего бота для отправки кода подтверждения.',
        },
        { status: 400 }
      );
    }

    // Генерация 6-значного одноразового кода
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 минут

    pendingTelegramCodes.set(targetChatId, { code, expiresAt });

    // Также фиксируем во временной таблице/метаданных в Supabase DB
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      try {
        const supabase = createAdminClient();
        await supabase.from('settings').upsert({
          id: 'admin_telegram_code',
          value: JSON.stringify({ code, expiresAt, chatId: targetChatId }),
          updated_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.warn('Could not save code to Supabase DB settings:', dbErr);
      }
    }

    // Отправка сообщения в Telegram напрямую администратору 405845462 (@ssharonovv)
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: `🔐 *Одноразовый код входа в админ-панель:*\n\n\`${code}\`\n\n_Код действителен 5 минут. Никому не передавайте этот код!_`,
        parse_mode: 'Markdown',
      }),
    });

    const tgData = await tgRes.json();

    if (!tgRes.ok || !tgData.ok) {
      console.error('Telegram API error sending code:', tgData);
      return NextResponse.json(
        {
          success: false,
          error: `Не удалось отправить код в Telegram (${tgData.description || 'Ошибка Telegram API'}). Проверьте, запустил ли пользователь @ssharonovv диалог с ботом.`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Одноразовый код подтверждения успешно отправлен в Ваш Telegram (@ssharonovv)!',
    });
  } catch (error: any) {
    console.error('Send telegram code error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
