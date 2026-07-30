import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Дефолтные динамические слоты для демо/фоллбека на случай отсутствия ключей Supabase
function getGeneratedDefaultSlots() {
  const dates = [];
  const today = new Date();
  
  for (let i = 1; i <= 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    // Форматирование типа "Пн, 3 августа"
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

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      // Фоллбек на случай локального тестирования без подключенного ключа Supabase
      return NextResponse.json({
        success: true,
        source: 'demo_fallback',
        dates: getGeneratedDefaultSlots(),
      });
    }

    const supabase = createAdminClient();
    const { data: dbSlots, error } = await supabase
      .from('time_slots')
      .select('*')
      .eq('is_booked', false)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Группировка слотов из БД по дням
    const groupedDates: Record<string, any[]> = {};
    dbSlots.forEach((slot: any) => {
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
      dates: formattedList.length > 0 ? formattedList : getGeneratedDefaultSlots(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, dates: getGeneratedDefaultSlots() },
      { status: 500 }
    );
  }
}
