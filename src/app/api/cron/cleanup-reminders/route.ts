import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendTelegramNotification, findParentTelegramId } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Проверка секретного заголовка от Vercel Cron или параметров вызова
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // В локальном режиме или при ручном тестировании разрешаем вызов по секретному ключу
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (key !== cronSecret && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date();
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  let releasedCount = 0;
  let remindersCount = 0;

  try {
    // 1. Освобождаем просроченные брони в статусе pending_payment
    const { data: expiredBookings } = await supabase
      .from('bookings')
      .select('id, slot_id')
      .eq('status', 'pending_payment')
      .lt('updated_at', thirtyMinsAgo);

    if (expiredBookings && expiredBookings.length > 0) {
      const bookingIds = (expiredBookings as any[]).map((b: any) => b.id);
      const slotIds = (expiredBookings as any[]).map((b: any) => b.slot_id).filter(Boolean);

      // Обновляем брони на cancelled
      await supabase
        .from('bookings')
        .update({ status: 'cancelled', updated_at: now.toISOString() })
        .in('id', bookingIds);

      // Возвращаем слоты в доступные
      if (slotIds.length > 0) {
        await supabase
          .from('time_slots')
          .update({ status: 'available' })
          .in('id', slotIds);
      }

      releasedCount = expiredBookings.length;
    }

    // 2. Отправка напоминаний об уроке за 24 часа и за 1 час
    const in24hStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000).toISOString();
    const in24hEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000).toISOString();

    const in1hStart = new Date(now.getTime() + 0.5 * 60 * 60 * 1000).toISOString();
    const in1hEnd = new Date(now.getTime() + 1.5 * 60 * 60 * 1000).toISOString();

    // Получаем подтвержденные брони с привязанными слотами
    const { data: upcoming24h } = await supabase
      .from('bookings')
      .select(`
        id, parent_name, parent_phone, child_name, lesson_link, user_id, telegram_id,
        time_slots!inner ( start_time )
      `)
      .eq('status', 'confirmed')
      .gte('time_slots.start_time', in24hStart)
      .lte('time_slots.start_time', in24hEnd);

    const { data: upcoming1h } = await supabase
      .from('bookings')
      .select(`
        id, parent_name, parent_phone, child_name, lesson_link, user_id, telegram_id,
        time_slots!inner ( start_time )
      `)
      .eq('status', 'confirmed')
      .gte('time_slots.start_time', in1hStart)
      .lte('time_slots.start_time', in1hEnd);

    // Напоминание за 24 часа
    if (upcoming24h) {
      for (const b of (upcoming24h as any[])) {
        const tgId = await findParentTelegramId(supabase, b);
        if (tgId) {
          const slotTime = (b.time_slots as any)?.start_time
            ? new Date((b.time_slots as any).start_time).toLocaleString('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Samara',
              })
            : 'завтра';

          const text = `⏰ *Напоминание о занятии (за 24 часа)*\n\nЗдравствуйте, ${b.parent_name}!\nНапоминаем, что занятие для *${b.child_name}* состоится *${slotTime}* (Самарское время, UTC+4).\n\n🔗 Ссылка на урок будет доступна в вашем [Личном кабинете](https://skokova-edu.vercel.app/my-dashboard).`;
          await sendTelegramNotification({ chatId: String(tgId), text, parseMode: 'Markdown' });
          remindersCount++;
        }
      }
    }

    // Напоминание за 1 час
    if (upcoming1h) {
      for (const b of (upcoming1h as any[])) {
        const tgId = await findParentTelegramId(supabase, b);
        if (tgId) {
          const lessonUrl = b.lesson_link || 'https://skokova-edu.vercel.app/my-dashboard';
          const text = `🚀 *Напоминание: Урок через 1 час!*\n\nЗдравствуйте, ${b.parent_name}!\nЗанятие для *${b.child_name}* начнётся через 1 час.\n\n🔗 [Подключиться к уроку](${lessonUrl})`;
          await sendTelegramNotification({ chatId: String(tgId), text, parseMode: 'Markdown' });
          remindersCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      released_slots: releasedCount,
      reminders_sent: remindersCount,
    });
  } catch (error: any) {
    console.error('Error in cleanup-reminders cron:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
