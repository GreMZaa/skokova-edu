import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getGeneratedDefaultSlots() {
  const dates = [];
  const today = new Date();
  
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const dateStr = d.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });

    dates.push({
      dateStr: dateStr.charAt(0).toUpperCase() + dateStr.slice(1),
      rawDate: d.toISOString().split('T')[0],
      slots: [
        { id: `slot-${i}-1`, time: '14:00', start_time: `${d.toISOString().split('T')[0]}T14:00:00Z` },
        { id: `slot-${i}-2`, time: '15:00', start_time: `${d.toISOString().split('T')[0]}T15:00:00Z` },
        { id: `slot-${i}-3`, time: '16:00', start_time: `${d.toISOString().split('T')[0]}T16:00:00Z` },
        { id: `slot-${i}-4`, time: '17:00', start_time: `${d.toISOString().split('T')[0]}T17:00:00Z` },
        { id: `slot-${i}-5`, time: '18:00', start_time: `${d.toISOString().split('T')[0]}T18:00:00Z` },
      ],
    });
  }

  return dates;
}

export async function GET() {
  try {
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

    // 1. Получаем слоты из БД Supabase
    let { data: dbSlots, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('is_booked', false)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Supabase slots query error:', error);
      return NextResponse.json({
        success: true,
        source: 'fallback_error',
        dates: defaultSlotsGrouped,
      });
    }

    // 2. Если слотов в базе нет — автозаполняем слоты на неделю вперёд в Supabase DB
    if (!dbSlots || dbSlots.length === 0) {
      const newSlotsToInsert: { start_time: string; end_time: string; is_booked: boolean }[] = [];
      const today = new Date();

      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const dateObj = new Date(today);
        dateObj.setDate(today.getDate() + dayOffset);
        const yyyymmdd = dateObj.toISOString().split('T')[0];

        const times = ['14:00', '15:00', '16:00', '17:00', '18:00'];
        times.forEach((t) => {
          const startTime = `${yyyymmdd}T${t}:00Z`;
          const endHour = parseInt(t.split(':')[0], 10);
          const endTime = `${yyyymmdd}T${endHour}:45:00Z`;
          newSlotsToInsert.push({
            start_time: startTime,
            end_time: endTime,
            is_booked: false,
          });
        });
      }

      const { data: insertedSlots, error: insertError } = await supabase
        .from('time_slots')
        .insert(newSlotsToInsert)
        .select();

      if (!insertError && insertedSlots) {
        dbSlots = insertedSlots;
      }
    }

    // 3. Группировка слотов из БД по датам
    const groupedDates: Record<string, any[]> = {};
    (dbSlots || []).forEach((slot: any) => {
      const d = new Date(slot.start_time);
      const dateStr = d.toLocaleDateString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      });
      const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

      if (!groupedDates[formattedDate]) {
        groupedDates[formattedDate] = [];
      }

      groupedDates[formattedDate].push({
        id: slot.id,
        time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        start_time: slot.start_time,
      });
    });

    const formattedList = Object.keys(groupedDates).map((dateStr) => ({
      dateStr,
      slots: groupedDates[dateStr],
    }));

    return NextResponse.json({
      success: true,
      source: 'database',
      dates: formattedList.length > 0 ? formattedList : defaultSlotsGrouped,
    });
  } catch (error: any) {
    console.error('API slots error:', error);
    return NextResponse.json(
      { success: true, error: error.message, dates: getGeneratedDefaultSlots() },
      { status: 200 }
    );
  }
}
