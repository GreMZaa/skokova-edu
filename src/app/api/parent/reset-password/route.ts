import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, sanitizeError } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс 3 сброса пароля за 5 минут с одного IP
    const rateCheck = checkRateLimit(`reset-pwd:${clientIp}`, 3, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много запросов. Пожалуйста, подождите 5 минут.' },
        { status: 429 }
      );
    }

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

    // 2. Генерируем ссылку восстановления через Admin API (без лимитов клиентской отправки)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: targetRedirect,
      },
    });

    if (linkErr) {
      console.error('Generate recovery link error:', linkErr);
      if (linkErr.message.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            error: '⏳ Слишком много запросов писем подряд. Пожалуйста, подождите 3-5 минут или проверьте уже полученное письмо на почте.',
          },
          { status: 429 }
        );
      }
      throw linkErr;
    }

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
      message: `✉️ Запрос на сброс пароля отправлен для ${cleanEmail}. Проверьте вашу электронную почту (Входящие или Спам)!`,
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'Не удалось отправить ссылку сброса') },
      { status: 500 }
    );
  }
}

// PATCH: Строго авторизованное обновление пароля только при наличии валидной криптографической сессии
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещён. Недействительный или истёкший токен восстановления.' },
        { status: 401 }
      );
    }

    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Новый пароль должен содержать минимум 6 символов' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();
    const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      message: 'Пароль успешно обновлён',
    });
  } catch (error: any) {
    console.error('PATCH Reset password error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error, 'Ошибка обновления пароля') },
      { status: 500 }
    );
  }
}

