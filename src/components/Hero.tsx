'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Award, ArrowRight } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section className="relative pt-8 pb-14 sm:pt-12 sm:pb-20 md:pt-20 md:pb-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          
          {/* Левый текстовый блок */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-5 sm:space-y-6"
          >
            {/* Моноширинный бейдж */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-[#2E5A44]/10 text-[#2E5A44] border border-[#2E5A44]/20 text-[10px] sm:text-xs font-mono font-medium">
              <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Опыт работы более 30 лет</span>
            </div>

            {/* Заголовок Display Serif — адаптивный */}
            <h1 className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl font-serif font-bold text-[#1F1E1D] tracking-tight">
              Юлия Павловна{' '}
              <span className="block italic text-[#C85A32] font-normal text-xl sm:text-3xl mt-2">
                Эксперт по развитию и подготовке к школе
              </span>
            </h1>

            {/* Описание */}
            <p className="text-sm sm:text-base md:text-lg text-[#595652] leading-relaxed max-w-2xl">
              Без слез и нервов, подготовка к школе, начальные классы, математика, русский, литература. ВПР, ОГЭ, ЕГЭ, ГИА, мои отзывы от родителей говорят за себя больше
            </p>

            {/* Описание подхода */}
            <div className="p-3.5 sm:p-4 bg-[#2E5A44]/5 border border-[#2E5A44]/20 rounded-xl text-xs sm:text-sm text-[#2E5A44] leading-relaxed font-mono">
              Интерактивные онлайн-уроки с использованием нейропедагогического подхода для уверенного старта в школе.
            </div>

            {/* Быстрые фичи */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
              {[
                'Гибкое онлайн-расписание',
                'Диагностика перед стартом',
                'Оплата по СБП после выбора слота',
                'Поддержка родителю в Telegram',
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm text-[#1F1E1D] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C85A32] shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Кнопки */}
            <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <button
                onClick={onOpenBooking}
                className="bg-[#C85A32] hover:bg-[#b04b27] active:scale-[0.97] text-white text-sm sm:text-base font-semibold px-6 sm:px-7 py-3.5 sm:py-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow-lg hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2.5 sm:gap-3 cursor-pointer group"
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Выбрать время и записаться</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#programs"
                className="bg-white hover:bg-[#FAF8F5] active:scale-[0.97] text-[#1F1E1D] text-sm sm:text-base font-semibold px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center justify-center"
              >
                Смотреть программы
              </a>
            </div>
          </motion.div>

          {/* Правый Floating UI Блок карточки педагога */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 relative"
          >
            {/* Карточка педагога */}
            <div className="relative bg-white border-2 border-[#1F1E1D] rounded-2xl p-5 sm:p-6 md:p-8 hard-shadow-lg floating-card space-y-5 sm:space-y-6">
              
              {/* Верхняя панель */}
              <div className="flex items-center justify-between border-b-2 border-[#1F1E1D]/10 pb-3.5 sm:pb-4 gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#FAF8F5] border-2 border-[#1F1E1D] flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/avatar.png" alt="Скокова Юлия Павловна" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base sm:text-lg text-[#1F1E1D] leading-none truncate">
                      Юлия Павловна
                    </h3>
                    <p className="text-[10px] sm:text-xs text-[#595652] font-mono pt-0.5 sm:pt-1 truncate">
                      Педагог высшей категории
                    </p>
                  </div>
                </div>
              </div>

              {/* Метрики — адаптивная сетка */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="p-2.5 sm:p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-xl sm:text-2xl text-[#C85A32] leading-tight">
                    30+
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-[#595652] font-mono mt-0.5 sm:mt-1 leading-tight">
                    лет опыта
                  </div>
                </div>
                <div className="p-2.5 sm:p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-xl sm:text-2xl text-[#2E5A44] leading-tight">
                    500+
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-[#595652] font-mono mt-0.5 sm:mt-1 leading-tight">
                    учеников
                  </div>
                </div>
                <div className="p-2.5 sm:p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-xl sm:text-2xl text-[#1F1E1D] leading-tight">
                    100%
                  </div>
                  <div className="text-[9px] sm:text-[11px] text-[#595652] font-mono mt-0.5 sm:mt-1 leading-tight">
                    отзывов 5★
                  </div>
                </div>
              </div>

              {/* Статус */}
              <div className="bg-[#2E5A44]/10 border border-[#2E5A44]/30 rounded-xl p-3 sm:p-3.5 flex items-center gap-2 text-[11px] sm:text-xs">
                <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="text-[#2E5A44] font-medium leading-snug">
                  Доступно 5 свободных слотов на эту неделю
                </span>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
