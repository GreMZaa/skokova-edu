'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Check, Calendar, Sparkles, BookOpen, GraduationCap, Compass } from 'lucide-react';
import { SERVICES } from '@/data/services';

interface ProgramsBentoProps {
  onSelectService: (serviceTitle: string, price: number) => void;
}

export const ProgramsBento: React.FC<ProgramsBentoProps> = ({ onSelectService }) => {
  return (
    <section id="programs" className="py-16 md:py-24 bg-white border-y-2 border-[#1F1E1D]/10 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Заголовок секции */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C85A32]/10 text-[#C85A32] text-xs font-mono font-medium">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Направления и программы</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[#1F1E1D]">
            Программы онлайн-занятий
          </h2>
          <p className="text-base text-[#595652]">
            Каждая программа выстраивается под индивидуальные особенности вашего ребёнка. 
            Выберите подходищее направление и забронируйте удобное время в календаре.
          </p>
        </div>

        {/* Bento Grid карточки программ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {SERVICES.map((service, index) => {
            const isFeatured = service.category === 'preschool';

            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`flex flex-col justify-between p-6 sm:p-8 rounded-2xl border-2 border-[#1F1E1D] hard-shadow floating-card bg-[#FAF8F5] relative ${
                  isFeatured 
                    ? 'md:col-span-12 lg:col-span-6 bg-gradient-to-br from-[#FAF8F5] via-[#FFF9F5] to-[#F7EFE8] ring-2 ring-[#C85A32]' 
                    : 'md:col-span-6 lg:col-span-6'
                }`}
              >
                {/* Бейджик популяности */}
                {isFeatured && (
                  <div className="absolute -top-3.5 right-6 bg-[#C85A32] text-white text-xs font-mono font-bold px-3 py-1 rounded-full border border-[#1F1E1D] hard-shadow">
                    ★ Выбор большинства родителей
                  </div>
                )}

                <div className="space-y-6">
                  {/* Иконка и заголовок */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border-2 border-[#1F1E1D] flex items-center justify-center text-[#C85A32] hard-shadow shrink-0">
                      {service.category === 'diagnostic' && <Compass className="w-6 h-6" />}
                      {service.category === 'preschool' && <GraduationCap className="w-6 h-6" />}
                      {service.category === 'primary_school' && <BookOpen className="w-6 h-6" />}
                    </div>

                    <div className="text-right">
                      <div className="font-serif font-bold text-2xl text-[#1F1E1D]">
                        {service.price.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="flex items-center justify-end gap-1 text-xs text-[#595652] font-mono mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{service.duration_minutes} минут</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-xl text-[#1F1E1D]">
                      {service.title}
                    </h3>
                    <p className="text-sm text-[#595652] mt-2 leading-relaxed">
                      {service.description}
                    </p>
                  </div>

                  {/* Список особенностей */}
                  <div className="space-y-2 pt-2 border-t border-[#1F1E1D]/10">
                    <div className="text-xs font-mono text-[#595652] uppercase tracking-wider font-semibold">
                      Что входит в занятие:
                    </div>
                    <ul className="space-y-2">
                      {service.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5 text-xs text-[#1F1E1D]">
                          <span className="w-4 h-4 rounded-full bg-[#2E5A44]/15 text-[#2E5A44] flex items-center justify-center text-[10px] font-bold shrink-0">
                            ✓
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Кнопка записи на данную услугу */}
                <div className="pt-8">
                  <button
                    onClick={() => onSelectService(service.title, service.price)}
                    className="w-full bg-[#1F1E1D] hover:bg-[#C85A32] text-white text-sm font-semibold py-3.5 px-4 rounded-xl border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
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
