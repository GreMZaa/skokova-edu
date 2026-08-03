import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatICalDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const expectedToken = process.env.CALENDAR_FEED_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || 'skokova_cal_secret_2026';

  if (token !== expectedToken && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized calendar access' }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, parent_name, parent_phone, child_name, notes, lesson_link, status, created_at,
        time_slots!inner ( start_time, end_time )
      `)
      .in('status', ['confirmed', 'receipt_uploaded']);

    if (error) {
      throw error;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SkokovaEdu//TeacherCalendar//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Уроки Юлия Павловна',
      'X-WR-TIMEZONE:Europe/Samara',
    ];

    if (bookings) {
      for (const b of bookings) {
        const slot = (b as any).time_slots;
        if (!slot || !slot.start_time) continue;

        const startTime = formatICalDate(slot.start_time);
        const endTime = slot.end_time
          ? formatICalDate(slot.end_time)
          : formatICalDate(new Date(new Date(slot.start_time).getTime() + 40 * 60 * 1000).toISOString());

        const createdTime = formatICalDate(b.created_at || new Date().toISOString());

        lines.push(
          'BEGIN:VEVENT',
          `UID:booking-${b.id}@skokova-edu.vercel.app`,
          `DTSTAMP:${createdTime}`,
          `DTSTART:${startTime}`,
          `DTEND:${endTime}`,
          `SUMMARY:Урок с ${b.child_name} (${b.parent_name})`,
          `DESCRIPTION:Ребёнок: ${b.child_name}\\nРодитель: ${b.parent_name}\\nТел: ${b.parent_phone}\\nСсылка: ${b.lesson_link || 'Не указана'}\\nЗаметки: ${(b.notes || '').replace(/\n/g, ' ')}`,
          `STATUS:${b.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`,
          'END:VEVENT'
        );
      }
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="teacher_schedule.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Error generating iCal feed:', err);
    return NextResponse.json({ error: 'Failed to generate iCal feed' }, { status: 500 });
  }
}
