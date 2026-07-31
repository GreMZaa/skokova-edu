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
  child_name?: string;
  child_grade?: string;
  phone?: string;
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

    // Главное постоянное меню Telegram бота (Bottom Reply Keyboard)
    const mainReplyKeyboard = {
      keyboard: [
        [
          { text: '📅 Записаться на урок' },
          { text: '👤 Мой кабинет' },
        ],
        [
          { text: '📚 Программы и тарифы' },
          { text: '💳 Реквизиты оплаты' },
        ],
        [
          { text: '💬 Связаться с педагогом' },
        ],
      ],
      resize_keyboard: true,
    };

    // Клавиатура отмены / возврата
    const cancelKeyboard = {
      keyboard: [
        [{ text: '⬅️ Назад в главное меню' }],
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
              `Скокова Юлия Павловна свяжется с Вами и подтвердит время занятия. Статус записи можно отслеживать в разделе *«👤 Мой кабинет»*.`,
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
            text: `📑 Мы получили Ваш чек. Чтобы привязать его к записи, сначала нажмите *«📅 Записаться на урок»* в меню ниже.`,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });
      }

      return NextResponse.json({ success: true });
    }

    // -------------------------------------------------------------
    // 2. ОБРАБОТКА СООБЩЕНИЙ, КОМАНД И КОНТАКТОВ В ЧАТЕ TELEGRAM
    // -------------------------------------------------------------
    if (update.message && (update.message.text !== undefined || update.message.contact !== undefined)) {
      const chatId = update.message.chat.id;
      const userId = update.message.from?.id || chatId;
      const text = (update.message.text || '').trim();
      const username = update.message.from?.username ? `@${update.message.from.username}` : '';
      const firstName = update.message.from?.first_name || 'Гость';

      const session = userSessions[userId] || {};

      // Нажатие на "⬅️ Назад в главное меню" или "/cancel"
      if (text.includes('Назад') || text.includes('Отмена') || text === '/cancel') {
        delete userSessions[userId];

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '👌 Вы вернулись в главное меню. Выберите нужный раздел:',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Команда /start
      if (text.startsWith('/start')) {
        delete userSessions[userId];

        const welcomeText = `👋 *Здравствуйте, ${firstName}!*\n\n` +
          `Вас приветствует бот педагога *Скоковой Юлии Павловны* — эксперта по подготовке к школе (5–7 лет) и репетитора 1–4 классов (опыт 30+ лет).\n\n` +
          `✨ *Все возможности доступны прямо в меню ниже:*\n` +
          `• 📅 Запись на уроки и выбор времени\n` +
          `• 👤 Кабинет родителя и история занятий\n` +
          `• 📚 Программы, тарифы и реквизиты СБП\n\n` +
          `Выберите нужный раздел на нижней клавиатуре:`;

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

      // Кнопка "📅 Записаться на урок" -> Перевод меню на выбор тарифа
      if (text.includes('Записаться') || text === '/book') {
        userSessions[userId] = { step: 'select_service' };

        let servicesMsg = `🎯 *ШАГ 1: ВЫБЕРИТЕ ПРОГРАММУ ЗАНЯТИЙ*\n\n` +
          `1️⃣ *Онлайн-занятие (Индивидуально)* — 600 ₽ / 40 мин\n` +
          `Индивидуальный урок по математике, чтению или грамоте через Zoom / Яндекс Телемост.\n\n` +
          `2️⃣ *Оффлайн-занятие (В кабинете)* — 800 ₽ / 40 мин\n` +
          `Очный урок в оборудованном кабинете педагога в г. Тольятти.\n\n` +
          `Выберите нужный вариант на клавиатуре внизу:`;

        const serviceReplyKeyboard = {
          keyboard: [
            [{ text: '👉 Онлайн-занятие (600 ₽)' }],
            [{ text: '👉 Оффлайн-занятие (800 ₽)' }],
            [{ text: '⬅️ Назад в главное меню' }],
          ],
          resize_keyboard: true,
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: servicesMsg,
            parse_mode: 'Markdown',
            reply_markup: serviceReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Выбор программы в нижнем меню -> Переход к ШАГУ 2 (Запрос Имени)
      if (session.step === 'select_service' || text.includes('Онлайн-занятие') || text.includes('Оффлайн-занятие')) {
        const isOffline = text.includes('Оффлайн');
        const selectedTitle = isOffline ? 'Оффлайн-занятие (В кабинете)' : 'Онлайн-занятие (Индивидуально)';
        const selectedPrice = isOffline ? 800 : 600;

        userSessions[userId] = {
          step: 'awaiting_child_name',
          service_title: selectedTitle,
          price: selectedPrice,
        };

        const namePromptMsg = `👍 Выбрано: *${selectedTitle}* (${selectedPrice} ₽)\n\n` +
          `👶 *ШАГ 2: Укажите имя ребёнка*\n` +
          `Напишите в сообщении ниже, как зовут ребёнка (например: \`Артём\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: namePromptMsg,
            parse_mode: 'Markdown',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 2: Пользователь ввёл ИМЯ -> Переход к ШАГУ 3 (Запрос Возраста / Класса)
      if (session.step === 'awaiting_child_name' && text) {
        session.child_name = text;
        session.step = 'awaiting_child_age_grade';
        userSessions[userId] = session;

        const agePromptMsg = `👍 Имя ребёнка: *${text}*\n\n` +
          `🎓 *ШАГ 3: Укажите возраст или класс ребёнка*\n` +
          `Напишите в сообщении ниже (например: \`6 лет, Подготовка к школе\` или \`3 класс\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: agePromptMsg,
            parse_mode: 'Markdown',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 3: Пользователь ввёл ВОЗРАСТ/КЛАСС -> Переход к ШАГУ 4 (Запрос Телефона)
      if (session.step === 'awaiting_child_age_grade' && text) {
        session.child_grade = text;
        session.step = 'awaiting_phone';
        userSessions[userId] = session;

        const phonePromptMsg = `👍 Возраст / Класс: *${text}*\n\n` +
          `📱 *ШАГ 4: Укажите Ваш контактный номер телефона*\n` +
          `Нажмите кнопку *«📱 Отправить мой номер телефона»* внизу или введите номер вручную:`;

        const contactKb = {
          keyboard: [
            [{ text: '📱 Отправить мой номер телефона', request_contact: true }],
            [{ text: '⬅️ Назад в главное меню' }],
          ],
          resize_keyboard: true,
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: phonePromptMsg,
            parse_mode: 'Markdown',
            reply_markup: contactKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 4: Пользователь передал номер (кнопкой контактов или текстом) -> СОХРАНЕНИЕ В SUPABASE
      if (session.step === 'awaiting_phone' || update.message.contact !== undefined) {
        const phone = update.message.contact?.phone_number || text;
        session.phone = phone;

        // Создаем запись в базе данных Supabase
        await supabase
          .from('bookings')
          .insert({
            service_title: session.service_title || SERVICES[0].title,
            price: session.price || SERVICES[0].price,
            parent_name: firstName,
            phone: phone,
            telegram_handle: username,
            child_name: session.child_name || 'Ученик',
            child_grade: session.child_grade || 'Подготовка к школе',
            status: 'pending_payment',
            admin_notes: `Запись создана через Telegram-бот (${new Date().toLocaleString('ru-RU')})`,
          });

        delete userSessions[userId];

        // Получаем реквизиты из настроек
        const { data: settings } = await supabase.from('settings').select('*').limit(1);
        const set = settings && settings[0] ? settings[0] : null;
        const sbpPhone = set?.phone || '+7 (937) 214-42-05';
        const cardNum = set?.card_number || '2202 2024 1122 3344';
        const recipient = set?.recipient || 'Скокова Юлия Павловна';

        const successMsg = `🎉 *УРОК УСПЕШНО ЗАБРОНИРОВАН!*\n\n` +
          `📚 *Программа:* ${session.service_title || SERVICES[0].title}\n` +
          `👶 *Ученик:* ${session.child_name || 'Ученик'} (${session.child_grade || 'Подготовка к школе'})\n` +
          `📞 *Телефон:* ${phone}\n` +
          `💰 *К оплате:* *${session.price || SERVICES[0].price} ₽*\n\n` +
          `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ (СБП):*\n` +
          `📱 *Телефон:* \`${sbpPhone}\`\n` +
          `💳 *Карта:* \`${cardNum}\`\n` +
          `👤 *Получатель:* ${recipient}\n\n` +
          `📸 *Отправьте фото/скриншот чека прямо в этот чат!* Бот автоматически передаст его педагогу на проверку.`;

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

        programsMsg += `💡 *Тарифы:* Онлайн-урок — *600 ₽* / 40 мин, Оффлайн — *800 ₽* / 40 мин.\n\n` +
          `Для записи нажмите кнопку *«📅 Записаться на урок»* в меню ниже.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: programsMsg,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "👤 Мой кабинет"
      if (text.includes('Мой кабинет') || text === '/my') {
        let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });

        if (username) {
          query = query.ilike('telegram_handle', username);
        }

        const { data: bookings } = await query.limit(5);

        let cabMsg = `👤 *ЛИЧНЫЙ КАБИНЕТ РОДИТЕЛЯ*\n` +
          `Telegram: ${username || firstName}\n\n`;

        if (!bookings || bookings.length === 0) {
          cabMsg += `У вас пока нет активных записей.\n` +
            `Нажмите кнопку *«📅 Записаться на урок»* в меню ниже для выбора времени!`;
        } else {
          cabMsg += `📋 *Ваши последние записи:*\n\n`;
          bookings.forEach((b: any, i: number) => {
            const statusStr = b.status === 'confirmed' ? '✅ Подтверждена' :
              b.status === 'pending_payment' ? '⏳ Ожидает оплаты' :
              b.status === 'receipt_uploaded' ? '📑 Чек на проверке' : b.status;
            cabMsg += `*${i + 1}. ${b.service_title}*\n` +
              `👶 Ученик: ${b.child_name} (${b.child_grade})\n` +
              `📌 Статус: *${statusStr}*\n` +
              `💰 Сумма: ${b.price} ₽\n\n`;
          });
        }

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: cabMsg,
            parse_mode: 'Markdown',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "💳 Реквизиты оплаты"
      if (text.includes('Реквизиты') || text === '/payment') {
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

      // Кнопка "💬 Связаться с педагогом"
      if (text.includes('Педагог') || text.includes('Связаться')) {
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
    // 3. ОБРАБОТКА CALLBACK QUERIES (КЛИКИ ИНЛАЙН КНОПОК ПЕДАГОГА)
    // -------------------------------------------------------------
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const callbackData = callbackQuery.data;
      const chatId = callbackQuery.message.chat.id;
      const messageId = callbackQuery.message.message_id;

      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQuery.id }),
      });

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
