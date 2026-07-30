import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export interface PaymentMethodItem {
  id: string;
  type: 'sbp' | 'card';
  title: string;
  phone?: string;
  card_number?: string;
  bank_name: string;
  recipient: string;
  is_active: boolean;
}

const DEFAULT_METHODS: PaymentMethodItem[] = [
  {
    id: 'sbp_default',
    type: 'sbp',
    title: 'Перевод через СБП (по телефону)',
    phone: '+7 (926) 123-45-67',
    bank_name: 'Т-Банк / Сбербанк',
    recipient: 'Скокова Юлия Павловна',
    is_active: true,
  },
  {
    id: 'card_default',
    type: 'card',
    title: 'Перевод по номеру карты',
    card_number: '2202 2000 1234 5678',
    bank_name: 'Т-Банк',
    recipient: 'Скокова Юлия Павловна',
    is_active: true,
  },
];

const DEFAULT_REQUISITES = {
  phone: '+7 (926) 123-45-67',
  card_number: '2202 2000 1234 5678',
  bank_name: 'Т-Банк / Сбербанк',
  recipient: 'Скокова Юлия Павловна',
};

// GET: Получение способов оплаты из таблицы settings или fallback
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({
        success: true,
        requisites: DEFAULT_REQUISITES,
        payment_methods: DEFAULT_METHODS,
      });
    }

    const supabase = createAdminClient();

    // 1. Пробуем из таблицы `settings`
    const { data: dbSettings, error: dbErr } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'requisites')
      .maybeSingle();

    if (!dbErr && dbSettings) {
      let methods: PaymentMethodItem[] = [];
      if (Array.isArray(dbSettings.payment_methods) && dbSettings.payment_methods.length > 0) {
        methods = dbSettings.payment_methods;
      } else {
        // Формируем из старых колонок
        if (dbSettings.phone) {
          methods.push({
            id: 'sbp_legacy',
            type: 'sbp',
            title: 'Перевод через СБП (по телефону)',
            phone: dbSettings.phone,
            bank_name: dbSettings.bank_name || 'Т-Банк / Сбербанк',
            recipient: dbSettings.recipient || 'Скокова Юлия Павловна',
            is_active: true,
          });
        }
        if (dbSettings.card_number) {
          methods.push({
            id: 'card_legacy',
            type: 'card',
            title: 'Перевод по номеру карты',
            card_number: dbSettings.card_number,
            bank_name: dbSettings.bank_name || 'Т-Банк',
            recipient: dbSettings.recipient || 'Скокова Юлия Павловна',
            is_active: true,
          });
        }
      }

      if (methods.length === 0) methods = DEFAULT_METHODS;

      return NextResponse.json({
        success: true,
        requisites: {
          phone: dbSettings.phone || DEFAULT_REQUISITES.phone,
          card_number: dbSettings.card_number || DEFAULT_REQUISITES.card_number,
          bank_name: dbSettings.bank_name || DEFAULT_REQUISITES.bank_name,
          recipient: dbSettings.recipient || DEFAULT_REQUISITES.recipient,
        },
        payment_methods: methods,
      });
    }

    // 2. Fallback из auth metadata
    const { data: usersData } = await supabase.auth.admin.listUsers();
    if (usersData?.users && usersData.users.length > 0) {
      const mainUser = usersData.users[0];
      const savedRequisites = mainUser.user_metadata?.payment_requisites;
      const savedMethods = mainUser.user_metadata?.payment_methods;

      if (savedMethods && Array.isArray(savedMethods) && savedMethods.length > 0) {
        return NextResponse.json({
          success: true,
          requisites: savedRequisites || DEFAULT_REQUISITES,
          payment_methods: savedMethods,
        });
      }
      if (savedRequisites) {
        return NextResponse.json({
          success: true,
          requisites: { ...DEFAULT_REQUISITES, ...savedRequisites },
          payment_methods: DEFAULT_METHODS,
        });
      }
    }

    return NextResponse.json({
      success: true,
      requisites: DEFAULT_REQUISITES,
      payment_methods: DEFAULT_METHODS,
    });
  } catch (error: any) {
    console.error('Fetch settings error:', error);
    return NextResponse.json({
      success: true,
      requisites: DEFAULT_REQUISITES,
      payment_methods: DEFAULT_METHODS,
    });
  }
}

// POST: Сохранение вариантов оплаты
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const paymentMethods: PaymentMethodItem[] = body.payment_methods || DEFAULT_METHODS;

    const firstSbp = paymentMethods.find((m) => m.type === 'sbp' && m.is_active);
    const firstCard = paymentMethods.find((m) => m.type === 'card' && m.is_active);

    const mainPhone = firstSbp?.phone || body.phone || DEFAULT_REQUISITES.phone;
    const mainCard = firstCard?.card_number || body.card_number || '';
    const mainBank = firstSbp?.bank_name || firstCard?.bank_name || body.bank_name || DEFAULT_REQUISITES.bank_name;
    const mainRecipient = firstSbp?.recipient || firstCard?.recipient || body.recipient || DEFAULT_REQUISITES.recipient;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project')) {
      return NextResponse.json({ success: true, message: 'Updated in demo mode' });
    }

    const supabase = createAdminClient();

    // 1. Сохраняем в таблицу `settings`
    await supabase.from('settings').upsert({
      id: 'requisites',
      phone: mainPhone,
      card_number: mainCard,
      bank_name: mainBank,
      recipient: mainRecipient,
      payment_methods: paymentMethods,
      updated_at: new Date().toISOString(),
    });

    // 2. Дублируем в user_metadata
    const { data: usersData } = await supabase.auth.admin.listUsers();
    if (usersData?.users) {
      for (const user of usersData.users) {
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            payment_requisites: {
              phone: mainPhone,
              card_number: mainCard,
              bank_name: mainBank,
              recipient: mainRecipient,
            },
            payment_methods: paymentMethods,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      payment_methods: paymentMethods,
      requisites: {
        phone: mainPhone,
        card_number: mainCard,
        bank_name: mainBank,
        recipient: mainRecipient,
      },
      message: 'Способы оплаты успешно сохранены в Supabase DB!',
    });
  } catch (error: any) {
    console.error('Save settings error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
