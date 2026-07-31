'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ProgramsBento } from '@/components/ProgramsBento';
import { TestimonialsFAQ } from '@/components/TestimonialsFAQ';
import { Footer } from '@/components/Footer';
import { BookingModal } from '@/components/BookingModal';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export default function TelegramWebAppPage() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState<string | undefined>(undefined);
  const [tgUser, setTgUser] = useState<{ id?: number; first_name?: string; username?: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();

      // Отключаем жесты вертикального свайпа для закрытия/скрытия Mini App при скролле
      if (typeof tg.disableVerticalSwipes === 'function') {
        tg.disableVerticalSwipes();
      } else {
        tg.isVerticalSwipesEnabled = false;
      }

      // Включаем подтверждение закрытия для предотвращения случайного свайпа
      if (typeof tg.enableClosingConfirmation === 'function') {
        tg.enableClosingConfirmation();
      }
      
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user);
      }
    }
  }, []);

  const handleOpenBooking = (serviceTitle?: string) => {
    if (serviceTitle) {
      setSelectedServiceTitle(serviceTitle);
    }
    setIsBookingOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] flex flex-col justify-between selection:bg-[#C85A32] selection:text-white">
      {/* Шапка навигации Mini App */}
      <Header onOpenBooking={() => handleOpenBooking()} />

      {/* Быстрый баннер приветствия для Telegram Mini App */}
      {tgUser && (
        <div className="max-w-6xl mx-auto px-4 pt-4 w-full">
          <div className="bg-[#2E5A44]/10 border-2 border-[#2E5A44]/30 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 hard-shadow text-xs sm:text-sm font-medium text-[#2E5A44]">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>
                Приветствуем, <strong>{tgUser.first_name || 'гость'}</strong>! Вы вошли через Telegram Mini App.
              </span>
            </div>
            <button
              onClick={() => handleOpenBooking()}
              className="bg-[#2E5A44] hover:bg-[#234635] text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-[#1F1E1D] hard-shadow shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Записаться</span>
            </button>
          </div>
        </div>
      )}

      {/* Главный блок Hero */}
      <Hero onOpenBooking={() => handleOpenBooking()} />

      {/* Программы в формате Bento Grid */}
      <ProgramsBento onSelectService={(title) => handleOpenBooking(title)} />

      {/* Отзывы родителей */}
      <TestimonialsFAQ />

      {/* Подвал сайта */}
      <Footer />

      {/* Модальное окно записи */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialServiceTitle={selectedServiceTitle}
      />
    </div>
  );
}
