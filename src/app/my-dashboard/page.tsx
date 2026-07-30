'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  Video,
  FileText,
  User,
  Plus,
  LogOut,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Check,
  CreditCard,
  Upload,
  Copy,
  Smartphone,
  Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GRADE_LABELS, GradeLevel } from '@/types/database';
import { BookingModal } from '@/components/BookingModal';
import { capitalizeFirstLetter, formatRussianPhone, formatTelegramHandle } from '@/lib/formatters';

interface BookingItem {
  id: string;
  service_title: string;
  price: number;
  selected_date?: string;
  parent_name: string;
  phone: string;
  telegram_handle: string;
  child_name: string;
  child_grade: GradeLevel;
  comment?: string;
  receipt_file_url?: string;
  status: 'pending_payment' | 'receipt_uploaded' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
  admin_notes?: string;
  created_at: string;
}

interface ChildItem {
  id: string;
  name: string;
  grade: GradeLevel;
}

interface ParentProfile {
  full_name: string;
  phone: string;
  telegram_handle: string;
}

export interface PaymentMethodItem {
  id: string;
  type: 'sbp' | 'card';
  title: string;
  phone?: string;
  card_number?: string;
  bank_name: string;
  recipient: string;
  is_active: boolean;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile'>('bookings');

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [profile, setProfile] = useState<ParentProfile>({ full_name: '', phone: '', telegram_handle: '' });
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);

  // Карточки реквизитов оплаты из базы данных
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([
    {
      id: 'sbp_default',
      type: 'sbp',
      title: 'Перевод через СБП (по телефону)',
      phone: '+7 (926) 123-45-67',
      bank_name: 'Т-Банк / Сбербанк',
      recipient: 'Скокова Юлия Павловна',
      is_active: true,
    },
  ]);

  // Состояние обновления профиля
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [editingTg, setEditingTg] = useState('');
  
  // Добавление ребёнка
  const [newChildName, setNewChildName] = useState('');
  const [newChildGrade, setNewChildGrade] = useState<GradeLevel>('preschool_6');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Редактирование карточки ребёнка
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [editChildName, setEditChildName] = useState('');
  const [editChildGrade, setEditChildGrade] = useState<GradeLevel>('preschool_6');
  const [savingChild, setSavingChild] = useState(false);

  // Форма смены пароля
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordErr, setPasswordErr] = useState('');

  // Оплата из кабинета
  const [payModalBooking, setPayModalBooking] = useState<BookingItem | null>(null);
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccessMsg, setPaySuccessMsg] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Модальное окно записи
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }
      setUserEmail(user.email || '');

      // Загружаем актуальные способы оплаты из API
      const reqRes = await fetch('/api/settings');
      const reqData = await reqRes.json();
      if (reqData.success && reqData.payment_methods) {
        setPaymentMethods(reqData.payment_methods);
      }

      const profRes = await fetch('/api/parent/profile');
      const profData = await profRes.json();
      if (profData.success) {
        setProfile(profData.profile);
        setEditingName(capitalizeFirstLetter(profData.profile.full_name || ''));
        setEditingPhone(formatRussianPhone(profData.profile.phone || ''));
        setEditingTg(formatTelegramHandle(profData.profile.telegram_handle || ''));
        setChildren(profData.children || []);
      }

      const bookRes = await fetch('/api/parent/bookings');
      const bookData = await bookRes.json();
      if (bookData.success) {
        setBookings(bookData.bookings || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');

    try {
      const res = await fetch('/api/parent/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editingName,
          phone: editingPhone,
          telegram_handle: editingTg,
          new_child_name: newChildName,
          new_child_grade: newChildGrade,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setProfileMsg('Профиль и данные семьи обновлены!');
        setNewChildName('');
        await loadDashboardData();
        setTimeout(() => setProfileMsg(''), 3000);
      }
    } catch (e) {
      console.error('Save profile error:', e);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStartEditChild = (child: ChildItem) => {
    setEditingChildId(child.id);
    setEditChildName(child.name);
    setEditChildGrade(child.grade);
  };

  const handleSaveEditChild = async (childId: string) => {
    setSavingChild(true);
    try {
      const res = await fetch('/api/parent/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId,
          name: editChildName,
          grade: editChildGrade,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingChildId(null);
        await loadDashboardData();
      }
    } catch (e) {
      console.error('Edit child error:', e);
    } finally {
      setSavingChild(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!confirm('Вы уверены, что хотите удалить профиль ребёнка из семьи?')) return;
    try {
      const res = await fetch(`/api/parent/profile?child_id=${childId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await loadDashboardData();
      }
    } catch (e) {
      console.error('Delete child error:', e);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordErr('');

    if (!newPassword || newPassword.length < 6) {
      setPasswordErr('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErr('Введённые пароли не совпадают!');
      return;
    }

    setChangingPassword(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordMsg('🎉 Пароль успешно изменён! Используйте его при следующих входах.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err: any) {
      console.error('Password change error:', err);
      setPasswordErr(err.message || 'Ошибка смены пароля');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleCopyText = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalBooking || !payReceiptFile) {
      setPayError('Пожалуйста, прикрепите файл чека или скриншот оплаты');
      return;
    }

    setSubmittingPayment(true);
    setPayError('');

    try {
      const formData = new FormData();
      formData.append('booking_id', payModalBooking.id);
      formData.append('receipt_file', payReceiptFile);

      formData.append('service_title', payModalBooking.service_title);
      formData.append('price', payModalBooking.price.toString());
      formData.append('parent_name', payModalBooking.parent_name);
      formData.append('phone', payModalBooking.phone);
      formData.append('telegram_handle', payModalBooking.telegram_handle || '');
      formData.append('child_name', payModalBooking.child_name);
      formData.append('child_grade', payModalBooking.child_grade);

      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка отправки чека');
      }

      setPaySuccessMsg(true);
      await loadDashboardData();
    } catch (err: any) {
      console.error('Pay submit error:', err);
      setPayError(err.message || 'Ошибка отправки чека. Попробуйте еще раз.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: BookingItem['status']) => {
    switch (status) {
      case 'pending_payment':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-900 text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span>⏳ Ожидает оплаты (Урок забронирован)</span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 text-xs font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Запись подтверждена</span>
          </div>
        );
      case 'rescheduled':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-800 text-xs font-mono font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Урок перенесён</span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-800 text-xs font-mono font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Заявка отклонена</span>
          </div>
        );
      case 'completed':
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-800 text-xs font-mono font-bold">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Занятие завершено</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 text-xs font-mono font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>🧾 Чек загружен — На проверке преподавателем</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4 text-[#1F1E1D]">
        <div className="flex items-center gap-3 font-mono text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#C85A32]" />
          <span>Загрузка кабинета родителя...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] flex flex-col justify-between selection:bg-[#C85A32] selection:text-white">
      {/* Шапка */}
      <header className="border-b-2 border-[#1F1E1D]/10 bg-[#FAF8F5]/80 backdrop-blur-md sticky top-0 z-50 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#C85A32] flex items-center justify-center text-white font-mono font-bold text-sm hard-shadow">
              СЮ
            </div>
            <div>
              <span className="font-serif font-bold text-base tracking-tight text-[#1F1E1D] block leading-none">
                Уроки Скоковой Юлии
              </span>
              <span className="text-[10px] font-mono text-[#595652]">Кабинет семьи</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-[#1F1E1D]">
                {profile.full_name || 'Уважаемый родитель'}
              </span>
              <span className="text-[10px] font-mono text-[#595652]">{userEmail}</span>
            </div>

            <button
              onClick={() => loadDashboardData()}
              title="Обновить данные"
              className="p-2 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-[#595652] hover:text-[#1F1E1D] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleSignOut}
              className="px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-white hover:bg-red-50 hover:border-red-500/50 hover:text-red-700 text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выход</span>
            </button>
          </div>
        </div>
      </header>

      {/* Основная секция */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {/* Приветственный баннер */}
        <div className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 sm:p-8 hard-shadow-lg mb-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#C85A32]/30 bg-[#C85A32]/10 text-[#C85A32] text-xs font-mono font-bold mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Личный кабинет авторизован</span>
            </div>
            <h1 className="font-serif font-extrabold text-2xl sm:text-4xl text-[#1F1E1D] tracking-tight">
              Добро пожаловать, {profile.full_name || 'Родитель'}!
            </h1>
            <p className="text-xs sm:text-sm text-[#595652] mt-1 max-w-xl">
              Здесь хранятся все ваши записи к Скоковой Юлии Павловне, ссылки на видеосвязь с педагогом и карточки ваших детей.
            </p>
          </div>

          <button
            onClick={() => setIsBookingOpen(true)}
            className="px-6 py-3.5 rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold text-sm tracking-wide hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Записаться на новый урок</span>
          </button>
        </div>

        {/* Навигация по вкладкам */}
        <div className="flex border-b-2 border-[#1F1E1D]/10 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-3 px-4 font-mono text-xs font-bold uppercase transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'bookings'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#595652] hover:text-[#1F1E1D]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Мои записи ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-3 px-4 font-mono text-xs font-bold uppercase transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-[#C85A32] text-[#C85A32]'
                : 'border-transparent text-[#595652] hover:text-[#1F1E1D]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Данные семьи & Дети ({children.length})</span>
          </button>
        </div>

        {/* ВКЛАДКА 1: МОИ УРОКИ */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="bg-white border-2 border-[#1F1E1D]/20 rounded-3xl p-12 text-center">
                <BookOpen className="w-12 h-12 text-[#595652]/40 mx-auto mb-4" />
                <h3 className="font-serif font-bold text-xl text-[#1F1E1D] mb-1">
                  У вас пока нет активных записей
                </h3>
                <p className="text-xs text-[#595652] mb-6">
                  Выберите удобное время в календаре Скоковой Юлии Павловны для первого онлайн-занятия
                </p>
                <button
                  onClick={() => setIsBookingOpen(true)}
                  className="px-5 py-3 rounded-xl bg-[#1F1E1D] text-white font-mono text-xs font-bold hard-shadow hover:bg-[#C85A32] transition-colors cursor-pointer"
                >
                  Выбрать программу и время ➔
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {bookings.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-5 sm:p-6 hard-shadow transition-all hover:border-[#C85A32]"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1F1E1D]/10 pb-4 mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {getStatusBadge(item.status)}
                          <span className="text-xs font-mono font-bold text-[#1F1E1D] bg-[#FAF8F5] px-2.5 py-1 rounded-lg border border-[#1F1E1D]/20">
                            ID: #{item.id.substring(0, 13)}
                          </span>
                        </div>
                        <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#1F1E1D]">
                          {item.service_title}
                        </h3>
                        <div className="text-xs font-mono text-[#595652] flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                          {item.selected_date && (
                            <span className="text-[#C85A32] font-bold bg-[#C85A32]/10 px-2 py-0.5 rounded-md border border-[#C85A32]/20">
                              📅 {item.selected_date}
                            </span>
                          )}
                          <span>
                            Ребёнок: <strong className="text-[#1F1E1D]">{item.child_name && item.child_name !== 'Нет никого' ? item.child_name : 'Не указан'}</strong> ({GRADE_LABELS[item.child_grade] || item.child_grade})
                          </span>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="font-serif font-bold text-2xl text-[#C85A32]">
                          {item.price.toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-[11px] font-mono text-[#595652]">
                          Заявка от {new Date(item.created_at).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    </div>

                    {/* Дополнительная информация */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="font-mono uppercase font-bold text-[#595652] block text-[10px]">
                          Контакты родителя:
                        </span>
                        <div className="font-medium text-[#1F1E1D]">{item.parent_name} • {item.phone}</div>
                        {item.telegram_handle && (
                          <div className="text-[#595652]">TG: {item.telegram_handle}</div>
                        )}
                      </div>

                      {item.admin_notes && (
                        <div className="space-y-1 bg-[#FAF8F5] p-3 rounded-2xl border border-[#1F1E1D]/10">
                          <span className="font-mono uppercase font-bold text-[#C85A32] block text-[10px]">
                            Заметка педагога:
                          </span>
                          <div className="font-medium text-[#1F1E1D]">{item.admin_notes}</div>
                        </div>
                      )}
                    </div>

                    {/* Интерактивные действия */}
                    <div className="mt-5 pt-4 border-t border-[#1F1E1D]/10 flex flex-wrap items-center justify-between gap-3">
                      {item.status === 'pending_payment' ? (
                        <button
                          onClick={() => {
                            setPayModalBooking(item);
                            setPayReceiptFile(null);
                            setPayError('');
                            setPaySuccessMsg(false);
                          }}
                          className="px-5 py-3 rounded-xl bg-[#C85A32] hover:bg-[#b04b27] text-white font-bold text-xs flex items-center gap-2 hard-shadow transition-all cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>💳 Оплатить урок по СБП / Карте и прикрепить чек ➔</span>
                        </button>
                      ) : item.status === 'confirmed' ? (
                        <a
                          href="https://telemost.yandex.ru"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 hard-shadow transition-all cursor-pointer"
                        >
                          <Video className="w-4 h-4" />
                          <span>🎥 Подключиться к уроку (Яндекс Телемост / Zoom)</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </a>
                      ) : item.status === 'receipt_uploaded' ? (
                        <div className="text-xs text-[#595652] font-mono flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Чек прикреплен и отправлен педагогу. Ожидается подтверждение.</span>
                        </div>
                      ) : (
                        <div />
                      )}

                      {item.receipt_file_url && (
                        <a
                          href={item.receipt_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-mono font-bold text-emerald-900 flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-700" />
                          <span>👁 Открыть загруженный чек</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА 2: ДАННЫЕ СЕМЬИ И ДЕТИ */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Форма профиля родителя */}
            <div className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 hard-shadow">
              <h3 className="font-serif font-bold text-xl text-[#1F1E1D] mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#C85A32]" />
                <span>Контакты родителя</span>
              </h3>

              {profileMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-500/30 text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{profileMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                    ФИО родителя:
                  </label>
                  <input
                    type="text"
                    autoCapitalize="words"
                    placeholder="Например, Сергей"
                    value={editingName}
                    onChange={(e) => setEditingName(capitalizeFirstLetter(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-medium text-[#1F1E1D] focus:border-[#1F1E1D] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                    Телефон для связи:
                  </label>
                  <input
                    type="tel"
                    placeholder="+7 (999) 000-00-00"
                    value={editingPhone}
                    onFocus={() => {
                      if (!editingPhone) setEditingPhone('+7 (');
                    }}
                    onChange={(e) => setEditingPhone(formatRussianPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-medium text-[#1F1E1D] focus:border-[#1F1E1D] outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                    Telegram юзернейм:
                  </label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={editingTg}
                    onFocus={() => {
                      if (!editingTg) setEditingTg('@');
                    }}
                    onChange={(e) => setEditingTg(formatTelegramHandle(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-medium text-[#1F1E1D] focus:border-[#1F1E1D] outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full py-3 px-4 rounded-xl bg-[#1F1E1D] hover:bg-[#C85A32] text-white font-mono text-xs font-bold hard-shadow transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Сохранить профиль</span>}
                </button>
              </form>

              {/* Смена пароля */}
              <div className="mt-8 pt-6 border-t-2 border-[#1F1E1D]/10 space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#C85A32]" />
                  <h4 className="font-serif font-bold text-base text-[#1F1E1D]">Смена пароля аккаунта</h4>
                </div>

                {passwordMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{passwordMsg}</span>
                  </div>
                )}

                {passwordErr && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{passwordErr}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-bold uppercase text-[#595652]">Новый пароль *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold uppercase text-[#595652]">Повторите новый пароль *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={changingPassword || !newPassword}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#C85A32] hover:bg-[#b04b27] text-white font-bold hard-shadow border-2 border-[#1F1E1D] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {changingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Обновление...</span>
                      </>
                    ) : (
                      <span>Изменить пароль</span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Карточки детей */}
            <div className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 hard-shadow">
              <h3 className="font-serif font-bold text-xl text-[#1F1E1D] mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#C85A32]" />
                <span>Профили детей ({children.length})</span>
              </h3>

              <div className="space-y-3 mb-6">
                {children.length === 0 ? (
                  <p className="text-xs font-mono text-[#595652]">
                    У вас пока не добавлено ни одного ребенка. Добавьте ребенка ниже, чтобы записывать его в 1 клик!
                  </p>
                ) : (
                  children.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] transition-all hover:border-[#1F1E1D]"
                    >
                      {editingChildId === c.id ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono font-bold uppercase text-[#595652]">
                              Имя ребёнка:
                            </label>
                            <input
                              type="text"
                              autoCapitalize="words"
                              value={editChildName}
                              onChange={(e) => setEditChildName(capitalizeFirstLetter(e.target.value))}
                              className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D] bg-white text-xs font-bold text-[#1F1E1D] outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-mono font-bold uppercase text-[#595652]">
                              Класс / Возраст:
                            </label>
                            <select
                              value={editChildGrade}
                              onChange={(e) => setEditChildGrade(e.target.value as GradeLevel)}
                              className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D] bg-white text-xs font-bold text-[#1F1E1D] outline-none"
                            >
                              <option value="preschool_5">Подготовка к школе (5 лет)</option>
                              <option value="preschool_6">Подготовка к школе (6 лет / Перед 1 классом)</option>
                              <option value="grade_1">1 класс</option>
                              <option value="grade_2">2 класс</option>
                              <option value="grade_3">3 класс</option>
                              <option value="grade_4">4 класс</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleSaveEditChild(c.id)}
                              disabled={savingChild}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Сохранить</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChildId(null)}
                              className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-[#1F1E1D] font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Отмена</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-sm text-[#1F1E1D]">{c.name}</div>
                            <div className="text-xs font-mono text-[#595652]">
                              {GRADE_LABELS[c.grade] || c.grade}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditChild(c)}
                              title="Редактировать карточку ребёнка"
                              className="p-2 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] hover:border-[#1F1E1D] text-[#595652] hover:text-[#C85A32] transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteChild(c.id)}
                              title="Удалить карточку ребёнка"
                              className="p-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Добавление нового ребёнка */}
              <div className="border-t border-[#1F1E1D]/10 pt-4 space-y-3">
                <span className="font-mono text-xs font-bold uppercase text-[#595652] block">
                  ➕ Добавить нового ребёнка в семью:
                </span>
                <input
                  type="text"
                  autoCapitalize="words"
                  placeholder="Имя ребёнка (напр., Артём)"
                  value={newChildName}
                  onChange={(e) => setNewChildName(capitalizeFirstLetter(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-medium text-[#1F1E1D] focus:border-[#1F1E1D] outline-none"
                />

                <select
                  value={newChildGrade}
                  onChange={(e) => setNewChildGrade(e.target.value as GradeLevel)}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-medium text-[#1F1E1D] focus:border-[#1F1E1D] outline-none"
                >
                  <option value="preschool_5">Подготовка к школе (5 лет)</option>
                  <option value="preschool_6">Подготовка к школе (6 лет / Перед 1 классом)</option>
                  <option value="grade_1">1 класс</option>
                  <option value="grade_2">2 класс</option>
                  <option value="grade_3">3 класс</option>
                  <option value="grade_4">4 класс</option>
                </select>

                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={!newChildName.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-mono text-xs font-bold hard-shadow transition-colors cursor-pointer disabled:opacity-40"
                >
                  Добавить ребёнка в семью
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Модальное окно оплаты уроков СБП / Картами из кабинета */}
      {payModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1E1D]/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#FAF8F5] border-2 border-[#1F1E1D] rounded-3xl hard-shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-4">
              <div>
                <h3 className="font-serif font-extrabold text-xl text-[#1F1E1D]">
                  Оплата урока по СБП / Карте
                </h3>
                <p className="text-xs text-[#595652] font-mono">
                  {payModalBooking.service_title} • Заказ #{payModalBooking.id.substring(0, 13)}
                </p>
              </div>
              <button
                onClick={() => {
                  setPayModalBooking(null);
                  setPaySuccessMsg(false);
                }}
                className="p-2 rounded-xl border border-[#1F1E1D]/20 hover:border-[#1F1E1D] bg-white text-[#1F1E1D]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paySuccessMsg ? (
              /* Экран успешной загрузки чека */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full mx-auto flex items-center justify-center border-2 border-[#1F1E1D] hard-shadow">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="font-serif font-extrabold text-2xl text-[#1F1E1D]">
                  🎉 Чек успешно отправлен!
                </h3>
                <p className="text-xs text-[#595652] max-w-sm mx-auto leading-relaxed">
                  Файл вашего чека получен и передан Скоковой Юлии Павловне. Статус вашей заявки изменён на <strong>«Чек загружен — На проверке»</strong>.
                </p>
                <button
                  onClick={() => {
                    setPayModalBooking(null);
                    setPaySuccessMsg(false);
                  }}
                  className="px-6 py-3 rounded-xl bg-[#1F1E1D] hover:bg-[#C85A32] text-white font-mono text-xs font-bold hard-shadow cursor-pointer transition-colors"
                >
                  Отлично, вернуться к записям ➔
                </button>
              </div>
            ) : (
              /* Экран ввода и загрузки */
              <>
                {payError && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 text-red-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{payError}</span>
                  </div>
                )}

                <div className="p-4 bg-white border-2 border-[#1F1E1D] rounded-2xl hard-shadow space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#595652]">
                    <span>Сумма к оплате:</span>
                    <span className="font-serif font-bold text-xl text-[#C85A32]">
                      {payModalBooking.price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  {/* Реквизиты оплаты (Карточки СБП и Карт) */}
                  <div className="space-y-2.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#595652] block">
                      Выберите удобный способ перевода:
                    </span>

                    {paymentMethods.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/15 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="text-[10px] font-mono font-bold text-[#C85A32] flex items-center gap-1">
                            {m.type === 'sbp' ? <Smartphone className="w-3 h-3 text-purple-600" /> : <CreditCard className="w-3 h-3 text-blue-600" />}
                            <span>{m.title}</span>
                          </div>
                          <div className="font-mono font-extrabold text-sm text-[#1F1E1D]">
                            {m.type === 'sbp' ? m.phone : m.card_number}
                          </div>
                          <div className="text-[11px] text-[#595652]">
                            {m.bank_name} • {m.recipient}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyText(m.type === 'sbp' ? (m.phone || '') : (m.card_number || ''), m.id)}
                          className="px-3 py-1.5 rounded-lg border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-xs font-mono font-medium flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
                        >
                          {copiedField === m.id ? (
                            <span className="text-emerald-600 font-bold">Скопировано!</span>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#C85A32]" />
                              <span>Копировать</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handlePaySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                      Прикрепите фото или PDF чека оплаты:
                    </label>

                    {payReceiptFile ? (
                      /* Загруженный файл выбран — зеленая плашка подтверждения */
                      <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-900 flex items-center justify-between font-mono text-xs hard-shadow">
                        <div className="flex items-center gap-3 font-bold truncate">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                          <div className="truncate">
                            <div className="truncate text-emerald-950 font-extrabold">{payReceiptFile.name}</div>
                            <div className="text-[10px] text-emerald-700 font-normal">Файл прикреплён и готов к отправке</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-emerald-200/80 px-2 py-0.5 rounded font-bold shrink-0">
                            {(payReceiptFile.size / 1024 / 1024).toFixed(2)} МБ
                          </span>
                          <button
                            type="button"
                            onClick={() => setPayReceiptFile(null)}
                            title="Удалить и выбрать другой файл"
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Окно перетаскивания файла */
                      <div className="relative border-2 border-dashed border-[#1F1E1D]/30 hover:border-[#C85A32] rounded-2xl p-6 text-center bg-white transition-colors">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setPayReceiptFile(e.target.files[0]);
                              setPayError('');
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Upload className="w-8 h-8 text-[#C85A32]" />
                          <div>
                            <div className="font-bold text-xs text-[#1F1E1D]">Нажмите или перетащите сюда чек</div>
                            <div className="text-[10px] text-[#595652]">Поддерживаются JPG, PNG, PDF до 10 МБ</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayModalBooking(null)}
                      className="px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] text-xs font-bold text-[#1F1E1D]"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={submittingPayment || !payReceiptFile}
                      className="flex-1 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white text-sm font-semibold py-3 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Отправка чека...</span>
                        </>
                      ) : (
                        <span>Я оплатил(а), отправить чек</span>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* Подвал */}
      <footer className="border-t border-[#1F1E1D]/10 py-6 text-center text-xs font-mono text-[#595652]">
        © 2026 Уроки Скоковой Юлии Павловны. Личный кабинет родителя.
      </footer>

      {/* Модальное окно записи */}
      <BookingModal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} />
    </div>
  );
}
