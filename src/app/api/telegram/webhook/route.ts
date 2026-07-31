import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { SERVICES } from '@/data/services';

export const dynamic = 'force-dynamic';

const sanitizeEnv = (val?: string) => (val || '').replace(/["'\r\n]/g, '').trim();

function mapChildGradeToEnum(rawText: string): 'preschool_5' | 'preschool_6' | 'grade_1' | 'grade_2' | 'grade_3' | 'grade_4' {
  const lower = (rawText || '').toLowerCase();
  if (lower.includes('1')) return 'grade_1';
  if (lower.includes('2')) return 'grade_2';
  if (lower.includes('3')) return 'grade_3';
  if (lower.includes('4')) return 'grade_4';
  if (lower.includes('5')) return 'preschool_5';
  if (lower.includes('6')) return 'preschool_6';
  return 'preschool_6';
}

async function getRequisites(supabase: any) {
  const { data: dbSettings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'requisites')
    .maybeSingle();

  const phone = dbSettings?.phone || '+7 (960) 837-47-06';
  const cardNumber = dbSettings?.card_number || '';
  const bankName = dbSettings?.bank_name || 'Т-Банк / Сбербанк';
  const recipient = dbSettings?.recipient || 'Скокова Юлия Павловна';

  return { phone, cardNumber, bankName, recipient };
}

async function getOrCreateUserProfile(
  supabase: any,
  params: {
    telegramId: number;
    firstName: string;
    username?: string;
    phone?: string;
    fullName?: string;
  }
) {
  const { telegramId, firstName, username, phone, fullName } = params;
  const parentName = fullName || firstName || 'Родитель';
  const cleanPhoneDigits = phone ? phone.replace(/\D/g, '') : '';
  const last10Phone = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : '';
  const email = `tg_${telegramId}@skokova-edu.ru`;
  const password = `Tg_${telegramId}!`;

  // 1. Поиск по telegram_handle в существующих профилях (без учета регистра)
  if (username) {
    const handleWithoutAt = username.replace('@', '').toLowerCase();
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    const existingByHandle = allProfiles?.find((p: any) =>
      p.telegram_handle && p.telegram_handle.replace('@', '').toLowerCase() === handleWithoutAt
    );

    if (existingByHandle) {
      await supabase.from('profiles').update({
        full_name: parentName !== 'Родитель' ? parentName : existingByHandle.full_name,
        phone: phone || existingByHandle.phone,
        telegram_handle: username,
        updated_at: new Date().toISOString(),
      }).eq('id', existingByHandle.id);

      return existingByHandle.id;
    }
  }

  // 2. Поиск по номеру телефона (сравнение последних 10 цифр с профилями сайта)
  if (last10Phone) {
    const { data: allProfiles } = await supabase.from('profiles').select('*');
    const existingByPhone = allProfiles?.find((p: any) =>
      p.phone && p.phone.replace(/\D/g, '').endsWith(last10Phone)
    );

    if (existingByPhone) {
      await supabase.from('profiles').update({
        full_name: parentName !== 'Родитель' ? parentName : existingByPhone.full_name,
        phone: phone || existingByPhone.phone,
        telegram_handle: username || existingByPhone.telegram_handle,
        updated_at: new Date().toISOString(),
      }).eq('id', existingByPhone.id);

      return existingByPhone.id;
    }

    // Поиск по предыдущим бронированиям с сайта
    const { data: pastBookings } = await supabase
      .from('bookings')
      .select('user_id, parent_name, phone')
      .not('user_id', 'is', null);

    const matchedBooking = pastBookings?.find((b: any) =>
      b.phone && b.phone.replace(/\D/g, '').endsWith(last10Phone)
    );

    if (matchedBooking && matchedBooking.user_id) {
      await supabase.from('profiles').upsert({
        id: matchedBooking.user_id,
        full_name: parentName !== 'Родитель' ? parentName : matchedBooking.parent_name,
        phone: phone || matchedBooking.phone,
        telegram_handle: username || null,
        updated_at: new Date().toISOString(),
      });

      return matchedBooking.user_id;
    }
  }

  // 3. Поиск по email/telegramId в Supabase Auth
  const { data: authList } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authList?.users?.find(
    (u: any) => u.email === email || u.user_metadata?.telegram_id === telegramId
  );

  if (existingAuthUser) {
    await supabase.from('profiles').upsert({
      id: existingAuthUser.id,
      full_name: parentName,
      phone: phone || '',
      telegram_handle: username || null,
      updated_at: new Date().toISOString(),
    });

    return existingAuthUser.id;
  }

  // 4. СОЗДАНИЕ НОВОГО ПРОФИЛЯ: Только если пользователь впервые
  const { data: authUserData, error: authErr } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      full_name: parentName,
      telegram_handle: username,
      telegram_id: telegramId,
    },
  });

  let parentUserId = authUserData?.user?.id || '';

  if (!parentUserId && authErr) {
    console.error('Supabase Auth user creation error:', authErr);
  }

  if (parentUserId) {
    await supabase.from('profiles').upsert({
      id: parentUserId,
      full_name: parentName,
      phone: phone || '',
      telegram_handle: username || null,
    });
  }

  return parentUserId;
}

