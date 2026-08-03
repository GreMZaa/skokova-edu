import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendTelegramNotificationToParent } from '@/lib/telegram';

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
