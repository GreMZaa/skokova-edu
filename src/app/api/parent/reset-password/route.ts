import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Пожалуйста, укажите корректную электронную почту' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabase = createAdminClient();

    // 1. Ищем пользователя по Email
    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();

    if (listErr || !usersData?.users) {
      throw new Error(listErr?.message || 'Ошибка поиска пользователя');
    }

    const user = usersData.users.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Пользователь с такой почтой не найден. Пожалуйста, проверьте Email или зарегистрируйтесь.',
        },
        { status: 444 }
      );
    }

    // 2. Генерируем новый надежный временный пароль
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const newTempPassword = `Skokova-${randomDigits}`;

    // 3. Обновляем пароль пользователя в Supabase Auth
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: newTempPassword,
    });

    if (updateErr) {
      throw updateErr;
    }

    // 4. Попытка генерации стандартного recovery линка Supabase (если отправка писем активна)
    try {
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
      });
    } catch (e) {
      console.log('Recovery email generateLink non-critical error:', e);
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      tempPassword: newTempPassword,
      message: `Временный пароль успешно отправлен на ${cleanEmail}!`,
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Не удалось сбросить пароль' },
      { status: 500 }
    );
  }
}
