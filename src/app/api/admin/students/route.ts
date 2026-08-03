import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSessionFromRequest } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, child_name, parent_name, parent_phone, telegram_handle, price, status, notes, created_at, time_slots(start_time)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const studentMap: Record<string, any> = {};

    for (const b of bookings || []) {
      const key = `${b.child_name || 'Ученик'}_${b.parent_phone || 'БезТелефона'}`.toLowerCase();

      if (!studentMap[key]) {
        studentMap[key] = {
          key,
          child_name: b.child_name || 'Не указано',
          parent_name: b.parent_name || 'Не указано',
          parent_phone: b.parent_phone || '',
          telegram_handle: b.telegram_handle || '',
          total_lessons: 0,
          total_spent: 0,
          last_lesson: (b as any).time_slots?.start_time || b.created_at,
          notes: b.notes || '',
          tags: ['Ученик'],
          history: [],
        };
      }

      const st = studentMap[key];
      st.history.push({
        id: b.id,
        date: (b as any).time_slots?.start_time || b.created_at,
        price: b.price || 600,
        status: b.status,
      });

      if (['confirmed', 'completed'].includes(b.status)) {
        st.total_lessons += 1;
        st.total_spent += Number(b.price) || 600;
      }

      if (st.total_lessons >= 5 && !st.tags.includes('Постоянный')) {
        st.tags.push('Постоянный');
      }
    }

    const students = Object.values(studentMap);
    return NextResponse.json({ students });
  } catch (error: any) {
    console.error('Students CRM API error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching students' }, { status: 500 });
  }
}
