import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SERVICES } from '@/data/services';

export const dynamic = 'force-dynamic';

const sanitizeEnv = (val?: string) => (val || '').replace(/["'\r\n]/g, '').trim();

// Временное хранилище шагов диалога (Session state for Telegram users)
const userSessions: Record<number, {
  step?: string;
  service_title?: string;
  price?: number;
  slot_id?: string;
  slot_time?: string;
  child_name?: string;
  child_grade?: string;
  phone?: string;
  parent_name?: string;
}> = {};

export async function POST(req: Request) {
  try {
    const update = await req.json();
    let botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    if (!botToken || botToken.length < 20) {
      botToken = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
    }

    const teacherChatId = sanitizeEnv(process.env.TELEGRAM_TEACHER_CHAT_ID) || '-5128191766';
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://skokova-edu.vercel.app').replace(/\/$/, '');
    const twaUrl = `${baseUrl}/twa`;

    // Постоянное меню кнопок внизу чата Telegram
    const mainReplyKeyboard = {
      keyboard: [
        [
          { text: '📅 1) Записаться на урок' },
          { text: '👤 2) Мой кабинет' },
        ],
        [
          { text: '📚 3) Программы и тарифы' },
          { text: '💳 4) Реквизиты оплаты' },
        ],
        [
          { text: '💬 5) Связаться с педагогом' },
        ],
      ],
      resize_keyboard: true,
    };

    const supabase = createAdminClient();

    // -------------------------------------------------------------
    // 1. ОБРАБОТКА ПОЛУЧЕНИЯ ФОТО / ЧЕКА В ЧАТЕ TELEGRAM
    // -------------------------------------------------------------
    if (update.message && (update.message.photo || update.message.document)) {
      const chatId = update.message.chat.id;
      const username = update.message.from?.username ? `@${update.message.from.username}` : '';
      const firstName = update.message.from?.first_name || 'Родитель';

      // Ищем последнюю неоплаченную или ожидающую чек запись этого пользователя
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (username) {
        query = query.ilike('telegram_handle', username);
      }

      const { data: bookings } = await query.limit(3);
      const pendingBooking = bookings?.find((b: any) => b.status === 'pending_payment' || b.status === 'receipt_uploaded');

      let photoFileId = '';
      if (update.message.photo && update.message.photo.length > 0) {
        photoFileId = update.message.photo[update.message.photo.length - 1].file_id;
      } else if (update.message.document) {
        photoFileId = update.message.document.file_id;
      }

      if (pendingBooking) {
        // Обновляем статус бронирования на receipt_uploaded
        await supabase
          .from('bookings')
          .update({
            status: 'receipt_uploaded',
            admin_notes: `Чек получен в Telegram (${new Date().toLocaleString('ru-RU')})`,
          })
          .eq('id', pendingBooking.id);

        // Отправляем фото чека педагогу в группу Telegram
        const caption = `📑 *НОВЫЙ ЧЕК ОБ ОПЛАТЕ ЗАНЯТИЯ!*\n\n` +
          `👤 *Родитель:* ${pendingBooking.parent_name || firstName} (${username || 'без ника'})\n` +
          `📞 *Телефон:* \`${pendingBooking.phone || 'не указан'}\`\n` +
          `👶 *Ученик:* ${pendingBooking.child_name} (${pendingBooking.child_grade})\n` +
          `📚 *Услуга:* ${pendingBooking.service_title}\n` +
          `💰 *Сумма:* ${pendingBooking.price} ₽\n` +
          `🆔 *ID записи:* \`${pendingBooking.id}\``;

        const inlineAdminKb = {
          inline_keyboard: [
            [
              { text: '✅ Подтвердить оплату', callback_data: `confirm_${pendingBooking.id}` },
              { text: '❌ Отклонить', callback_data: `reject_${pendingBooking.id}` },
            ],
          ],
        };

        if (photoFileId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: teacherChatId,
              photo: photoFileId,
              caption: caption,
              parse_mode: 'Markdown',
              reply_markup: inlineAdminKb,
            }),
          });
        }

        // Подтверждаем родителю
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ *Ваш чек успешно получен и отправлен педагогу на проверку!*\n\n` +
              `Скокова Юлия Павловна свяжется с Вами и подтвердит время занятия. Статус записи можно отслеживать в разделе *«👤 2) Мой кабинет»*.`,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });
      } else {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📑 Мы получили Ваш документ/фото. Чтобы привязать чек к конкретной записи, сначала выберите время через *«📅 1) Записаться на урок»*.`,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });
      }

      return NextResponse.json({ success: true });
    }

    // -------------------------------------------------------------
    // 2. ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ И КОМАНД
    // -------------------------------------------------------------
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const userId = update.message.from?.id || chatId;
      const text = update.message.text.trim();
      const username = update.message.from?.username ? `@${update.message.from.username}` : '';
      const firstName = update.message.from?.first_name || 'Гость';

      const session = userSessions[userId] || {};

      // Команда /start
      if (text.startsWith('/start')) {
        delete userSessions[userId];

        const welcomeText = `👋 *Здравствуйте, ${firstName}!*\n\n` +
          `Вас приветствует бот педагога *Скоковой Юлии Павловны* — эксперта по подготовке к школе (5–7 лет) и репетитора 1–4 классов (опыт 30+ лет).\n\n` +
          `✨ *Все возможности доступны прямо в Telegram:*\n` +
          `• 📅 Запись на уроки и выбор времени\n` +
          `• 👤 Кабинет родителя и история занятий\n` +
          `• 📚 Программы, тарифы и реквизиты СБП\n\n` +
          `Выберите нужный пункт в меню ниже:`;

        const startInlineKb = {
          inline_keyboard: [
            [
              { text: '📅 1) Записаться на урок', callback_data: 'start_booking' },
            ],
            [
              { text: '🌐 Открыть интерактивное Mini App', web_app: { url: twaUrl } },
            ],
            [
              { text: '👤 2) Мой кабинет', callback_data: 'native_cabinet' },
              { text: '📚 3) Программы', callback_data: 'native_programs' },
            ],
            [
              { text: '💳 4) Реквизиты СБП', callback_data: 'payment_info' },
              { text: '💬 5) Педагог', url: 'https://t.me/ssharonovv' },
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
            reply_markup: startInlineKb,
          }),
        });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: 'Используйте меню внизу экрана для быстрой навигации:',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "📅 1) Записаться на урок"
      if (text.includes('1) Записаться') || text.includes('Записаться')) {
        userSessions[userId] = { step: 'awaiting_child_data' };

        let servicesMsg = `🎯 *ШАГ 1: ВЫБЕРИТЕ НАПРАВЛЕНИЕ ОБУЧЕНИЯ*\n\n`;
        SERVICES.forEach((s, idx) => {
          servicesMsg += `*${idx + 1}. ${s.title}*\n` +
            `⏱ ${s.duration_minutes} мин • 💰 *${s.price} ₽*\n` +
            `📖 ${s.description}\n\n`;
        });
        servicesMsg += `Нажмите на подходящую программу ниже:`;

        const inlineServices = {
          inline_keyboard: SERVICES.map((s, i) => [
            { text: `👉 ${s.title} (${s.price} ₽)`, callback_data: `select_service_${i}` },
          ]),
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: servicesMsg,
            parse_mode: 'Markdown',
            reply_markup: inlineServices,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Если пользователь в процессе ввода данных ребенка (Шаг записи)
      if (session.step === 'awaiting_child_data') {
        session.child_name = text;
        session.step = 'awaiting_phone';
        userSessions[userId] = session;

        const phoneMsg = `👍 Принято: *${text}*\n\n` +
          `📱 *ШАГ 4: Укажите Ваш контактный номер телефона для связи*\n` +
          `(Например: \`+7 937 214-42-05\` или отправьте контакт через кнопку ниже):`;

        const contactKb = {
          keyboard: [
            [{ text: '📱 Отправить мой номер телефона', request_contact: true }],
            [{ text: '⬅️ Отмена' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: phoneMsg,
            parse_mode: 'Markdown',
            reply_markup: contactKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Если пользователь в процессе ввода телефона (Завершение записи)
      if (session.step === 'awaiting_phone' || update.message.contact) {
        const phone = update.message.contact?.phone_number || text;
        session.phone = phone;

        // Создаем запись в базе данных Supabase
        const { data: newBooking, error } = await supabase
          .from('bookings')
          .insert({
            service_title: session.service_title || SERVICES[0].title,
            price: session.price || SERVICES[0].price,
            parent_name: firstName,
            phone: phone,
            telegram_handle: username,
            child_name: session.child_name || 'Ученик',
            child_grade: 'Подготовка к школе',
            status: 'pending_payment',
            admin_notes: `Запись создана через Telegram-бот (${new Date().toLocaleString('ru-RU')})`,
          })
          .select()
          .single();

        delete userSessions[userId];

        // Получаем реквизиты из настроек
        const { data: settings } = await supabase.from('settings').select('*').limit(1);
        const set = settings && settings[0] ? settings[0] : null;
        const sbpPhone = set?.phone || '+7 (937) 214-42-05';
        const cardNum = set?.card_number || '2202 2024 1122 3344';
        const recipient = set?.recipient || 'Скокова Юлия Павловна';

        const successMsg = `🎉 *УРОК УСПЕШНО ЗАБРОНИРОВАН!*\n\n` +
          `📚 *Программа:* ${session.service_title || SERVICES[0].title}\n` +
          `👶 *Ученик:* ${session.child_name || 'Ученик'}\n` +
          `📞 *Телефон:* ${phone}\n` +
          `💰 *К оплате:* *${session.price || SERVICES[0].price} ₽*\n\n` +
          `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ (СБП):*\n` +
          `📱 *Телефон:* \`${sbpPhone}\`\n` +
          `💳 *Карта:* \`${cardNum}\`\n` +
          `👤 *Получатель:* ${recipient}\n\n` +
          `📸 *Отправьте фото/скриншот чека об оплате прямо в этот чат!* Бот автоматически передаст его педагогу на проверку.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: successMsg,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "📚 3) Программы и тарифы"
      if (text.includes('3) Программы') || text.includes('Программы') || text === '/programs') {
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
            [{ text: '📅 Записаться прямо сейчас', callback_data: 'start_booking' }],
            [{ text: '🌐 Открыть интерактивное Mini App', web_app: { url: twaUrl } }],
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

      // Кнопка "👤 2) Мой кабинет"
      if (text.includes('2) Мой кабинет') || text.includes('Мой кабинет') || text === '/my') {
        let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });

        if (username) {
          query = query.ilike('telegram_handle', username);
        }

        const { data: bookings } = await query.limit(5);

        let cabMsg = `👤 *ЛИЧНЫЙ КАБИНЕТ РОДИТЕЛЯ*\n` +
          `Telegram: ${username || firstName}\n\n`;

        if (!bookings || bookings.length === 0) {
          cabMsg += `У вас пока нет активных записей.\n` +
            `Нажмите кнопку *«📅 1) Записаться на урок»* в меню ниже для выбора времени!`;
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
            [{ text: '📅 Записаться на новый урок', callback_data: 'start_booking' }],
            [{ text: '🌐 Войти через Mini App', web_app: { url: `${baseUrl}/my-dashboard` } }],
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

      // Кнопка "💳 4) Реквизиты оплаты"
      if (text.includes('4) Реквизиты') || text.includes('Реквизиты') || text === '/payment') {
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
          `📸 *Отправьте фото/скриншот чека прямо в этот чат после оплаты!*`;

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

      // Кнопка "💬 5) Связаться с педагогом"
      if (text.includes('5) Связаться') || text.includes('Педагог') || text.includes('Связаться')) {
        const contactMsg = `👩‍🏫 *СВЯЗЬ С ПЕДАГОГОМ*\n\n` +
          `*Скокова Юлия Павловна*\n` +
          `Эксперт по развитию и подготовке к школе (опыт 30+ лет).\n\n` +
          `📲 Личный Telegram: [@ssharonovv](https://t.me/ssharonovv)\n` +
          `📞 Телефон: +7 (937) 214-42-05\n\n` +
          `Задайте любой вопрос или напишите педагогу прямо сейчас!`;

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
    // 3. ОБРАБОТКА CALLBACK QUERIES (ИНЛАЙН КНОПКИ)
    // -------------------------------------------------------------
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const userId = callbackQuery.from?.id || chatId;
      const messageId = callbackQuery.message.message_id;

      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });

      // Выбор программы в инлайн записи
      if (callbackData.startsWith('select_service_')) {
        const idx = parseInt(callbackData.replace('select_service_', ''), 10);
        const selected = SERVICES[idx] || SERVICES[0];

        userSessions[userId] = {
          step: 'awaiting_slot',
          service_title: selected.title,
          price: selected.price,
        };

        // Запрашиваем свободные слоты из базы Supabase
        const { data: slots } = await supabase
          .from('time_slots')
          .select('*')
          .eq('is_booked', false)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(8);

        let slotsMsg = `📅 *ВЫБЕРИТЕ УДОБНОЕ ВРЕМЯ ЗАНЯТИЯ*\n\n` +
          `Выбрано направление: *${selected.title}* (${selected.price} ₽)\n\n`;

        let inlineSlots: any[] = [];
        if (slots && slots.length > 0) {
          slotsMsg += `Доступные даты и слоты:`;
          inlineSlots = slots.map((slot: any) => {
            const dateStr = new Date(slot.start_time).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Europe/Samara',
            });
            return [{ text: `⏰ ${dateStr}`, callback_data: `select_slot_${slot.id}` }];
          });
        } else {
          slotsMsg += `В данный момент доступные слоты на эту неделю формируются.\nВыберите любое удобное время, написав сообщение далее!`;
          inlineSlots = [[{ text: '✨ Продолжить запись', callback_data: 'select_slot_custom' }]];
        }

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: slotsMsg,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: inlineSlots },
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Выбор слота времени
      if (callbackData.startsWith('select_slot_')) {
        const slotId = callbackData.replace('select_slot_', '');
        const session = userSessions[userId] || {};
        session.slot_id = slotId;
        session.step = 'awaiting_child_data';
        userSessions[userId] = session;

        const promptChildMsg = `👶 *ШАГ 3: УКАЖИТЕ ДАННЫЕ РЕБЁНКА*\n\n` +
          `Напишите в ответном сообщении *Имя* и *Класс / Возраст* ребёнка.\n` +
          `(Например: \`Артём, Подготовка к школе\` или \`София, 3 класс\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: promptChildMsg,
            parse_mode: 'Markdown',
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Запуск записи через инлайн кнопку
      if (callbackData === 'start_booking') {
        userSessions[userId] = { step: 'awaiting_service' };

        let servicesMsg = `🎯 *ВЫБЕРИТЕ НАПРАВЛЕНИЕ ОБУЧЕНИЯ*\n\n`;
        SERVICES.forEach((s, idx) => {
          servicesMsg += `*${idx + 1}. ${s.title}*\n` +
            `⏱ ${s.duration_minutes} мин • 💰 *${s.price} ₽*\n` +
            `📖 ${s.description}\n\n`;
        });

        const inlineServices = {
          inline_keyboard: SERVICES.map((s, i) => [
            { text: `👉 ${s.title} (${s.price} ₽)`, callback_data: `select_service_${i}` },
          ]),
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: servicesMsg,
            parse_mode: 'Markdown',
            reply_markup: inlineServices,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кабинет инлайн
      if (callbackData === 'native_cabinet') {
        const username = callbackQuery.from?.username ? `@${callbackQuery.from.username}` : '';
        const firstName = callbackQuery.from?.first_name || 'Гость';

        let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
        if (username) {
          query = query.ilike('telegram_handle', username);
        }

        const { data: bookings } = await query.limit(5);

        let cabMsg = `👤 *ЛИЧНЫЙ КАБИНЕТ РОДИТЕЛЯ*\n` +
          `Telegram: ${username || firstName}\n\n`;

        if (!bookings || bookings.length === 0) {
          cabMsg += `У вас пока нет активных записей.\n` +
            `Нажмите кнопку *«📅 1) Записаться на урок»* ниже!`;
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
            [{ text: '📅 Записаться на урок', callback_data: 'start_booking' }],
            [{ text: '🌐 Открыть веб-кабинет в Mini App', web_app: { url: `${baseUrl}/my-dashboard` } }],
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

      // Реквизиты инлайн
      if (callbackData === 'payment_info') {
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
          `📸 *Отправьте фото/скриншот чека прямо в этот чат после перевода!*`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: payMsg,
            parse_mode: 'Markdown',
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Подтверждение или отмена педагогом
      const [action, bookingId] = callbackData.split('_');

      if (action === 'confirm') {
        await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', bookingId);

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
