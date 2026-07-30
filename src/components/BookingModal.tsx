'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, Upload, CheckCircle2, AlertCircle, Copy, Check, Loader2 } from 'lucide-react';
import { SERVICES } from '@/data/services';
import { GRADE_LABELS, GradeLevel, Service } from '@/types/database';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceTitle?: string;
}

interface DateSlotGroup {
  dateStr: string;
  slots: { id: string; time: string; start_time?: string }[];
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialServiceTitle = SERVICES[1].title,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableDates, setAvailableDates] = useState<DateSlotGroup[]>([]);
  
  // Выбранные параметры
  const [selectedService, setSelectedService] = useState<Service>(
    SERVICES.find(s => s.title === initialServiceTitle) || SERVICES[1]
  );
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ id: string; time: string } | null>(null);

  // Форма родителя
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [childName, setChildName] = useState('');
  const [childGrade, setChildGrade] = useState<GradeLevel>('preschool_6');
  const [comment, setComment] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);

  // Оплата и чек
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Загрузка слотов при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchSlots();
    }
  }, [isOpen]);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      if (data.success && data.dates && data.dates.length > 0) {
        setAvailableDates(data.dates);
        setSelectedDate(data.dates[0].dateStr);
      }
    } catch (e) {
      console.error('Failed to load slots:', e);
    } finally {
      setLoadingSlots(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyCard = () => {
    navigator.clipboard.writeText('+7 (926) 123-45-67');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg('Размер файла чека не должен превышать 10 МБ');
        return;
      }
      setErrorMsg('');
      setReceiptFile(file);
    }
  };

  const handleGoToStep2 = async () => {
    if (!selectedSlot) {
      setErrorMsg('Пожалуйста, выберите удобное время в календаре');
      return;
    }
    setErrorMsg('');
    
    // Блокировка слота на 15 минут через API
    try {
      await fetch('/api/slots/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot_id: selectedSlot.id }),
      });
    } catch (e) {
      console.error('Slot lock error:', e);
    }

    setStep(2);
  };

  const handleGoToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phone.trim() || !childName.trim()) {
      setErrorMsg('Заполните обязательные поля: Имя родителя, Телефон и Имя ребёнка');
      return;
    }
    if (!consentChecked) {
      setErrorMsg('Необходимо согласие на обработку персональных данных');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleSubmitBooking = async () => {
    if (!receiptFile) {
      setErrorMsg('Пожалуйста, загрузите файл чека или скриншот перевода');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('slot_id', selectedSlot?.id || '');
      formData.append('service_title', selectedService.title);
      formData.append('price', selectedService.price.toString());
      formData.append('selected_date', selectedDate);
      formData.append('selected_slot_time', selectedSlot?.time || '');

      formData.append('parent_name', parentName);
      formData.append('phone', phone);
      formData.append('telegram_handle', telegramHandle);
      formData.append('child_name', childName);
      formData.append('child_grade', childGrade);
      formData.append('comment', comment);

      formData.append('receipt_file', receiptFile);

      const res = await fetch('/api/bookings', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке заявки');
      }

      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Произошла ошибка при отправке. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentGroup = availableDates.find((d) => d.dateStr === selectedDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border-2 border-[#1F1E1D] rounded-2xl hard-shadow-lg w-full max-w-2xl overflow-hidden relative my-8"
      >
        {/* Шапка модального окна */}
        <div className="p-5 bg-[#FAF8F5] border-b-2 border-[#1F1E1D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C85A32] text-white flex items-center justify-center font-bold text-sm">
              {step}
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">
                {step === 1 && 'Шаг 1: Выбор программы и времени'}
                {step === 2 && 'Шаг 2: Анкетные данные ребёнка'}
                {step === 3 && 'Шаг 3: Оплата по СБП и загрузка чека'}
                {step === 4 && 'Заявка успешно отправлена!'}
              </h3>
              <p className="text-xs text-[#595652] font-mono">
                {step === 1 && 'Выберите подходящий день и свободный слот'}
                {step === 2 && 'Укажите информацию для подготовки к занятию'}
                {step === 3 && 'Переведите оплату и прикрепите подтверждение'}
                {step === 4 && 'Педагог уведомит вас в ближайшее время'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-[#1F1E1D]/20 flex items-center justify-center text-[#1F1E1D] hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ШАГ 1: Выбор программы и времени */}
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Выбор программы */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                  Выберите программу:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s)}
                      className={`p-3.5 rounded-xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                        selectedService.id === s.id
                          ? 'border-[#C85A32] bg-[#C85A32]/5 hard-shadow'
                          : 'border-[#1F1E1D]/20 bg-[#FAF8F5] hover:border-[#1F1E1D]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-[#1F1E1D]">{s.title}</div>
                        <div className="text-xs text-[#595652]">{s.duration_minutes} минут</div>
                      </div>
                      <div className="font-serif font-bold text-base text-[#C85A32]">
                        {s.price.toLocaleString('ru-RU')} ₽
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Выбор дня */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                  Выберите дату:
                </label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center p-4 text-xs font-mono text-[#595652] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C85A32]" />
                    <span>Загрузка расписания...</span>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {availableDates.map((item) => (
                      <button
                        key={item.dateStr}
                        onClick={() => {
                          setSelectedDate(item.dateStr);
                          setSelectedSlot(null);
                        }}
                        className={`px-3.5 py-2 rounded-xl border-2 text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                          selectedDate === item.dateStr
                            ? 'border-[#1F1E1D] bg-[#1F1E1D] text-white hard-shadow'
                            : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D] hover:border-[#1F1E1D]'
                        }`}
                      >
                        {item.dateStr}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Выбор временного слота */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                  Свободное время ({selectedDate}):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {currentGroup?.slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold text-center transition-all cursor-pointer ${
                        selectedSlot?.id === slot.id
                          ? 'border-[#C85A32] bg-[#C85A32] text-white hard-shadow'
                          : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D] hover:border-[#1F1E1D]'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleGoToStep2}
                  className="w-full bg-[#C85A32] hover:bg-[#b04b27] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Продолжить заполнение анкеты</span>
                </button>
              </div>

            </div>
          )}

          {/* ШАГ 2: Анкета родителя и ребёнка */}
          {step === 2 && (
            <form onSubmit={handleGoToStep3} className="space-y-4">
              
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/10 text-xs flex items-center justify-between">
                <span className="font-medium text-[#1F1E1D]">
                  {selectedService.title} • {selectedDate}, {selectedSlot?.time}
                </span>
                <span className="font-serif font-bold text-[#C85A32]">{selectedService.price} ₽</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Имя родителя *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Ольга"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Телефон для связи *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+7 (9XX) XXX-XX-XX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Имя ребёнка *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Артём"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Класс / Возраст *
                  </label>
                  <select
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value as GradeLevel)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white"
                  >
                    {(Object.keys(GRADE_LABELS) as GradeLevel[]).map((key) => (
                      <option key={key} value={key}>
                        {GRADE_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-[#595652]">
                  Telegram (для отправки ссылки на урок)
                </label>
                <input
                  type="text"
                  placeholder="@username"
                  value={telegramHandle}
                  onChange={(e) => setTelegramHandle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-[#595652]">
                  Комментарий (какие есть сложности или на что обратить внимание)
                </label>
                <textarea
                  rows={3}
                  placeholder="Плохо читает по слогам, нужно подтянуть решения задач..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 text-xs text-[#595652]">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 accent-[#C85A32]"
                />
                <label htmlFor="consent">
                  Согласен(на) на обработку персональных данных (ФЗ-152)
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 border-2 border-[#1F1E1D]/20 rounded-xl text-xs font-semibold hover:border-[#1F1E1D]"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#C85A32] hover:bg-[#b04b27] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow cursor-pointer"
                >
                  Перейти к оплате реквизитов
                </button>
              </div>

            </form>
          )}

          {/* ШАГ 3: Оплата по реквизитам СБП и загрузка чека */}
          {step === 3 && (
            <div className="space-y-6">
              
              <div className="p-4 bg-[#FAF8F5] border-2 border-[#1F1E1D] rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-2">
                  <span className="text-xs font-mono text-[#595652]">Сумма к оплате:</span>
                  <span className="font-serif font-bold text-xl text-[#C85A32]">
                    {selectedService.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                <div className="space-y-2 text-xs text-[#1F1E1D]">
                  <div className="font-bold font-mono">Реквизиты для перевода (СБП):</div>
                  <div className="flex items-center justify-between p-2.5 bg-white border border-[#1F1E1D]/20 rounded-lg">
                    <div>
                      <div className="font-bold">+7 (926) 123-45-67</div>
                      <div className="text-[11px] text-[#595652]">Т-Банк / Сбербанк • Скокова Юлия Павловна</div>
                    </div>
                    <button
                      onClick={handleCopyCard}
                      className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-gray-100 border border-[#1F1E1D]/30 rounded-md flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Загрузчик файла чека */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                  Прикрепите фото или PDF чека оплаты:
                </label>
                <div className="border-2 border-dashed border-[#1F1E1D]/30 rounded-xl p-6 text-center hover:border-[#C85A32] transition-colors bg-[#FAF8F5]">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, application/pdf"
                    onChange={handleFileChange}
                    id="receipt-file-input"
                    className="hidden"
                  />
                  <label htmlFor="receipt-file-input" className="cursor-pointer space-y-2 block">
                    <Upload className="w-8 h-8 text-[#C85A32] mx-auto" />
                    <div className="text-sm font-semibold text-[#1F1E1D]">
                      {receiptFile ? receiptFile.name : 'Нажмите для выбора файла (JPG, PNG, PDF)'}
                    </div>
                    <div className="text-xs text-[#595652]">Размер до 10 МБ</div>
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-3 border-2 border-[#1F1E1D]/20 rounded-xl text-xs font-semibold hover:border-[#1F1E1D]"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleSubmitBooking}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#2E5A44] hover:bg-[#234634] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{isSubmitting ? 'Отправка...' : 'Я оплатил(а), отправить заявку'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ШАГ 4: Экран благодарности */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-[#1F1E1D] text-emerald-600 flex items-center justify-center mx-auto hard-shadow">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h3 className="font-serif font-bold text-2xl text-[#1F1E1D]">
                Заявка принята!
              </h3>

              <p className="text-sm text-[#595652] max-w-md mx-auto leading-relaxed">
                Спасибо, {parentName}! Ваша запись на <strong>{selectedDate} в {selectedSlot?.time}</strong> успешно зафиксирована. Чек прикреплён и отправлен педагогу.
              </p>

              <div className="p-4 bg-[#FAF8F5] border border-[#1F1E1D]/20 rounded-xl text-xs text-left space-y-1">
                <div><strong>Услуга:</strong> {selectedService.title}</div>
                <div><strong>Ребёнок:</strong> {childName} ({GRADE_LABELS[childGrade]})</div>
                <div><strong>Телефон:</strong> {phone}</div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="bg-[#1F1E1D] text-white text-sm font-semibold px-8 py-3 rounded-xl border-2 border-[#1F1E1D] hard-shadow"
                >
                  Закрыть окно
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
