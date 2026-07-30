'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Lock, Mail, User, Phone, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatRussianPhone } from '@/lib/formatters';

function LoginContent() {
  const searchParams = useSearchParams();
  const isResetModeParam = searchParams.get('reset') === 'true';

  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSetNewPasswordMode, setIsSetNewPasswordMode] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isResetModeParam || (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))) {
      setIsSetNewPasswordMode(true);
    }
  }, [isResetModeParam]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Установка нового пароля после перехода из письма
    if (isSetNewPasswordMode) {
      if (!password || password.length < 6) {
        setErrorMsg('Новый пароль должен содержать минимум 6 символов');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Введённые пароли не совпадают');
        return;
      }

      setLoading(true);
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) throw error;

        setSuccessMsg('🎉 Новый пароль успешно сохранён! Переход в кабинет...');
        setTimeout(() => {
          window.location.href = '/my-dashboard';
        }, 800);
      } catch (err: any) {
        console.error('Update password error:', err);
        setErrorMsg(err.message || 'Ошибка обновления пароля');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2. Мгновенное и безопасное восстановление по Email + Номеру телефона
    if (isForgotPassword) {
      if (!email || !email.includes('@')) {
        setErrorMsg('Пожалуйста, укажите корректный Email');
        return;
      }

      if (!password || password.length < 6) {
        setErrorMsg('Новый пароль должен содержать минимум 6 символов');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/parent/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, newPassword: password }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Ошибка восстановления пароля');
        }

        setSuccessMsg('🎉 Пароль успешно изменён! Выполняем вход в кабинет...');
        
        // Автоматический вход с новым паролем
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError) {
          setTimeout(() => {
            window.location.href = '/my-dashboard';
          }, 800);
        } else {
          setIsForgotPassword(false);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Ошибка восстановления пароля');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 3. Вход или регистрация
    if (!email || !password) {
      setErrorMsg('Пожалуйста, укажите ваш Email и пароль');
      return;
    }

    if (isRegister && !fullName.trim()) {
      setErrorMsg('Пожалуйста, укажите ваше имя');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (isRegister) {
        const signupRes = await fetch('/api/parent/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        });

        const signupData = await signupRes.json();
        if (!signupData.success) {
          throw new Error(signupData.error || 'Ошибка при регистрации');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setSuccessMsg('Аккаунт создан и активирован! Переход в кабинет...');
        setTimeout(() => {
          window.location.href = '/my-dashboard';
        }, 600);
      } else {
        let { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error && (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed'))) {
          const autoConfirmRes = await fetch('/api/parent/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, fullName: email.split('@')[0] }),
          });

          if (autoConfirmRes.ok) {
            const retryAuth = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (!retryAuth.error) {
              error = null;
            }
          }
        }

        if (error) {
          throw new Error('Неверный Email или пароль. Проверьте данные или нажмите «Забыли пароль?».');
        }

        setSuccessMsg('Успешный вход! Переход в кабинет...');
        setTimeout(() => {
          window.location.href = '/my-dashboard';
        }, 600);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Ошибка авторизации. Проверьте данные и повторите попытку.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 sm:p-8 hard-shadow-lg relative overflow-hidden">
      {/* Декоративный бейдж */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#C85A32]/30 bg-[#C85A32]/10 text-[#C85A32] text-xs font-mono font-bold mb-6">
        <BookOpen className="w-3.5 h-3.5" />
        <span>
          {isSetNewPasswordMode
            ? 'Новый пароль'
            : isForgotPassword
            ? 'Мгновенное восстановление'
            : isRegister
            ? 'Регистрация родителя'
            : 'Кабинет родителя'}
        </span>
      </div>

      <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1F1E1D] mb-2">
        {isSetNewPasswordMode
          ? 'Укажите новый пароль'
          : isForgotPassword
          ? 'Смена и восстановление пароля'
          : isRegister
          ? 'Создать аккаунт семьи'
          : 'Вход в личный кабинет'}
      </h1>
      <p className="text-xs sm:text-sm text-[#595652] mb-6">
        {isSetNewPasswordMode
          ? 'Введите новый пароль для вашей учётной записи.'
          : isForgotPassword
          ? 'Укажите ваш Email, номер телефона для подтверждения и придумайте новый пароль.'
          : isRegister
          ? 'Зарегистрируйтесь, чтобы отслеживать уроки ребёнка и подключаться к видеосвязи'
          : 'Введите ваш email и пароль для доступа к истории занятий'}
      </p>

      {/* Сообщение об ошибке */}
      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl border-2 border-red-500/30 bg-red-50 text-red-700 text-xs font-medium flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Сообщение об успехе */}
      {successMsg && (
        <div className="mb-4 p-4 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 text-emerald-900 text-xs font-medium flex items-start gap-2.5 leading-relaxed font-mono">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Форма */}
      <form onSubmit={handleAuth} className="space-y-4">
        {isSetNewPasswordMode ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Новый пароль *</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Повторите новый пароль *</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Повторите введенный пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold text-sm tracking-wide hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <span>Сохранить новый пароль ➔</span>
              )}
            </button>
          </>
        ) : isForgotPassword ? (
          /* Форма мгновенного сброса по Email + Телефон */
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Электронная почта (Email) *</span>
              </label>
              <input
                type="email"
                required
                placeholder="name@domain.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Ваш телефон при регистрации/записи *</span>
              </label>
              <input
                type="tel"
                required
                placeholder="+7 (999) 000-00-00"
                value={phone}
                onFocus={() => {
                  if (!phone) setPhone('+7 (');
                }}
                onChange={(e) => setPhone(formatRussianPhone(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Придумайте новый пароль *</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold text-sm tracking-wide hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Проверка данных...</span>
                </>
              ) : (
                <span>Подтвердить и войти с новым паролем ➔</span>
              )}
            </button>
          </>
        ) : (
          /* Обычный вход / Регистрация */
          <>
            {isRegister && (
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Ваше имя (родителя) *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например, Сергей"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none transition-colors"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Электронная почта (Email) *</span>
              </label>
              <input
                type="email"
                required
                placeholder="name@domain.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none transition-colors font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
                  <span>Пароль *</span>
                </label>

                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-xs font-mono font-bold text-[#C85A32] hover:underline cursor-pointer"
                  >
                    Забыли пароль?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold text-sm tracking-wide hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Обработка...</span>
                </>
              ) : (
                <span>{isRegister ? 'Зарегистрироваться' : 'Войти в кабинет'}</span>
              )}
            </button>
          </>
        )}
      </form>

      {/* Переключатель Вход / Регистрация / Отмена восстановления */}
      <div className="mt-6 pt-6 border-t border-[#1F1E1D]/10 text-center space-y-2">
        {isForgotPassword || isSetNewPasswordMode ? (
          <button
            type="button"
            onClick={() => {
              setIsForgotPassword(false);
              setIsSetNewPasswordMode(false);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-xs font-mono font-bold text-[#1F1E1D] hover:text-[#C85A32] transition-colors cursor-pointer"
          >
            ↩ Возврат к форме входа
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-xs font-mono font-bold text-[#595652] hover:text-[#C85A32] transition-colors cursor-pointer"
          >
            {isRegister
              ? 'Уже есть аккаунт? Войти в кабинет'
              : 'Ещё нет аккаунта? Зарегистрироваться'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] flex flex-col justify-between selection:bg-[#C85A32] selection:text-white">
      {/* Шапка */}
      <header className="border-b-2 border-[#1F1E1D]/10 bg-[#FAF8F5]/80 backdrop-blur-md sticky top-0 z-50 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase text-[#595652] hover:text-[#1F1E1D] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#C85A32]" />
            <span>На главную</span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#C85A32] flex items-center justify-center text-white font-mono font-bold text-xs hard-shadow">
              СЮ
            </div>
            <span className="font-serif font-bold text-sm tracking-tight text-[#1F1E1D]">
              Уроки Скоковой Юлии Павловны
            </span>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <Suspense
          fallback={
            <div className="w-full max-w-md bg-white border-2 border-[#1F1E1D] rounded-3xl p-8 hard-shadow-lg text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#C85A32] mb-2" />
              <span className="font-mono text-xs text-[#595652]">Загрузка формы...</span>
            </div>
          }
        >
          <LoginContent />
        </Suspense>
      </main>

      {/* Подвал */}
      <footer className="border-t border-[#1F1E1D]/10 py-6 text-center text-xs font-mono text-[#595652]">
        © 2026 Уроки Скоковой Юлии Павловны. Личный кабинет родителя.
      </footer>
    </div>
  );
}
