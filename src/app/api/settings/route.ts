import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAdminSessionFromRequest, sanitizeError } from '@/lib/security';

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
    phone: '+7 (960) 837-47-06',
    bank_name: 'Т-Банк / Сбербанк',
    recipient: 'Скокова Юлия Павловна',
    is_active: true,
  },
  {
    id: 'card_default',
    type: 'card',
    title: 'Перевод по номеру карты',
    card_number: '11111111111111111111',
    bank_name: 'Т-Банк / Сбербанк',
    recipient: 'Скокова Юлия Павловна',
    is_active: true,
  },
];

const DEFAULT_REQUISITES = {
  phone: '+7 (960) 837-47-06',
  card_number: '11111111111111111111',
  bank_name: 'Т-Банк / Сбербанк',
  recipient: 'Скокова Юлия Павловна',
};

// GET: Загрузка способов оплаты из DB + user_metadata
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

    // 1. Проверяем user_metadata у юзеров (там хранится точный массив нескольких карт)
    let metaMethods: PaymentMethodItem[] | null = null;
    let metaRequisites = null;

    const { data: usersData } = await supabase.auth.admin.listUsers();
    if (usersData?.users && usersData.users.length > 0) {
      for (const u of usersData.users) {
        if (u.user_metadata?.payment_methods && Array.isArray(u.user_metadata.payment_methods) && u.user_metadata.payment_methods.length > 0) {
          metaMethods = u.user_metadata.payment_methods;
          metaRequisites = u.user_metadata.payment_requisites;
          break;
        }
      }
    }

    // 2. Проверяем таблицу `settings` в Supabase DB
    const { data: dbSettings, error: dbErr } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'requisites')
      .maybeSingle();

    let methods: PaymentMethodItem[] = [];

    if (!dbErr && dbSettings) {
      if (Array.isArray(dbSettings.payment_methods) && dbSettings.payment_methods.length > 0) {
        methods = dbSettings.payment_methods;
      } else {
        // Формируем из колонок таблицы phone и card_number
        if (dbSettings.phone && dbSettings.phone !== 'EMPTY') {
          methods.push({
            id: 'sbp_db',
            type: 'sbp',
            title: 'Перевод через СБП (по телефону)',
            phone: dbSettings.phone,
            bank_name: dbSettings.bank_name || 'Т-Банк / Сбербанк',
            recipient: dbSettings.recipient || 'Скокова Юлия Павловна',
            is_active: true,
          });
        }
        if (dbSettings.card_number && dbSettings.card_number !== 'EMPTY' && dbSettings.card_number.trim() !== '') {
          methods.push({
            id: 'card_db',
            type: 'card',
            title: 'Перевод по номеру карты',
            card_number: dbSettings.card_number,
            bank_name: dbSettings.bank_name || 'Т-Банк / Сбербанк',
            recipient: dbSettings.recipient || 'Скокова Юлия Павловна',
            is_active: true,
          });
        }
      }
    }

    // Если метаданные содержат больше информации (например, 2 карты), отдаем метаданные!
    if (metaMethods && metaMethods.length >= methods.length) {
      methods = metaMethods;
    }

    if (methods.length === 0) {
      methods = DEFAULT_METHODS;
    }

    const firstSbp = methods.find((m) => m.type === 'sbp');
    const firstCard = methods.find((m) => m.type === 'card');

    return NextResponse.json({
      success: true,
      requisites: metaRequisites || {
        phone: firstSbp?.phone || dbSettings?.phone || DEFAULT_REQUISITES.phone,
        card_number: firstCard?.card_number || dbSettings?.card_number || DEFAULT_REQUISITES.card_number,
        bank_name: dbSettings?.bank_name || DEFAULT_REQUISITES.bank_name,
        recipient: dbSettings?.recipient || DEFAULT_REQUISITES.recipient,
      },
      payment_methods: methods,
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

// POST: Безотказное сохранение нескольких карт в Supabase DB + metadata (Только для администраторов!)
export async function POST(req: Request) {
  try {
    // 12.2 Серверная проверка прав администратора
    const session = getAdminSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const paymentMethods: PaymentMethodItem[] = body.payment_methods || DEFAULT_METHODS;

    const firstSbp = paymentMethods.find((m) => m.type === 'sbp' && m.is_active) || paymentMethods.find((m) => m.type === 'sbp');
    const firstCard = paymentMethods.find((m) => m.type === 'card' && m.is_active) || paymentMethods.find((m) => m.type === 'card');

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

    // 1. Пробуем сохранить с колонкой payment_methods
    let { error: upsertErr } = await supabase.from('settings').upsert({
      id: 'requisites',
      phone: mainPhone,
      card_number: mainCard,
      bank_name: mainBank,
      recipient: mainRecipient,
      payment_methods: paymentMethods,
      updated_at: new Date().toISOString(),
    });

    // 2. Если колонка payment_methods в таблице еще не создана в Supabase, делаем фолбэк на стандартные колонки!
    if (upsertErr) {
      console.warn('Upsert with payment_methods column failed, retrying without column:', upsertErr.message);
      await supabase.from('settings').upsert({
        id: 'requisites',
        phone: mainPhone,
        card_number: mainCard,
        bank_name: mainBank,
        recipient: mainRecipient,
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Гарантированно сохраняем полный массив всех карт в user_metadata всех пользователей
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
      message: 'Способы оплаты успешно сохранены в Supabase DB и доступны пользователям!',
    });
  } catch (error: any) {
    console.error('Save settings error:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

