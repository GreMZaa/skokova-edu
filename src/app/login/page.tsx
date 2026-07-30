'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock, Mail, User, CheckCircle2, AlertCircle, Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetTempPassword, setResetTempPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isForgotPassword) {
      // Восстановление пароля
      if (!email || !email.includes('@')) {
        setErrorMsg('Пожалуйста, укажите корректный Email');
        return;
      }

      setLoading(true);
      try {
        const res = await fetch('/api/parent/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Ошибка восстановления пароля');
        }

        setResetTempPassword(data.tempPassword);
        setSuccessMsg(data.message || 'Новый временный пароль выслан на вашу почту!');
      } catch (err: any) {
        setErrorMsg(err.message || 'Ошибка восстановления пароля');
      } finally {
        setLoading(false);
      }
      return;
    }

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
        // 1. Создаем пользователя с мгновенным серверным подтверждением
        const signupRes = await fetch('/api/parent/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        });

        const signupData = await signupRes.json();
        if (!signupData.success) {
          throw new Error(signupData.error || 'Ошибка при регистрации');
        }

        // 2. Выполняем вход
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
        // Вход существующего родителя
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
          throw new Error('Неверный Email или пароль. Проверьте правильность введённых данных или нажмите «Забыли пароль?».');
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

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(resetTempPassword);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

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
        <div className="w-full max-w-md bg-white border-2 border-[#1F1E1D] rounded-3xl p-6 sm:p-8 hard-shadow-lg relative overflow-hidden">
          {/* Декоративный бейдж */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#C85A32]/30 bg-[#C85A32]/10 text-[#C85A32] text-xs font-mono font-bold mb-6">
            <BookOpen className="w-3.5 h-3.5" />
            <span>
              {isForgotPassword
                ? 'Восстановление пароля'
                : isRegister
                ? 'Регистрация родителя'
                : 'Кабинет родителя'}
            </span>
          </div>

          <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1F1E1D] mb-2">
            {isForgotPassword
              ? 'Сброс и замена пароля'
              : isRegister
              ? 'Создать аккаунт семьи'
              : 'Вход в личный кабинет'}
          </h1>
          <p className="text-xs sm:text-sm text-[#595652] mb-6">
            {isForgotPassword
              ? 'Укажите адрес электронной почты. Мы сгенерируем и вышлем вам новый временный пароль.'
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
          {successMsg && !resetTempPassword && (
            <div className="mb-4 p-3.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 text-emerald-800 text-xs font-medium flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Блок сгенерированного временного пароля */}
          {resetTempPassword ? (
            <div className="p-5 bg-emerald-50 border-2 border-emerald-500 rounded-2xl text-emerald-950 space-y-4 hard-shadow">
              <div className="font-bold text-sm flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Новый пароль успешно выслан!</span>
              </div>
              
              <div className="text-xs text-emerald-900 leading-relaxed font-mono">
                Пароль отправлен на <strong>{email}</strong> и сгенерирован ниже для мгновенного входа:
              </div>

              <div className="p-3 bg-white border-2 border-emerald-400 rounded-xl flex items-center justify-between font-mono font-extrabold text-lg text-[#1F1E1D]">
                <span>{resetTempPassword}</span>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#C85A32]" />}
                  <span>{isCopied ? 'Скопировано' : 'Копировать'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPassword(resetTempPassword);
                  setIsForgotPassword(false);
                  setResetTempPassword('');
                  setSuccessMsg('Временный пароль подставлен! Нажмите «Войти в кабинет»');
                }}
                className="w-full py-3 bg-[#1F1E1D] hover:bg-[#C85A32] text-white font-mono text-xs font-bold rounded-xl hard-shadow transition-colors cursor-pointer"
              >
                Войти с новым паролем ➔
              </button>
            </div>
          ) : (
            /* Форма */
            <form onSubmit={handleAuth} className="space-y-4">
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

              {!isForgotPassword && (
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
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#C85A32] hover:bg-[#B34D28] text-white font-bold text-sm tracking-wide hard-shadow transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Обработка запроса...</span>
                  </>
                ) : (
                  <span>
                    {isForgotPassword
                      ? 'Сбросить и отправить новый пароль'
                      : isRegister
                      ? 'Зарегистрироваться'
                      : 'Войти в кабинет'}
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Переключатель Вход / Регистрация / Отмена восстановления */}
          <div className="mt-6 pt-6 border-t border-[#1F1E1D]/10 text-center space-y-2">
            {isForgotPassword ? (
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setResetTempPassword('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs font-mono font-bold text-[#1F1E1D] hover:text-[#C85A32] transition-colors cursor-pointer"
              >
                ↩ Отмена и возврат к форме входа
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
      </main>

      {/* Подвал */}
      <footer className="border-t border-[#1F1E1D]/10 py-6 text-center text-xs font-mono text-[#595652]">
        © 2026 Уроки Скоковой Юлии Павловны. Личный кабинет родителя.
      </footer>
    </div>
  );
}