// Персистентность сессий пользователей в Supabase Auth user_metadata
async function getUserSession(supabase: any, parentUserId: string) {
  if (!parentUserId) return {};
  try {
    const { data } = await supabase.auth.admin.getUserById(parentUserId);
    return data?.user?.user_metadata?.telegram_session || {};
  } catch (e) {
    return {};
  }
}

async function setUserSession(supabase: any, parentUserId: string, session: any) {
  if (!parentUserId) return;
  try {
    const { data: userRes } = await supabase.auth.admin.getUserById(parentUserId);
    const currentMetadata = userRes?.user?.user_metadata || {};
    await supabase.auth.admin.updateUserById(parentUserId, {
      user_metadata: { ...currentMetadata, telegram_session: session },
    });
  } catch (e) {
    console.error('Error setting user session:', e);
  }
}

async function clearUserSession(supabase: any, parentUserId: string) {
  if (!parentUserId) return;
  try {
    const { data: userRes } = await supabase.auth.admin.getUserById(parentUserId);
    const currentMetadata = userRes?.user?.user_metadata || {};
    delete currentMetadata.telegram_session;
    await supabase.auth.admin.updateUserById(parentUserId, {
      user_metadata: currentMetadata,
    });
  } catch (e) {
    console.error('Error clearing user session:', e);
  }
}

// Построитель компактной сетки выбора слотов даты и времени (Инлайн-клавиатура < 64 байт!)
async function buildSlotInlineKeyboard(supabase: any, page: number = 0) {
  const nowIso = new Date().toISOString();

  const { data: slots } = await supabase
    .from('time_slots')
    .select('*')
    .eq('is_booked', false)
    .gte('start_time', nowIso)
    .order('start_time', { ascending: true });

  const validSlots = slots || [];
  const pageSize = 6;
  const totalPages = Math.ceil(validSlots.length / pageSize) || 1;
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const pageSlots = validSlots.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const inline_keyboard: any[][] = [];

  for (let i = 0; i < pageSlots.length; i += 2) {
    const row: any[] = [];

    const slot1 = pageSlots[i];
    const dateStr1 = new Date(slot1.start_time).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Samara',
    });
    row.push({
      text: `🗓 ${dateStr1}`,
      callback_data: `slot_${slot1.id}`,
    });

    if (i + 1 < pageSlots.length) {
      const slot2 = pageSlots[i + 1];
      const dateStr2 = new Date(slot2.start_time).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Samara',
      });
      row.push({
        text: `🗓 ${dateStr2}`,
        callback_data: `slot_${slot2.id}`,
      });
    }

    inline_keyboard.push(row);
  }

  const navRow: any[] = [];
  if (currentPage > 0) {
    navRow.push({ text: '◀️ Раньше', callback_data: `page_${currentPage - 1}` });
  }
  if (currentPage < totalPages - 1) {
    navRow.push({ text: 'Позже ▶️', callback_data: `page_${currentPage + 1}` });
  }
  if (navRow.length > 0) {
    inline_keyboard.push(navRow);
  }

  return { inline_keyboard, totalSlots: validSlots.length, currentPage, totalPages };
}

async function syncBotDescription(botToken: string) {
  try {
    const desc = 'Онлайн-школа и репетиторский центр Скоковой Юлии Павловны.\n\nПодготовка к школе (5–7 лет), математика, чтение, подготовка к 1–4 классам.\n\nЗапись на уроки, личный кабинет и консультации.';
    const shortDesc = 'Официальный бот педагога Скоковой Юлии Павловны. Запись на уроки и личный кабинет.';

    await fetch(`https://api.telegram.org/bot${botToken}/setMyDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc }),
    });

    await fetch(`https://api.telegram.org/bot${botToken}/setMyShortDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_description: shortDesc }),
    });
  } catch (e) {
    // Silent ignore
  }
}

