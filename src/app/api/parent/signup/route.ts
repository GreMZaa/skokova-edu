import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email и пароль обязательны' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Создаем пользователя через Admin API с автоподтверждением email_confirm: true
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      // Если пользователь уже был зарегистрирован с необработанным email — подтверждаем и обновляем ему пароль
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        await supabase.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
          password: password,
          user_metadata: { full_name: fullName },
        });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Аккаунт подтвержден и готов к входу',
    });
  } catch (error: any) {
    console.error('Signup admin error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
