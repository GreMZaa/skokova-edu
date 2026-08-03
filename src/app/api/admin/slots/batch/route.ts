import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSessionFromRequest } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { startDate, endDate, daysOfWeek, timeSlots, lessonFormat, price } = body;

    if (!startDate || !endDate || !Array.isArray(daysOfWeek) || !Array.isArray(timeSlots)) {
      return NextResponse.json({ error: 'Неверные входные параметры' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const slotsToInsert: any[] = [];

    // Чтение существующих слотов, чтобы избежать дублирования
    const { data: existingSlots } = await supabase.from('time_slots').select('start_time');
    const existingTimes = new Set(((existingSlots || []) as any[]).map((s: any) => new Date(s.start_time).toISOString()));

    const curr = new Date(start);
    while (curr <= end) {
      const dayNum = curr.getDay(); // 0 = Sun, 1 = Mon, ...
      if (daysOfWeek.includes(dayNum)) {
        const year = curr.getFullYear();
        const month = curr.getMonth();
        const date = curr.getDate();

        for (const timeStr of timeSlots) {
          const [h, m] = timeStr.split(':').map(Number);
          const slotStart = new Date(year, month, date, h, m, 0);
          const slotEnd = new Date(slotStart.getTime() + 40 * 60 * 1000); // 40 минут урок

          const startIso = slotStart.toISOString();
          if (!existingTimes.has(startIso)) {
            slotsToInsert.push({
              start_time: startIso,
              end_time: slotEnd.toISOString(),
              status: 'available',
              lesson_format: lessonFormat || 'online',
              price: Number(price) || 600,
            });
            existingTimes.add(startIso);
          }
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    if (slotsToInsert.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'Новые слоты не созданы (уже существуют)' });
    }

    const { error: insertErr } = await supabase.from('time_slots').insert(slotsToInsert);
    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, count: slotsToInsert.length });
  } catch (error: any) {
    console.error('Batch slot creation error:', error);
    return NextResponse.json({ error: error.message || 'Ошибка генерации слотов' }, { status: 500 });
  }
}
