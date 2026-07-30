'use client';

import React from 'react';
import { Calendar, Clock, CheckCircle2, Video, ArrowLeft, Heart } from 'lucide-react';
import Link from 'next/link';

export default function MyBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-xl w-full bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 sm:p-8 hard-shadow-lg space-y-6">
        
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-100 border-2 border-[#1F1E1D] text-emerald-600 flex items-center justify-center mx-auto hard-shadow">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="font-serif font-bold text-2xl text-[#1F1E1D]">
            Личный кабинет записи #{resolvedParams.id}
          </h1>
          <p className="text-xs font-mono text-[#595652]">
            Статус: <span className="text-emerald-700 font-bold">Подтверждено педагогом</span>
          </p>
        </div>

        <div className="p-4 bg-[#FAF8F5] border-2 border-[#1F1E1D]/20 rounded-xl space-y-3 text-xs sm:text-sm">
          <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-2">
            <span className="font-mono text-[#595652]">Программа:</span>
            <span className="font-bold text-[#1F1E1D]">Подготовка к школе (5–7 лет)</span>
          </div>

          <div className="flex items-center justify-between border-b border-[#1F1E1D]/10 pb-2">
            <span className="font-mono text-[#595652]">Дата и время:</span>
            <span className="font-bold text-[#C85A32]">Пн, 3 августа в 16:00</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[#595652]">Формат проведения:</span>
            <span className="font-bold text-[#1F1E1D]">Онлайн (Zoom / Яндекс Телемост)</span>
          </div>
        </div>

        {/* Ссылка на подключение к уроку */}
        <div className="p-4 bg-emerald-50 border-2 border-emerald-700/30 rounded-xl text-center space-y-2">
          <div className="text-xs font-mono font-bold text-emerald-900 uppercase">
            Ссылка на видеоконференцию урока:
          </div>
          <a
            href="https://telemost.yandex.ru"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#2E5A44] hover:bg-[#234634] text-white text-xs font-semibold rounded-lg border border-[#1F1E1D] hard-shadow"
          >
            <Video className="w-4 h-4" />
            <span>Подключиться к уроку</span>
          </a>
        </div>

        <div className="pt-2 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#595652] hover:text-[#C85A32] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Вернуться на главную страницу</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
