import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { GRADE_LABELS, GradeLevel } from '@/types/database';

function sanitizeStr(val: any): string {
  if (typeof val !== 'string') return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// POST: Создание пред-заказа (статус 'pending_payment' или 'receipt_uploaded')
export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const slot_id = sanitizeStr(formData.get('slot_id'));
    const service_title = sanitizeStr(formData.get('service_title'));
    const price = parseFloat(sanitizeStr(formData.get('price')) || '0');
    const selected_date = sanitizeStr(formData.get('selected_date'));
    const selected_slot_time = sanitizeStr(formData.get('selected_slot_time'));

    const parent_name = sanitizeStr(formData.get('parent_name'));
    const phone = sanitizeStr(formData.get('phone'));
    const telegram_handle = sanitizeStr(formData.get('telegram_handle'));
    const child_name = sanitizeStr(formData.get('child_name'));
    const child_grade = sanitizeStr(formData.get('child_grade')) as GradeLevel;
    const comment = sanitizeStr(formData.get('comment'));
    const user_id = sanitizeStr(formData.get('user_id'));

    const initialStatus = sanitizeStr(formData.get('status')) || 'pending_payment';

    if (!parent_name || !phone || !child_name) {
      return NextResponse.json(
        { success: false, error: 'Имя родителя, телефон и имя ребёнка обязательны к заполнению' },
        { status: 400 }
      );
    }

    let booking_id = `booking-${Date.now()}`;
    const supabaseUrl = sanitizeStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeStr(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();

      // 1. Создаём предзаявку со статусом 'pending_payment'
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          slot_id: slot_id || null,
          user_id: user_id || null,
          service_title,
          price,
          parent_name,
          phone,
          telegram_handle,
          child_name,
          child_grade,
          comment,
          receipt_file_url: null,
          status: initialStatus,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (bookingData) booking_id = bookingData.id;

      // 2. Блокируем время слота на 15 минут в time_slots
      if (slot_id) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await supabase
          .from('time_slots')
          .update({ locked_until: lockUntil })
          .eq('id', slot_id);
      }

      // 3. Автоматически сохраняем/обновляем профиль родителя в таблице profiles в Supabase DB
      if (user_id) {
        await supabase.from('profiles').upsert({
          id: user_id,
          full_name: parent_name,
          phone: phone,
          telegram_handle: telegram_handle,
        });

        // 4. Добавляем ребёнка в семью, если такого ещё нет
        if (child_name && child_name !== 'Нет никого') {
          const { data: existingChild } = await supabase
            .from('children')
            .select('id')
            .eq('parent_id', user_id)
            .eq('name', child_name)
            .maybeSingle();

          if (!existingChild) {
            await supabase.from('children').insert({
              parent_id: user_id,
              name: child_name,
              grade: child_grade || 'preschool_6',
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      booking_id,
      message: 'Заявка успешно создана и передана в админ-панель (Ожидает оплаты)',
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Прикрепление чека и отправка заявки педагогу
export async function PATCH(req: Request) {
  try {
    const formData = await req.formData();
    const booking_id = sanitizeStr(formData.get('booking_id'));
    const slot_id = sanitizeStr(formData.get('slot_id'));
    const receipt_file = formData.get('receipt_file') as File | null;

    const service_title = sanitizeStr(formData.get('service_title'));
    const price = parseFloat(sanitizeStr(formData.get('price')) || '0');
    const selected_date = sanitizeStr(formData.get('selected_date'));
    const selected_slot_time = sanitizeStr(formData.get('selected_slot_time'));
    const parent_name = sanitizeStr(formData.get('parent_name'));
    const phone = sanitizeStr(formData.get('phone'));
    const telegram_handle = sanitizeStr(formData.get('telegram_handle'));
    const child_name = sanitizeStr(formData.get('child_name'));
    const child_grade = sanitizeStr(formData.get('child_grade')) as GradeLevel;
    const comment = sanitizeStr(formData.get('comment'));

    if (!booking_id || !receipt_file) {
      return NextResponse.json(
        { success: false, error: 'booking_id и файл чека обязательны' },
        { status: 400 }
      );
    }

    let receipt_file_url = '';
    const supabaseUrl = sanitizeStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeStr(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();

      // 1. Загружаем чек в Supabase Storage
      const originalName = sanitizeStr(receipt_file.name || 'receipt.png');
      const rawExt = originalName.split('.').pop() || 'png';
      const fileExt = rawExt.replace(/[^a-zA-Z0-9]/g, '');
      const fileName = `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt || 'png'}`;

      const arrayBuffer = await receipt_file.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);
      const contentType = receipt_file.type && receipt_file.type.includes('/') ? receipt_file.type : 'image/png';

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileBuffer, {
          contentType,
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

      // 2. Обновляем статус заявки в 'receipt_uploaded'
      await supabase
        .from('bookings')
        .update({
          receipt_file_url,
          status: 'receipt_uploaded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking_id);

      // 3. Фиксируем окончательное бронирование слота (is_booked: true)
      if (slot_id) {
        await supabase
          .from('time_slots')
          .update({ is_booked: true, locked_until: null })
          .eq('id', slot_id);
      }
    } else {
      receipt_file_url = `https://storage.demo/receipts/${receipt_file.name}`;
    }

    // 4. Уведомление в Telegram Бот педагога
    const botToken = sanitizeStr(process.env.TELEGRAM_BOT_TOKEN);
    const teacherChatId = sanitizeStr(process.env.TELEGRAM_TEACHER_CHAT_ID);

    if (botToken && teacherChatId && !botToken.includes('123456789')) {
      const gradeText = GRADE_LABELS[child_grade] || child_grade;
      const messageText = `🔔 *ЧЕК ЗАГРУЖЕН! ПОДТВЕРДИТЕ ОПЛАТУ*\n\n` +
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
      message: 'Чек успешно прикреплен, статус заявки обновлен!',
    });
  } catch (error: any) {
    console.error('Booking patch error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