export async function POST(req: Request) {
  try {
    const update = await req.json();
    let botToken = sanitizeEnv(process.env.TELEGRAM_BOT_TOKEN);
    if (!botToken || botToken.length < 20) {
      botToken = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
    }

    const teacherChatId = sanitizeEnv(process.env.TELEGRAM_TEACHER_CHAT_ID) || '-5128191766';
    const supabase = createAdminClient();

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

    // Прямая инлайн-кнопка для связи с Юлией Павловной
    const yuliaContactInlineKb = {
      inline_keyboard: [
        [{ text: '💬 Написать в Telegram', url: 'https://t.me/+79608374706' }],
      ],
    };

    // -------------------------------------------------------------
    // 1. ОБРАБОТКА ПОЛУЧЕНИЯ ФОТО / ЧЕКА В ЧАТЕ TELEGRAM
    // -------------------------------------------------------------
    if (update.message && (update.message.photo || update.message.document)) {
      const chatId = update.message.chat.id;
      const username = update.message.from?.username ? `@${update.message.from.username}` : '';
      const firstName = update.message.from?.first_name || 'Родитель';

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('status', 'pending_payment')
        .order('created_at', { ascending: false })
        .limit(10);

      const pendingBooking = bookings?.find((b: any) => 
        (username && b.telegram_handle && b.telegram_handle.toLowerCase() === username.toLowerCase()) ||
        (b.parent_name && b.parent_name.toLowerCase() === firstName.toLowerCase())
      ) || bookings?.[0];

      let photoFileId = '';
      if (update.message.photo && update.message.photo.length > 0) {
        photoFileId = update.message.photo[update.message.photo.length - 1].file_id;
      } else if (update.message.document) {
        photoFileId = update.message.document.file_id;
      }

      if (pendingBooking) {
        await supabase
          .from('bookings')
          .update({
            status: 'receipt_uploaded',
            admin_notes: `Чек получен в Telegram (${new Date().toLocaleString('ru-RU')})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pendingBooking.id);

        const caption = `📑 *НОВЫЙ ЧЕК ОБ ОПЛАТЕ ЗАНЯТИЯ!*\n\n` +
          `👤 *Родитель:* ${pendingBooking.parent_name || firstName} (${username || 'без ника'})\n` +
          `📞 *Телефон:* \`${pendingBooking.phone || 'не указан'}\`\n` +
          `👶 *Ученик:* ${pendingBooking.child_name}\n` +
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

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ *Ваш чек успешно получен и отправлен педагогу на проверку!*\n\n` +
              `Скокова Юлия Павловна свяжется с Вами и подтвердит время занятия. Статус записи можно отслеживать в разделе *«👤 Мой кабинет»*.`,
            parse_mode: 'Markdown',
            reply_markup: yuliaContactInlineKb,
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
      const firstName = update.message.from?.first_name || 'Родитель';

      const parentUserId = await getOrCreateUserProfile(supabase, {
        telegramId: userId,
        firstName: firstName,
        username: username,
      });

      let session = await getUserSession(supabase, parentUserId);

      // ПРИОРИТЕТ 1: Если нажата кнопка главного меню или Отмена -> Сразу очищаем шаг записи и выполняем меню!
      const isMenuCommand = 
        text.includes('Назад') || text.includes('Отмена') || text === '/cancel' ||
        text.startsWith('/start') ||
        text.includes('Записаться') || text === '/book' ||
        text.includes('Мой кабинет') || text === '/my' ||
        text.includes('Программы') || text === '/programs' ||
        text.includes('Реквизиты') || text === '/payment' ||
        text.includes('Педагог') || text.includes('Связаться');

      if (isMenuCommand) {
        // Очищаем активный шаг записи
        await clearUserSession(supabase, parentUserId);
        session = {};
      }

      // Отмена / Назад в главное меню
      if (text.includes('Назад') || text.includes('Отмена') || text === '/cancel') {
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

      // Команда /start -> Сразу создаем Личный кабинет в Supabase
      if (text.startsWith('/start')) {
        syncBotDescription(botToken);

        const welcomeText = `👋 *Здравствуйте, ${firstName}!*\n\n` +
          `Вас приветствует бот педагога *Скоковой Юлии Павловны* — эксперта по подготовке к школе (5–7 лет) и репетитора 1–4 классов (опыт 30+ лет).\n\n` +
          `✨ *Ваш Личный кабинет создан! Все возможности доступны ниже:*\n` +
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

      // Кнопка "📅 Записаться на урок" -> ШАГ 1: Перевод меню на выбор тарифа (Инлайн-кнопки)
      if (text.includes('Записаться') || text === '/book') {
        session = { step: 'select_service' };
        await setUserSession(supabase, parentUserId, session);

        let servicesMsg = `🎯 *ШАГ 1: ВЫБЕРИТЕ ПРОГРАММУ ЗАНЯТИЙ*\n\n` +
          `1️⃣ *Онлайн-занятие (Индивидуально)* — 600 ₽ / 40 мин\n` +
          `Индивидуальный урок по математике, чтению или грамоте через Zoom / Яндекс Телемост.\n\n` +
          `2️⃣ *Оффлайн-занятие (В кабинете)* — 800 ₽ / 40 мин\n` +
          `Очный урок в оборудованном кабинете педагога в г. Тольятти.\n\n` +
          `Нажмите на нужную программу ниже:`;

        const serviceInlineKeyboard = {
          inline_keyboard: [
            [{ text: '👉 Онлайн-занятие (600 ₽)', callback_data: 'service_online' }],
            [{ text: '👉 Оффлайн-занятие (800 ₽)', callback_data: 'service_offline' }],
          ],
        };

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: servicesMsg,
            parse_mode: 'Markdown',
            reply_markup: serviceInlineKeyboard,
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
              `👶 Ученик: ${b.child_name}\n` +
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
        const reqs = await getRequisites(supabase);

        let payDetailsStr = `📱 *Телефон (СБП):* \`${reqs.phone}\`\n`;
        if (reqs.cardNumber) {
          payDetailsStr += `💳 *Карта:* \`${reqs.cardNumber}\`\n`;
        }
        payDetailsStr += `🏦 *Банк:* ${reqs.bankName}\n` +
          `👤 *Получатель:* ${reqs.recipient}`;

        const payMsg = `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ ЗАНЯТИЙ (СБП)*\n\n${payDetailsStr}\n\n` +
          `📸 *Отправьте фото/скриншот чека прямо в этот чат после оплаты!*`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: payMsg,
            parse_mode: 'Markdown',
            reply_markup: yuliaContactInlineKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Кнопка "💬 Связаться с педагогом"
      if (text.includes('Педагог') || text.includes('Связаться')) {
        const contactMsg = `👩‍🏫 *СВЯЗЬ С ПЕДАГОГОМ*\n\n` +
          `*Скокова Юлия Павловна*\n` +
          `Эксперт по развитию и подготовке к школе (опыт 30+ лет).\n\n` +
          `📞 Телефон: +7 (960) 837-47-06\n\n` +
          `Нажмите кнопку ниже, чтобы перейти в личный чат с Юлией Павловной:`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: contactMsg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: yuliaContactInlineKb,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // -------------------------------------------------------------
      // ПОШАГОВЫЙ ДИАЛОГ ЗАПИСИ НА УРОК (Только если не нажата кнопка меню!)
      // -------------------------------------------------------------

      // ШАГ 1 -> ШАГ 2: Выбор даты и времени занятия (если отправлен текст из старой клавиатуры)
      if (session.step === 'select_service' || text.includes('Онлайн-занятие') || text.includes('Оффлайн-занятие')) {
        const isOffline = text.includes('Оффлайн');
        const selectedTitle = isOffline ? 'Оффлайн-занятие (В кабинете)' : 'Онлайн-занятие (Индивидуально)';
        const selectedPrice = isOffline ? 800 : 600;

        session = {
          step: 'select_slot_time',
          service_title: selectedTitle,
          price: selectedPrice,
        };
        await setUserSession(supabase, parentUserId, session);

        const { inline_keyboard, totalSlots } = await buildSlotInlineKeyboard(supabase, 0);

        let slotMsg = `🎯 *ВЫБРАНО:* ${selectedTitle} (${selectedPrice} ₽)\n\n` +
          `⏰ *ШАГ 2: ВЫБЕРИТЕ ДАТУ И ВРЕМЯ ЗАНЯТИЯ*\n\n`;

        if (totalSlots === 0) {
          slotMsg += `⚠️ На ближайшие дни пока нет свободных слотов в расписании. Попробуйте записаться позже!`;
        } else {
          slotMsg += `Выберите свободный день и время на интерактивной клавиатуре ниже:`;
        }

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: slotMsg,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
          }),
        });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '👇 Выберите удобный слот выше:',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 2 -> ШАГ 3: Если время введено сообщением вручную
      if (session.step === 'select_slot_time' && text) {
        session.slot_time = text.replace('⏰', '').trim();
        session.step = 'awaiting_parent_name';
        await setUserSession(supabase, parentUserId, session);

        const parentPromptMsg = `👍 Время: *${session.slot_time}*\n\n` +
          `👤 *ШАГ 3: Как к Вам обращаться?*\n` +
          `Напишите Ваше имя (например: \`${firstName}\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: parentPromptMsg,
            parse_mode: 'Markdown',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 3 -> ШАГ 4: Запрос имени ребёнка
      if (session.step === 'awaiting_parent_name' && text) {
        session.parent_name = text;
        session.step = 'awaiting_child_name';
        await setUserSession(supabase, parentUserId, session);

        const childNamePromptMsg = `👍 Родитель: *${text}*\n\n` +
          `👶 *ШАГ 4: Как зовут ребёнка?*\n` +
          `Напишите только имя ребёнка (например: \`Артём\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: childNamePromptMsg,
            parse_mode: 'Markdown',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // ШАГ 4 -> ШАГ 5: Запрос возраста / класса ребёнка
      if (session.step === 'awaiting_child_name' && text) {
        session.child_name = text;
        session.step = 'awaiting_child_age_grade';
        await setUserSession(supabase, parentUserId, session);

        const agePromptMsg = `👍 Ребёнок: *${text}*\n\n` +
          `🎓 *ШАГ 5: Укажите возраст или класс ребёнка*\n` +
          `Напишите в сообщении (например: \`6 лет, Подготовка к школе\` или \`3 класс\`):`;

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

      // ШАГ 5 -> ШАГ 6: Запрос номера телефона
      if (session.step === 'awaiting_child_age_grade' && text) {
        session.child_grade = text;
        session.step = 'awaiting_phone';
        await setUserSession(supabase, parentUserId, session);

        const phonePromptMsg = `👍 Возраст / Класс: *${text}*\n\n` +
          `📱 *ШАГ 6: Укажите Ваш контактный номер телефона*\n` +
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

      // ШАГ 6: Сохранение бронирования в Supabase DB + создание профиля родителя и ребёнка
      if (session.step === 'awaiting_phone' || update.message.contact !== undefined) {
        const phone = update.message.contact?.phone_number || text;
        session.phone = phone;

        const parentNameOnly = session.parent_name || firstName;
        const childNameOnly = session.child_name || 'Ученик';
        const rawGrade = session.child_grade || '';
        const mappedGrade = mapChildGradeToEnum(rawGrade);

        // 1. Автоматическое обновление профиля родителя в Supabase Auth и таблице `profiles`
        await getOrCreateUserProfile(supabase, {
          telegramId: userId,
          firstName: firstName,
          username: username,
          phone: phone,
          fullName: parentNameOnly,
        });

        // 2. Автоматическое создание/привязка ребёнка в таблице `children`
        if (childNameOnly && parentUserId) {
          const { data: existingChild } = await supabase
            .from('children')
            .select('id')
            .eq('parent_id', parentUserId)
            .ilike('name', childNameOnly)
            .maybeSingle();

          if (!existingChild) {
            await supabase.from('children').insert({
              parent_id: parentUserId,
              name: childNameOnly,
              grade: mappedGrade,
            });
          }
        }

        // 3. Создаем запись бронирования с привязанным user_id родителя
        const { data: newBooking, error: dbError } = await supabase
          .from('bookings')
          .insert({
            user_id: parentUserId,
            slot_id: session.slot_id || null,
            service_title: session.service_title || SERVICES[0].title,
            price: session.price || SERVICES[0].price,
            parent_name: parentNameOnly,
            phone: phone,
            telegram_handle: username,
            child_name: childNameOnly,
            child_grade: mappedGrade,
            comment: `Время: ${session.slot_time || 'Уточнить'}. Возраст/Класс: ${rawGrade}`,
            status: 'pending_payment',
            admin_notes: `Запись создана через Telegram-бот (${new Date().toLocaleString('ru-RU')})`,
          })
          .select()
          .single();

        if (dbError) {
          console.error('Supabase booking insert error:', dbError);
        }

        // Очищаем сессию диалога
        await clearUserSession(supabase, parentUserId);

        // Получаем реквизиты из базы данных Supabase
        const reqs = await getRequisites(supabase);

        let payDetailsStr = `📱 *Телефон (СБП):* \`${reqs.phone}\`\n`;
        if (reqs.cardNumber) {
          payDetailsStr += `💳 *Карта:* \`${reqs.cardNumber}\`\n`;
        }
        payDetailsStr += `🏦 *Банк:* ${reqs.bankName}\n` +
          `👤 *Получатель:* ${reqs.recipient}`;

        const successMsg = `🎉 *УРОК УСПЕШНО ЗАБРОНИРОВАН!*\n\n` +
          `📚 *Программа:* ${session.service_title || SERVICES[0].title}\n` +
          `⏰ *Время:* ${session.slot_time || 'Согласовать время'}\n` +
          `👤 *Родитель:* ${parentNameOnly}\n` +
          `👶 *Ученик:* ${childNameOnly} (${rawGrade})\n` +
          `📞 *Телефон:* ${phone}\n` +
          `💰 *К оплате:* *${session.price || SERVICES[0].price} ₽*\n\n` +
          `💳 *РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ (СБП):*\n${payDetailsStr}\n\n` +
          `📸 *Отправьте фото/скриншот чека прямо в этот чат!* Бот автоматически передаст его педагогу на проверку.`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: successMsg,
            parse_mode: 'Markdown',
            reply_markup: yuliaContactInlineKb,
          }),
        });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '👇 Используйте меню ниже для дальнейших действий:',
            reply_markup: mainReplyKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }
    }

    // -------------------------------------------------------------
    // 3. ОБРАБОТКА CALLBACK QUERIES (КЛИКИ ИНЛАЙН КНОПОК)
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

      const userId = callbackQuery.from?.id || chatId;
      const parentUserId = await getOrCreateUserProfile(supabase, {
        telegramId: userId,
        firstName: callbackQuery.from?.first_name || 'Родитель',
        username: callbackQuery.from?.username ? `@${callbackQuery.from.username}` : '',
      });

      let session = await getUserSession(supabase, parentUserId);

      // Клик по выбору тарифа/программы (Инлайн-кнопки)
      if (callbackData.startsWith('service_')) {
        const isOffline = callbackData === 'service_offline';
        const selectedTitle = isOffline ? 'Оффлайн-занятие (В кабинете)' : 'Онлайн-занятие (Индивидуально)';
        const selectedPrice = isOffline ? 800 : 600;

        session = {
          step: 'select_slot_time',
          service_title: selectedTitle,
          price: selectedPrice,
        };
        await setUserSession(supabase, parentUserId, session);

        const { inline_keyboard, totalSlots } = await buildSlotInlineKeyboard(supabase, 0);

        let slotMsg = `🎯 *ВЫБРАНО:* ${selectedTitle} (${selectedPrice} ₽)\n\n` +
          `⏰ *ШАГ 2: ВЫБЕРИТЕ ДАТУ И ВРЕМЯ ЗАНЯТИЯ*\n\n`;

        if (totalSlots === 0) {
          slotMsg += `⚠️ На ближайшие дни пока нет свободных слотов в расписании. Попробуйте записаться позже!`;
        } else {
          slotMsg += `Выберите свободный день и время на интерактивной клавиатуре ниже:`;
        }

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: slotMsg,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
          }),
        });

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '👇 Выберите удобный слот выше:',
            reply_markup: cancelKeyboard,
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Клик по инлайн-слоту времени (< 64 байт!)
      if (callbackData.startsWith('slot_')) {
        const slotId = callbackData.replace('slot_', '');

        const { data: slot } = await supabase
          .from('time_slots')
          .select('*')
          .eq('id', slotId)
          .single();

        let timeStr = 'Выбранное время';
        if (slot) {
          timeStr = new Date(slot.start_time).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Samara',
          });
        }

        session.slot_id = slotId;
        session.slot_time = timeStr;
        session.step = 'awaiting_parent_name';
        await setUserSession(supabase, parentUserId, session);

        const updatedSlotText = `⏰ *ВЫБРАНО ВРЕМЯ:* \`${timeStr}\`\n\n` +
          `👤 *ШАГ 3: Как к Вам обращаться?*\n` +
          `Напишите Ваше имя (например: \`${callbackQuery.from?.first_name || 'Родитель'}\`):`;

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: updatedSlotText,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] },
          }),
        });

        return NextResponse.json({ success: true });
      }

      // Перелистывание страниц слотов (< 64 байт!)
      if (callbackData.startsWith('page_')) {
        const pageNum = parseInt(callbackData.replace('page_', ''), 10) || 0;
        const { inline_keyboard } = await buildSlotInlineKeyboard(supabase, pageNum);

        await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard },
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
