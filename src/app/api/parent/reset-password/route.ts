import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://skokova-edu.vercel.app';

    // Вызываем официальную функцию отправки письма восстановления пароля Supabase Auth
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/login?reset=true`,
    });

    if (error) {
      console.error('Supabase resetPasswordForEmail error:', error);
      throw new Error('Ошибка отправки письма. Убедитесь, что пользователь зарегистрирован.');
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: `✉️ Письмо со ссылкой для сброса пароля успешно отправлено на ${cleanEmail}. Проверьте Входящие или Спам!`,
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Не удалось отправить письмо для сброса пароля' },
      { status: 500 }
    );
  }
}
