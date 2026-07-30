'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Award, BookCheck, HeartHandshake, Sparkles, Brain, CheckCircle } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';

export const AboutTeacher: React.FC = () => {
  return (
    <section id="about" className="py-16 md:py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Левый блок: Методический подход */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E5A44]/10 text-[#2E5A44] text-xs font-mono font-medium">
              <Brain className="w-3.5 h-3.5" />
              <span>Педагогический подход</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1F1E1D] leading-tight">
              Обучение через интерес и поддержку ребёнка
            </h2>

            <p className="text-base text-[#595652] leading-relaxed">
              {TEACHER_INFO.bio}
            </p>

            {/* Карточки принципов */}
            <div className="space-y-4 pt-2">
              {TEACHER_INFO.methodology.map((method, idx) => (
                <div 
                  key={idx}
                  className="p-4 bg-white rounded-xl border-2 border-[#1F1E1D] hard-shadow flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#C85A32]/10 text-[#C85A32] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                    0{idx + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1F1E1D]">
                      {method.title}
                    </h3>
                    <p className="text-xs text-[#595652] mt-1 leading-relaxed">
                      {method.description}
                    </p>
                  </div>
                </div>
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
            <div className="bg-white border-2 border-[#1F1E1D] rounded-2xl p-6 sm:p-8 hard-shadow-lg space-y-6">
              
              <div className="flex items-center gap-3 border-b-2 border-[#1F1E1D]/10 pb-4">
                <Award className="w-6 h-6 text-[#C85A32]" />
                <h3 className="font-serif font-bold text-xl text-[#1F1E1D]">
                  Образование и квалификация
                </h3>
              </div>

              <div className="space-y-3">
                {TEACHER_INFO.education.map((edu, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-[#1F1E1D]">
                    <CheckCircle className="w-4 h-4 text-[#2E5A44] shrink-0 mt-0.5" />
                    <span>{edu}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#1F1E1D]/20 space-y-2">
                <div className="font-mono text-xs font-bold text-[#595652] uppercase">
                  Гарантии эффективности:
                </div>
                <p className="text-xs text-[#595652] leading-relaxed">
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
