'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, XCircle, Edit, ExternalLink, Lock, KeyRound, LogOut, AlertCircle, ShieldCheck, History, Loader2 } from 'lucide-react';
import { GRADE_LABELS, STATUS_LABELS, GradeLevel, BookingStatus } from '@/types/database';

interface MockAdminBooking {
  id: string;
  parent_name: string;
  phone: string;
  telegram_handle?: string;
  child_name: string;
  child_grade: GradeLevel;
  service_title: string;
  price: number;
  dateStr: string;
  timeSlot: string;
  receipt_file_url?: string;
  status: BookingStatus;
  comment?: string;
  created_at: string;
}

interface LoginLog {
  id: string;
  ip_address: string;
  user_agent: string;
  status: string;
  created_at: string;
}

const INITIAL_MOCK_BOOKINGS: MockAdminBooking[] = [
  {
    id: 'booking-101',
    parent_name: 'Ольга Смирнова',
    phone: '+7 (916) 123-45-67',
    telegram_handle: '@olga_smirnova',
    child_name: 'Артём',
    child_grade: 'preschool_6',
    service_title: 'Подготовка к школе (5–7 лет)',
    price: 1500,
    dateStr: 'Пн, 3 августа',
    timeSlot: '16:00',
    receipt_file_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
    status: 'receipt_uploaded',
    comment: 'Плохо читает по слогам, нужно подтянуть подготовку к 1 классу.',
    created_at: '30.07.2026 14:30',
  },
  {
    id: 'booking-102',
    parent_name: 'Екатерина Петрова',
    phone: '+7 (903) 987-65-43',
    telegram_handle: '@katerina_p',
    child_name: 'София',
    child_grade: 'grade_3',
    service_title: 'Репетитор начальных классов (1–4 классы)',
    price: 1700,
    dateStr: 'Вт, 4 августа',
    timeSlot: '15:00',
    receipt_file_url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600',
    status: 'confirmed',
    comment: 'Сложности с задачами по математике на движение.',
    created_at: '29.07.2026 18:10',
  },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [inputPin, setInputPin] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [bookings, setBookings] = useState<MockAdminBooking[]>(INITIAL_MOCK_BOOKINGS);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingBooking, setEditingBooking] = useState<MockAdminBooking | null>(null);
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
      fetchAuditLogs();
    }
  }, []);

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
              Авторизация Supabase Auth
            </h1>
            <p className="text-xs font-mono text-[#595652]">
              Скокова Юлия Павловна • Защищённый вход администратора
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
                Пароль администратора (Supabase DB):
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
                Все попытки входа записываются в журнал Supabase `admin_login_logs`
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#C85A32] hover:bg-[#b04b27] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{isSubmitting ? 'Проверка в Supabase...' : 'Войти в админ-панель'}</span>
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

  const handleUpdateStatus = (id: string, newStatus: BookingStatus) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
  };

  const handleOpenEdit = (b: MockAdminBooking) => {
    setEditingBooking(b);
    setEditDate(b.dateStr);
    setEditTime(b.timeSlot);
    setEditParent(b.parent_name);
    setEditPhone(b.phone);
    setEditChild(b.child_name);
    setEditComment(b.comment || '');
  };

  const handleSaveEdit = () => {
    if (!editingBooking) return;
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
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Шапка админ-панели */}
        <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-mono font-medium mb-1 border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Авторизовано через Supabase Auth</span>
            </div>
            <h1 className="font-serif font-bold text-2xl md:text-3xl text-[#1F1E1D]">
              Управление заявками и расписанием
            </h1>
          </div>

          <div className="flex items-center gap-3">
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
              <span>Перейти на сайт</span>
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

        {/* Фильтры */}
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
            onClick={() => setFilterStatus('receipt_uploaded')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'receipt_uploaded'
                ? 'border-[#C85A32] bg-[#C85A32] text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            Чек загружен (На проверке)
          </button>
          <button
            onClick={() => setFilterStatus('confirmed')}
            className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold cursor-pointer ${
              filterStatus === 'confirmed'
                ? 'border-emerald-600 bg-emerald-600 text-white hard-shadow'
                : 'border-[#1F1E1D]/20 bg-white text-[#1F1E1D]'
            }`}
          >
            Подтверждённые
          </button>
        </div>

        {/* Список карточек заявок */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBookings.map((b) => {
            const statusInfo = STATUS_LABELS[b.status] || { label: b.status, color: 'gray' };

            return (
              <div
                key={b.id}
                className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 hard-shadow space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-3">
                    <span className="text-xs font-mono text-[#595652]">ID: {b.id}</span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border border-[#1F1E1D]/20 bg-amber-50 text-amber-800">
                      {statusInfo.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-serif font-bold text-xl text-[#C85A32]">{b.service_title}</div>
                    <div className="text-sm font-semibold text-[#1F1E1D] flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4 text-[#595652]" />
                      <span>{b.dateStr}, {b.timeSlot}</span>
                      <span className="font-mono text-xs text-[#595652]">({b.price} ₽)</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/10 text-xs space-y-1.5">
                    <div><strong>Родитель:</strong> {b.parent_name} ({b.phone})</div>
                    <div><strong>Ребёнок:</strong> {b.child_name} ({GRADE_LABELS[b.child_grade]})</div>
                    {b.telegram_handle && <div><strong>Telegram:</strong> {b.telegram_handle}</div>}
                    {b.comment && <div className="text-[#595652] italic pt-1">«{b.comment}»</div>}
                  </div>

                  {b.receipt_file_url && (
                    <div className="text-xs">
                      <a
                        href={b.receipt_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#C85A32] underline font-semibold flex items-center gap-1 hover:text-[#b04b27]"
                      >
                        <span>🧾 Просмотреть прикреплённый чек</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#1F1E1D]/10 flex flex-wrap items-center gap-2">
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
                    <span>Изменить заявку</span>
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
              </div>
            );
          })}
        </div>

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
                    История входов пока пуста или только формируется.
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
                  className="px-4 py-2 bg-[#1F1E1D] text-white rounded-lg text-xs font-semibold"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
