'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Calendar, BookOpen, GraduationCap, Compass } from 'lucide-react';
import { SERVICES } from '@/data/services';

interface ProgramsBentoProps {
  onSelectService: (serviceTitle: string, price: number) => void;
}

export const ProgramsBento: React.FC<ProgramsBentoProps> = ({ onSelectService }) => {
  return (
    <section id="programs" className="py-12 sm:py-16 md:py-24 bg-white border-y-2 border-[#1F1E1D]/10 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Заголовок секции */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16 space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-[#C85A32]/10 text-[#C85A32] text-[10px] sm:text-xs font-mono font-medium">
            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Направления и программы</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-[#1F1E1D]">
            Программы онлайн-занятий
          </h2>
          <p className="text-sm sm:text-base text-[#595652] leading-relaxed px-2 sm:px-0">
            Каждая программа выстраивается под индивидуальные особенности вашего ребёнка. 
            Выберите подходищее направление и забронируйте удобное время в календаре.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 md:gap-8">
          {SERVICES.map((service, index) => {
            const isFeatured = service.category === 'preschool';

            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col justify-between p-5 sm:p-6 md:p-8 rounded-2xl border-2 border-[#1F1E1D] hard-shadow floating-card bg-[#FAF8F5] relative ${
                  isFeatured 
                    ? 'md:col-span-12 lg:col-span-6 bg-gradient-to-br from-[#FAF8F5] via-[#FFF9F5] to-[#F7EFE8] ring-2 ring-[#C85A32]' 
                    : 'md:col-span-6 lg:col-span-6'
                }`}
              >
                {/* Бейджик */}
                {isFeatured && (
                  <div className="absolute -top-3 sm:-top-3.5 right-4 sm:right-6 bg-[#C85A32] text-white text-[10px] sm:text-xs font-mono font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-[#1F1E1D] hard-shadow">
                    ★ Выбор родителей
                  </div>
                )}

                <div className="space-y-4 sm:space-y-6">
                  {/* Иконка и заголовок */}
                  <div className="flex items-start justify-between gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white border-2 border-[#1F1E1D] flex items-center justify-center text-[#C85A32] hard-shadow shrink-0">
                      {service.category === 'diagnostic' && <Compass className="w-5 h-5 sm:w-6 sm:h-6" />}
                      {service.category === 'preschool' && <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />}
                      {service.category === 'primary_school' && <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />}
                    </div>

                    <div className="text-right">
                      <div className="font-serif font-bold text-xl sm:text-2xl text-[#1F1E1D]">
                        {service.price.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] sm:text-xs text-[#595652] font-mono mt-0.5">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>{service.duration_minutes} минут</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-[#1F1E1D]">
                      {service.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#595652] mt-1.5 sm:mt-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Список особенностей */}
                  <div className="space-y-2 pt-2 border-t border-[#1F1E1D]/10">
                    <div className="text-[10px] sm:text-xs font-mono text-[#595652] uppercase tracking-wider font-semibold">
                      Что входит в занятие:
                    </div>
                    <ul className="space-y-1.5 sm:space-y-2">
                      {service.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs text-[#1F1E1D]">
                          <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#2E5A44]/15 text-[#2E5A44] flex items-center justify-center text-[8px] sm:text-[10px] font-bold shrink-0">
                            ✓
                          </span>
                          <span className="leading-snug">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Кнопка записи */}
                <div className="pt-6 sm:pt-8">
                  <button
                    onClick={() => onSelectService(service.title, service.price)}
                    className="w-full bg-[#1F1E1D] hover:bg-[#C85A32] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold py-3 sm:py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Записаться на этот урок</span>
                  </button>
                </div>

              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
