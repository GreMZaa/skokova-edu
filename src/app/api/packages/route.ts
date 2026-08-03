import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');

    const adminSupabase = createAdminClient();

    let query = adminSupabase.from('user_packages').select('*').order('created_at', { ascending: false });

    if (user) {
      query = query.eq('user_id', user.id);
    } else if (phone) {
      query = query.eq('parent_phone', phone);
    } else {
      return NextResponse.json({ packages: [], total_remaining: 0 });
    }

    const { data: packages, error } = await query;
    if (error) {
      // Таблица еще может создаваться
      return NextResponse.json({ packages: [], total_remaining: 0 });
    }

    // Уроки считаются доступными только из подтвержденных (active) абонементов
    const activePackages = (packages || []).filter((p: any) => p.status === 'active');
    const totalRemaining = activePackages.reduce((acc: number, p: any) => acc + (p.remaining_lessons || 0), 0);

    return NextResponse.json({
      packages: packages || [],
      total_remaining: totalRemaining,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, count, parent_name, parent_phone, child_name, package_id } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const adminSupabase = createAdminClient();

    if (action === 'purchase') {
      const lessonCount = [4, 8, 12].includes(Number(count)) ? Number(count) : 4;
      const pricePerLesson = 600; // Стандартная цена без скидки
      const pricePaid = lessonCount * pricePerLesson;

      // Новые заявки создаются со статусом 'pending_payment' (на проверке у преподавателя)
      const { data: newPkg, error } = await adminSupabase
        .from('user_packages')
        .insert({
          user_id: user?.id || null,
          parent_name: parent_name || '',
          parent_phone: parent_phone || '',
          child_name: child_name || '',
          total_lessons: lessonCount,
          remaining_lessons: lessonCount,
          price_paid: pricePaid,
          status: 'pending_payment',
        })
        .select()
        .single();

      if (error) throw error;

      // Отправка уведомления преподавателю в Telegram
      try {
        const { sendTelegramNotification, escapeMarkdown } = await import('@/lib/telegram');
        await sendTelegramNotification({
          text: `🎟️ *НОВАЯ ЗАЯВКА НА АБОНЕМЕНТ*\n\n👤 *Родитель:* ${escapeMarkdown(parent_name || 'Родитель')}\n📞 *Телефон:* ${escapeMarkdown(parent_phone || 'Не указан')}\n👶 *Ребёнок:* ${escapeMarkdown(child_name || 'Не указан')}\n📦 *Выбран пакет:* ${lessonCount} уроков (${pricePaid.toLocaleString('ru-RU')} ₽)\n\n⏳ *Статус:* На проверке. Подтвердите оплату в панели администратора!`,
          parseMode: 'Markdown',
        });
      } catch (tgErr) {
        console.error('Telegram package notification error:', tgErr);
      }

      return NextResponse.json({ success: true, package: newPkg });
    }

    if (action === 'use_lesson') {
      let targetPackageId = package_id;

      if (!targetPackageId) {
        // Находим первый активный абонемент с балансом > 0
        let q = adminSupabase
          .from('user_packages')
          .select('*')
          .eq('status', 'active')
          .gt('remaining_lessons', 0)
          .order('created_at', { ascending: true })
          .limit(1);

        if (user) {
          q = q.eq('user_id', user.id);
        } else if (parent_phone) {
          q = q.eq('parent_phone', parent_phone);
        }

        const { data: activePkgs } = await q;
        if (!activePkgs || activePkgs.length === 0) {
          return NextResponse.json({ error: 'Нет активных абонементов с доступными уроками' }, { status: 400 });
        }
        targetPackageId = activePkgs[0].id;
      }

      const { data: pkg } = await adminSupabase
        .from('user_packages')
        .select('*')
        .eq('id', targetPackageId)
        .single();

      if (!pkg || pkg.remaining_lessons <= 0) {
        return NextResponse.json({ error: 'Уроки в абонементе закончились' }, { status: 400 });
      }

      const newRemaining = pkg.remaining_lessons - 1;
      const newStatus = newRemaining === 0 ? 'completed' : 'active';

      await adminSupabase
        .from('user_packages')
        .update({
          remaining_lessons: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPackageId);

      return NextResponse.json({ success: true, remaining_lessons: newRemaining });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Ошибка сервера' }, { status: 500 });
  }
}
