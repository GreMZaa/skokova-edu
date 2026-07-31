import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getSamaraISOString(dateISO: string, timeStr: string): { startISO: string; endISO: string } | null {
  if (!dateISO || !timeStr) return null;
  const timeParts = timeStr.trim().split(':');
  if (timeParts.length < 2) return null;

  const hour = parseInt(timeParts[0], 10);
  const minute = parseInt(timeParts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return null;

  const dateParts = dateISO.trim().split('-');
  if (dateParts.length < 3) return null;

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  // Часовой пояс Самары/Тольятти UTC+4. В UTC время = hour - 4
  const startDate = new Date(Date.UTC(year, month, day, hour - 4, minute, 0));
  const endDate = new Date(startDate.getTime() + 40 * 60 * 1000); // Урок 40 минут

  return {
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
  };
}

// GET: Получение всех реальных заявок из таблицы bookings в Supabase с ДИНАМИЧЕСКИМ форматированием даты из слота
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, bookings: [] });
    }

    const supabase = createAdminClient();
    const { data: dbBookings, error } = await supabase
      .from('bookings')
      .select('*, time_slots!bookings_slot_id_fkey(start_time)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedBookings = (dbBookings || []).map((item: any) => {
      let dateStr = '';
      let timeSlot = '';
      if (item.time_slots?.start_time) {
        const d = new Date(item.time_slots.start_time);
        const dayStr = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Samara', day: 'numeric', month: 'long', weekday: 'short' });
        timeSlot = d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Samara', hour: '2-digit', minute: '2-digit' });
        dateStr = `${dayStr}, ${timeSlot}`;
      }

      return {
        ...item,
        dateStr,
        timeSlot,
      };
    });

    return NextResponse.json({
      success: true,
      bookings: formattedBookings,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Полное редактирование заявки администратором с автоматическим переносом и резервированием слота
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      service_title,
      price,
      parent_name,
      phone,
      telegram_handle,
      child_name,
      child_grade,
      comment,
      admin_notes,
      dateISO,
      timeSlot,
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, message: 'Updated in demo mode' });
    }

    const supabase = createAdminClient();

    const { data: oldBooking } = await supabase
      .from('bookings')
      .select('slot_id')
      .eq('id', id)
      .single();

    const oldSlotId = oldBooking?.slot_id;
    let newSlotId: string | null = null;

    // 1. Если передана новая дата и время — ищем или создаем слот и БРОНИРУЕМ его
    if (dateISO && timeSlot) {
      const times = getSamaraISOString(dateISO, timeSlot);
      if (times) {
        let { data: slot } = await supabase
          .from('time_slots')
          .select('*')
          .eq('start_time', times.startISO)
          .maybeSingle();

        if (!slot) {
          const { data: createdSlot } = await supabase
            .from('time_slots')
            .insert({
              start_time: times.startISO,
              end_time: times.endISO,
              is_booked: true,
            })
            .select()
            .single();
          slot = createdSlot;
        } else {
          await supabase
            .from('time_slots')
            .update({ is_booked: true, locked_until: null })
            .eq('id', slot.id);
        }

        if (slot?.id) {
          newSlotId = slot.id;
        }
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (newSlotId) {
      updates.slot_id = newSlotId;
      if (!status) updates.status = 'rescheduled';
    }

    if (status !== undefined) updates.status = status;
    if (service_title !== undefined) updates.service_title = service_title;
    if (price !== undefined) updates.price = price;
    if (parent_name !== undefined) updates.parent_name = parent_name;
    if (phone !== undefined) updates.phone = phone;
    if (telegram_handle !== undefined) updates.telegram_handle = telegram_handle;
    if (child_name !== undefined) updates.child_name = child_name;
    if (child_grade !== undefined) updates.child_grade = child_grade;
    if (comment !== undefined) updates.comment = comment;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;

    const { data: updatedData, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 2. Если перенесли на другой слот — ОСВОБОЖДАЕМ старый слот для других клиентов!
    if (newSlotId && oldSlotId && oldSlotId !== newSlotId) {
      await supabase
        .from('time_slots')
        .update({ is_booked: false, locked_until: null })
        .eq('id', oldSlotId);
    }

    // 3. Если заявка отклонена — освобождаем текущий слот
    const targetStatus = status || updates.status;
    const activeSlotId = newSlotId || oldSlotId;

    if (targetStatus === 'cancelled' && activeSlotId) {
      await supabase
        .from('time_slots')
        .update({ is_booked: false, locked_until: null })
        .eq('id', activeSlotId);
    } else if (targetStatus === 'confirmed' && activeSlotId) {
      await supabase
        .from('time_slots')
        .update({ is_booked: true, locked_until: null })
        .eq('id', activeSlotId);
    }

    // 4. Отправляем клиентское уведомление в Telegram при любом изменении/подтверждении статуса на сайте
    if (updatedData) {
      const slotRes = activeSlotId
        ? await supabase.from('time_slots').select('start_time').eq('id', activeSlotId).maybeSingle()
        : null;

      const fullBookingObj = {
        ...updatedData,
        time_slots: slotRes?.data || null,
      };

      await sendTelegramNotificationToParent(supabase, fullBookingObj, targetStatus || updatedData.status);
    }

    return NextResponse.json({
      success: true,
      booking: updatedData,
      message: 'Заявка и расписание слотов успешно обновлены в Supabase DB',
    });
  } catch (error: any) {
    console.error('Admin PATCH error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function findParentTelegramId(supabase: any, bookingObj: any): Promise<number | null> {
  if (!bookingObj) return null;

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
    const cleanHandle = bookingObj.telegram_handle.replace('@', '').toLowerCase();

    for (const u of authUsers) {
      const metaHandle = (u.user_metadata?.telegram_handle || '').replace('@', '').toLowerCase();
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
        p.telegram_handle && p.telegram_handle.replace('@', '').toLowerCase() === cleanHandle
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
    const pNameLower = bookingObj.parent_name.toLowerCase();
    for (const u of authUsers) {
      const uName = (u.user_metadata?.full_name || u.user_metadata?.name || '').toLowerCase();
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

async function sendTelegramNotificationToParent(supabase: any, bookingObj: any, newStatus: string) {
  try {
    let botToken = (process.env.TELEGRAM_BOT_TOKEN || '').replace(/["'\r\n]/g, '').trim();
    if (!botToken || botToken.length < 20) {
      botToken = '8656501308:AAFDzAuFznqhjRgWd35p-NvUa_hg1pwhoqM';
    }

    const parentTgId = await findParentTelegramId(supabase, bookingObj);
    if (!parentTgId) {
      console.warn('Could not find parent Telegram ID for booking notification:', bookingObj?.id);
      return;
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
        `📚 *Программа:* ${bookingObj?.service_title || 'Занятие'}\n` +
        `⏱ *Время:* ${slotTimeStr}\n` +
        `👶 *Ученик:* ${bookingObj?.child_name || 'Не указан'}\n` +
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
        `📚 *Программа:* ${bookingObj?.service_title || 'Занятие'}\n` +
        `⏱ *Новое время:* ${slotTimeStr}\n` +
        `👶 *Ученик:* ${bookingObj?.child_name || 'Не указан'}\n` +
        `📌 *Статус:* 🔄 Перенесено\n\n` +
        `Детали записи обновлены в разделе *«👤 Мой кабинет»*.`;
    }

    if (!text) return;

    const mainInlineKeyboard = {
      inline_keyboard: [
        [{ text: '📅 Записаться на урок', callback_data: 'start_booking' }],
        [{ text: '👤 Мой кабинет', callback_data: 'menu_my' }],
        [{ text: '📚 Программы и тарифы', callback_data: 'menu_programs' }],
        [{ text: '💳 Реквизиты оплаты', callback_data: 'menu_requisites' }],
        [{ text: '💬 Связаться с педагогом', callback_data: 'menu_contact' }],
      ],
    };

    let res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: parentTgId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: mainInlineKeyboard,
      }),
    });

    let json = await res.json();
    if (!json.ok) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: parentTgId,
          text: text.replace(/[*_`]/g, ''),
          reply_markup: mainInlineKeyboard,
        }),
      });
    }
  } catch (e) {
    console.error('Error sending Telegram notification to parent:', e);
  }
}

// DELETE: Удаление заявки из Supabase с освобождением слота
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();
      
      const { data: oldBooking } = await supabase
        .from('bookings')
        .select('slot_id')
        .eq('id', id)
        .single();

      if (oldBooking?.slot_id) {
        await supabase
          .from('time_slots')
          .update({ is_booked: false, locked_until: null })
          .eq('id', oldBooking.slot_id);
      }

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: 'Заявка успешно удалена из Supabase' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
