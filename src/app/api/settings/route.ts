import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const DEFAULT_REQUISITES = {
  phone: '+7 (926) 123-45-67',
  card_number: '',
  bank_name: 'Т-Банк / Сбербанк',
  recipient: 'Скокова Юлия Павловна',
};

// GET: Получение реквизитов из таблицы settings или fallback из user_metadata
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, requisites: DEFAULT_REQUISITES });
    }

    const supabase = createAdminClient();

    // 1. Пробуем прочитать из таблицы `settings` в Supabase DB
    const { data: dbSettings, error: dbErr } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'requisites')
      .maybeSingle();

    if (!dbErr && dbSettings) {
      return NextResponse.json({
        success: true,
        requisites: {
          phone: dbSettings.phone || DEFAULT_REQUISITES.phone,
          card_number: dbSettings.card_number || '',
          bank_name: dbSettings.bank_name || DEFAULT_REQUISITES.bank_name,
          recipient: dbSettings.recipient || DEFAULT_REQUISITES.recipient,
        },
      });
    }

    // 2. Fallback: Загрузка из user_metadata в Supabase Auth
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

// POST: Сохранение реквизитов в таблицу settings и user_metadata в Supabase DB
export async function POST(req: Request) {
  try {
    const { phone, card_number, bank_name, recipient } = await req.json();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, message: 'Updated in demo mode' });
    }

    const supabase = createAdminClient();

    const newRequisites = {
      phone: phone || DEFAULT_REQUISITES.phone,
      card_number: card_number || '',
      bank_name: bank_name || DEFAULT_REQUISITES.bank_name,
      recipient: recipient || DEFAULT_REQUISITES.recipient,
    };

    // 1. Пробуем записать в таблицу `settings` в Supabase DB
    await supabase.from('settings').upsert({
      id: 'requisites',
      phone: newRequisites.phone,
      card_number: newRequisites.card_number,
      bank_name: newRequisites.bank_name,
      recipient: newRequisites.recipient,
      updated_at: new Date().toISOString(),
    });

    // 2. Дополнительно дублируем в user_metadata для 100% надёжности
    const { data: usersData } = await supabase.auth.admin.listUsers();
    if (usersData?.users) {
      for (const user of usersData.users) {
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            payment_requisites: newRequisites,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      requisites: newRequisites,
      message: 'Реквизиты успешно сохранены в Supabase DB!',
    });
  } catch (error: any) {
    console.error('Save settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
