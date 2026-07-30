import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const displaySerif = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
});

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const monoFont = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#FAF8F5',
};

export const metadata: Metadata = {
  title: 'Скокова Юлия Павловна | Подготовка к школе & Репетитор 1-4 классов',
  description: 'Частный педагог высшей категории. Индивидуальные онлайн-уроки по подготовке к 1 классу и предметам начальной школы. Запись онлайн.',
  openGraph: {
    title: 'Скокова Юлия Павловна — Педагог начальных классов',
    description: 'Индивидуальные онлайн-уроки и подготовка к школе без слёз и стресса.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${displaySerif.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="antialiased bg-[#FAF8F5] text-[#1F1E1D] selection:bg-[#C85A32] selection:text-white relative">
        <div className="fixed inset-0 pointer-events-none z-30 bg-noise opacity-40" />
        {children}
      </body>
    </html>
  );
}
