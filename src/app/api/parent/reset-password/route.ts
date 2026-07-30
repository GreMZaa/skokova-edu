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
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skokova-edu.vercel.app';
    const targetRedirect = `${siteUrl}/login?reset=true`;

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

    // 2. Генерируем безопасную ссылку сброса с явным перенаправлением на продакшн сайт вместо localhost
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: targetRedirect,
      },
    });

    if (linkErr) {
      console.error('Generate recovery link error:', linkErr);
      throw linkErr;
    }

    // Корректируем redirect_to в ссылке, если в Supabase Dashboard до сих пор указан localhost
    let rawActionLink = linkData.properties?.action_link || '';
    if (rawActionLink.includes('localhost')) {
      rawActionLink = rawActionLink.replace(
        /redirect_to=[^&]+/,
        'redirect_to=' + encodeURIComponent(targetRedirect)
      );
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      actionLink: rawActionLink,
      message: `✉️ Запрос на сброс пароля обработан для ${cleanEmail}!`,
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Не удалось отправить ссылку сброса' },
      { status: 500 }
    );
  }
}
