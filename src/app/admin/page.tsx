'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, XCircle, Edit, ExternalLink, Lock, KeyRound, LogOut, AlertCircle, ShieldCheck, History, Loader2, Trash2, RefreshCw, Inbox } from 'lucide-react';
import { GRADE_LABELS, STATUS_LABELS, GradeLevel, BookingStatus } from '@/types/database';

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

  // Редактируемые поля
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editParent, setEditParent] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editChild, setEditChild] = useState('');
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    const authStatus = sessionStorage.getItem('skokova_admin_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      fetchRealBookings();
      fetchAuditLogs();
    }
  }, []);

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

  // Изменение статуса заявки (Подтвердить / Отклонить) в Supabase
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

  const handleOpenEdit = (b: AdminBooking) => {
    setEditingBooking(b);
    setEditDate(b.dateStr || '');
    setEditTime(b.timeSlot || '');
    setEditParent(b.parent_name);
    setEditPhone(b.phone);
    setEditChild(b.child_name);
    setEditComment(b.comment || '');
  };

  // Сохранение отредактированных данных заявки в Supabase
  const handleSaveEdit = async () => {
    if (!editingBooking) return;

    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBooking.id,
          parent_name: editParent,
          phone: editPhone,
          child_name: editChild,
          comment: editComment,
          dateStr: editDate,
          timeSlot: editTime,
          status: 'rescheduled',
        }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) =>
            b.id === editingBooking.id
              ? {
                  ...b,
                  dateStr: editDate,
                  timeSlot: editTime,
                  parent_name: editParent,
                  phone: editPhone,
                  child_name: editChild,
                  comment: editComment,
                  status: 'rescheduled',
                }
              : b
          )
        );
        setEditingBooking(null);
      }
    } catch (e) {
      console.error('Save edit error:', e);
    }
  };

  // ЭКРАН ВХОДА С АВТОРИЗАЦИЕЙ ЧЕРЕЗ SUPABASE
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] flex items-center justify-center p-4">
        <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-8 hard-shadow-lg w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-[#C85A32]/10 border-2 border-[#1F1E1D] text-[#C85A32] flex items-center justify-center mx-auto hard-shadow">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="font-serif font-bold text-2xl text-[#1F1E1D]">
              Вход для администратора
            </h1>
            <p className="text-xs font-mono text-[#595652]">
              Скокова Юлия Павловна • Защищённый доступ
            </p>
          </div>

          {loginError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold uppercase text-[#595652]">
                Введите пароль администратора:
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  className="w-full px-4 py-3 text-sm rounded-xl border-2 border-[#1F1E1D]/20 focus:border-[#C85A32] outline-none font-mono tracking-widest text-center text-lg"
                />
                <KeyRound className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" />
              </div>
              <p className="text-[11px] text-[#595652] pt-1 text-center font-mono">
                Все входы логируются в Supabase `admin_login_logs`
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#C85A32] hover:bg-[#b04b27] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isSubmitting ? 'Проверка...' : 'Войти в панель'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredBookings = bookings.filter((b) => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Шапка админ-панели */}
        <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-medium mb-1 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Авторизовано • Данные из Supabase DB</span>
            </div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#1F1E1D]">
              Управление заявками и расписанием
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchRealBookings}
              className="p-2.5 bg-[#FAF8F5] hover:bg-gray-100 border border-[#1F1E1D]/20 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
              title="Обновить данные из БД"
            >
              <RefreshCw className={`w-4 h-4 text-[#C85A32] ${loadingBookings ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => {
                fetchAuditLogs();
                setShowLogsModal(true);
              }}
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-gray-100 border border-[#1F1E1D]/20 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#C85A32]" />
              <span>Журнал входов Supabase</span>
            </button>

            <a
              href="/"
              target="_blank"
              className="px-4 py-2.5 bg-[#FAF8F5] hover:bg-gray-100 border border-[#1F1E1D]/20 rounded-xl text-xs font-semibold flex items-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>На сайт</span>
            </a>

            <button
              onClick={handleLogout}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Выйти</span>
            </button>
          </div>
        </div>

        {/* Фильтры статусов */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'all'
                ? 'border-[#1F1E1D] bg-[#1F1E1D] text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            Все заявки ({bookings.length})
          </button>

          <button
            onClick={() => setFilterStatus('pending_payment')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'pending_payment'
                ? 'border-amber-600 bg-amber-600 text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            ⏳ Ожидают оплаты ({bookings.filter((b) => b.status === 'pending_payment').length})
          </button>

          <button
            onClick={() => setFilterStatus('receipt_uploaded')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'receipt_uploaded'
                ? 'border-[#C85A32] bg-[#C85A32] text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            📄 Чек загружен ({bookings.filter((b) => b.status === 'receipt_uploaded').length})
          </button>

          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'confirmed'
                ? 'border-emerald-600 bg-emerald-600 text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            ✅ Подтверждённые ({bookings.filter((b) => b.status === 'confirmed').length})
          </button>
        </div>

        {/* Список реальных заявок */}
        {loadingBookings ? (
          <div className="flex items-center justify-center p-12 text-sm font-mono text-[#595652] gap-2 bg-white rounded-2xl border-2 border-[#1F1E1D] hard-shadow">
            <Loader2 className="w-5 h-5 animate-spin text-[#C85A32]" />
            <span>Загрузка актуальных заявок из Supabase...</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-2xl border-2 border-[#1F1E1D] hard-shadow space-y-3">
            <Inbox className="w-12 h-12 text-[#C85A32] mx-auto opacity-40" />
            <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">Заявок в этой категории нет</h3>
            <p className="text-xs text-[#595652] max-w-sm mx-auto font-mono">
              Когда родители заполнят форму записи на сайте, заказ сразу появится здесь со статусом «Ожидает оплаты».
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredBookings.map((b) => {
              const renderStatusBadge = () => {
                switch (b.status) {
                  case 'pending_payment':
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-amber-500/30 bg-amber-50 text-amber-800">
                        ⏳ Ожидает оплаты (Заказ создан)
                      </span>
                    );
                  case 'receipt_uploaded':
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-[#C85A32]/30 bg-[#C85A32]/10 text-[#C85A32]">
                        📄 Чек загружен (На проверке)
                      </span>
                    );
                  case 'confirmed':
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-emerald-500/30 bg-emerald-50 text-emerald-800">
                        ✅ Подтверждена
                      </span>
                    );
                  case 'rescheduled':
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-sky-500/30 bg-sky-50 text-sky-800">
                        📅 Перенесена
                      </span>
                    );
                  case 'cancelled':
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-red-500/30 bg-red-50 text-red-800">
                        ❌ Отклонена
                      </span>
                    );
                  default:
                    return (
                      <span className="px-3 py-1 rounded-full text-xs font-mono font-bold border border-gray-200 bg-gray-50 text-gray-700">
                        {b.status}
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
                      <span className="text-xs font-mono text-[#595652]">ID: {b.id.substring(0, 13)}</span>
                      {renderStatusBadge()}
                    </div>

                    <div>
                      <div className="font-serif font-bold text-xl text-[#C85A32]">{b.service_title}</div>
                      <div className="text-sm font-semibold text-[#1F1E1D] flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-[#595652]" />
                        <span>{b.dateStr || 'Дата выставляется'}</span>
                        <span className="font-mono text-xs text-[#595652]">({b.price} ₽)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/10 text-xs space-y-1.5">
                      <div><strong>Родитель:</strong> {b.parent_name} ({b.phone})</div>
                      <div><strong>Ребёнок:</strong> {b.child_name} ({GRADE_LABELS[b.child_grade] || b.child_grade})</div>
                      {b.telegram_handle && <div><strong>Telegram:</strong> {b.telegram_handle}</div>}
                      {b.comment && <div className="text-[#595652] italic pt-1">«{b.comment}»</div>}
                      {b.admin_notes && <div className="text-[#C85A32] font-semibold pt-1">📌 Заметка: {b.admin_notes}</div>}
                    </div>

                    {b.receipt_file_url && (
                      <div className="text-xs">
                        <a
                          href={b.receipt_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#C85A32] underline font-semibold flex items-center gap-1 hover:text-[#b04b27]"
                        >
                          <span>🧾 Просмотреть прикреплённый чек (Файл)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Кнопки управления */}
                  <div className="pt-4 border-t border-[#1F1E1D]/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {b.status !== 'confirmed' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                          className="px-3.5 py-2 bg-[#2E5A44] hover:bg-[#234634] text-white text-xs font-semibold rounded-lg border border-[#1F1E1D] hard-shadow cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Подтвердить</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-[#1F1E1D] text-xs font-semibold rounded-lg border border-[#1F1E1D] hard-shadow cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5 text-[#C85A32]" />
                        <span>Изменить</span>
                      </button>

                      {b.status !== 'cancelled' && (
                        <button
                          onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                          className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Отклонить
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteBooking(b.id)}
                      className="p-2 text-gray-400 hover:text-rose-600 transition-colors"
                      title="Удалить заявку"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Модальное окно журнала входов Supabase */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow-lg w-full max-w-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-3">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-[#C85A32]" />
                  <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">
                    Журнал входов Supabase (`admin_login_logs`)
                  </h3>
                </div>
                <button onClick={() => setShowLogsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {auditLogs.length === 0 ? (
                  <div className="text-xs font-mono text-[#595652] p-4 text-center">
                    История входов пока пуста.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-[#FAF8F5] border border-[#1F1E1D]/10 rounded-xl text-xs flex items-center justify-between font-mono"
                    >
                      <div>
                        <div className="font-bold text-[#1F1E1D]">
                          IP: {log.ip_address} • {log.status === 'success' ? '✅ Успешный вход' : '❌ Ошибка входа'}
                        </div>
                        <div className="text-[11px] text-[#595652] truncate max-w-md">{log.user_agent}</div>
                      </div>
                      <div className="text-[11px] text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ru-RU')}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-4 py-2 bg-[#1F1E1D] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно редактирования заявки */}
        {editingBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow-lg w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-3">
                <h3 className="font-serif font-bold text-lg text-[#1F1E1D]">
                  Редактирование заявки {editingBooking.id.substring(0, 13)}
                </h3>
                <button onClick={() => setEditingBooking(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Перенести дату:</label>
                    <input
                      type="text"
                      placeholder="Пн, 3 августа"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="font-mono font-bold text-[#595652] block mb-1">Перенести время:</label>
                    <input
                      type="text"
                      placeholder="16:00"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono font-bold text-[#595652] block mb-1">Имя родителя:</label>
                  <input
                    type="text"
                    value={editParent}
                    onChange={(e) => setEditParent(e.target.value)}
                    className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-mono font-bold text-[#595652] block mb-1">Телефон:</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-mono font-bold text-[#595652] block mb-1">Имя ребёнка:</label>
                  <input
                    type="text"
                    value={editChild}
                    onChange={(e) => setEditChild(e.target.value)}
                    className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                  />
                </div>

                <div>
                  <label className="font-mono font-bold text-[#595652] block mb-1">Комментарий:</label>
                  <textarea
                    rows={2}
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full p-2 border border-[#1F1E1D]/20 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  onClick={() => setEditingBooking(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-[#C85A32] text-white rounded-lg text-xs font-semibold border border-[#1F1E1D] hard-shadow cursor-pointer"
                >
                  Сохранить в Supabase DB
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
