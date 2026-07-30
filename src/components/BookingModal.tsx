'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, Upload, CheckCircle2, AlertCircle, Copy, Check, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { SERVICES } from '@/data/services';
import { GRADE_LABELS, GradeLevel, Service } from '@/types/database';
import { capitalizeFirstLetter, formatRussianPhone, formatTelegramHandle } from '@/lib/formatters';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceTitle?: string;
}

interface DateSlotGroup {
  dateStr: string;
  slots: { id: string; time: string; start_time?: string }[];
}

const DRAFT_STORAGE_KEY = 'skokova_active_draft_booking';

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  initialServiceTitle = SERVICES[0].title,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Выбор услуги и слота
  const [selectedService, setSelectedService] = useState<Service>(
    SERVICES.find((s) => s.title === initialServiceTitle) || SERVICES[0]
  );
  const [availableDates, setAvailableDates] = useState<DateSlotGroup[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<{ id: string; time: string } | null>(null);

  // Анкета родителя и ребёнка
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [telegramHandle, setTelegramHandle] = useState('');
  const [childName, setChildName] = useState('');
  const [childGrade, setChildGrade] = useState<GradeLevel>('preschool_6');
  const [comment, setComment] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);

  // Сохраненные дети из профиля родителя
  const [savedChildren, setSavedChildren] = useState<{ id: string; name: string; grade: GradeLevel }[]>([]);
  const [isCustomChild, setIsCustomChild] = useState(false);

  // Информация об автоматически созданном аккаунте
  const [createdAccountInfo, setCreatedAccountInfo] = useState<{ email: string } | null>(null);

  // Оплата и чек
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [userId, setUserId] = useState('');

  // Загрузка слотов и данных родителя при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchUserData();
      restoreDraftOrFetchSlots();
    }
  }, [isOpen]);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/parent/profile');
      const data = await res.json();
      if (data.success) {
        if (data.profile.full_name) setParentName((prev) => prev || capitalizeFirstLetter(data.profile.full_name));
        if (data.profile.phone) setPhone((prev) => prev || formatRussianPhone(data.profile.phone));
        if (data.profile.telegram_handle) setTelegramHandle((prev) => prev || formatTelegramHandle(data.profile.telegram_handle));
        if (data.children && data.children.length > 0) {
          setSavedChildren(data.children);
          setChildName((prev) => prev || capitalizeFirstLetter(data.children[0].name));
          setChildGrade((prev) => prev || data.children[0].grade);
        }
      }
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        if (user.email) setParentEmail(user.email);
      }
    } catch (e) {
      // Игнорируем в неавторизованном режиме
    }
  };

  const restoreDraftOrFetchSlots = async () => {
    setLoadingSlots(true);
    let includeSlotId: string | null = null;

    try {
      const savedDraft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && Date.now() - parsed.timestamp < 15 * 60 * 1000) {
          includeSlotId = parsed.selectedSlot?.id || null;
          if (parsed.selectedService) {
            const foundSvc = SERVICES.find((s) => s.id === parsed.selectedService.id);
            if (foundSvc) setSelectedService(foundSvc);
          }
          if (parsed.selectedDate) setSelectedDate(parsed.selectedDate);
          if (parsed.selectedSlot) setSelectedSlot(parsed.selectedSlot);
          if (parsed.parentName) setParentName(capitalizeFirstLetter(parsed.parentName));
          if (parsed.parentEmail) setParentEmail(parsed.parentEmail);
          if (parsed.phone) setPhone(formatRussianPhone(parsed.phone));
          if (parsed.telegramHandle) setTelegramHandle(formatTelegramHandle(parsed.telegramHandle));
          if (parsed.childName) setChildName(capitalizeFirstLetter(parsed.childName));
          if (parsed.childGrade) setChildGrade(parsed.childGrade);
          if (parsed.comment) setComment(capitalizeFirstLetter(parsed.comment));
          if (parsed.currentBookingId) setCurrentBookingId(parsed.currentBookingId);
          if (parsed.createdAccountInfo) setCreatedAccountInfo(parsed.createdAccountInfo);
          if (parsed.step && parsed.step > 1 && parsed.step <= 3) {
            setStep(parsed.step);
          }
        } else {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }

      const url = includeSlotId ? `/api/slots?include_slot_id=${includeSlotId}` : '/api/slots';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.dates && data.dates.length > 0) {
        setAvailableDates(data.dates);
        if (!selectedDate) {
          setSelectedDate(data.dates[0].dateStr);
        }
      }
    } catch (e) {
      console.error('Failed to load slots / restore draft:', e);
    } finally {
      setLoadingSlots(false);
    }
  };

  const saveDraftToSession = (nextStep: 1 | 2 | 3, bookingId?: string, createdAcc?: { email: string }) => {
    try {
      const draftData = {
        step: nextStep,
        selectedService,
        selectedDate,
        selectedSlot,
        parentName,
        parentEmail,
        phone,
        telegramHandle,
        childName,
        childGrade,
        comment,
        currentBookingId: bookingId || currentBookingId,
        createdAccountInfo: createdAcc || createdAccountInfo,
        timestamp: Date.now(),
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    } catch (e) {
      console.error('Failed to save draft:', e);
    }
  };

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
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
        setErrorMsg('Размер файла не должен превышать 10 МБ');
        return;
      }
      setErrorMsg('');
      setReceiptFile(file);
    }
  };

  const handleGoToStep2 = () => {
    if (!selectedSlot) {
      setErrorMsg('Пожалуйста, выберите удобное время в календаре');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  // Переход к оплате: Авто-создает аккаунт (если не авторизован), создает бронь и резервирует слот
  const handleGoToStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phone.trim() || !childName.trim()) {
      setErrorMsg('Заполните обязательные поля: Имя родителя, Телефон и Имя ребёнка');
      return;
    }
    if (!userId && (!parentEmail || !parentEmail.includes('@'))) {
      setErrorMsg('Пожалуйста, укажите верный Email для автоматического создания Личного кабинета');
      return;
    }
    if (!consentChecked) {
      setErrorMsg('Необходимо согласие на обработку персональных данных');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    let currentUserId = userId;
    let newAccInfo = createdAccountInfo;

    try {
      // 1. Если пользователь не авторизован, автоматически создаем аккаунт родителя
      if (!currentUserId && parentEmail) {
        const password = phone.replace(/\D/g, '') || '2026skokova';
        const signupRes = await fetch('/api/parent/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: parentEmail.trim(),
            password,
            fullName: parentName,
            phone,
            telegramHandle,
          }),
        });

        const signupData = await signupRes.json();
        if (signupData.success && signupData.user?.id) {
          currentUserId = signupData.user.id;
          setUserId(currentUserId);
          newAccInfo = { email: parentEmail.trim() };
          setCreatedAccountInfo(newAccInfo);

          // Автоматический вход в сессию
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          await supabase.auth.signInWithPassword({
            email: parentEmail.trim(),
            password,
          });
        }
      }

      // 2. Создание пред-заказа
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
      formData.append('status', 'pending_payment');
      if (currentUserId) {
        formData.append('user_id', currentUserId);
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Не удалось создать предварительную заявку');
      }

      setCurrentBookingId(data.booking_id);
      saveDraftToSession(3, data.booking_id, newAccInfo || undefined);
      setStep(3);
    } catch (err: any) {
      console.error('Pending booking creation error:', err);
      setErrorMsg(err.message || 'Ошибка создания заявки. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Отправка чека на Шаге 3
  const handleSubmitBooking = async () => {
    if (!receiptFile) {
      setErrorMsg('Пожалуйста, загрузите файл чека или скриншот перевода');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('booking_id', currentBookingId || '');
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
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при отправке заявки');
      }

      clearDraft();
      setStep(4);
    } catch (err: any) {
      console.error('Booking submit error:', err);
      setErrorMsg(err.message || 'Произошла ошибка при отправке заявки. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#1F1E1D]/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-[#FAF8F5] border-2 border-[#1F1E1D] rounded-3xl hard-shadow-lg overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Шапка модального окна */}
        <div className="flex items-center justify-between p-5 border-b-2 border-[#1F1E1D]/10 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#C85A32] text-white flex items-center justify-center font-bold text-sm hard-shadow">
              {step}
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">
                {step === 1 && 'Шаг 1: Выбор программы и времени'}
                {step === 2 && 'Шаг 2: Анкетные данные ребёнка'}
                {step === 3 && 'Шаг 3: Оплата по СБП и загрузка чека'}
                {step === 4 && 'Заявка принята!'}
              </h3>
              <p className="text-xs text-[#595652] font-mono">
                {step === 1 && 'Выберите подходящий день и свободный слот'}
                {step === 2 && 'Укажите информацию для подготовки к занятию'}
                {step === 3 && 'Переведите оплату и прикрепите подтверждение'}
                {step === 4 && 'Запись успешна, ожидайте подтверждения'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] bg-white text-[#1F1E1D] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Тело модального окна */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {errorMsg && (
            <div className="p-3.5 rounded-2xl border-2 border-red-500/30 bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
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
                <div className="grid grid-cols-1 gap-2.5">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s)}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
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
              {(() => {
                const activeDate = selectedDate || (availableDates.length > 0 ? availableDates[0].dateStr : '');
                const currentGroup = availableDates.find((d) => d.dateStr === activeDate) || availableDates[0];

                return (
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                      Свободное время ({activeDate}):
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {currentGroup?.slots?.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => {
                            if (!selectedDate && availableDates.length > 0) {
                              setSelectedDate(availableDates[0].dateStr);
                            }
                            setSelectedSlot(slot);
                          }}
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
                );
              })()}

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

              {userId ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-xs font-mono font-medium flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Вы авторизованы как {parentEmail || 'родитель'}. Личный кабинет подключён!</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] text-xs font-mono font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>При отправке формы ваш Личный кабинет семьи будет создан автоматически!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Имя родителя *
                  </label>
                  <input
                    type="text"
                    required
                    autoCapitalize="words"
                    placeholder="Например, Ольга"
                    value={parentName}
                    onChange={(e) => setParentName(capitalizeFirstLetter(e.target.value))}
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
                    onFocus={() => {
                      if (!phone) setPhone('+7 (');
                    }}
                    onChange={(e) => setPhone(formatRussianPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
              </div>

              {!userId && (
                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Электронная почта (Email для Личного кабинета) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="olga@mail.ru"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Выбор имени ребёнка из списка */}
                <div className="space-y-1">
                  <label className="text-xs font-mono font-semibold text-[#595652]">
                    Имя ребёнка *
                  </label>
                  {savedChildren.length > 0 && !isCustomChild ? (
                    <select
                      value={childName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomChild(true);
                          setChildName('');
                        } else {
                          const found = savedChildren.find((c) => c.name === val);
                          setChildName(capitalizeFirstLetter(val));
                          if (found) setChildGrade(found.grade);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-sm font-bold rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white text-[#1F1E1D]"
                    >
                      {savedChildren.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name} ({GRADE_LABELS[c.grade] || c.grade})
                        </option>
                      ))}
                      <option value="__custom__">✏️ Ввести имя другого ребёнка</option>
                    </select>
                  ) : (
                    <div>
                      <input
                        type="text"
                        required
                        autoCapitalize="words"
                        placeholder="Например, Артём"
                        value={childName}
                        onChange={(e) => setChildName(capitalizeFirstLetter(e.target.value))}
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                      />
                      {savedChildren.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomChild(false);
                            if (savedChildren.length > 0) {
                              setChildName(capitalizeFirstLetter(savedChildren[0].name));
                              setChildGrade(savedChildren[0].grade);
                            }
                          }}
                          className="text-[10px] font-mono text-[#C85A32] hover:underline mt-1 block cursor-pointer"
                        >
                          ↩ Выбрать из списка сохранённых детей
                        </button>
                      )}
                    </div>
                  )}
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
                  onFocus={() => {
                    if (!telegramHandle) setTelegramHandle('@');
                  }}
                  onChange={(e) => setTelegramHandle(formatTelegramHandle(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-[#595652]">
                  Комментарий (какие есть сложности или на что обратить внимание)
                </label>
                <textarea
                  rows={2}
                  autoCapitalize="sentences"
                  placeholder="Плохо читает по слогам, нужно подтянуть решения задач..."
                  value={comment}
                  onChange={(e) => setComment(capitalizeFirstLetter(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 accent-[#C85A32] rounded cursor-pointer"
                />
                <label htmlFor="consent" className="text-xs text-[#595652] cursor-pointer">
                  Согласен(на) на обработку персональных данных (ФЗ-152)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                  }}
                  className="px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] text-xs font-bold text-[#1F1E1D] transition-colors cursor-pointer"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#C85A32] hover:bg-[#b04b27] disabled:opacity-50 text-white text-sm font-semibold py-3 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Создание брони и кабинета...</span>
                    </>
                  ) : (
                    <span>Перейти к оплате реквизитов ➔</span>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* ШАГ 3: Оплата СБП и Загрузка чека */}
          {step === 3 && (
            <div className="space-y-6">
              
              <div className="p-4 bg-white border-2 border-[#1F1E1D] rounded-2xl hard-shadow space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-[#595652]">
                  <span>Сумма к оплате:</span>
                  <span className="font-serif font-bold text-lg text-[#C85A32]">
                    {selectedService.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/10 space-y-1.5">
                  <span className="text-[11px] font-mono font-bold uppercase text-[#595652] block">
                    Реквизиты для перевода (СБП):
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-sm text-[#1F1E1D]">+7 (926) 123-45-67</div>
                      <div className="text-[11px] text-[#595652]">Т-Банк / Сбербанк • Скокова Юлия Павловна</div>
                    </div>
                    <button
                      onClick={handleCopyCard}
                      className="px-3 py-1.5 rounded-lg border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#C85A32]" />
                          <span>Копировать</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Поле загрузки файла */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                  Прикрепите фото или PDF чека оплаты:
                </label>
                <div className="relative border-2 border-dashed border-[#1F1E1D]/30 hover:border-[#C85A32] rounded-2xl p-6 text-center bg-white transition-colors">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Upload className="w-8 h-8 text-[#C85A32]" />
                    {receiptFile ? (
                      <div>
                        <div className="font-bold text-xs text-[#1F1E1D]">{receiptFile.name}</div>
                        <div className="text-[10px] text-[#595652]">Размер: {(receiptFile.size / 1024 / 1024).toFixed(2)} МБ</div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold text-xs text-[#1F1E1D]">Нажмите или перетащите сюда чек</div>
                        <div className="text-[10px] text-[#595652]">Поддерживаются JPG, PNG, PDF до 10 МБ</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep(2);
                  }}
                  className="px-4 py-3.5 rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] text-xs font-bold text-[#1F1E1D] transition-colors cursor-pointer"
                >
                  Назад
                </button>
                <button
                  onClick={handleSubmitBooking}
                  disabled={isSubmitting || !receiptFile}
                  className="flex-1 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Отправка заявки и чека...</span>
                    </>
                  ) : (
                    <span>Я оплатил(а), отправить заявку</span>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* ШАГ 4: Успешное бронирование */}
          {step === 4 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center hard-shadow border-2 border-[#1F1E1D]">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h3 className="font-serif font-extrabold text-2xl text-[#1F1E1D]">
                Заявка успешно отправлена!
              </h3>

              {createdAccountInfo && (
                <div className="p-4 bg-[#C85A32]/10 border-2 border-[#C85A32] rounded-2xl text-left space-y-2 max-w-md mx-auto my-4 hard-shadow">
                  <div className="font-bold text-xs text-[#1F1E1D] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#C85A32]" />
                    <span>🎉 Ваш Личный кабинет семьи создается и подключен!</span>
                  </div>
                  <div className="text-xs text-[#595652] space-y-1 font-mono">
                    <div>Логин: <strong className="text-[#1F1E1D]">{createdAccountInfo.email}</strong></div>
                    <div>Пароль: <strong className="text-[#1F1E1D]">Ваш номер телефона</strong></div>
                  </div>
                  <div className="pt-1">
                    <Link
                      href="/my-dashboard"
                      onClick={onClose}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#C85A32] hover:bg-[#b04b27] text-white font-mono font-bold text-xs rounded-xl hard-shadow transition-colors"
                    >
                      <span>Перейти в Личный кабинет ➔</span>
                    </Link>
                  </div>
                </div>
              )}

              <p className="text-xs text-[#595652] max-w-md mx-auto leading-relaxed">
                Спасибо! Скокова Юлия Павловна уже получила ваш чек и подтверждение оплаты. В ближайшее время она свяжется с вами или вышлет ссылку в Telegram.
              </p>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-white hover:border-[#1F1E1D] text-[#1F1E1D] font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  Вернуться на сайт
                </button>
                <Link
                  href="/my-dashboard"
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-[#1F1E1D] text-white font-mono text-xs font-bold hard-shadow hover:bg-[#C85A32] transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span>Мой кабинет ➔</span>
                </Link>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
