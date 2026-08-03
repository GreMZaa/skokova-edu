import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp, sanitizeError } from '@/lib/security';

export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс 5 регистраций в минуту с одного IP
    const rateCheck = checkRateLimit(`parent-signup:${clientIp}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много запросов. Пожалуйста, подождите 1 минуту.' },
        { status: 429 }
      );
    }

    const { email, password, fullName, phone, telegramHandle } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email и пароль обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();

    let createdUser: any = null;

    // 1. Создаем пользователя через Admin API с автоподтверждением email_confirm: true
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      // Если пользователь уже зарегистрирован — обновляем пароль и автоподтверждаем
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        const { data: updatedData } = await supabase.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
          password: password,
          user_metadata: { full_name: fullName },
        });
        createdUser = updatedData?.user || existingUser;
      } else {
        throw createErr;
      }
    } else {
      createdUser = newUser.user;
    }

    // 2. Гарантированно создаем/обновляем запись в таблице profiles в Supabase DB!
    if (createdUser?.id) {
      await supabase.from('profiles').upsert({
        id: createdUser.id,
        full_name: fullName || 'Родитель',
        phone: phone || '',
        telegram_handle: telegramHandle || '',
      });
    }

    return NextResponse.json({
      success: true,
      user: createdUser ? { id: createdUser.id, email: createdUser.email } : null,
      message: 'Аккаунт создан и профиль записан в Supabase DB',
    });
  } catch (error: any) {
    console.error('Signup admin error:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

