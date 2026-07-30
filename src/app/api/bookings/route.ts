import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { GRADE_LABELS, GradeLevel } from '@/types/database';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const slot_id = formData.get('slot_id') as string;
    const service_title = formData.get('service_title') as string;
    const price = parseFloat(formData.get('price') as string || '0');
    const selected_date = formData.get('selected_date') as string;
    const selected_slot_time = formData.get('selected_slot_time') as string;

    const parent_name = formData.get('parent_name') as string;
    const phone = formData.get('phone') as string;
    const telegram_handle = formData.get('telegram_handle') as string;
    const child_name = formData.get('child_name') as string;
    const child_grade = formData.get('child_grade') as GradeLevel;
    const comment = formData.get('comment') as string;

    const receipt_file = formData.get('receipt_file') as File | null;

    if (!parent_name || !phone || !child_name) {
      return NextResponse.json(
        { success: false, error: 'Имя родителя, телефон и имя ребёнка обязательны к заполнению' },
        { status: 400 }
      );
    }

    let receipt_file_url = '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Загрузка файла в Supabase Storage если подключены ключи
    if (receipt_file && supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();
      const fileExt = receipt_file.name.split('.').pop();
      const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const fileBuffer = await receipt_file.arrayBuffer();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileBuffer, {
          contentType: receipt_file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
      } else if (uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receipt_file_url = publicUrlData.publicUrl;
      }
    } else if (receipt_file) {
      receipt_file_url = `https://storage.demo/receipts/${receipt_file.name}`;
    }

    // 2. Сохранение заявки в БД
    let booking_id = `booking-${Date.now()}`;
    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          slot_id: slot_id || null,
          service_title,
          price,
          parent_name,
          phone,
          telegram_handle,
          child_name,
          child_grade,
          comment,
          receipt_file_url,
          status: 'receipt_uploaded',
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (bookingData) booking_id = bookingData.id;
    }

    // 3. Отправка уведомления маме в Telegram (если заданы ключи бота)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const teacherChatId = process.env.TELEGRAM_TEACHER_CHAT_ID;

    if (botToken && teacherChatId && !botToken.includes('123456789')) {
      const gradeText = GRADE_LABELS[child_grade] || child_grade;
      const messageText = `🔔 *НОВАЯ ЗАПИСЬ НА УРОК!* (Чек загружен)\n\n` +
        `📚 *Услуга:* ${service_title}\n` +
        `📅 *Дата и время:* ${selected_date}, ${selected_slot_time}\n` +
        `💰 *Сумма:* ${price.toLocaleString('ru-RU')} ₽\n\n` +
        `👤 *Родитель:* ${parent_name}\n` +
        `📞 *Телефон:* ${phone}\n` +
        `💬 *Telegram:* ${telegram_handle || 'не указан'}\n` +
        `👶 *Ребёнок:* ${child_name} (${gradeText})\n\n` +
        `📝 *Комментарий:* ${comment || 'отсутствует'}\n\n` +
        `🧾 *Чек оплаты:* ${receipt_file_url || 'Файл загружен'}`;

      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Подтвердить запись', callback_data: `confirm_${booking_id}` },
            { text: '✏️ Изменить заявку', callback_data: `edit_${booking_id}` }
          ],
          [
            { text: '❌ Отклонить', callback_data: `reject_${booking_id}` },
            { text: '💬 Написать родителю', url: telegram_handle ? `https://t.me/${telegram_handle.replace('@', '')}` : `tel:${phone}` }
          ]
        ]
      };

      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: teacherChatId,
            text: messageText,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          }),
        });
      } catch (tgError) {
        console.error('Telegram notification error:', tgError);
      }
    }

    return NextResponse.json({
      success: true,
      booking_id,
      receipt_file_url,
      message: 'Заявка успешно принята, чек сохранен и передан педагогу!',
    });
  } catch (error: any) {
    console.error('Booking submission error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
