import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SERVICES } from '@/data/services';

export const dynamic = 'force-dynamic';

const sanitizeEnv = (val?: string) => (val || '').replace(/["'\r\n]/g, '').trim();

export async function POST(req: Request) {
  try {
    const update = await req.json();
    let botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    if (!botToken || botToken.length < 20) {
      botToken = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://skokova-edu.vercel.app').replace(/\/$/, '');
    const twaUrl = `${baseUrl}/twa`;

    // Главное постоянное меню Telegram бота (Reply Keyboard)
    const mainReplyKeyboard = {
      keyboard: [
        [
          { text: '👤 Мой кабинет' },
          { text: '📚 Программы и тарифы' },
        ],
        [
          { text: '💳 Реквизиты оплаты' },
          { text: '💬 Связаться с педагогом' },
        ],
      ],
      resize_keyboard: true,
    };

    // -------------------------------------------------------------
    // 1. ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ И КОМАНД
    // -------------------------------------------------------------
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const username = update.message.from?.username ? `@${update.message.from.username}` : '';
      const firstName = update.message.from?.first_name || 'Гость';

      // Команда /start
      if (text.startsWith('/start')) {
        const welcomeText = `👋 *Здравствуйте, ${firstName}!*\n\n` +
          `Вас приветствует бот педагога *Скоковой Юлии Павловны* — эксперта по подготовке к школе (5–7 лет) и репетитора 1–4 классов.\n\n` +
          `Нажмите кнопку *«Записаться»* слева внизу для запуска Mini App или выберите раздел в меню ниже:`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "📚 Программы и тарифы"
      if (text.includes('Программы') || text === '/programs') {
        let programsMsg = `📚 *ПРОГРАММЫ ОНЛАЙН-ЗАНЯТИЙ И ТАРИФЫ*\n\n` +
          `*Юлия Павловна* — Эксперт по развитию и подготовке к школе с опытом более 30 лет.\n\n`;

        SERVICES.forEach((service, idx) => {
          programsMsg += `*${idx + 1}. ${service.title}*\n` +
            `⏱ Длительность: ${service.duration_minutes} минут\n` +
            `💰 Стоимость: *${service.price} ₽*\n` +
            `📖 ${service.description}\n\n`;
        });

        programsMsg += `💡 *Тарифы:* Онлайн-урок — *600 ₽* / 40 мин, Оффлайн — *800 ₽* / 40 мин.`;

        const inlineKb = {
          inline_keyboard: [
            [{ text: '📅 Записаться через Mini App', web_app: { url: twaUrl } }],
            [{ text: '🌐 Все программы на сайте', url: `${baseUrl}/#programs` }],
          ],
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: programsMsg,
            parse_mode: 'Markdown',
            reply_markup: inlineKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "👤 Мой кабинет"
      if (text.includes('Мой кабинет') || text === '/my') {
        const supabase = createAdminClient();
        let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });

        if (username) {
          query = query.ilike('telegram_handle', username);
        } else {
          query = query.eq('phone', '');
        }

        const { data: bookings } = await query.limit(5);

        let cabMsg = `👤 *ЛИЧНЫЙ КАБИНЕТ РОДИТЕЛЯ*\n` +
          `Telegram: ${username || firstName}\n\n`;

        if (!bookings || bookings.length === 0) {
          cabMsg += `У вас пока нет активных записей.\n` +
            `Вы можете записаться на первый урок через Mini App или войти в кабинет на сайте!`;
        } else {
          cabMsg += `📋 *Ваши последние записи:*\n\n`;
          bookings.forEach((b: any, i: number) => {
            const statusStr = b.status === 'confirmed' ? '✅ Подтверждена' :
              b.status === 'pending_payment' ? '⏳ Ожидает оплаты' :
              b.status === 'receipt_uploaded' ? '📑 Чек на проверке' : b.status;
            cabMsg += `*${i + 1}. ${b.service_title}*\n` +
              `👶 Ученик: ${b.child_name}\n` +
              `📌 Статус: *${statusStr}*\n` +
              `💰 Сумма: ${b.price} ₽\n\n`;
          });
        }

        const inlineKb = {
          inline_keyboard: [
            [{ text: '📅 Новая запись (Mini App)', web_app: { url: twaUrl } }],
            [{ text: '🔑 Войти в Кабинет на сайте', url: `${baseUrl}/login` }],
          ],
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: cabMsg,
            parse_mode: 'Markdown',
            reply_markup: inlineKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "💳 Реквизиты оплаты"
      if (text.includes('Реквизиты') || text === '/payment') {
        const supabase = createAdminClient();
        const { data: settings } = await supabase.from('settings').select('*').limit(1);
        const set = settings && settings[0] ? settings[0] : null;

        const phone = set?.phone || '+7 (937) 214-42-05';
        const cardNumber = set?.card_number || '2202 2024 1122 3344';
        const bankName = set?.bank_name || 'Сбербанк / Т-Банк (СБП)';
        const recipient = set?.recipient || 'Скокова Юлия Павловна';

        const payMsg = `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ ЗАНЯТИЙ (СБП)*\n\n` +
          `📱 *Телефон СБП:* \`${phone}\`\n` +
          `💳 *Карта:* \`${cardNumber}\`\n` +
          `🏦 *Банк:* ${bankName}\n` +
          `👤 *Получатель:* ${recipient}\n\n` +
          `📌 После перевода загрузите чек через окно записи в Mini App или Кабинете родителя!`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: payMsg,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "💬 Связаться с педагогом"
      if (text.includes('Педагог') || text.includes('Связаться')) {
        const contactMsg = `👩‍🏫 *СВЯЗЬ С ПЕДАГОГОМ*\n\n` +
          `*Скокова Юлия Павловна*\n` +
          `Эксперт по развитию и подготовке к школе.\n\n` +
          `📲 Личный Telegram: [@ssharonovv](https://t.me/ssharonovv)\n` +
          `📞 Телефон: +7 (937) 214-42-05\n\n` +
          `Задайте любой вопрос или напишите прямо сейчас!`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: contactMsg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }
    }

    // -------------------------------------------------------------
    // 2. ОБРАБОТКА CALLBACK QUERIES (КЛИКИ ПО ИНЛАЙН КНОПКАМ)
    // -------------------------------------------------------------
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      const [action, bookingId] = callbackData.split('_');
      const supabase = createAdminClient();

      if (action === 'confirm') {
        await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bookingId);

        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQuery.id,
            text: '✅ Запись успешно подтверждена!',
          }),
        });

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
      } else if (action === 'reject') {
        await supabase
          .from('bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);

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
