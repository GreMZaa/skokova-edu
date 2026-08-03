import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, sanitizeError } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс 10 блокировок слота в минуту с одного IP
    const rateCheck = checkRateLimit(`slot-lock:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много запросов. Пожалуйста, подождите 1 минуту.' },
        { status: 429 }
      );
    }

    const { slot_id } = await req.json();

    if (!slot_id) {
      return NextResponse.json({ success: false, error: 'slot_id is required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      // Имитация быстрой временной блокировки для демо
      return NextResponse.json({
        success: true,
        message: 'Slot temporarily locked for 15 minutes (demo mode)',
        locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    }

    const supabase = createAdminClient();

    // Вызов SQL функции lock_time_slot
    const { data: isLocked, error } = await supabase.rpc('lock_time_slot', { p_slot_id: slot_id });

    if (error) throw error;

    if (!isLocked) {
      return NextResponse.json(
        { success: false, error: 'Слот уже забронирован или заблокирован другим пользователем' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Слот успешно запечатан на 15 минут для оплаты',
      locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

