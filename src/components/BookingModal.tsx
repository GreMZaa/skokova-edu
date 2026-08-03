'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, Upload, CheckCircle2, AlertCircle, Copy, Check, Loader2, Sparkles, UserCheck, ArrowRight } from 'lucide-react';
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
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 4>(1);

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

  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [userId, setUserId] = useState('');

  // Состояние баланса абонементов
  const [userRemainingLessons, setUserRemainingLessons] = useState<number>(0);
  const [usePackageLesson, setUsePackageLesson] = useState<boolean>(false);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

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

      const pkgRes = await fetch('/api/packages');
      const pkgData = await pkgRes.json();
      if (pkgData.total_remaining && pkgData.total_remaining > 0) {
        setUserRemainingLessons(pkgData.total_remaining);
        setUsePackageLesson(true);
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

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
  };

  if (!isOpen) return null;

  const handleGoToStep2 = () => {
    if (!selectedSlot) {
      setErrorMsg('Пожалуйста, выберите удобное время в календаре');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  // По клику на «Перейти к оплате»: создаёт кабинет (если не авторизован), создает бронь 'pending_payment' и открывает Шаг 4 с кнопкой «Перейти в Личный кабинет»
  const handleGoToPaymentAndCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentName.trim() || !phone.trim() || !childName.trim()) {
      setErrorMsg('Заполните обязательные поля: Имя родителя, Телефон и Имя ребёнка');
      return;
    }
    if (!userId && (!parentEmail || !parentEmail.includes('@'))) {
      setErrorMsg('Пожалуйста, укажите верный Email для создания Личного кабинета');
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
      // 1. Если пользователь не авторизован — автоматически создаём аккаунт
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

      // 2. Создание заказа (со статусом 'confirmed' если списываем из абонемента, иначе 'pending_payment')
      const isUsingPackage = usePackageLesson && userRemainingLessons > 0;
      const targetStatus = isUsingPackage ? 'confirmed' : 'pending_payment';

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
      formData.append('status', targetStatus);
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

      // Списываем 1 урок из абонемента
      if (isUsingPackage) {
        await fetch('/api/packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'use_lesson' }),
        });
      }

      setCurrentBookingId(data.booking_id);
      clearDraft();
      setStep(4);
    } catch (err: any) {
      console.error('Pending booking creation error:', err);
      setErrorMsg(err.message || 'Ошибка создания заявки. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigateToDashboard = () => {
    onClose();
    router.push('/my-dashboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-[#1F1E1D]/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full sm:max-w-2xl bg-[#FAF8F5] border-2 border-[#1F1E1D] sm:rounded-3xl rounded-t-3xl hard-shadow-lg overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
      >
        {/* Шапка модального окна */}
        <div className="border-b-2 border-[#1F1E1D]/10 bg-white shrink-0 sm:rounded-t-3xl rounded-t-3xl overflow-hidden">
          {/* Мобильная «ручка» для визуального affordance slide-down */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white">
            <div className="w-10 h-1.5 rounded-full bg-[#1F1E1D]/20" />
          </div>

          <div className="flex items-center justify-between px-4 pb-4 pt-1 sm:p-5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#C85A32] text-white flex items-center justify-center font-bold text-xs sm:text-sm hard-shadow shrink-0">
                {step === 4 ? '✓' : step}
              </div>
              <div className="min-w-0">
                <h3 className="font-serif font-bold text-base sm:text-lg text-[#1F1E1D] truncate">
                  {step === 1 && 'Программа и время'}
                  {step === 2 && 'Данные ребёнка'}
                  {step === 4 && 'Заявка забронирована!'}
                </h3>
                <p className="text-[10px] sm:text-xs text-[#595652] font-mono truncate">
                  {step === 1 && 'Выберите подходящий день и слот'}
                  {step === 2 && 'Информация для подготовки к занятию'}
                  {step === 4 && 'Перейдите в кабинет для оплаты'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] bg-white text-[#1F1E1D] transition-colors cursor-pointer active:scale-95 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Тело модального окна */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 overscroll-contain">
          
          {errorMsg && (
            <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 border-red-500/30 bg-red-50 text-red-700 text-[11px] sm:text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ШАГ 1: Выбор программы и времени */}
          {step === 1 && (
            <div className="space-y-5 sm:space-y-6">
              
              {/* Выбор программы */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-mono font-bold uppercase text-[#595652]">
                  Выберите программу:
                </label>
                <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
                  {SERVICES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedService(s)}
                      className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between active:scale-[0.98] ${
                        selectedService.id === s.id
                          ? 'border-[#C85A32] bg-[#C85A32]/5 hard-shadow'
                          : 'border-[#1F1E1D]/20 bg-[#FAF8F5] hover:border-[#1F1E1D]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-[#1F1E1D] truncate">{s.title}</div>
                        <div className="text-[10px] sm:text-xs text-[#595652]">{s.duration_minutes} минут</div>
                      </div>
                      <div className="font-serif font-bold text-sm sm:text-base text-[#C85A32] shrink-0 ml-2">
                        {s.price.toLocaleString('ru-RU')} ₽
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Выбор дня */}
              <div className="space-y-2">
                <label className="text-[10px] sm:text-xs font-mono font-bold uppercase text-[#595652]">
                  Выберите дату:
                </label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center p-4 text-[11px] sm:text-xs font-mono text-[#595652] gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C85A32]" />
                    <span>Загрузка расписания...</span>
                  </div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x scrollbar-hide">
                    {availableDates.map((item) => (
                      <button
                        key={item.dateStr}
                        onClick={() => {
                          setSelectedDate(item.dateStr);
                          setSelectedSlot(null);
                        }}
                        className={`px-3 sm:px-3.5 py-2 rounded-lg sm:rounded-xl border-2 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all cursor-pointer snap-center active:scale-95 ${
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
                    <label className="text-[10px] sm:text-xs font-mono font-bold uppercase text-[#595652]">
                      Свободное время ({activeDate}):
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {currentGroup?.slots?.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => {
                            if (!selectedDate && availableDates.length > 0) {
                              setSelectedDate(availableDates[0].dateStr);
                            }
                            setSelectedSlot(slot);
                          }}
                          className={`py-2.5 px-2 sm:px-3 rounded-lg sm:rounded-xl border-2 text-[11px] sm:text-xs font-bold text-center transition-all cursor-pointer active:scale-95 ${
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

              <div className="pt-2 sm:pt-4">
                <button
                  onClick={handleGoToStep2}
                  className="w-full bg-[#C85A32] hover:bg-[#b04b27] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Продолжить заполнение анкеты</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

            </div>
          )}

          {/* ШАГ 2: Анкета родителя и ребёнка */}
          {step === 2 && (
            <form onSubmit={handleGoToPaymentAndCabinet} className="space-y-4">
              
              <div className="p-2.5 sm:p-3 bg-[#FAF8F5] rounded-lg sm:rounded-xl border border-[#1F1E1D]/10 text-[10px] sm:text-xs flex items-center justify-between gap-2">
                <span className="font-medium text-[#1F1E1D] truncate">
                  {selectedService.title} • {selectedDate}, {selectedSlot?.time}
                </span>
                <span className="font-serif font-bold text-[#C85A32] shrink-0">{selectedService.price} ₽</span>
              </div>

              {userId ? (
                <div className="p-2.5 rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-[10px] sm:text-xs font-mono font-medium flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">Вы авторизованы как {parentEmail || 'родитель'}. Заявка появится в кабинете!</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg sm:rounded-xl bg-[#C85A32]/10 border border-[#C85A32]/30 text-[#C85A32] text-[10px] sm:text-xs font-mono font-medium flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="leading-snug">Личный кабинет создаётся автоматически!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
                    Имя родителя *
                  </label>
                  <input
                    type="text"
                    required
                    autoCapitalize="words"
                    placeholder="Например, Ольга"
                    value={parentName}
                    onChange={(e) => setParentName(capitalizeFirstLetter(e.target.value))}
                    className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
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
                    className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono bg-white"
                  />
                </div>
              </div>

              {!userId && (
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
                    Email для Личного кабинета *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="olga@mail.ru"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Выбор имени ребёнка */}
                <div className="space-y-1">
                  <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
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
                      className="w-full px-3 sm:px-3.5 py-2.5 text-sm font-bold rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white text-[#1F1E1D]"
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
                        className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white"
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
                  <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
                    Класс / Возраст *
                  </label>
                  <select
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value as GradeLevel)}
                    className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white"
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
                <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
                  Telegram (для ссылки на урок)
                </label>
                <input
                  type="text"
                  placeholder="@username"
                  value={telegramHandle}
                  onFocus={() => {
                    if (!telegramHandle) setTelegramHandle('@');
                  }}
                  onChange={(e) => setTelegramHandle(formatTelegramHandle(e.target.value))}
                  className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] sm:text-xs font-mono font-semibold text-[#595652]">
                  Комментарий (сложности или на что обратить внимание)
                </label>
                <textarea
                  rows={2}
                  autoCapitalize="sentences"
                  placeholder="Плохо читает по слогам, нужно подтянуть решения задач..."
                  value={comment}
                  onChange={(e) => setComment(capitalizeFirstLetter(e.target.value))}
                  className="w-full px-3 sm:px-3.5 py-2.5 text-sm rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none bg-white"
                />
              </div>

              {userRemainingLessons > 0 && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex items-center justify-between gap-3 hard-shadow-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <span className="text-xs font-mono font-bold text-emerald-950 block">Активный абонемент!</span>
                      <span className="text-[11px] text-emerald-800">Остаток: {userRemainingLessons} уроков</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer font-mono text-xs font-bold text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-400">
                    <input
                      type="checkbox"
                      checked={usePackageLesson}
                      onChange={(e) => setUsePackageLesson(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                    <span>Списать 1 урок</span>
                  </label>
                </div>
              )}

              <div className="flex items-start gap-2.5 pt-1 sm:pt-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 accent-[#C85A32] rounded cursor-pointer mt-0.5 shrink-0"
                />
                <label htmlFor="consent" className="text-[10px] sm:text-xs text-[#595652] cursor-pointer leading-snug">
                  Согласен(на) на обработку персональных данных (ФЗ-152)
                </label>
              </div>

              <div className="flex gap-2.5 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                  }}
                  className="px-3.5 sm:px-4 py-3 rounded-lg sm:rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] active:scale-95 text-[11px] sm:text-xs font-bold text-[#1F1E1D] transition-all cursor-pointer"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-[#C85A32] hover:bg-[#b04b27] active:scale-[0.98] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold py-3.5 px-4 rounded-lg sm:rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Создание...</span>
                    </>
                  ) : (
                    <>
                      <span>Перейти к оплате</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

            </form>
          )}

          {/* ШАГ 4: Успешное бронирование */}
          {step === 4 && (
            <div className="text-center py-4 sm:py-6 space-y-4 sm:space-y-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center hard-shadow border-2 border-[#1F1E1D]"
              >
                <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10" />
              </motion.div>

              <div>
                <h3 className="font-serif font-extrabold text-xl sm:text-2xl text-[#1F1E1D]">
                  Заявка успешно забронирована!
                </h3>
                <p className="text-[10px] sm:text-xs font-mono text-[#595652] mt-1">
                  Урок: {selectedService.title} • {selectedDate}, {selectedSlot?.time}
                </p>
              </div>

              {createdAccountInfo && (
                <div className="p-3.5 sm:p-4 bg-[#C85A32]/10 border-2 border-[#C85A32] rounded-xl sm:rounded-2xl text-left space-y-1.5 sm:space-y-2 max-w-md mx-auto hard-shadow">
                  <div className="font-bold text-[11px] sm:text-xs text-[#1F1E1D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C85A32]" />
                    <span>🎉 Личный кабинет создан!</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-[#595652] space-y-0.5 sm:space-y-1 font-mono">
                    <div>Логин: <strong className="text-[#1F1E1D]">{createdAccountInfo.email}</strong></div>
                    <div>Пароль: <strong className="text-[#1F1E1D]">Ваш номер телефона</strong></div>
                  </div>
                </div>
              )}

              <p className="text-[11px] sm:text-xs text-[#595652] max-w-md mx-auto leading-relaxed px-2 sm:px-0">
                Ваша заявка со статусом <strong>«⏳ Ожидает оплаты»</strong> уже в Личном кабинете. Для оплаты по СБП нажмите кнопку ниже:
              </p>

              <div className="pt-1 sm:pt-2">
                <button
                  onClick={handleNavigateToDashboard}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-[#C85A32] hover:bg-[#b04b27] active:scale-[0.97] text-white font-mono font-extrabold text-xs sm:text-sm hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                >
                  <span>Перейти в Личный кабинет</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};
