'use client';

import React from 'react';
import { TEACHER_INFO } from '@/data/teacherInfo';
import { Send, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  const handleTelegramClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Пробуем открыть напрямую в установленном приложении Telegram (без блока .me)
    try {
      window.location.href = 'tg://user?id=510510041';
    } catch (err) {
      console.log('Native Telegram app link fallback');
    }
  };

  return (
    <footer className="bg-[#1F1E1D] text-[#FAF8F5] py-8 sm:py-12 border-t-4 border-[#C85A32] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 sm:space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-8 items-center justify-between pb-6 sm:pb-8 border-b border-white/10">
          
          <div className="md:col-span-6 space-y-1.5 sm:space-y-2 text-center md:text-left">
            <h3 className="font-serif font-bold text-xl sm:text-2xl text-white">
              {TEACHER_INFO.name}
            </h3>
          </div>

          <div className="md:col-span-6 flex flex-wrap items-center justify-center md:justify-end gap-3 sm:gap-4">
            <a
              href="tg://user?id=510510041"
              target="_blank"
              rel="noreferrer"
              onClick={handleTelegramClick}
              className="bg-[#2E5A44] hover:bg-[#234634] active:scale-[0.97] text-white text-xs font-semibold px-4 py-2.5 rounded-lg border border-white/20 flex items-center gap-2 transition-all cursor-pointer hard-shadow w-full sm:w-auto justify-center"
            >
              <Send className="w-4 h-4" />
              <span>Написать в Telegram</span>
            </a>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-[10px] sm:text-xs text-white/50 font-mono">
          <div className="text-center sm:text-left">
            © 2026 {TEACHER_INFO.name}. Все права защищены.
          </div>
          <div className="flex items-center gap-1">
            <span>С заботой о детях и результатах</span>
            <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#C85A32] fill-[#C85A32]" />
          </div>
        </div>

      </div>
    </footer>
  );
};
