'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Award, Users, BookOpen, ArrowRight } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Левый текстовый блок */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            {/* Моноширинный бейдж */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2E5A44]/10 text-[#2E5A44] border border-[#2E5A44]/20 text-xs font-mono font-medium">
              <Award className="w-3.5 h-3.5" />
              <span>Опыт более {TEACHER_INFO.experience_years} лет • Высшая категория</span>
            </div>

            {/* Акцидентный типографический заголовок Display Serif */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-[#1F1E1D] leading-[1.1] tracking-tight">
              Индивидуальное обучение <br />
              <span className="italic text-[#C85A32] font-normal">без слёз и стресса</span>
            </h1>

            {/* Описание */}
            <p className="text-base sm:text-lg text-[#595652] leading-relaxed max-w-2xl">
              Подготовка к 1 классу и репетиторство для учеников 1–4 классов. 
              Интерактивные онлайн-уроки с использованием нейропедагогического подхода для уверенного старта в школе.
            </p>

            {/* Быстрые фичи */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2.5 text-sm text-[#1F1E1D] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>Гибкое онлайн-расписание</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#1F1E1D] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>Диагностика перед стартом</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#1F1E1D] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>Оплата по СБП после выбора слота</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[#1F1E1D] font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>Поддержка родителю в Telegram</span>
              </div>
            </div>

            {/* CTA Кнопки */}
            <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                onClick={onOpenBooking}
                className="bg-[#C85A32] hover:bg-[#b04b27] text-white text-base font-semibold px-7 py-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow-lg hover:translate-y-[-2px] transition-all flex items-center justify-center gap-3 cursor-pointer group"
              >
                <Calendar className="w-5 h-5" />
                <span>Выбрать время и записаться</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <a
                href="#programs"
                className="bg-white hover:bg-[#FAF8F5] text-[#1F1E1D] text-base font-semibold px-6 py-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center justify-center"
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
            {/* Декоративная рамка Neo-Brutalism */}
            <div className="relative bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 sm:p-8 hard-shadow-lg floating-card space-y-6">
              
              {/* Верхняя панель карточки */}
              <div className="flex items-center justify-between border-b-2 border-[#1F1E1D]/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FAF8F5] border-2 border-[#1F1E1D] flex items-center justify-center font-bold text-[#C85A32] text-xl">
                    👩‍🏫
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#1F1E1D] leading-none">
                      {TEACHER_INFO.name}
                    </h3>
                    <p className="text-xs text-[#595652] font-mono pt-1">
                      Педагог дошкольного & начального образования
                    </p>
                  </div>
                </div>
              </div>

              {/* Метрики */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-2xl text-[#C85A32]">
                    {TEACHER_INFO.experience_years} лет
                  </div>
                  <div className="text-[11px] text-[#595652] font-mono mt-1">Опыт работы</div>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-2xl text-[#2E5A44]">
                    {TEACHER_INFO.students_count}
                  </div>
                  <div className="text-[11px] text-[#595652] font-mono mt-1">Учеников</div>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20">
                  <div className="font-serif font-bold text-2xl text-[#1F1E1D]">
                    {TEACHER_INFO.satisfaction_rate}
                  </div>
                  <div className="text-[11px] text-[#595652] font-mono mt-1">Отзывов на 5★</div>
                </div>
              </div>

              {/* Образование */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[#595652]">
                  Квалификация и образование:
                </h4>
                <ul className="space-y-1.5 text-xs text-[#1F1E1D]">
                  {TEACHER_INFO.education.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-[#C85A32] font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Интерактивная плашка статуса */}
              <div className="bg-[#2E5A44]/10 border border-[#2E5A44]/30 rounded-xl p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-[#2E5A44] font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Доступно 5 свободных слотов на эту неделю</span>
                </div>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
