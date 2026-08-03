const DEFAULT_BOT_TOKEN = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
const DEFAULT_TEACHER_CHAT_ID = '-5128191766';

export function getTelegramConfig() {
  const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').replace(/["'\r\n]/g, '').trim();
  const envChatId = (process.env.TELEGRAM_TEACHER_CHAT_ID || '').replace(/["'\r\n]/g, '').trim();

  const botToken = envToken && envToken.length >= 20 && !envToken.includes('123456789')
    ? envToken
    : DEFAULT_BOT_TOKEN;

  const teacherChatId = envChatId || DEFAULT_TEACHER_CHAT_ID;

  return { botToken, teacherChatId };
}

export function escapeMarkdown(text: string): string {
  if (!text) return '';
  // Экранируем спецсимволы Markdown V1, чтобы имена вроде @vasilina_original не ломали верстку
  return text.replace(/([_*`\[\]()])/g, '\\$1');
}

export async function sendTelegramNotification(options: {
  chatId?: string;
  text: string;
  keyboard?: any;
  parseMode?: 'Markdown' | 'HTML';
}): Promise<boolean> {
  const { botToken, teacherChatId } = getTelegramConfig();
  const targetChatId = options.chatId || teacherChatId;

  if (!botToken || !targetChatId) {
    console.warn('Telegram config is missing botToken or teacherChatId');
    return false;
  }

  const payload: Record<string, any> = {
    chat_id: targetChatId,
    text: options.text,
  };

  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  if (options.keyboard) {
    payload.reply_markup = options.keyboard;
  }

  try {
    let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let json = await res.json();

    // Если Telegram вернул ошибку (например, 400 Bad Request: can't parse entities из-за @vasilina_original),
    // совершаем повторную попытку без parse_mode для гарантированной доставки!
    if (!json.ok && payload.parse_mode) {
      console.warn('Telegram sendMessage failed with parse_mode, retrying without parse_mode:', json.description);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.parse_mode;

      res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackPayload),
      });

      json = await res.json();
    }

    if (!json.ok) {
      console.error('Telegram sendMessage error final:', json);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram notification network error:', error);
    return false;
  }
}

export async function findParentTelegramId(supabase: any, bookingObj: any): Promise<number | null> {
  if (!bookingObj) return null;

  // 0. Если у bookingObj уже напрямую есть telegram_id
  if (bookingObj.telegram_id && !isNaN(Number(bookingObj.telegram_id))) {
    return Number(bookingObj.telegram_id);
  }

  // 1. Поиск по bookingObj.user_id в Auth
  if (bookingObj.user_id) {
    try {
      const { data: uRes } = await supabase.auth.admin.getUserById(bookingObj.user_id);
      const tgId = uRes?.user?.user_metadata?.telegram_id;
      if (tgId) return Number(tgId);

      const email = uRes?.user?.email || '';
      if (email.startsWith('tg_')) {
        const match = email.match(/tg_(\d+)@/);
        if (match) return Number(match[1]);
      }
    } catch (e) {}
  }

  let authUsers: any[] = [];
  try {
    const { data: authList } = await supabase.auth.admin.listUsers();
    authUsers = authList?.users || [];
  } catch (e) {}

  // 2. Поиск по telegram_handle
  if (bookingObj.telegram_handle) {
    const cleanHandle = bookingObj.telegram_handle.replace('@', '').toLowerCase().trim();

    for (const u of authUsers) {
      const metaHandle = (u.user_metadata?.telegram_handle || '').replace('@', '').toLowerCase().trim();
      if (metaHandle && metaHandle === cleanHandle) {
        if (u.user_metadata?.telegram_id) return Number(u.user_metadata.telegram_id);
        if (u.email?.startsWith('tg_')) {
          const match = u.email.match(/tg_(\d+)@/);
          if (match) return Number(match[1]);
        }
      }
    }

    try {
      const { data: allProfiles } = await supabase.from('profiles').select('*');
      const matchedProfile = allProfiles?.find((p: any) =>
        p.telegram_handle && p.telegram_handle.replace('@', '').toLowerCase().trim() === cleanHandle
      );

      if (matchedProfile?.id) {
        const { data: uRes } = await supabase.auth.admin.getUserById(matchedProfile.id);
        const tgId = uRes?.user?.user_metadata?.telegram_id;
        if (tgId) return Number(tgId);
        const email = uRes?.user?.email || '';
        if (email.startsWith('tg_')) {
          const match = email.match(/tg_(\d+)@/);
          if (match) return Number(match[1]);
        }
      }
    } catch (e) {}
  }

  // 3. Поиск по номеру телефона
  if (bookingObj.phone) {
    const cleanPhoneDigits = bookingObj.phone.replace(/\D/g, '');
    const last10 = cleanPhoneDigits.length >= 10 ? cleanPhoneDigits.slice(-10) : '';

    if (last10) {
      for (const u of authUsers) {
        const uPhone = (u.user_metadata?.phone || u.phone || '').replace(/\D/g, '');
        if (uPhone && uPhone.endsWith(last10)) {
          if (u.user_metadata?.telegram_id) return Number(u.user_metadata.telegram_id);
          if (u.email?.startsWith('tg_')) {
            const match = u.email.match(/tg_(\d+)@/);
            if (match) return Number(match[1]);
          }
        }
      }

      try {
        const { data: allProfiles } = await supabase.from('profiles').select('*');
        const matchedProfile = allProfiles?.find((p: any) => p.phone && p.phone.replace(/\D/g, '').endsWith(last10));

        if (matchedProfile?.id) {
          const { data: uRes } = await supabase.auth.admin.getUserById(matchedProfile.id);
          const tgId = uRes?.user?.user_metadata?.telegram_id;
          if (tgId) return Number(tgId);

          const email = uRes?.user?.email || '';
          if (email.startsWith('tg_')) {
            const match = email.match(/tg_(\d+)@/);
            if (match) return Number(match[1]);
          }
        }
      } catch (e) {}
    }
  }

  // 4. Поиск по имени родителя
  if (bookingObj.parent_name) {
    const pNameLower = bookingObj.parent_name.toLowerCase().trim();
    for (const u of authUsers) {
      const uName = (u.user_metadata?.full_name || u.user_metadata?.name || '').toLowerCase().trim();
      if (uName && (uName.includes(pNameLower) || pNameLower.includes(uName))) {
        if (u.user_metadata?.telegram_id) return Number(u.user_metadata.telegram_id);
        if (u.email?.startsWith('tg_')) {
          const match = u.email.match(/tg_(\d+)@/);
          if (match) return Number(match[1]);
        }
      }
    }
  }

  return null;
}

export async function sendTelegramNotificationToParent(
  supabase: any,
  bookingObj: any,
  newStatus: string
): Promise<boolean> {
  try {
    const parentTgId = await findParentTelegramId(supabase, bookingObj);
    if (!parentTgId) {
      console.warn('Could not find parent Telegram ID for booking notification:', bookingObj?.id);
      return false;
    }

    let slotTimeStr = 'Согласованное время';
    if (bookingObj?.time_slots?.start_time) {
      slotTimeStr = new Date(bookingObj.time_slots.start_time).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Samara',
      });
    } else if (bookingObj?.comment && bookingObj.comment.includes('Время:')) {
      const m = bookingObj.comment.match(/Время:\s*([^.]+)/);
      if (m) slotTimeStr = m[1].trim();
    }

    let text = '';
    if (newStatus === 'confirmed') {
      text = `🎉 *ОПЛАТА И ЗАПИСЬ ПОДТВЕРЖДЕНЫ ПЕДАГОГОМ!*\n\n` +
        `Скокова Юлия Павловна подтвердила зачисление оплаты за урок!\n\n` +
        `📚 *Программа:* ${escapeMarkdown(bookingObj?.service_title || 'Занятие')}\n` +
        `⏱ *Время:* ${escapeMarkdown(slotTimeStr)}\n` +
        `👶 *Ученик:* ${escapeMarkdown(bookingObj?.child_name || 'Не указан')}\n` +
        `💰 *Сумма:* ${bookingObj?.price || 600} ₽\n` +
        `📌 *Статус:* ✅ Занятие подтверждено\n\n` +
        `Юлия Павловна ждёт Вас на уроке! Вы можете отслеживать детали записи в разделе *«👤 Мой кабинет»*.`;
    } else if (newStatus === 'cancelled') {
      text = `⚠️ *ОПЛАТА ИЛИ ЗАПИСЬ ОТКЛОНЕНЫ*\n\n` +
        `К сожалению, Ваша запись или оплата были отклонены/отменены.\n` +
        `Вы можете связаться с Юлией Павловной в разделе *«💬 Связаться с педагогом»* для уточнения деталей.`;
    } else if (newStatus === 'rescheduled') {
      text = `⏰ *ВРЕМЯ ЗАНЯТИЯ ИЗМЕНЕНО ПЕДАГОГОМ*\n\n` +
        `Ваше занятие перенесено на новое время!\n\n` +
        `📚 *Программа:* ${escapeMarkdown(bookingObj?.service_title || 'Занятие')}\n` +
        `⏱ *Новое время:* ${escapeMarkdown(slotTimeStr)}\n` +
        `👶 *Ученик:* ${escapeMarkdown(bookingObj?.child_name || 'Не указан')}\n` +
        `📌 *Статус:* 🔄 Перенесено\n\n` +
        `Детали записи обновлены в разделе *«👤 Мой кабинет»*.`;
    }

    if (!text) return false;

    const mainInlineKeyboard = {
      inline_keyboard: [
        [{ text: '📅 Записаться на урок', callback_data: 'start_booking' }],
        [{ text: '👤 Мой кабинет', callback_data: 'menu_my' }],
      ],
    };

    return await sendTelegramNotification({
      chatId: String(parentTgId),
      text,
      parseMode: 'Markdown',
      keyboard: mainInlineKeyboard,
    });
  } catch (e) {
    console.error('Error sending Telegram notification to parent:', e);
    return false;
  }
}
