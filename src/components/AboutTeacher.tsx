'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, Brain, CheckCircle } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';

export const AboutTeacher: React.FC = () => {
  return (
    <section id="about" className="py-12 sm:py-16 md:py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 items-start lg:items-center">
          
          {/* Левый блок: Методический подход */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-5 sm:space-y-6"
          >
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-[#2E5A44]/10 text-[#2E5A44] text-[10px] sm:text-xs font-mono font-medium">
              <Brain className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Педагогический подход</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#1F1E1D] leading-tight">
              Обучение через интерес и поддержку ребёнка
            </h2>

            <p className="text-sm sm:text-base text-[#595652] leading-relaxed">
              {TEACHER_INFO.bio}
            </p>

            {/* Карточки принципов */}
            <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
              {TEACHER_INFO.methodology.map((method, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="p-3.5 sm:p-4 bg-white rounded-xl border-2 border-[#1F1E1D] hard-shadow flex items-start gap-3 sm:gap-4"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 mt-0.5">
                    0{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-[#1F1E1D]">
                      {method.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#595652] mt-0.5 sm:mt-1 leading-relaxed">
                      {method.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

          </motion.div>

          {/* Правый блок: Дипломы и факты */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-5 sm:p-6 md:p-8 hard-shadow-lg space-y-5 sm:space-y-6">
              
              <div className="flex items-center gap-2.5 sm:gap-3 border-b-2 border-[#1F1E1D]/10 pb-3.5 sm:pb-4">
                <Award className="w-5 h-5 sm:w-6 sm:h-6 text-[#C85A32] shrink-0" />
                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#1F1E1D]">
                  Образование и квалификация
                </h3>
              </div>

              <div className="space-y-2.5 sm:space-y-3">
                {TEACHER_INFO.education.map((edu, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 sm:gap-3 text-[11px] sm:text-xs md:text-sm text-[#1F1E1D]">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2E5A44] shrink-0 mt-0.5" />
                    <span className="leading-snug">{edu}</span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 sm:p-4 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20 space-y-1.5 sm:space-y-2">
                <div className="font-mono text-[10px] sm:text-xs font-bold text-[#595652] uppercase">
                  Гарантии эффективности:
                </div>
                <p className="text-[11px] sm:text-xs text-[#595652] leading-relaxed">
                  Все занятия строятся по государственной программе ФГОС НОО с индивидуальной адаптацией под школьную программу вашей гимназии или школы.
                </p>
              </div>

            </div>
          </motion.div>

        </div>

      </div>
    </section>
  );
};
