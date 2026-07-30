import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { pin, email } = await req.json();

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const validPin = process.env.NEXT_PUBLIC_ADMIN_PIN || '2026';
    const isSuccess = pin && pin.trim() === validPin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Журналирование попытки входа в таблицу admin_login_logs в Supabase DB
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from('admin_login_logs')
          .insert({
            ip_address: clientIp,
            user_agent: userAgent,
            status: isSuccess ? 'success' : 'failed',
            email: email || 'skokova_admin',
          });
      } catch (logError) {
        console.error('Failed to log admin access to Supabase DB:', logError);
      }
    }

    if (!isSuccess) {
      return NextResponse.json(
        { success: false, error: 'Неверный PIN-код / пароль администратора' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      token: `supabase-admin-session-${Date.now()}`,
      message: 'Авторизация прошла успешно и зафиксирована в журнале Supabase',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, logs: [] });
    }

    const supabase = createAdminClient();
    const { data: logs, error } = await supabase
      .from('admin_login_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
