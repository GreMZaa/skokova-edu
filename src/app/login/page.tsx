'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Lock, Mail, User, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

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
        // Регистрация нового родителя
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        setSuccessMsg('Успешная регистрация! Выполняется вход...');
        setTimeout(() => {
          router.push('/my-dashboard');
          router.refresh();
        }, 1200);
      } else {
        // Вход существующего родителя
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setSuccessMsg('Успешный вход! Переход в кабинет...');
        setTimeout(() => {
          router.push('/my-dashboard');
          router.refresh();
        }, 1000);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(err.message || 'Ошибка авторизации. Проверьте данные и повторите попытку.');
    } finally {
      setLoading(false);
    }
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
            <span>{isRegister ? 'Регистрация родителя' : 'Кабинет родителя'}</span>
          </div>

          <h1 className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1F1E1D] mb-2">
            {isRegister ? 'Создать аккаунт семьи' : 'Вход в личный кабинет'}
          </h1>
          <p className="text-xs sm:text-sm text-[#595652] mb-6">
            {isRegister
              ? 'Зарегистрируйтесь, чтобы отслеживать уроки ребёнка и подключаться к видеосвязи'
              : 'Введите ваши данные для доступа к истории занятий и ссылкам на уроки'}
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
            <div className="mb-4 p-3.5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50 text-emerald-800 text-xs font-medium flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Форма */}
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
                  placeholder="Например, Анна Сергеевна"
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
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase text-[#595652] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#C85A32]" />
                <span>Пароль *</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#1F1E1D]/20 bg-[#FAF8F5] text-sm text-[#1F1E1D] font-medium focus:border-[#1F1E1D] focus:outline-none transition-colors"
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
                  <span>Подождите...</span>
                </>
              ) : (
                <span>{isRegister ? 'Зарегистрироваться' : 'Войти в кабинет'}</span>
              )}
            </button>
          </form>

          {/* Переключатель Вход / Регистрация */}
          <div className="mt-6 pt-6 border-t border-[#1F1E1D]/10 text-center">
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
