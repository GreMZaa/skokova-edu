import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendTelegramNotification } from '@/lib/telegram';
import { getAdminSessionFromRequest, sanitizeError } from '@/lib/security';

export async function POST(req: Request) {
  try {
    // 12.2 Серверная проверка прав администратора
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { booking_id, new_slot_id, new_parent_name, new_phone, new_child_name, new_comment } = await req.json();

    if (!booking_id) {
      return NextResponse.json({ success: false, error: 'booking_id is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (new_slot_id) {
      updates.slot_id = new_slot_id;
      updates.status = 'rescheduled';
    }
    if (new_parent_name) updates.parent_name = new_parent_name;
    if (new_phone) updates.phone = new_phone;
    if (new_child_name) updates.child_name = new_child_name;
    if (new_comment !== undefined) updates.comment = new_comment;

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();
      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', booking_id);

      if (error) throw error;
    }

    // Оповещение педагога в Telegram об изменении
    const updateMsg = `✏️ *ЗАЯВКА #${booking_id} ОБНОВЛЕНА ПЕДАГОГОМ*\n\n` +
      `Изменения успешно внесены в систему.`;

    await sendTelegramNotification({
      text: updateMsg,
      parseMode: 'Markdown',
    });

    return NextResponse.json({
      success: true,
      booking_id,
      message: 'Данные заявки успешно отредактированы',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

