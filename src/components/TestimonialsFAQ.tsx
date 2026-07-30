'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronDown, MessageSquare, HelpCircle } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';

export const TestimonialsFAQ: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <section id="reviews" className="py-16 md:py-24 bg-white border-t-2 border-[#1F1E1D]/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-20">
        
        {/* Блок Отзывов */}
        <div className="space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C85A32]/10 text-[#C85A32] text-xs font-mono font-medium">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Отзывы родителей</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1F1E1D]">
              Что говорят о наших занятиях
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TEACHER_INFO.testimonials.map((review, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 bg-[#FAF8F5] rounded-2xl border-2 border-[#1F1E1D] hard-shadow flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-500" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-[#1F1E1D] leading-relaxed italic">
                    «{review.text}»
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#1F1E1D]/10">
                  <div className="font-bold text-sm text-[#1F1E1D]">{review.author}</div>
                  <div className="text-xs font-mono text-[#C85A32]">{review.grade}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Блок FAQ */}
        <div className="space-y-10 max-w-3xl mx-auto pt-8 border-t-2 border-[#1F1E1D]/10">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2E5A44]/10 text-[#2E5A44] text-xs font-mono font-medium">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Ответы на вопросы</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1F1E1D]">
              Частые вопросы родителей
            </h2>
          </div>

          <div className="space-y-4">
            {TEACHER_INFO.faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-[#FAF8F5] border-2 border-[#1F1E1D] rounded-xl hard-shadow overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#1F1E1D] cursor-pointer hover:text-[#C85A32] transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#C85A32]' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="px-5 pb-5 text-xs sm:text-sm text-[#595652] leading-relaxed border-t border-[#1F1E1D]/10 pt-3"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
