'use client';

import React, { useState } from 'react';
import { Hero } from '@/components/Hero';
import { ProgramsBento } from '@/components/ProgramsBento';
import { BookingModal } from '@/components/BookingModal';

export default function TelegramWebAppPage() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState<string | undefined>(undefined);

  const handleOpenBooking = (serviceTitle?: string) => {
    if (serviceTitle) {
      setSelectedServiceTitle(serviceTitle);
    }
    setIsBookingOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1F1E1D] p-2 sm:p-4">
      {/* Шапка ТВА */}
      <div className="p-4 bg-white border-2 border-[#1F1E1D] rounded-xl hard-shadow mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-lg text-[#1F1E1D]">Юлия Владимировна</h1>
          <p className="text-xs font-mono text-[#595652]">Запись на онлайн-уроки из Telegram</p>
        </div>
        <button
          onClick={() => handleOpenBooking()}
          className="bg-[#C85A32] text-white text-xs font-bold px-3 py-2 rounded-lg border border-[#1F1E1D] hard-shadow"
        >
          Записаться
        </button>
      </div>

      <Hero onOpenBooking={() => handleOpenBooking()} />

      <ProgramsBento onSelectService={(title) => handleOpenBooking(title)} />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialServiceTitle={selectedServiceTitle}
      />
    </div>
  );
}
