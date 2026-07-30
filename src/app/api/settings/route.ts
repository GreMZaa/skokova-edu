import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const DEFAULT_REQUISITES = {
  phone: '+7 (926) 123-45-67',
  card_number: '',
  bank_name: 'Т-Банк / Сбербанк',
  recipient: 'Скокова Юлия Павловна',
};

// GET: Получение текущих реквизитов из Supabase
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, requisites: DEFAULT_REQUISITES });
    }

    const supabase = createAdminClient();
    const { data: usersData } = await supabase.auth.admin.listUsers();

    if (usersData?.users && usersData.users.length > 0) {
      const mainUser = usersData.users[0];
      const savedRequisites = mainUser.user_metadata?.payment_requisites;
      if (savedRequisites) {
        return NextResponse.json({
          success: true,
          requisites: {
            ...DEFAULT_REQUISITES,
            ...savedRequisites,
          },
        });
      }
    }

    return NextResponse.json({ success: true, requisites: DEFAULT_REQUISITES });
  } catch (error: any) {
    console.error('Fetch settings error:', error);
    return NextResponse.json({ success: true, requisites: DEFAULT_REQUISITES });
  }
}

// POST: Обновление реквизитов педагога в Supabase
export async function POST(req: Request) {
  try {
    const { phone, card_number, bank_name, recipient } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, message: 'Updated in demo mode' });
    }

    const supabase = createAdminClient();
    const { data: usersData } = await supabase.auth.admin.listUsers();

    if (!usersData?.users || usersData.users.length === 0) {
      return NextResponse.json({ success: false, error: 'Пользователь не найден в Supabase Auth' }, { status: 404 });
    }

    const newRequisites = {
      phone: phone || DEFAULT_REQUISITES.phone,
      card_number: card_number || '',
      bank_name: bank_name || DEFAULT_REQUISITES.bank_name,
      recipient: recipient || DEFAULT_REQUISITES.recipient,
    };

    // Сохраняем во всех пользователях админа для синхронности
    for (const user of usersData.users) {
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          payment_requisites: newRequisites,
        },
      });
    }

    return NextResponse.json({
      success: true,
      requisites: newRequisites,
      message: 'Реквизиты успешно сохранены в Supabase!',
    });
  } catch (error: any) {
    console.error('Save settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
