'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Edit,
  ExternalLink,
  Lock,
  KeyRound,
  LogOut,
  AlertCircle,
  ShieldCheck,
  History,
  Loader2,
  Trash2,
  RefreshCw,
  Inbox,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  BookOpen,
  DollarSign,
  Check,
  CreditCard,
  Building,
} from 'lucide-react';
import { GRADE_LABELS, STATUS_LABELS, GradeLevel, BookingStatus } from '@/types/database';
import { capitalizeFirstLetter, formatRussianPhone, formatTelegramHandle } from '@/lib/formatters';

interface AdminBooking {
  id: string;
  parent_name: string;
  phone: string;
  telegram_handle?: string;
  child_name: string;
  child_grade: GradeLevel;
  service_title: string;
  price: number;
  dateStr?: string;
  timeSlot?: string;
  receipt_file_url?: string;
  status: BookingStatus;
  comment?: string;
  admin_notes?: string;
  created_at: string;
}

interface LoginLog {
  id: string;
  ip_address: string;
  user_agent: string;
  status: string;
  created_at: string;
}

const AVAILABLE_TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inputPin, setInputPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingBooking, setEditingBooking] = useState<AdminBooking | null>(null);
  const [auditLogs, setAuditLogs] = useState<LoginLog[]>([]);
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);

  // Модальное окно реквизитов оплаты
  const [showRequisitesModal, setShowRequisitesModal] = useState<boolean>(false);
  const [reqPhone, setReqPhone] = useState<string>('+7 (926) 123-45-67');
  const [reqCardNumber, setReqCardNumber] = useState<string>('');
  const [reqBankName, setReqBankName] = useState<string>('Т-Банк / Сбербанк');
  const [reqRecipient, setReqRecipient] = useState<string>('Скокова Юлия Павловна');
  const [savingRequisites, setSavingRequisites] = useState<boolean>(false);
  const [requisitesMsg, setRequisitesMsg] = useState<string>('');

  // Редактируемые поля модального окна
  const [editStatus, setEditStatus] = useState<BookingStatus>('pending_payment');
  const [editServiceTitle, setEditServiceTitle] = useState<string>('Онлайн-занятие (Индивидуально)');
  const [editPrice, setEditPrice] = useState<number>(600);
  const [editDateISO, setEditDateISO] = useState<string>('');
  const [editDateStr, setEditDateStr] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('14:00');
  const [editParent, setEditParent] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editTelegram, setEditTelegram] = useState<string>('');
  const [editChild, setEditChild] = useState<string>('');
  const [editChildGrade, setEditChildGrade] = useState<GradeLevel>('preschool_6');
  const [editComment, setEditComment] = useState<string>('');
  const [editAdminNotes, setEditAdminNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  useEffect(() => {
    const authStatus = sessionStorage.getItem('skokova_admin_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      fetchRealBookings();
      fetchAuditLogs();
      fetchRequisites();
    }
  }, []);

  const fetchRequisites = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.requisites) {
        setReqPhone(data.requisites.phone || '');
        setReqCardNumber(data.requisites.card_number || '');
        setReqBankName(data.requisites.bank_name || '');
        setReqRecipient(data.requisites.recipient || '');
      }
    } catch (e) {
      console.error('Failed to fetch requisites:', e);
    }
  };

  const handleSaveRequisites = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRequisites(true);
    setRequisitesMsg('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: reqPhone,
          card_number: reqCardNumber,
          bank_name: reqBankName,
          recipient: reqRecipient,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRequisitesMsg('Реквизиты СБП успешно сохранены в Supabase DB!');
        setTimeout(() => setRequisitesMsg(''), 4000);
      }
    } catch (e) {
      console.error('Save requisites error:', e);
    } finally {
      setSavingRequisites(false);
    }
  };

  const fetchRealBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch('/api/admin/bookings');
      const data = await res.json();
      if (data.success && data.bookings) {
        setBookings(data.bookings);
      }
    } catch (e) {
      console.error('Failed to fetch bookings:', e);
    } finally {
      setLoadingBookings(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/login');
      const data = await res.json();
      if (data.success && data.logs) {
        setAuditLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: inputPin }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Неверный пароль доступа');
      }

      setIsAuthenticated(true);
      sessionStorage.setItem('skokova_admin_auth', 'true');
      fetchRealBookings();
      fetchAuditLogs();
      fetchRequisites();
    } catch (err: any) {
      setLoginError(err.message || 'Ошибка авторизации');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('skokova_admin_auth');
    setInputPin('');
  };

  // Изменение статуса заявки в Supabase
  const handleUpdateStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
        );
      }
    } catch (e) {
      console.error('Status update error:', e);
    }
  };

  // Удаление заявки из Supabase
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту заявку из базы данных?')) return;

    try {
      const res = await fetch(`/api/admin/bookings?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Открытие модального окна полного редактирования
  const handleOpenEdit = (b: AdminBooking) => {
    setEditingBooking(b);
    setEditStatus(b.status);
    setEditServiceTitle(b.service_title || 'Онлайн-занятие (Индивидуально)');
    setEditPrice(b.price || (b.service_title?.includes('Оффлайн') ? 800 : 600));

    let cleanDateStr = b.dateStr || '';
    let extractedTime = b.timeSlot || '14:00';

    if (cleanDateStr.includes(',')) {
      const parts = cleanDateStr.split(',');
      if (parts.length >= 2 && /\d{1,2}:\d{2}/.test(parts[parts.length - 1])) {
        extractedTime = parts[parts.length - 1].trim();
        cleanDateStr = parts.slice(0, parts.length - 1).join(',').trim();
      }
    }

    setEditDateStr(cleanDateStr);
    setEditTime(extractedTime);
    setEditParent(capitalizeFirstLetter(b.parent_name || ''));
    setEditPhone(formatRussianPhone(b.phone || ''));
    setEditTelegram(formatTelegramHandle(b.telegram_handle || ''));
    setEditChild(capitalizeFirstLetter(b.child_name || ''));
    setEditChildGrade(b.child_grade || 'preschool_6');
    setEditComment(b.comment || '');
    setEditAdminNotes(b.admin_notes || '');

    const todayStr = new Date().toISOString().split('T')[0];
    setEditDateISO(todayStr);
  };

  // Выбор даты из календаря
  const handleDateChange = (isoDate: string) => {
    setEditDateISO(isoDate);
    if (!isoDate) return;
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const formatted = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
      setEditDateStr(formatted);
    }
  };

  // Сохранение отредактированных данных заявки в Supabase DB
  const handleSaveEdit = async () => {
    if (!editingBooking) return;
    setSavingEdit(true);

    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBooking.id,
          status: editStatus,
          service_title: editServiceTitle,
          price: editPrice,
          parent_name: editParent,
          phone: editPhone,
          telegram_handle: editTelegram,
          child_name: editChild,
          child_grade: editChildGrade,
          comment: editComment,
          admin_notes: editAdminNotes,
          dateISO: editDateISO,
          dateStr: editDateStr,
          timeSlot: editTime,
        }),
      });

      if (res.ok) {
        await fetchRealBookings();
        setEditingBooking(null);
      }
    } catch (e) {
      console.error('Save edit error:', e);
    } finally {
      setSavingEdit(false);
    }
  };

  // ЭКРАН ВХОДА С АВТОРИЗАЦИЕЙ ЧЕРЕЗ SUPABASE
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] flex items-center justify-center p-4">
        <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-8 hard-shadow-lg w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-[#C85A32] rounded-full flex items-center justify-center text-white mx-auto hard-shadow font-mono font-bold text-lg">
              СЮ
            </div>
            <h1 className="font-serif font-bold text-2xl text-[#1F1E1D]">
              Панель преподавателя
            </h1>
            <p className="text-xs text-[#595652] font-mono">
              Вход для Скоковой Юлии Павловны
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                ПИН-код доступа:
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D] bg-[#FAF8F5] font-mono text-center text-lg font-bold tracking-widest focus:outline-none focus:border-[#C85A32] transition-colors"
                  autoFocus
                  required
                />
                <KeyRound className="w-5 h-5 text-gray-400 absolute right-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-[#C85A32] hover:bg-[#b04b27] text-white font-mono text-xs font-bold uppercase rounded-xl border-2 border-[#1F1E1D] hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Проверка пароля...</span>
                </>
              ) : (
                <span>Войти в систему ➔</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <a
              href="/"
              className="text-xs font-mono text-[#595652] hover:text-[#1F1E1D] underline"
            >
              ← Вернуться на главный сайт
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Фильтрация заявок
  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Шапка админки */}
        <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Авторизовано • Данные из Supabase DB</span>
              </span>
            </div>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1F1E1D]">
              Управление заявками и расписанием
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowRequisitesModal(true)}
              className="px-3.5 py-2 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-xs font-mono font-bold text-[#1F1E1D] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-[#C85A32]" />
              <span>💳 Настройка реквизитов СБП</span>
            </button>

            <button
              onClick={fetchRealBookings}
              title="Обновить список"
              className="p-2.5 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-[#595652] hover:text-[#1F1E1D] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBookings ? 'animate-spin text-[#C85A32]' : ''}`} />
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="px-3.5 py-2 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-xs font-mono font-bold text-[#1F1E1D] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <History className="w-4 h-4 text-[#C85A32]" />
              <span>Журнал входов Supabase</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl border border-[#1F1E1D]/20 bg-white hover:bg-[#FAF8F5] text-xs font-mono font-bold text-[#1F1E1D] flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-emerald-600" />
              <span>На сайт</span>
            </a>

            <button
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl border-2 border-red-200 bg-white hover:bg-red-50 text-xs font-mono font-bold text-red-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>

        {/* Фильтры статусов */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[
            { id: 'all', label: `Все заявки (${bookings.length})` },
            {
              id: 'pending_payment',
              label: `⏳ Ожидают оплаты (${bookings.filter((b) => b.status === 'pending_payment').length})`,
            },
            {
              id: 'receipt_uploaded',
              label: `🧾 Чек загружен (${bookings.filter((b) => b.status === 'receipt_uploaded').length})`,
            },
            {
              id: 'confirmed',
              label: `✅ Подтверждённые (${bookings.filter((b) => b.status === 'confirmed').length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-4 py-2 rounded-xl border-2 font-mono text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterStatus === tab.id
                  ? 'bg-[#1F1E1D] text-white border-[#1F1E1D] hard-shadow'
                  : 'bg-white text-[#595652] border-[#1F1E1D]/20 hover:border-[#1F1E1D] hover:text-[#1F1E1D]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Список заявок */}
        {loadingBookings ? (
          <div className="bg-white border-2 border-[#1F1E1D]/20 rounded-2xl p-12 text-center text-[#595652]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#C85A32] mb-2" />
            <span className="font-mono text-xs">Загрузка заявок из Supabase DB...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white border-2 border-[#1F1E1D]/20 rounded-2xl p-12 text-center text-[#595652]">
            <Inbox className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">Заявок не найдено</h3>
            <p className="text-xs font-mono">В выбранной категории пока нет созданных предзаказов</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredBookings.map((b) => {
              const renderStatusBadge = () => {
                switch (b.status) {
                  case 'pending_payment':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold border border-amber-300">
                        ⏳ Ожидает оплаты (Заказ создан)
                      </span>
                    );
                  case 'receipt_uploaded':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-mono font-bold border border-sky-300">
                        🧾 Чек прикреплен — Проверьте
                      </span>
                    );
                  case 'confirmed':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold border border-emerald-300">
                        ✅ Запись подтверждена
                      </span>
                    );
                  case 'rescheduled':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-[10px] font-mono font-bold border border-purple-300">
                        🔄 Время перенесено
                      </span>
                    );
                  case 'cancelled':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-mono font-bold border border-red-300">
                        ❌ Отклонена
                      </span>
                    );
                  case 'completed':
                    return (
                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold border border-blue-300">
                        ✨ Занятие завершено
                      </span>
                    );
                }
              };

              return (
                <div
                  key={b.id}
                  className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-3">
                      <span className="text-xs font-mono font-bold text-[#595652]">
                        ID: #{b.id.substring(0, 13)}
                      </span>
                      {renderStatusBadge()}
                    </div>

                    <div>
                      <div className="font-serif font-bold text-xl text-[#C85A32]">
                        {b.service_title}
                      </div>
                      <div className="text-sm font-semibold text-[#1F1E1D] flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-[#595652]" />
                        <span>{b.dateStr || 'Время не указано'}</span>
                        <span className="text-[#595652] font-mono font-normal">
                          ({b.price.toLocaleString('ru-RU')} ₽)
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#FAF8F5] p-3 rounded-xl border border-[#1F1E1D]/10 space-y-1 text-xs">
                      <div>
                        <span className="font-bold text-[#595652]">Родитель: </span>
                        <span className="text-[#1F1E1D] font-medium">
                          {b.parent_name} ({b.phone})
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-[#595652]">Ребёнок: </span>
                        <span className="text-[#1F1E1D] font-medium">
                          {b.child_name || 'Не указан'} ({GRADE_LABELS[b.child_grade] || b.child_grade})
                        </span>
                      </div>
                      {b.telegram_handle && (
                        <div>
                          <span className="font-bold text-[#595652]">Telegram: </span>
                          <a
                            href={`https://t.me/${b.telegram_handle.replace('@', '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#C85A32] underline hover:text-[#b04b27]"
                          >
                            {b.telegram_handle}
                          </a>
                        </div>
                      )}
                      {b.comment && (
                        <div className="pt-1 text-[#595652] italic font-serif">
                          «{b.comment}»
                        </div>
                      )}
                      {b.admin_notes && (
                        <div className="pt-1 text-emerald-700 font-mono text-[11px] font-bold">
                          Заметка: {b.admin_notes}
                        </div>
                      )}
                    </div>

                    {b.receipt_file_url && (
                      <div className="pt-1">
                        <a
                          href={b.receipt_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold hover:bg-emerald-100 transition-colors"
                        >
                          <span>🧾 Открыть загруженный чек</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Кнопки управления */}
                  <div className="pt-3 border-t border-[#1F1E1D]/10 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {b.status !== 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-xs font-bold flex items-center gap-1 border border-[#1F1E1D] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Подтвердить</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-[#1F1E1D] hover:bg-[#FAF8F5] text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>Изменить</span>
                      </button>

                      {b.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                          className="px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-mono font-bold cursor-pointer"
                        >
                          Отклонить
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteBooking(b.id)}
                      title="Удалить заявку из базы"
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО НАСТРОЙКИ РЕКВИЗИТОВ ОПЛАТЫ */}
        {showRequisitesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 sm:p-8 hard-shadow-lg w-full max-w-lg space-y-6">
              <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#C85A32]" />
                  <h3 className="font-serif font-bold text-xl text-[#1F1E1D]">
                    Настройка реквизитов СБП
                  </h3>
                </div>
                <button
                  onClick={() => setShowRequisitesModal(false)}
                  className="p-1 rounded-xl text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {requisitesMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{requisitesMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveRequisites} className="space-y-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className="font-bold uppercase text-[#595652]">Номер телефона для СБП *</label>
                  <input
                    type="text"
                    required
                    placeholder="+7 (926) 123-45-67"
                    value={reqPhone}
                    onChange={(e) => setReqPhone(formatRussianPhone(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase text-[#595652]">Номер карты (необязательно)</label>
                  <input
                    type="text"
                    placeholder="2202 2000 1234 5678"
                    value={reqCardNumber}
                    onChange={(e) => setReqCardNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase text-[#595652]">Наименование банка *</label>
                  <input
                    type="text"
                    required
                    placeholder="Т-Банк / Сбербанк"
                    value={reqBankName}
                    onChange={(e) => setReqBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold uppercase text-[#595652]">ФИО получателя перевода *</label>
                  <input
                    type="text"
                    required
                    placeholder="Скокова Юлия Павловна"
                    value={reqRecipient}
                    onChange={(e) => setReqRecipient(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRequisitesModal(false)}
                    className="px-4 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 text-[#1F1E1D] font-bold cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={savingRequisites}
                    className="px-6 py-2.5 rounded-xl bg-[#C85A32] hover:bg-[#b04b27] text-white font-bold hard-shadow border-2 border-[#1F1E1D] cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingRequisites ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Сохранение...</span>
                      </>
                    ) : (
                      <span>Сохранить реквизиты в Supabase DB</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Модальное окно просмотра логов Supabase */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow-lg w-full max-w-2xl space-y-4 max-h-[80vh] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#C85A32]" />
                  <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">
                    Журнал входов в Supabase DB
                  </h3>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                {auditLogs.length === 0 ? (
                  <p className="text-xs font-mono text-[#595652]">Записей входов пока нет</p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-[#FAF8F5] border border-[#1F1E1D]/10 rounded-xl text-xs font-mono flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#1F1E1D]">IP: {log.ip_address}</div>
                        <div className="text-[10px] text-[#595652] max-w-md truncate">
                          UA: {log.user_agent}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {log.status}
                        </span>
                        <div className="text-[10px] text-[#595652] mt-0.5">
                          {new Date(log.created_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-4 py-2 bg-[#1F1E1D] text-white font-mono text-xs font-bold rounded-xl cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* УЛУЧШЕННОЕ МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ЗАЯВКИ */}
        {editingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 sm:p-8 hard-shadow-lg w-full max-w-xl space-y-6 my-8">
              <div className="flex items-center justify-between border-b-2 border-[#1F1E1D]/10 pb-4">
                <div>
                  <h3 className="font-serif font-extrabold text-xl text-[#1F1E1D]">
                    Редактирование заявки #{editingBooking.id.substring(0, 13)}
                  </h3>
                  <p className="text-xs font-mono text-[#595652]">
                    Изменение всех параметров урока в базе данных Supabase
                  </p>
                </div>
                <button
                  onClick={() => setEditingBooking(null)}
                  className="p-2 rounded-xl border border-[#1F1E1D]/20 hover:border-[#1F1E1D] text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* 1. ВЫБОР ДАТЫ И ВРЕМЕНИ */}
                <div className="p-4 bg-[#FAF8F5] border-2 border-[#1F1E1D]/20 rounded-2xl space-y-3">
                  <span className="font-mono uppercase font-bold text-[#C85A32] block text-[11px]">
                    📅 Удобный перенос даты и времени:
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-mono font-bold text-[#595652] block mb-1">
                        Выберите дату (Календарь):
                      </label>
                      <input
                        type="date"
                        value={editDateISO}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-white font-mono text-xs font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                      />
                    </div>

                    <div>
                      <label className="font-mono font-bold text-[#595652] block mb-1">
                        Время в Самарском часовом поясе (UTC+4):
                      </label>
                      <input
                        type="text"
                        placeholder="14:00"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-white font-mono text-xs font-bold text-[#1F1E1D] outline-none focus:border-[#C85A32]"
                      />
                    </div>
                  </div>

                  {/* Быстрые кнопки времени */}
                  <div>
                    <span className="font-mono text-[10px] text-[#595652] block mb-1">
                      Быстрый выбор времени (по Самаре/Тольятти):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_TIMES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditTime(t)}
                          className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold cursor-pointer transition-all ${
                            editTime === t
                              ? 'bg-[#C85A32] text-white border-[#1F1E1D]'
                              : 'bg-white text-[#1F1E1D] border-[#1F1E1D]/20 hover:border-[#1F1E1D]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Итоговый вид даты */}
                  <div className="p-2.5 bg-white rounded-xl border border-[#1F1E1D]/15 font-mono text-xs text-[#1F1E1D]">
                    Выбрано для переноса: <strong className="text-[#C85A32]">{editDateStr ? `${editDateStr}, ${editTime}` : editTime}</strong>
                  </div>
                </div>

                {/* 2. ТАРИФ И СТАТУС */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">
                      Тариф / Формат занятия:
                    </label>
                    <select
                      value={editServiceTitle}
                      onChange={(e) => {
                        const title = e.target.value;
                        setEditServiceTitle(title);
                        setEditPrice(title.includes('Оффлайн') ? 800 : 600);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-bold text-[#1F1E1D] outline-none focus:border-[#1F1E1D]"
                    >
                      <option value="Онлайн-занятие (Индивидуально)">Онлайн-занятие (600 ₽ / 40 мин)</option>
                      <option value="Оффлайн-занятие (В кабинете)">Оффлайн-занятие (800 ₽ / 40 мин)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">
                      Статус заявки в базе:
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as BookingStatus)}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-bold text-[#1F1E1D] outline-none focus:border-[#1F1E1D]"
                    >
                      <option value="pending_payment">⏳ Ожидает оплаты (pending_payment)</option>
                      <option value="receipt_uploaded">🧾 Чек загружен — на проверке (receipt_uploaded)</option>
                      <option value="confirmed">✅ Запись подтверждена (confirmed)</option>
                      <option value="rescheduled">🔄 Урок перенесён (rescheduled)</option>
                      <option value="cancelled">❌ Отклонена / Отменена (cancelled)</option>
                      <option value="completed">✨ Занятие завершено (completed)</option>
                    </select>
                  </div>
                </div>

                {/* 3. ДАННЫЕ РОДИТЕЛЯ И СВЯЗИ */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Имя родителя:</label>
                    <input
                      type="text"
                      autoCapitalize="words"
                      value={editParent}
                      onChange={(e) => setEditParent(capitalizeFirstLetter(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-bold text-[#1F1E1D] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Телефон родителя:</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onFocus={() => {
                        if (!editPhone) setEditPhone('+7 (');
                      }}
                      onChange={(e) => setEditPhone(formatRussianPhone(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-mono font-bold text-[#1F1E1D] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Telegram юзернейм:</label>
                    <input
                      type="text"
                      value={editTelegram}
                      onFocus={() => {
                        if (!editTelegram) setEditTelegram('@');
                      }}
                      onChange={(e) => setEditTelegram(formatTelegramHandle(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-mono font-bold text-[#1F1E1D] outline-none"
                    />
                  </div>
                </div>

                {/* 4. ДАННЫЕ РЕБЁНКА */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Имя ребёнка:</label>
                    <input
                      type="text"
                      autoCapitalize="words"
                      value={editChild}
                      onChange={(e) => setEditChild(capitalizeFirstLetter(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-bold text-[#1F1E1D] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Класс / Возраст:</label>
                    <select
                      value={editChildGrade}
                      onChange={(e) => setEditChildGrade(e.target.value as GradeLevel)}
                      className="w-full px-3 py-2 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-xs font-bold text-[#1F1E1D] outline-none"
                    >
                      <option value="preschool_5">Подготовка к школе (5 лет)</option>
                      <option value="preschool_6">Подготовка к школе (6 лет / Перед 1 классом)</option>
                      <option value="grade_1">1 класс</option>
                      <option value="grade_2">2 класс</option>
                      <option value="grade_3">3 класс</option>
                      <option value="grade_4">4 класс</option>
                    </select>
                  </div>
                </div>

                {/* 5. КОММЕНТАРИЙ И ЗАМЕТКА ПЕДАГОГА */}
                <div className="space-y-3">
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Комментарий родителя:</label>
                    <textarea
                      rows={2}
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      className="w-full p-2.5 border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] rounded-xl text-xs font-medium text-[#1F1E1D] outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-mono font-bold text-[#C85A32] block mb-1">Заметка педагога (видима в кабинете):</label>
                    <textarea
                      rows={2}
                      placeholder="Например: Ссылку на Телемост пришлю за 15 минут до урока в Телеграм"
                      value={editAdminNotes}
                      onChange={(e) => setEditAdminNotes(e.target.value)}
                      className="w-full p-2.5 border-2 border-[#C85A32]/30 bg-orange-50/40 rounded-xl text-xs font-medium text-[#1F1E1D] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* КНОПКИ СОХРАНЕНИЯ И ОТМЕНЫ */}
              <div className="pt-4 border-t-2 border-[#1F1E1D]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="px-5 py-2.5 rounded-xl border-2 border-[#1F1E1D]/20 hover:border-[#1F1E1D] text-xs font-mono font-bold text-[#1F1E1D] cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-6 py-2.5 bg-[#C85A32] hover:bg-[#b04b27] text-white rounded-xl text-xs font-mono font-bold border-2 border-[#1F1E1D] hard-shadow cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Сохранение...</span>
                    </>
                  ) : (
                    <span>Сохранить изменения ➔</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
