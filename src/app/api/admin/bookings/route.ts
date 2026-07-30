import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// GET: Получение всех реальных заявок из таблицы bookings в Supabase
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
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      bookings: dbBookings || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Обновление статуса или данных заявки в Supabase
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, status, parent_name, phone, child_name, comment, dateStr, timeSlot } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, message: 'Updated in demo mode' });
    }

    const supabase = createAdminClient();

    // Получаем старую запись для проверки slot_id
    const { data: oldBooking } = await supabase
      .from('bookings')
      .select('slot_id')
      .eq('id', id)
      .single();

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updates.status = status;
    if (parent_name) updates.parent_name = parent_name;
    if (phone) updates.phone = phone;
    if (child_name) updates.child_name = child_name;
    if (comment !== undefined) updates.comment = comment;
    if (dateStr || timeSlot) {
      updates.admin_notes = `Перенесено админом на ${dateStr || ''} ${timeSlot || ''}`;
    }

    const { data: updatedData, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Если заявка отклонена/отменена — освобождаем слот расписания
    if (status === 'cancelled' && oldBooking?.slot_id) {
      await supabase
        .from('time_slots')
        .update({ is_booked: false, locked_until: null })
        .eq('id', oldBooking.slot_id);
    } else if (status === 'confirmed' && oldBooking?.slot_id) {
      await supabase
        .from('time_slots')
        .update({ is_booked: true })
        .eq('id', oldBooking.slot_id);
    }

    return NextResponse.json({
      success: true,
      booking: updatedData,
      message: 'Заявка успешно обновлена в Supabase',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Удаление заявки из Supabase
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
