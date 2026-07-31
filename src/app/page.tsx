'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { ProgramsBento } from '@/components/ProgramsBento';
import { AboutTeacher } from '@/components/AboutTeacher';
import { TestimonialsFAQ } from '@/components/TestimonialsFAQ';
import { Footer } from '@/components/Footer';
import { BookingModal } from '@/components/BookingModal';

export default function Home() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState<string | undefined>(undefined);

  const handleOpenBooking = (serviceTitle?: string) => {
    if (serviceTitle) {
      setSelectedServiceTitle(serviceTitle);
    }
    setIsBookingOpen(true);
  };

  const handleCloseBooking = () => {
    setIsBookingOpen(false);
  };

  return (
    <main className="min-h-screen flex flex-col justify-between relative bg-[#FAF8F5]">
      
      {/* Навигационная шапка */}
      <Header onOpenBooking={() => handleOpenBooking()} />

      {/* Контент страницы */}
      <div className="flex-1">
        {/* Главный экран Hero */}
        <Hero onOpenBooking={() => handleOpenBooking()} />

        {/* Программы обучения в формате Bento Grid */}
        <ProgramsBento 
          onSelectService={(title) => handleOpenBooking(title)} 
        />

        {/* Отзывы */}
        <TestimonialsFAQ />
      </div>

      {/* Подвал */}
      <Footer />

      {/* Модальное окно пошаговой записи и оплаты */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={handleCloseBooking}
        initialServiceTitle={selectedServiceTitle}
      />

    </main>
  );
}
