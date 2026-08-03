import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { GRADE_LABELS, GradeLevel } from '@/types/database';
import { sendTelegramNotification, escapeMarkdown } from '@/lib/telegram';
import {
  checkRateLimit,
  getClientIp,
  validateReceiptFile,
  sanitizeError,
} from '@/lib/security';

function sanitizeStr(val: any): string {
  if (typeof val !== 'string') return '';
  return val.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// POST: Создание пред-заказа (статус 'pending_payment')
export async function POST(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс 10 попыток бронирования в минуту с одного IP
    const rateCheck = checkRateLimit(`bookings-post:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много запросов. Пожалуйста, подождите 1 минуту.' },
        { status: 429 }
      );
    }

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

    const requestedStatus = sanitizeStr(formData.get('status'));
    const use_package = formData.get('use_package') === 'true' || requestedStatus === 'confirmed';

    if (!parent_name || !phone || !child_name) {
      return NextResponse.json(
        { success: false, error: 'Имя родителя, телефон и имя ребёнка обязательны к заполнению' },
        { status: 400 }
      );
    }

    let booking_id = `booking-${Date.now()}`;
    const supabaseUrl = sanitizeStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeStr(process.env.SUPABASE_SERVICE_ROLE_KEY);

    let initialStatus = 'pending_payment';
    let paymentMethod = 'sbp';
    let packageDeducted = false;
    let remainingLessonsInPkg = 0;

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();

      // Автоматическое списание 1 урока из активного абонемента
      if (use_package) {
        try {
          let pkgQuery = supabase
            .from('user_packages')
            .select('*')
            .eq('status', 'active')
            .gt('remaining_lessons', 0)
            .order('created_at', { ascending: true })
            .limit(1);

          if (user_id) {
            pkgQuery = pkgQuery.eq('user_id', user_id);
          } else if (phone) {
            pkgQuery = pkgQuery.eq('parent_phone', phone);
          }

          const { data: activePkgs } = await pkgQuery;
          if (activePkgs && activePkgs.length > 0) {
            const targetPkg = activePkgs[0];
            remainingLessonsInPkg = Math.max(0, targetPkg.remaining_lessons - 1);
            await supabase
              .from('user_packages')
              .update({
                remaining_lessons: remainingLessonsInPkg,
                status: remainingLessonsInPkg === 0 ? 'completed' : 'active',
                updated_at: new Date().toISOString(),
              })
              .eq('id', targetPkg.id);

            packageDeducted = true;
            initialStatus = 'confirmed';
            paymentMethod = 'package';
          }
        } catch (pkgErr) {
          console.error('Package deduction in booking route error:', pkgErr);
        }
      }

      const finalComment = comment
        ? (packageDeducted ? `${comment} [🎟️ Списано 1 занятие из абонемента]` : comment)
        : (packageDeducted ? '[🎟️ Списано 1 занятие из абонемента]' : '');

      // 1. Создаём предзаявку с соответствующим статусом
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          slot_id: slot_id || null,
          user_id: user_id || null,
          service_title,
          price: packageDeducted ? 0 : price,
          parent_name,
          phone,
          telegram_handle,
          child_name,
          child_grade,
          comment: finalComment,
          receipt_file_url: null,
          status: initialStatus,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;
      if (bookingData) booking_id = bookingData.id;

      // 2. Помечаем время слота как забронированное в time_slots
      if (slot_id) {
        await supabase
          .from('time_slots')
          .update({ is_booked: true, locked_until: null })
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

    // 5. Уведомление в Telegram чат админов/педагога о НОВОЙ ЗАЯВКЕ
    const gradeText = GRADE_LABELS[child_grade] || child_grade;
    const dateStr = selected_date && selected_slot_time ? `${selected_date}, ${selected_slot_time}` : 'Время на согласовании';
    const cleanHandle = telegram_handle ? (telegram_handle.startsWith('@') ? telegram_handle : `@${telegram_handle}`) : '';

    const messageText = packageDeducted
      ? `🎟️ *НОВАЯ ЗАПИСЬ (ОПЛАЧЕНО АБОНЕМЕНТОМ)*\n\n` +
        `📚 *Услуга:* ${escapeMarkdown(service_title)}\n` +
        `📅 *Дата и время:* ${escapeMarkdown(dateStr)}\n` +
        `🎟️ *Оплата:* Списано 1 занятие из абонемента (Осталось на балансе: ${remainingLessonsInPkg} уроков)\n\n` +
        `👤 *Родитель:* ${escapeMarkdown(parent_name)}\n` +
        `📞 *Телефон:* \`${phone}\`\n` +
        `💬 *Telegram:* ${cleanHandle ? escapeMarkdown(cleanHandle) : 'не указан'}\n` +
        `👶 *Ребёнок:* ${escapeMarkdown(child_name)} (${escapeMarkdown(gradeText)})\n\n` +
        `📝 *Комментарий:* ${escapeMarkdown(comment || 'отсутствует')}\n\n` +
        `📌 *Статус:* ✅ *Подтверждено (Списано из абонемента)*`
      : `🆕 *НОВАЯ ЗАЯВКА С САЙТА!*\n\n` +
        `📚 *Услуга:* ${escapeMarkdown(service_title)}\n` +
        `📅 *Дата и время:* ${escapeMarkdown(dateStr)}\n` +
        `💰 *Сумма:* ${price.toLocaleString('ru-RU')} ₽\n\n` +
        `👤 *Родитель:* ${escapeMarkdown(parent_name)}\n` +
        `📞 *Телефон:* \`${phone}\`\n` +
        `💬 *Telegram:* ${cleanHandle ? escapeMarkdown(cleanHandle) : 'не указан'}\n` +
        `👶 *Ребёнок:* ${escapeMarkdown(child_name)} (${escapeMarkdown(gradeText)})\n\n` +
        `📝 *Комментарий:* ${escapeMarkdown(comment || 'отсутствует')}\n\n` +
        `📌 *Статус:* ⏳ Ожидает оплаты`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить запись', callback_data: `confirm_${booking_id}` },
          { text: '✏️ Изменить заявку', callback_data: `edit_${booking_id}` }
        ],
        [
          { text: '❌ Отклонить', callback_data: `reject_${booking_id}` },
          { text: '💬 Написать родителю', url: cleanHandle ? `https://t.me/${cleanHandle.replace('@', '')}` : `tel:${phone}` }
        ]
      ]
    };

    await sendTelegramNotification({
      text: messageText,
      keyboard,
      parseMode: 'Markdown',
    });

    return NextResponse.json({
      success: true,
      booking_id,
      message: 'Заявка успешно создана и передана в админ-панель (Ожидает оплаты)',
    });
  } catch (error: any) {
    console.error('Booking creation error:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// PATCH: Прикрепление чека и отправка заявки педагогу
export async function PATCH(req: Request) {
  try {
    const clientIp = getClientIp(req);

    // 12.9 Rate Limiting: макс 10 попыток загрузки чека в минуту с одного IP
    const rateCheck = checkRateLimit(`bookings-patch:${clientIp}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Слишком много запросов. Пожалуйста, подождите 1 минуту.' },
        { status: 429 }
      );
    }

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

    // 12.10 Безопасная валидация файла чека (Размер <= 10 МБ, Расширение, Magic Bytes)
    const arrayBuffer = await receipt_file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const originalName = sanitizeStr(receipt_file.name || 'receipt.png');

    const fileValidation = validateReceiptFile(fileBuffer, originalName, receipt_file.type);
    if (!fileValidation.valid) {
      return NextResponse.json(
        { success: false, error: fileValidation.error || 'Недопустимый файл чека' },
        { status: 400 }
      );
    }

    let receipt_file_url = '';
    let dbBooking: any = null;

    const supabaseUrl = sanitizeStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseServiceKey = sanitizeStr(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (supabaseUrl && supabaseServiceKey && !supabaseUrl.includes('your-project')) {
      const supabase = createAdminClient();

      // 1. Загружаем чек в закрытый бакет Supabase Storage с безопасным случайным именем
      const fileName = fileValidation.safeFileName!;
      const contentType = fileValidation.contentType!;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, fileBuffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return NextResponse.json(
          { success: false, error: 'Ошибка сохранения файла чека в хранилище' },
          { status: 500 }
        );
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

      // 4. Достаем актуальную запись из БД для полной информации в уведомлении
      const { data: fetchedBooking } = await supabase
        .from('bookings')
        .select('*, time_slots!bookings_slot_id_fkey(start_time)')
        .eq('id', booking_id)
        .maybeSingle();

      dbBooking = fetchedBooking;
    } else {
      receipt_file_url = `https://storage.demo/receipts/${fileValidation.safeFileName}`;
    }

    // 5. Уведомление в Telegram Бот педагога/админов
    const finalServiceTitle = service_title || dbBooking?.service_title || 'Занятие';
    const finalPrice = price || dbBooking?.price || 0;
    const finalParentName = parent_name || dbBooking?.parent_name || 'Родитель';
    const finalPhone = phone || dbBooking?.phone || '';
    const rawHandle = telegram_handle || dbBooking?.telegram_handle || '';
    const cleanHandle = rawHandle ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`) : '';
    const finalChildName = child_name || dbBooking?.child_name || 'Ребёнок';
    const finalChildGrade = (child_grade || dbBooking?.child_grade) as GradeLevel;
    const gradeText = GRADE_LABELS[finalChildGrade] || finalChildGrade || 'Подготовка к школе';
    const finalComment = comment || dbBooking?.comment || '';

    let dateStr = selected_date && selected_slot_time ? `${selected_date}, ${selected_slot_time}` : '';
    if (!dateStr && dbBooking?.time_slots?.start_time) {
      dateStr = new Date(dbBooking.time_slots.start_time).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Samara',
      });
    }
    if (!dateStr) dateStr = 'Время на согласовании';

    const receiptLinkText = receipt_file_url ? `[Открыть чек](${receipt_file_url})` : 'Файл загружен';

    const messageText = `🔔 *ЧЕК ЗАГРУЖЕН! ПОДТВЕРДИТЕ ОПЛАТУ*\n\n` +
      `📚 *Услуга:* ${escapeMarkdown(finalServiceTitle)}\n` +
      `📅 *Дата и время:* ${escapeMarkdown(dateStr)}\n` +
      `💰 *Сумма:* ${finalPrice.toLocaleString('ru-RU')} ₽\n\n` +
      `👤 *Родитель:* ${escapeMarkdown(finalParentName)}\n` +
      `📞 *Телефон:* \`${finalPhone}\`\n` +
      `💬 *Telegram:* ${cleanHandle ? escapeMarkdown(cleanHandle) : 'не указан'}\n` +
      `👶 *Ребёнок:* ${escapeMarkdown(finalChildName)} (${escapeMarkdown(gradeText)})\n\n` +
      `📝 *Комментарий:* ${escapeMarkdown(finalComment || 'отсутствует')}\n\n` +
      `🧾 *Чек оплаты:* ${receiptLinkText}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить запись', callback_data: `confirm_${booking_id}` },
          { text: '✏️ Изменить заявку', callback_data: `edit_${booking_id}` }
        ],
        [
          { text: '❌ Отклонить', callback_data: `reject_${booking_id}` },
          { text: '💬 Написать родителю', url: cleanHandle ? `https://t.me/${cleanHandle.replace('@', '')}` : `tel:${finalPhone}` }
        ]
      ]
    };

    await sendTelegramNotification({
      text: messageText,
      keyboard,
      parseMode: 'Markdown',
    });

    return NextResponse.json({
      success: true,
      booking_id,
      receipt_file_url,
      message: 'Чек успешно прикреплен, статус заявки обновлен!',
    });
  } catch (error: any) {
    console.error('Booking patch error:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

