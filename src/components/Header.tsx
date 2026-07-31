'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, User, Menu, X, BookOpen, UserCircle, MessageSquare, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEACHER_INFO } from '@/data/teacherInfo';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  onOpenBooking: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBooking }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkUserSession();
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

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

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const navLinks = [
    { href: '#programs', label: 'Программы', icon: BookOpen },
    { href: '#reviews', label: 'Отзывы', icon: MessageSquare },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#FAF8F5]/80 border-b-2 border-[#1F1E1D]/10 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Логотип / Имя педагога */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#C85A32] text-white flex items-center justify-center font-bold text-[#FAF8F5] text-xs sm:text-sm border-2 border-[#1F1E1D] hard-shadow shrink-0">
              СЮ
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg tracking-tight text-[#1F1E1D] leading-tight truncate">
                Скокова Юлия Павловна
              </h1>
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono text-[#595652]">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Открыта запись</span>
              </div>
            </div>
          </div>

          {/* Навигация и кнопки */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Desktop навигация */}
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className="hidden md:inline-flex text-sm font-medium text-[#1F1E1D] hover:text-[#C85A32] transition-colors"
              >
                {link.label}
              </a>
            ))}

            {/* Кабинет — desktop */}
            <Link
              href={isAuthenticated ? '/my-dashboard' : '/login'}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-[#1F1E1D]/20 bg-white hover:border-[#1F1E1D] text-xs font-mono font-bold text-[#1F1E1D] transition-colors"
            >
              <User className="w-4 h-4 text-[#C85A32]" />
              <span>{isAuthenticated ? 'Кабинет' : 'Войти'}</span>
            </Link>

            {/* CTA Записаться */}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="bg-[#C85A32] hover:bg-[#b04b27] active:scale-[0.97] text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border-2 border-[#1F1E1D] hard-shadow hover:translate-y-[-2px] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Записаться онлайн</span>
              <span className="sm:hidden">Запись</span>
            </button>

            {/* Hamburger menu — только мобайл */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border-2 border-[#1F1E1D]/20 bg-white hover:border-[#1F1E1D] text-[#1F1E1D] transition-all cursor-pointer active:scale-95"
              aria-label="Меню навигации"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isMobileMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-35 bg-[#1F1E1D]/30 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-16 left-0 right-0 z-35 bg-[#FAF8F5] border-b-2 border-[#1F1E1D]/15 shadow-lg md:hidden"
            >
              <div className="max-w-6xl mx-auto px-4 py-4 space-y-2">
                {/* Навигационные ссылки */}
                {navLinks.map((link, idx) => (
                  <motion.button
                    key={link.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.2 }}
                    onClick={() => handleNavClick(link.href)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white border-2 border-[#1F1E1D]/10 hover:border-[#C85A32] active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#C85A32]/10 flex items-center justify-center shrink-0">
                      <link.icon className="w-4 h-4 text-[#C85A32]" />
                    </div>
                    <span className="font-semibold text-sm text-[#1F1E1D]">{link.label}</span>
                    <ChevronRight className="w-4 h-4 text-[#595652]/50 ml-auto group-hover:text-[#C85A32] transition-colors" />
                  </motion.button>
                ))}

                {/* Кабинет — мобайл */}
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: navLinks.length * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={isAuthenticated ? '/my-dashboard' : '/login'}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-white border-2 border-[#1F1E1D]/10 hover:border-[#1F1E1D] active:scale-[0.98] transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#2E5A44]/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-[#2E5A44]" />
                    </div>
                    <span className="font-semibold text-sm text-[#1F1E1D]">
                      {isAuthenticated ? 'Личный кабинет' : 'Войти в кабинет'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#595652]/50 ml-auto group-hover:text-[#1F1E1D] transition-colors" />
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
