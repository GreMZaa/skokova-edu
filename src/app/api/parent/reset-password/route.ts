import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email, phone, newPassword } = await req.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Пожалуйста, укажите корректную электронную почту' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const supabase = createAdminClient();

    // 1. Ищем пользователя по Email в Supabase Auth
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

    // 2. Если передан новый пароль — проверяем подтверждение по телефону и меняем пароль
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Новый пароль должен содержать минимум 6 символов' },
          { status: 400 }
        );
      }

      let isVerified = false;

      // Проверка по профилю
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.phone) {
        const userPhoneClean = profile.phone.replace(/\D/g, '');
        if (cleanPhone && (userPhoneClean.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(userPhoneClean.slice(-10)))) {
          isVerified = true;
        }
      }

      // Проверка по прошлым заявкам
      if (!isVerified) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('phone')
          .eq('user_id', user.id);

        if (bookings && bookings.length > 0) {
          for (const b of bookings) {
            if (b.phone) {
              const bPhoneClean = b.phone.replace(/\D/g, '');
              if (cleanPhone && (bPhoneClean.endsWith(cleanPhone.slice(-10)) || cleanPhone.endsWith(bPhoneClean.slice(-10)))) {
                isVerified = true;
                break;
              }
            }
          }
        }
      }

      // Если в аккаунте пока не сохранён номер телефона — разрешаем смену по почте
      if (!profile?.phone && (!cleanPhone || cleanPhone.length < 5)) {
        isVerified = true;
      }

      if (!isVerified && cleanPhone.length >= 7) {
        return NextResponse.json(
          {
            success: false,
            error: 'Указанный номер телефона не совпадает с номером в вашем профиле. Проверьте данные!',
          },
          { status: 403 }
        );
      }

      // Обновляем пароль пользователя в Supabase Auth
      const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateErr) {
        throw updateErr;
      }

      return NextResponse.json({
        success: true,
        message: '🎉 Пароль успешно изменён! Подставляем новый пароль для входа...',
      });
    }

    // Запасной вариант: попытка генерации ссылки на Email
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skokova-edu.vercel.app';
    try {
      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: {
          redirectTo: `${siteUrl}/login?reset=true`,
        },
      });
    } catch (e) {
      console.log('Recovery generateLink non-critical error:', e);
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: 'Запрос принят. Укажите ваш телефон для немедленной смены пароля.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Не удалось сбросить пароль' },
      { status: 500 }
    );
  }
}
