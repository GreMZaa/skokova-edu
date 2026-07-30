import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return NextResponse.json({ success: true, message: 'No TELEGRAM_BOT_TOKEN configured' });
    }

    // Обработка текстовой команды /start
    if (update.message && update.message.text && update.message.text.startsWith('/start')) {
      const chatId = update.message.chat.id;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';

      const welcomeText = `👋 *Здравствуйте! Вас приветствует Telegram-бот педагога Скоковой Юлии Павловны.*\n\n` +
        `Здесь вы можете записаться на индивидуальные онлайн-уроки по подготовке к школе (5-7 лет) ` +
        `и предметам начальной школы (1-4 классы).\n\n` +
        `Нажмите кнопку ниже, чтобы открыть интерактивное приложение записи:`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '📅 Записаться на урок (WebApp)',
              web_app: { url: appUrl },
            },
          ],
          [
            { text: '💬 Связаться с педагогом', url: 'https://t.me/teacher' },
          ],
        ],
      };

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: welcomeText,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }),
      });

      return NextResponse.json({ success: true });
    }

    // Обработка клика по интерактивным кнопкам (Callback Queries)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data; // e.g., "confirm_booking-123"
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const [action, bookingId] = callbackData.split('_');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (action === 'confirm') {
        // Подтверждение записи
        if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
          const supabase = createAdminClient();
          await supabase
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', bookingId);
        }

        // Ответ в Telegram мамы
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: '✅ Запись успешно подтверждена!',
          }),
        });

        // Обновляем плашку в сообщении
        const updatedText = `${callbackQuery.message.text}\n\n✅ *СТАТУС: Запись подтверждена педагогом*`;
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: updatedText,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          }),
        });
      } else if (action === 'edit') {
        // Меню редактирования заявки
        const editText = `✏️ *МЕНЮ РЕДАКТИРОВАНИЯ ЗАЯВКИ* ID: \`${bookingId}\`\n\n` +
          `Выберите действие для изменения данных:`;

        const editKeyboard = {
          inline_keyboard: [
            [
              { text: '📅 Перенести дату/время', callback_data: `reschedule_${bookingId}` },
            ],
            [
              { text: '👤 Изменить контакты / данные', callback_data: `editdata_${bookingId}` },
            ],
            [
              { text: '⬅️ Отмена', callback_data: `cancelmenu_${bookingId}` },
            ],
          ],
        };

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: editText,
            parse_mode: 'Markdown',
            reply_markup: editKeyboard,
          }),
        });
      } else if (action === 'reject') {
        // Отклонение заявки
        if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
          const supabase = createAdminClient();
          await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId);
        }

        const rejectedText = `${callbackQuery.message.text}\n\n❌ *СТАТУС: Заявка отклонена педагогом*`;
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: rejectedText,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          }),
        });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
