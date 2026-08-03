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
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, price, status, created_at, slot_id, child_name, parent_name, time_slots(start_time)');

    if (bErr) throw bErr;

    const { data: slots, error: sErr } = await supabase
      .from('time_slots')
      .select('id, status, start_time');

    if (sErr) throw sErr;

    const allBookings: any[] = bookings || [];
    const allSlots: any[] = slots || [];

    const confirmedBookings = allBookings.filter((b: any) => ['confirmed', 'completed'].includes(b.status));
    const totalRevenue = confirmedBookings.reduce((sum: number, b: any) => sum + (Number(b.price) || 600), 0);
    const totalBookingsCount = allBookings.length;
    const confirmedCount = confirmedBookings.length;

    const totalSlotsCount = allSlots.length;
    const bookedSlotsCount = allSlots.filter((s: any) => s.status === 'booked').length;
    const occupancyRate = totalSlotsCount > 0 ? Math.round((bookedSlotsCount / totalSlotsCount) * 100) : 0;


    // Группировка по часам для определения популярных часов
    const hourCounts: Record<string, number> = {};
    for (const b of confirmedBookings) {
      const slotTime = (b as any).time_slots?.start_time;
      if (slotTime) {
        const hour = new Date(slotTime).getHours() + ':00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }

    const popularHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalRevenue,
      totalBookingsCount,
      confirmedCount,
      totalSlotsCount,
      occupancyRate,
      popularHours,
    });
  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: error.message || 'Error fetching analytics' }, { status: 500 });
  }
}
