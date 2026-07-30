import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Запрашиваем все заявки текущего родителя по его user_id с присоединением время слота
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, time_slots(start_time)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedBookings = (bookings || []).map((item: any) => {
      let selected_date = '';
      if (item.time_slots?.start_time) {
        const d = new Date(item.time_slots.start_time);
        const dayStr = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Samara', day: 'numeric', month: 'long', weekday: 'short' });
        const timeStr = d.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Samara', hour: '2-digit', minute: '2-digit' });
        selected_date = `${dayStr}, ${timeStr}`;
      }

      return {
        ...item,
        selected_date,
      };
    });

    return NextResponse.json({
      success: true,
      bookings: formattedBookings,
    });
  } catch (error: any) {
    console.error('Parent bookings fetch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
