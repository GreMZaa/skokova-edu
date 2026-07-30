'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, User } from 'lucide-react';
import { TEACHER_INFO } from '@/data/teacherInfo';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  onOpenBooking: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBooking }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsAuthenticated(true);
      }
    } catch (e) {
      // Игнорируем в демо режиме
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#FAF8F5]/85 border-b-2 border-[#1F1E1D]/10 transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        
        {/* Логотип / Имя педагога */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#C85A32] text-white flex items-center justify-center font-bold text-[#FAF8F5] text-sm border-2 border-[#1F1E1D] hard-shadow sm:flex">
            СЮ
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight text-[#1F1E1D] leading-tight">
              {TEACHER_INFO.name}
            </h1>
            <div className="flex items-center gap-2 text-xs font-mono text-[#595652]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Открыта запись на уроки
            </div>
          </div>
        </div>

        {/* Навигация и кнопка вызова формы записи */}
        <div className="flex items-center gap-3 sm:gap-4">
          <a 
            href="#programs" 
            className="hidden md:inline-flex text-sm font-medium text-[#1F1E1D] hover:text-[#C85A32] transition-colors"
          >
            Программы
          </a>
          <a 
            href="#about" 
            className="hidden md:inline-flex text-sm font-medium text-[#1F1E1D] hover:text-[#C85A32] transition-colors"
          >
            О педагоге
          </a>

          {/* Ссылка в Кабинет Родителя */}
          <Link
            href={isAuthenticated ? '/my-dashboard' : '/login'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-[#1F1E1D]/20 bg-white hover:border-[#1F1E1D] text-xs font-mono font-bold text-[#1F1E1D] transition-colors"
          >
            <User className="w-4 h-4 text-[#C85A32]" />
            <span>{isAuthenticated ? 'Кабинет' : 'Войти'}</span>
          </Link>

          <button
            onClick={onOpenBooking}
            className="bg-[#C85A32] hover:bg-[#b04b27] text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2.5 rounded-lg border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center gap-2 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Записаться онлайн</span>
            <span className="sm:hidden">Запись</span>
          </button>
        </div>
      </div>
    </header>
  );
};
