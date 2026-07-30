import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const TOLYATTI_TZ = 'Europe/Samara'; // Самарское время (UTC+4, Тольятти)

function getGeneratedDefaultSlots() {
  const dates = [];
  const today = new Date();
  
  const defaultTimes = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const dateStr = d.toLocaleDateString('ru-RU', {
      timeZone: TOLYATTI_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });

    dates.push({
      dateStr: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
      rawDate: d.toISOString().split('T')[0],
      slots: defaultTimes.map((t, idx) => ({
        id: `slot-${i}-${idx}`,
        time: t,
        start_time: `${d.toISOString().split('T')[0]}T${t}:00+04:00`,
      })),
    });
  }

  return dates;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeSlotId = searchParams.get('include_slot_id');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const defaultSlotsGrouped = getGeneratedDefaultSlots();

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({
        success: true,
        source: 'demo_fallback',
        dates: defaultSlotsGrouped,
      });
    }

    const supabase = createAdminClient();

    // 1. Получаем слоты из БД Supabase (исключаем забронированные и заблокированные на 15 минут, кроме слота пользователя)
    const nowIso = new Date().toISOString();
    let filterCondition = `locked_until.is.null,locked_until.lt.${nowIso}`;
    if (includeSlotId) {
      filterCondition += `,id.eq.${includeSlotId}`;
    }

    let { data: dbSlots, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('is_booked', false)
      .gte('start_time', nowIso)
      .or(filterCondition)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Supabase slots query error:', error);
      return NextResponse.json({
        success: true,
        source: 'fallback_error',
        dates: defaultSlotsGrouped,
      });
    }

    // 2. Если слотов в базе нет — автозаполняем слоты в Самарском часовом поясе (Тольятти UTC+4)
    if (!dbSlots || dbSlots.length === 0) {
      const newSlotsToInsert: { start_time: string; end_time: string; is_booked: boolean }[] = [];
      const timesTolyatti = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
      const today = new Date();

      for (let dayOffset = 1; dayOffset <= 10; dayOffset++) {
        const dateObj = new Date(today);
        dateObj.setDate(today.getDate() + dayOffset);
        const yyyymmdd = dateObj.toISOString().split('T')[0];

        timesTolyatti.forEach((t) => {
          const startTime = new Date(`${yyyymmdd}T${t}:00+04:00`).toISOString();
          const endTime = new Date(new Date(startTime).getTime() + 45 * 60 * 1000).toISOString();
          newSlotsToInsert.push({
            start_time: startTime,
            end_time: endTime,
            is_booked: false,
          });
        });
      }

      await supabase.from('time_slots').insert(newSlotsToInsert);

      const retryRes = await supabase
        .from('time_slots')
        .select('*')
        .eq('is_booked', false)
        .gte('start_time', nowIso)
        .or(filterCondition)
        .order('start_time', { ascending: true });

      dbSlots = retryRes.data || [];
    }

    // 3. Группируем слоты по датам в часовом поясе Тольятти (Europe/Samara, UTC+4)
    const dateGroupsMap: { [key: string]: { dateStr: string; slots: { id: string; time: string; start_time: string }[] } } = {};

    dbSlots.forEach((slot: any) => {
      const startDate = new Date(slot.start_time);
      const dateStrRaw = startDate.toLocaleDateString('ru-RU', {
        timeZone: TOLYATTI_TZ,
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      const dateStrFormatted = dateStrRaw.charAt(0).toUpperCase() + dateStrRaw.slice(1);

      // Время в часовом поясе Тольятти (HH:MM)
      const timeStr = startDate.toLocaleTimeString('ru-RU', {
        timeZone: TOLYATTI_TZ,
        hour: '2-digit',
        minute: '2-digit',
      });

      if (!dateGroupsMap[dateStrFormatted]) {
        dateGroupsMap[dateStrFormatted] = {
          dateStr: dateStrFormatted,
          slots: [],
        };
      }

      // Избегаем дубликатов времени на одну и ту же дату
      if (!dateGroupsMap[dateStrFormatted].slots.some((s) => s.time === timeStr)) {
        dateGroupsMap[dateStrFormatted].slots.push({
          id: slot.id,
          time: timeStr,
          start_time: slot.start_time,
        });
      }
    });

    const datesArray = Object.values(dateGroupsMap);

    return NextResponse.json({
      success: true,
      source: 'supabase_db',
      dates: datesArray.length > 0 ? datesArray : defaultSlotsGrouped,
    });
  } catch (error: any) {
    console.error('API slots route error:', error);
    return NextResponse.json({
      success: true,
      source: 'route_error_fallback',
      dates: getGeneratedDefaultSlots(),
    });
  }
}
